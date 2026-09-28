export const COLS = 9;
export const CENTER_COL = 4;
export const PLAYER_WIDTH = .07;
export const DEFAULT_CAR_LENGTH = .1;
export const VEHICLE_LENGTH = { car: .1, van: .14, truck: .22 } as const;
export const CAR_HIT = (PLAYER_WIDTH + DEFAULT_CAR_LENGTH) / 2;
export const CAR_PALETTE = ["#e4453a", "#2f74e8", "#f2c14e", "#21b37a", "#f07832", "#b04ee0", "#3dc6e0", "#f25f90"] as const;
/** A car counts as "soon" when it touches the crossing point within this many seconds. */
export const SOON_S = 1.2;
/** A car in the chicken's own lane is "danger" when it touches the chicken within this many seconds. */
export const DANGER_S = 2;
/** The run ends if the chicken does not reach a new row for this long. */
export const IDLE_LIMIT_S = 20;
export const MAX_ROW = 100_000;
export const FAR_S = 9;
const MIN_GAP = .3;
const MAX_GAP = .6;
const CROSS_GAP = .42;

export type VehicleKind = keyof typeof VEHICLE_LENGTH;
export type RowKind = "grass" | "road";
export type Car = { x: number; speed: number; dir?: 1 | -1; kind?: VehicleKind; length?: number; color?: number };
export type Row = { kind: RowKind; cars: Car[]; road: number; decor: number };
export type Occupancy = "clear" | "blocked";
export type Here = "grass" | "safe" | "danger";
export type RoadFacts = {
  /** Road lanes already crossed. */
  lane: number;
  /** Seconds until the nearest car touches the crossing point ahead, capped at FAR_S. */
  distance: number;
  speed: number;
  /** Signed centre distance of the nearest car ahead, as a share of the road width. */
  nearestOffset: number;
  here?: Here;
  left?: Occupancy;
  right?: Occupancy;
  back?: Occupancy;
  ahead?: Occupancy;
};
export type RoadAction = "advance" | "left" | "right" | "back" | "wait";
export type EndCause = "hit" | "idle";

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function colToX(col: number) {
  return (col + .5) / COLS;
}

export function wrap01(value: number) {
  return ((value % 1) + 1) % 1;
}

export function wrapDelta(a: number, b: number) {
  let d = (a - b) % 1;
  if (d > .5) d -= 1;
  if (d < -.5) d += 1;
  return d;
}

export function vehicleLength(car: Car) {
  return car.length ?? (car.kind ? VEHICLE_LENGTH[car.kind] : DEFAULT_CAR_LENGTH);
}

export function vehicleDir(car: Car): 1 | -1 {
  return car.dir === -1 ? -1 : 1;
}

export function aabbOverlapWrap(ax: number, aw: number, bx: number, bw: number) {
  return Math.abs(wrapDelta(ax, bx)) < (aw + bw) / 2;
}

export function hitsPlayer(playerX: number, car: Car) {
  return aabbOverlapWrap(playerX, PLAYER_WIDTH, car.x, vehicleLength(car));
}

/** Seconds until some car touches the player's box at `px` (0 if one already does). */
export function timeToContact(cars: Car[], px: number) {
  let best = Infinity, nearest: Car | null = null, offset = 1;
  for (const car of cars) {
    if (hitsPlayer(px, car)) return { seconds: 0, car, offset: 0 };
    const travel = vehicleDir(car) > 0 ? wrap01(px - car.x) : wrap01(car.x - px);
    const reach = (PLAYER_WIDTH + vehicleLength(car)) / 2;
    const seconds = car.speed > 0 ? Math.max(0, travel - reach) / car.speed : Infinity;
    if (seconds < best) { best = seconds; nearest = car; offset = wrapDelta(car.x, px); }
  }
  return { seconds: best, car: nearest, offset };
}

function pickKind(rand: () => number, level: number): VehicleKind {
  const r = rand();
  const truck = Math.min(.22, .08 + level * .003);
  return r < .72 - truck / 2 ? "car" : r < 1 - truck ? "van" : "truck";
}

function sortedCars(cars: Car[]) {
  return [...cars].sort((a, b) => a.x - b.x);
}

export function bumperGaps(cars: Car[]) {
  if (!cars.length) return [1];
  const sorted = sortedCars(cars);
  return sorted.map((car, i) => {
    const next = sorted[(i + 1) % sorted.length];
    const right = car.x + vehicleLength(car) / 2;
    const left = next.x - vehicleLength(next) / 2;
    return wrap01(left - right);
  });
}

function carsOverlap(cars: Car[]) {
  if (cars.length < 2) return false;
  const sorted = sortedCars(cars);
  return sorted.some((car, i) => {
    const next = sorted[(i + 1) % sorted.length];
    return aabbOverlapWrap(car.x, vehicleLength(car), next.x, vehicleLength(next));
  });
}

export function laneIsCrossable(cars: Car[]) {
  if (carsOverlap(cars)) return false;
  return Math.max(...bumperGaps(cars)) > PLAYER_WIDTH + .12;
}

/** Traffic starts slow with one car per lane; speed and density grow with the road index. */
const PACE = { base: .07, spread: .05, ramp: 40, max: 1.6, two: 6, three: 22 };

export function buildLane(rand: () => number, level: number): Car[] {
  const dir: 1 | -1 = rand() < .5 ? 1 : -1;
  const pace = 1 + Math.min(PACE.max, level / PACE.ramp);
  const speed = (PACE.base + rand() * PACE.spread) * pace;
  const maxCars = level < PACE.two ? 1 : level < PACE.three ? 2 : 3;
  for (let attempt = 0; attempt < 8; attempt++) {
    const count = 1 + Math.floor(rand() * maxCars);
    const pieces: { kind: VehicleKind; length: number; color: number; gap: number }[] = [];
    for (let i = 0; i < count; i++) {
      const kind = pickKind(rand, level);
      pieces.push({ kind, length: VEHICLE_LENGTH[kind], color: Math.floor(rand() * CAR_PALETTE.length), gap: MIN_GAP + rand() * (MAX_GAP - MIN_GAP) });
    }
    pieces[Math.floor(rand() * pieces.length)].gap = Math.max(CROSS_GAP, pieces[0].gap);
    const room = 1 - pieces.reduce((sum, piece) => sum + piece.length, 0);
    const gapSum = pieces.reduce((sum, piece) => sum + piece.gap, 0);
    if (room < count * MIN_GAP * .9) continue;
    const scale = room / gapSum;
    const cars: Car[] = [];
    let x = rand();
    for (const piece of pieces) {
      x = wrap01(x + piece.length / 2);
      cars.push({ x, speed, dir, kind: piece.kind, length: piece.length, color: piece.color });
      x = wrap01(x + piece.length / 2 + piece.gap * scale);
    }
    if (laneIsCrossable(cars)) return cars;
  }
  return [{ x: rand(), speed, dir, kind: "car", length: VEHICLE_LENGTH.car, color: 0 }];
}

export class RoadEngine {
  rows: Row[] = [];
  row = 0;
  col = CENTER_COL;
  best = 0;
  hits = 0;
  elapsed = 0;
  running = false;
  over: EndCause | null = null;
  seed = 1;
  lastHitAt = -1;
  lastProgressAt = 0;
  private rand: () => number = mulberry32(1);
  private roads = 0;
  private groupLeft = 0;
  private grassLeft = 0;

  /** Road lanes fully crossed at the best row reached. */
  get crossed() {
    return this.roadsBelow(this.best);
  }

  get lane() {
    return this.row;
  }

  playerX() {
    return colToX(this.col);
  }

  roadsBelow(row: number) {
    this.ensure(row);
    let n = 0;
    for (let r = 0; r < row; r++) if (this.rows[r].kind === "road") n++;
    return n;
  }

  rowAt(row: number): Row {
    if (row < 0) return { kind: "grass", cars: [], road: -1, decor: 0 };
    this.ensure(row);
    return this.rows[row];
  }

  isGrass(row: number) {
    return this.rowAt(row).kind === "grass";
  }

  /** Grows the world on demand. Deterministic for a seed because rows are built in order. */
  ensure(row: number) {
    while (this.rows.length <= Math.min(row, MAX_ROW)) {
      const index = this.rows.length;
      const rand = this.rand;
      const decor = Math.floor(rand() * 0xffff);
      if (index < 2) { this.rows.push({ kind: "grass", cars: [], road: -1, decor }); continue; }
      if (this.groupLeft > 0) {
        this.groupLeft--;
        this.rows.push({ kind: "road", cars: buildLane(rand, this.roads), road: this.roads++, decor });
        continue;
      }
      if (this.rows[index - 1].kind === "road") {
        this.rows.push({ kind: "grass", cars: [], road: -1, decor });
        this.grassLeft = rand() < .25 ? 1 : 0;
        continue;
      }
      if (this.grassLeft > 0) {
        this.grassLeft--;
        this.rows.push({ kind: "grass", cars: [], road: -1, decor });
        continue;
      }
      this.groupLeft = this.groupSize() - 1;
      this.rows.push({ kind: "road", cars: buildLane(rand, this.roads), road: this.roads++, decor });
    }
  }

  private groupSize() {
    const cap = Math.min(5, 2 + Math.floor(this.roads / 12));
    return 1 + Math.floor(this.rand() * cap);
  }

  start(seed = Math.floor(Math.random() * 0x7fffffff)) {
    this.seed = seed >>> 0 || 1;
    this.rand = mulberry32(this.seed);
    this.rows = [];
    this.roads = 0;
    this.groupLeft = 0;
    this.grassLeft = 0;
    this.row = 0;
    this.col = CENTER_COL;
    this.best = 0;
    this.hits = 0;
    this.elapsed = 0;
    this.lastHitAt = -1;
    this.lastProgressAt = 0;
    this.over = null;
    this.ensure(30);
    this.running = true;
  }

  cellClear(row: number, col: number) {
    if (col < 0 || col >= COLS || row < 0) return false;
    const r = this.rowAt(row);
    if (r.kind === "grass") return true;
    const px = colToX(col);
    return !r.cars.some(car => hitsPlayer(px, car));
  }

  facts(): RoadFacts {
    const occupant = (row: number, col: number): Occupancy => this.cellClear(row, col) ? "clear" : "blocked";
    const px = this.playerX();
    const current = this.rowAt(this.row);
    const hereContact = current.kind === "road" ? timeToContact(current.cars, px).seconds : Infinity;
    const here: Here = current.kind === "grass" ? "grass" : hereContact <= DANGER_S ? "danger" : "safe";
    const sides = { here, left: occupant(this.row, this.col - 1), right: occupant(this.row, this.col + 1), back: occupant(this.row - 1, this.col) };
    const lane = Math.min(MAX_ROW, this.roadsBelow(this.row));
    const next = this.rowAt(this.row + 1);
    if (next.kind === "grass" || !next.cars.length) return { lane, distance: FAR_S, speed: 0, nearestOffset: 1, ...sides, ahead: "clear" };
    const contact = timeToContact(next.cars, px);
    return {
      lane,
      distance: Math.min(FAR_S, contact.seconds),
      speed: contact.car?.speed ?? 0,
      nearestOffset: contact.offset,
      ...sides,
      ahead: occupant(this.row + 1, this.col),
    };
  }

  can(action: RoadAction) {
    if (action === "wait") return true;
    if (action === "left") return this.col > 0;
    if (action === "right") return this.col < COLS - 1;
    if (action === "back") return this.row > 0;
    return true;
  }

  act(action: RoadAction) {
    if (!this.running || action === "wait" || !this.can(action)) return;
    if (action === "advance") this.moveTo(this.row + 1, this.col);
    else if (action === "back") this.moveTo(this.row - 1, this.col);
    else this.moveTo(this.row, this.col + (action === "left" ? -1 : 1));
  }

  advance() { this.act("advance"); }
  retreat() { this.act("back"); }
  shift(delta: number) { this.act(delta < 0 ? "left" : "right"); }

  private moveTo(row: number, col: number) {
    this.row = row;
    this.col = col;
    this.ensure(row + 30);
    if (row > this.best) { this.best = row; this.lastProgressAt = this.elapsed; }
    this.checkCollision();
  }

  step(dt: number) {
    if (!this.running || !Number.isFinite(dt) || dt <= 0) return;
    let remaining = Math.min(dt, .25);
    const from = Math.max(0, this.row - 12), to = Math.min(this.rows.length - 1, this.row + 24);
    while (remaining > 0 && this.running) {
      const step = Math.min(remaining, .05);
      this.elapsed += step;
      for (let r = from; r <= to; r++) for (const car of this.rows[r].cars) car.x = wrap01(car.x + vehicleDir(car) * car.speed * step);
      this.checkCollision();
      if (this.running && this.elapsed - this.lastProgressAt > IDLE_LIMIT_S) this.end("idle");
      remaining -= step;
    }
  }

  private end(cause: EndCause) {
    this.over = cause;
    this.running = false;
  }

  private checkCollision() {
    const current = this.rowAt(this.row);
    if (current.kind === "grass") return;
    if (!current.cars.some(car => hitsPlayer(this.playerX(), car))) return;
    this.hits++;
    this.lastHitAt = this.elapsed;
    this.end("hit");
  }
}

export function describeRoad(facts: RoadFacts) {
  const ahead = facts.speed === 0
    ? "Ahead: grass or an empty road. No car can reach the crossing point."
    : facts.distance <= 0
      ? "Ahead: a car is on the crossing point right now."
      : facts.distance <= SOON_S
        ? "Ahead: no car is on the crossing point, but a car will reach it soon."
        : "Ahead: no car is on the crossing point and none will reach it soon.";
  const here = facts.here === "grass"
    ? " Here: the chicken stands on grass, where no car can reach it."
    : facts.here === "danger"
      ? " Here: a car in the chicken's lane will reach it soon."
      : facts.here === "safe" ? " Here: no car in the chicken's lane will reach it soon." : "";
  const behind = facts.back ? ` Behind: ${facts.back === "clear" ? "the space behind is free" : "a car is in the space behind"}.` : "";
  return `${ahead}${here}${behind}`;
}
