import { prediction } from "@/lib/bench/answers";
import { maxSustainableRate } from "@/lib/bench/metrics";
import type { BenchResult } from "@/lib/bench/server";
import { chatMessages, type ChatMessage } from "@/lib/data/chat";
import { addHistory } from "@/lib/history";
import {
  CONCURRENCY,
  describeBreak,
  emptyReport,
  exampleFrom,
  liveP95,
  measuredRate,
  mustBlock,
  poissonWaitMs,
  pushTrail,
  queueCap,
  RAMP_MS,
  RATE_KEYS,
  SATURATED_P95_MS,
  SATURATED_QUEUE,
  SETTLE_MS,
  sleep,
  snapshotWindow,
  targetRate,
  visibleLines,
  WINDOW_MS,
  windowFailed,
  type ChatLine,
  type ErrorKind,
  type LiveStats,
  type Pilot,
  type Report,
} from "./model";

type Task = { uid: string; item: ChatMessage; at: number; window: number };

type StreamHooks = {
  onUpdate: (state: { live: LiveStats; lines: ChatLine[]; currentId: string | null }) => void;
  onReport: (report: Report) => void;
  onError: (message: string) => void;
};

const CATCH_UP_CAP = 250;

export class ChatStream {
  private readonly controller = new AbortController();
  private readonly queue: Task[] = [];
  private waiting: Task[] = [];
  private readonly seen = new Set<string>();
  private readonly lines = new Map<string, ChatLine>();
  private readonly arrivalAt: number[] = [];
  private readonly report = emptyReport();
  private readonly windowLatencies = RATE_KEYS.map(() => [] as number[]);
  private readonly windowDrops = RATE_KEYS.map(() => 0);
  private readonly windowStarted = RATE_KEYS.map(() => false);
  private readonly finalized = RATE_KEYS.map(() => false);
  private active = 0;
  private origin = 0;
  private perfOrigin = 0;
  private rate = 1;
  private saturated = false;
  private flushTimer = 0;
  private pending: { target: number; current: string | null; now: number } | null = null;
  readonly signal = this.controller.signal;

  constructor(private readonly pilot: Pilot, private readonly hooks: StreamHooks) {}

  abort() { this.controller.abort(); }

  moderate(flag: boolean, at: number) {
    if (this.pilot !== "human") return;
    const task = this.queue[0];
    if (!task) return;
    this.finish(task, flag, at);
    this.ping(this.rate, this.queue[0]?.uid ?? null, at);
  }

  async start() {
    try {
      const origin = Date.now();
      this.origin = origin;
      this.perfOrigin = performance.now();
      let sequence = 0;
      let nextAt = 0;
      let lastTrail = 0;
      this.rate = RATE_KEYS[0];
      this.ping(this.rate, null, performance.now());

      while (!this.controller.signal.aborted && Date.now() - origin < RAMP_MS) {
        const elapsed = Date.now() - origin;
        this.rate = targetRate(elapsed);
        this.finalizeDue(elapsed);
        const window = Math.min(RATE_KEYS.length - 1, Math.floor(elapsed / WINDOW_MS));
        this.windowStarted[window] = true;
        let emitted = 0;
        while (nextAt <= elapsed && !this.controller.signal.aborted) {
          if (emitted >= CATCH_UP_CAP) {
            this.arrive(nextAt, this.rate, window, sequence++, true);
            nextAt += poissonWaitMs(this.rate);
            continue;
          }
          this.arrive(nextAt, this.rate, window, sequence++, false);
          nextAt += poissonWaitMs(this.rate);
          emitted++;
        }
        if (this.pilot !== "human") this.drain();
        const t = performance.now();
        this.saturated = this.waiting.length > SATURATED_QUEUE || liveP95(this.report.latencyEvents, t) > SATURATED_P95_MS;
        if (t - lastTrail > 180) {
          pushTrail(this.report.queueTrail, this.waiting.length);
          pushTrail(this.report.p95Trail, liveP95(this.report.latencyEvents, t));
          lastTrail = t;
        }
        this.ping(this.rate, this.queue[0]?.uid ?? this.waiting[0]?.uid ?? null, t);
        await sleep(16, this.controller.signal);
      }

      if (!this.controller.signal.aborted) {
        const settleStart = Date.now();
        while (!this.controller.signal.aborted && (this.queue.length || this.active) && Date.now() - settleStart < SETTLE_MS) {
          if (this.pilot !== "human") this.drain();
          this.finalizeDue(Date.now() - origin);
          const t = performance.now();
          this.ping(this.rate, this.queue[0]?.uid ?? this.waiting[0]?.uid ?? null, t);
          await sleep(50, this.controller.signal);
        }
      }

      const stopped = this.controller.signal.aborted;
      if (!stopped) {
        for (let index = 0; index < RATE_KEYS.length; index++) {
          if (this.windowStarted[index] && !this.finalized[index]) this.finalizeWindow(index);
        }
        for (const task of [...this.waiting]) this.drop(task);
        this.hooks.onReport(cloneReport(this.report));
        addHistory({
          kind: "chat",
          label: `Chat / ${this.pilot}`,
          detail: `${maxSustainableRate(this.report.windows)} msg/s · ${this.report.arrived} llegados · ${this.report.completed} moderados · ${this.report.dropped} perdidos`,
        });
      } else {
        for (const task of [...this.waiting]) {
          if (this.seen.has(task.uid)) continue;
          this.seen.add(task.uid);
          this.patch(task.uid, { status: "missed", late: true });
        }
      }
      this.ping(this.rate, null, performance.now());
    } catch (cause) {
      this.hooks.onError(cause instanceof Error ? cause.message : "Error en el stream.");
    } finally {
      this.controller.abort();
      this.queue.length = 0;
      this.waiting = [];
      this.ping(this.rate, null, performance.now());
    }
  }

  private finalizeDue(elapsed: number) {
    for (let index = 0; index < RATE_KEYS.length; index++) {
      if (this.finalized[index] || !this.windowStarted[index]) continue;
      if (elapsed < (index + 1) * WINDOW_MS + SETTLE_MS) continue;
      this.finalizeWindow(index);
    }
  }

  private finalizeWindow(index: number) {
    if (this.finalized[index]) return;
    this.finalized[index] = true;
    for (const task of this.waiting.filter(entry => entry.window === index)) this.drop(task);
    const sample = snapshotWindow(RATE_KEYS[index], this.windowLatencies[index], 0, this.windowDrops[index]);
    this.report.windows.push(sample);
    if (windowFailed(sample) && !this.report.broke) {
      this.report.broke = describeBreak(sample);
      this.lines.set(`break-${sample.rate}`, {
        uid: `break-${sample.rate}`,
        item: chatMessages[0],
        at: performance.now(),
        status: "break",
        late: false,
        marker: this.report.broke,
      });
    }
    this.hooks.onReport(cloneReport(this.report));
  }

  private ping(target: number, current: string | null, t: number) {
    this.pending = { target, current, now: t };
    if (this.flushTimer) return;
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = 0;
      const job = this.pending;
      this.pending = null;
      if (!job) return;
      const elapsed = this.origin ? Date.now() - this.origin : 0;
      this.hooks.onUpdate({
        live: {
          rate: measuredRate(this.arrivalAt, elapsed),
          targetRate: job.target,
          elapsedMs: elapsed,
          pending: this.waiting.length,
          arrived: this.report.arrived,
          completed: this.report.completed,
          dropped: this.report.dropped,
          correct: this.report.correct,
          falseBlocks: this.report.falseBlocks,
          slipped: this.report.slipped,
          p95Ms: liveP95(this.report.latencyEvents, job.now),
          p95Trail: [...this.report.p95Trail],
          queueTrail: [...this.report.queueTrail],
          broke: this.report.broke,
          saturated: this.saturated,
        },
        lines: visibleLines(this.lines, job.now),
        currentId: job.current,
      });
    }, 40);
  }

  private patch(uid: string, update: Partial<ChatLine>) {
    const prev = this.lines.get(uid);
    if (!prev) return;
    this.lines.set(uid, { ...prev, ...update });
  }

  private remember(item: ChatMessage, kind: ErrorKind) {
    if (this.report.errors.length < 24) this.report.errors.push(exampleFrom(item, kind));
  }

  private bumpDrop(window: number, item: ChatMessage, kind: ErrorKind) {
    this.report.dropped++;
    if (window >= 0 && window < this.windowDrops.length) this.windowDrops[window]++;
    this.remember(item, kind);
  }

  private finish(task: Task, blocked: boolean, endedAt: number) {
    if (this.seen.has(task.uid)) return;
    this.seen.add(task.uid);
    this.waiting = this.waiting.filter(entry => entry.uid !== task.uid);
    const qi = this.queue.findIndex(entry => entry.uid === task.uid);
    if (qi >= 0) this.queue.splice(qi, 1);
    const truth = mustBlock(task.item);
    const correct = blocked === truth;
    this.report.completed++;
    if (correct) this.report.correct++;
    else if (blocked) {
      this.report.falseBlocks++;
      this.remember(task.item, "false_block");
    } else {
      this.report.slipped++;
      this.remember(task.item, "slipped");
    }
    const ms = endedAt - task.at;
    this.report.latencies.push(ms);
    this.report.latencyEvents.push({ at: endedAt, ms });
    if (task.window >= 0 && task.window < this.windowLatencies.length) this.windowLatencies[task.window].push(ms);
    this.patch(task.uid, { status: blocked ? "removed" : "approved", late: false, verdict: { blocked, correct } });
  }

  private drop(task: Task) {
    if (this.seen.has(task.uid)) return;
    this.seen.add(task.uid);
    this.waiting = this.waiting.filter(entry => entry.uid !== task.uid);
    const qi = this.queue.findIndex(entry => entry.uid === task.uid);
    if (qi >= 0) this.queue.splice(qi, 1);
    this.bumpDrop(task.window, task.item, "missed");
    this.patch(task.uid, { status: "missed", late: true });
  }

  private arrive(atMs: number, rate: number, window: number, sequence: number, countOnly: boolean) {
    const item = chatMessages[sequence % chatMessages.length];
    this.report.arrived++;
    this.arrivalAt.push(atMs);
    this.windowStarted[window] = true;
    const arrivedAt = this.perfOrigin + atMs;
    if (countOnly || this.waiting.length >= queueCap(rate)) {
      if (!countOnly) {
        const uid = `${sequence}-${item.id}-${Math.round(atMs)}`;
        this.lines.set(uid, { uid, item, at: arrivedAt, status: "missed", late: true });
      }
      this.bumpDrop(window, item, "missed");
      return;
    }
    const uid = `${sequence}-${item.id}-${Math.round(atMs)}`;
    const task: Task = { uid, item, at: arrivedAt, window };
    this.lines.set(uid, { uid, item, at: arrivedAt, status: "pending", late: false });
    this.queue.push(task);
    this.waiting.push(task);
  }

  private drain() {
    const limit = CONCURRENCY[this.pilot];
    while (!this.controller.signal.aborted && this.pilot !== "human" && this.active < limit && this.queue.length) {
      const task = this.queue.shift()!;
      this.active++;
      void fetch(`/api/decide/chat/${this.pilot}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId: task.item.id }),
        signal: this.controller.signal,
      }).then(async response => {
        const result = await response.json() as BenchResult;
        if (!result.ok) throw new Error(result.error);
        if (this.controller.signal.aborted || this.seen.has(task.uid)) return;
        const toxic = prediction(result.answers.toxic)?.value === true;
        const spam = prediction(result.answers.spam)?.value === true;
        this.report.costUsd += result.usage.costUsd;
        this.finish(task, toxic || spam, performance.now());
      }).catch(cause => {
        if (this.controller.signal.aborted) return;
        this.drop(task);
        this.hooks.onError(cause instanceof Error ? cause.message : "Error de moderación.");
      }).finally(() => { this.active--; this.drain(); });
    }
  }
}

function cloneReport(report: Report): Report {
  return {
    ...report,
    windows: [...report.windows],
    latencies: [...report.latencies],
    latencyEvents: [...report.latencyEvents],
    errors: [...report.errors],
    p95Trail: [...report.p95Trail],
    queueTrail: [...report.queueTrail],
    broke: report.broke,
  };
}
