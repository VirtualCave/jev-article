export const W = 288, H = 512, GROUND = 112, PLAY_H = H - GROUND;
const FIXED = 1 / 120;
export type Pilot = "human" | "laya" | "jev";
export type Facts = { bird_y: number; aim_y: number; gap_y: number; vy: number; pipe_dx: number };
export type Pipe = { id: number; x: number; w: number; top: number; gap: number; scored: boolean };
export type Decision = { action: "flap" | "glide"; reason: string; latencyMs: number; rttMs: number; state: string; probabilities: Record<string, number> };
export type FlappyMatch = { n: number; tokens: number; costUsd: number; latencies: number[]; log: Decision[]; elapsed: number; flaps: number };

export class FlappyEngine {
  bird = { x: 68, y: 230, r: 12, vy: 0 };
  pipes: Pipe[] = [];
  score = 0;
  status: "ready" | "running" | "dying" | "dead" = "ready";
  scroll = 0;
  pilot: Pilot = "human";
  match: FlappyMatch = { n: 0, tokens: 0, costUsd: 0, latencies: [], log: [], elapsed: 0, flaps: 0 };
  private accumulator = 0;
  private pipeId = 0;

  constructor(private random: () => number = Math.random) {}

  start(pilot: Pilot) {
    this.pilot = pilot;
    this.bird = { x: 68, y: 230, r: 12, vy: 0 };
    this.pipes = []; this.score = 0; this.scroll = 0; this.accumulator = 0;
    this.match = { n: 0, tokens: 0, costUsd: 0, latencies: [], log: [], elapsed: 0, flaps: 0 };
    const first = pilot === "human" ? W + 40 : W + 110;
    this.spawnPipe(first); this.spawnPipe(first + 168);
    this.status = "running";
  }

  flap() {
    if (this.status !== "running") return;
    this.bird.vy = -265;
    this.match.flaps++;
  }

  nextPipe() { return this.pipes.find(pipe => pipe.x + pipe.w > this.bird.x - 6) || this.pipes.at(-1); }

  facts(): Facts {
    const pipe = this.nextPipe() || { top: PLAY_H / 2 - 59, gap: 118, x: W };
    const y = this.bird.y / PLAY_H;
    return { bird_y: y, aim_y: Math.max(.02, Math.min(.98, y)), gap_y: (pipe.top + pipe.gap / 2) / PLAY_H, vy: Math.max(-1, Math.min(1, this.bird.vy / 520)), pipe_dx: (pipe.x - this.bird.x) / W };
  }

  step(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.accumulator = Math.min(.1, this.accumulator + dt);
    while (this.accumulator + 1e-9 >= FIXED) { this.tick(FIXED); this.accumulator -= FIXED; }
  }

  private spawnPipe(x: number) {
    const gap = 118, minY = 50, maxY = PLAY_H - 50 - gap;
    this.pipes.push({ id: this.pipeId++, x, w: 52, top: minY + this.random() * Math.max(8, maxY - minY), gap, scored: false });
  }

  private tick(dt: number) {
    if (this.status === "ready" || this.status === "dead") return;
    if (this.status === "dying") {
      this.bird.vy = Math.min(620, this.bird.vy + 920 * dt);
      this.bird.y += this.bird.vy * dt;
      if (this.bird.y + this.bird.r >= PLAY_H) { this.bird.y = PLAY_H - this.bird.r; this.status = "dead"; }
      return;
    }
    this.bird.vy = Math.min(480, this.bird.vy + 920 * dt);
    this.bird.y += this.bird.vy * dt;
    this.scroll += 120 * dt;
    this.match.elapsed += dt;
    for (const pipe of this.pipes) {
      pipe.x -= 120 * dt;
      if (!pipe.scored && pipe.x + pipe.w < this.bird.x) { pipe.scored = true; this.score++; }
    }
    this.pipes = this.pipes.filter(pipe => pipe.x > -pipe.w - 8);
    const last = this.pipes.at(-1);
    if (!last || last.x < W - 168) this.spawnPipe((last ? last.x : W) + 168);
    if (this.bird.y - this.bird.r <= 0 || this.bird.y + this.bird.r >= PLAY_H || this.pipes.some(pipe => this.bird.x + this.bird.r >= pipe.x && this.bird.x - this.bird.r <= pipe.x + pipe.w && (this.bird.y - this.bird.r < pipe.top || this.bird.y + this.bird.r > pipe.top + pipe.gap))) this.status = "dying";
  }
}
