import { CAR_PALETTE, colToX, mulberry32, PLAYER_WIDTH, RoadEngine, vehicleDir, vehicleLength, type Car, type Row } from "./engine";

export const VIEW_W = 900;
export const VIEW_H = 560;
const ROW_H = 56;
const HOP_S = .16;
/** Rows kept visible below the chicken. */
const BELOW = 2.5;

export type RecordFlag = { label: string; row: number; color: string };

function ease(t: number) {
  return 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function mix(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const target = amount > 0 ? 255 : 0;
  const k = Math.abs(amount);
  const ch = (v: number) => Math.round(v + (target - v) * k);
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

export class RoadView {
  private fromRow = 0;
  private fromCol = 4;
  private row = 0;
  private col = 4;
  private t = 1;
  private cam = 0;
  private over = false;
  flash = 0;
  time = 0;

  reset() {
    this.fromRow = this.row = 0;
    this.fromCol = this.col = 4;
    this.t = 1;
    this.cam = 0;
    this.over = false;
    this.flash = 0;
    this.time = 0;
  }

  tick(game: RoadEngine, dt: number, reduce: boolean) {
    this.time += dt;
    if (game.row !== this.row || game.col !== this.col) {
      this.fromRow = this.rowVis();
      this.fromCol = this.colVis();
      this.row = game.row;
      this.col = game.col;
      this.t = reduce ? 1 : 0;
    }
    if (game.over === "hit" && !this.over) this.flash = .6;
    this.over = Boolean(game.over);
    this.t = Math.min(1, this.t + dt / HOP_S);
    this.flash = Math.max(0, this.flash - dt);
    const target = this.rowVis();
    this.cam = reduce ? target : this.cam + (target - this.cam) * Math.min(1, dt * 7);
  }

  private rowVis() {
    return this.fromRow + (this.row - this.fromRow) * ease(this.t);
  }

  private colVis() {
    return this.fromCol + (this.col - this.fromCol) * ease(this.t);
  }

  /** Screen y of a row's top edge. */
  private rowTop(row: number) {
    return VIEW_H - (row - this.cam + BELOW + .5) * ROW_H;
  }

  draw(ctx: CanvasRenderingContext2D, game: RoadEngine, flags: RecordFlag[] = []) {
    ctx.fillStyle = "#7cc257";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const first = Math.floor(this.cam - BELOW - 1);
    const last = Math.ceil(this.cam + VIEW_H / ROW_H);
    for (let r = last; r >= first; r--) this.drawGround(ctx, game, r);
    for (const flag of flags) this.drawFlag(ctx, flag);
    for (let r = last; r >= first; r--) {
      const row = game.rowAt(r);
      if (row.kind !== "road") continue;
      const top = this.rowTop(r);
      for (const car of row.cars) for (const wrap of [-1, 0, 1]) drawVehicle(ctx, car, top, wrap);
      if (r === Math.round(this.rowVis())) this.drawChickenLayer(ctx, game);
    }
    if (game.rowAt(Math.round(this.rowVis())).kind !== "road") this.drawChickenLayer(ctx, game);
  }

  private drawGround(ctx: CanvasRenderingContext2D, game: RoadEngine, r: number) {
    const top = this.rowTop(r);
    if (top > VIEW_H || top + ROW_H < 0) return;
    const row: Row = game.rowAt(r);
    if (row.kind === "grass") {
      ctx.fillStyle = r % 2 ? "#86cb5f" : "#7ec257";
      ctx.fillRect(0, top, VIEW_W, ROW_H);
      const rand = mulberry32(row.decor + 17 + Math.max(0, r) * 131);
      for (let i = 0; i < 7; i++) {
        const x = rand() * VIEW_W, y = top + 8 + rand() * (ROW_H - 16);
        ctx.fillStyle = rand() < .25 ? "#f5f1d8" : "#6aae48";
        ctx.fillRect(x, y, 4, 4);
      }
      if (r >= 0) {
        const bush = (x: number) => {
          ctx.fillStyle = "rgba(0,0,0,.14)";
          ctx.beginPath(); ctx.ellipse(x + 3, top + ROW_H * .62, 17, 7, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#3f8f3a";
          ctx.beginPath(); ctx.arc(x, top + ROW_H * .45, 15, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#5cb14a";
          ctx.beginPath(); ctx.arc(x - 4, top + ROW_H * .38, 8, 0, Math.PI * 2); ctx.fill();
        };
        if (rand() < .7) bush(10 + rand() * 18);
        if (rand() < .7) bush(VIEW_W - 10 - rand() * 18);
      }
      if (r === 1) {
        ctx.fillStyle = "rgba(255,255,255,.55)";
        for (let x = 0; x < VIEW_W; x += 24) ctx.fillRect(x, top + ROW_H - 3, 12, 3);
      }
      return;
    }
    ctx.fillStyle = "#3a3e4b";
    ctx.fillRect(0, top, VIEW_W, ROW_H);
    const above = game.rowAt(r + 1), below = game.rowAt(r - 1);
    ctx.fillStyle = "#4a4f5e";
    if (above.kind !== "road") ctx.fillRect(0, top, VIEW_W, 4);
    if (below.kind !== "road") { ctx.fillStyle = "#2d3039"; ctx.fillRect(0, top + ROW_H - 4, VIEW_W, 4); }
    if (above.kind === "road") {
      ctx.fillStyle = "rgba(255,255,255,.55)";
      for (let x = 12; x < VIEW_W; x += 44) ctx.fillRect(x, top - 1.5, 22, 3);
    }
    ctx.fillStyle = "rgba(255,255,255,.28)";
    ctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textBaseline = "middle";
    ctx.fillText(String(row.road + 1), 6, top + ROW_H / 2);
  }

  private drawFlag(ctx: CanvasRenderingContext2D, flag: RecordFlag) {
    const top = this.rowTop(flag.row);
    if (top > VIEW_H || top + ROW_H < 0) return;
    ctx.save();
    ctx.strokeStyle = flag.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(0, top + 1); ctx.lineTo(VIEW_W, top + 1); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
    const w = ctx.measureText(flag.label).width + 14;
    ctx.fillStyle = flag.color;
    roundRect(ctx, VIEW_W - w - 8, top - 10, w, 20, 5); ctx.fill();
    ctx.fillStyle = "#0b1020";
    ctx.textBaseline = "middle";
    ctx.fillText(flag.label, VIEW_W - w - 1, top);
    ctx.restore();
  }

  private drawChickenLayer(ctx: CanvasRenderingContext2D, game: RoadEngine) {
    const hop = this.t < 1 ? Math.sin(Math.PI * ease(this.t)) : 0;
    const row = this.rowVis();
    const x = colToX(this.colVis()) * VIEW_W;
    const y = this.rowTop(row) + ROW_H / 2;
    const squashed = game.over === "hit";
    drawChicken(ctx, x, y, hop * 16, squashed, game.over ? 0 : Math.sin(this.time * 7) * 1.2);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,70,90,${this.flash * .5})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }
}

function drawVehicle(ctx: CanvasRenderingContext2D, car: Car, top: number, wrap: number) {
  const len = vehicleLength(car) * VIEW_W;
  const dir = vehicleDir(car);
  const cx = (car.x + wrap) * VIEW_W;
  if (cx + len < -10 || cx - len > VIEW_W + 10) return;
  const kind = car.kind ?? "car";
  const color = CAR_PALETTE[car.color ?? 0] ?? CAR_PALETTE[0];
  const h = kind === "car" ? ROW_H * .56 : ROW_H * .66;
  const x = cx - len / 2, y = top + (ROW_H - h) / 2;
  ctx.fillStyle = "rgba(0,0,0,.28)";
  roundRect(ctx, x + 3, y + 5, len, h, 8); ctx.fill();
  ctx.fillStyle = "#15171d";
  for (const wx of [x + len * .18, x + len * .72]) {
    ctx.fillRect(wx, y - 3, len * .12, 4);
    ctx.fillRect(wx, y + h - 1, len * .12, 4);
  }
  if (kind === "truck") {
    const cab = len * .26;
    const cabX = dir > 0 ? x + len - cab : x;
    const boxX = dir > 0 ? x : x + cab + 3;
    ctx.fillStyle = "#e9ecf2";
    roundRect(ctx, boxX, y, len - cab - 3, h, 5); ctx.fill();
    ctx.fillStyle = "#cfd4de";
    ctx.fillRect(boxX + 6, y + h * .5 - 1, len - cab - 15, 2);
    ctx.fillStyle = color;
    roundRect(ctx, cabX, y + 2, cab, h - 4, 6); ctx.fill();
    ctx.fillStyle = "#bfe3f5";
    ctx.fillRect(dir > 0 ? cabX + cab - 10 : cabX + 4, y + 7, 6, h - 14);
  } else {
    ctx.fillStyle = color;
    roundRect(ctx, x, y, len, h, kind === "van" ? 7 : 10); ctx.fill();
    ctx.fillStyle = mix(color, .22);
    roundRect(ctx, x + 3, y + 3, len - 6, h * .3, 6); ctx.fill();
    const roofW = len * (kind === "van" ? .62 : .46);
    const roofX = cx - roofW / 2 - dir * len * (kind === "van" ? .08 : .02);
    ctx.fillStyle = mix(color, -.18);
    roundRect(ctx, roofX, y + h * .18, roofW, h * .64, 6); ctx.fill();
    ctx.fillStyle = "#bfe3f5";
    const glass = Math.max(5, len * .09);
    ctx.fillRect(dir > 0 ? roofX + roofW - 2 : roofX - glass + 2, y + h * .22, glass, h * .56);
  }
  const front = dir > 0 ? x + len - 4 : x;
  const back = dir > 0 ? x : x + len - 4;
  ctx.fillStyle = "#ffe89a";
  ctx.fillRect(front, y + 4, 4, 6); ctx.fillRect(front, y + h - 10, 4, 6);
  ctx.fillStyle = "#ff5a5a";
  ctx.fillRect(back, y + 4, 4, 5); ctx.fillRect(back, y + h - 9, 4, 5);
}

function drawChicken(ctx: CanvasRenderingContext2D, x: number, y: number, lift: number, squashed: boolean, bob: number) {
  const w = PLAYER_WIDTH * VIEW_W * .95;
  const shadow = 1 - lift / 40;
  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.beginPath(); ctx.ellipse(x + 2, y + w * .42, w * .5 * shadow, w * .18 * shadow, 0, 0, Math.PI * 2); ctx.fill();
  if (squashed) {
    ctx.fillStyle = "#fbfbf5";
    ctx.beginPath(); ctx.ellipse(x, y + 6, w * .75, w * .22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e3342f";
    ctx.fillRect(x - 6, y - 2, 12, 5);
    return;
  }
  const by = y - lift + bob;
  ctx.fillStyle = "#f59e2b";
  ctx.fillRect(x - 9, by + w * .28, 5, 9); ctx.fillRect(x + 4, by + w * .28, 5, 9);
  ctx.fillStyle = "#fbfbf5";
  roundRect(ctx, x - w / 2, by - w * .5, w, w * .9, 12); ctx.fill();
  ctx.fillStyle = "#e6e6dc";
  roundRect(ctx, x - w / 2, by + w * .12, w, w * .28, 8); ctx.fill();
  ctx.fillStyle = "#e3342f";
  roundRect(ctx, x - 6, by - w * .5 - 9, 12, 11, 4); ctx.fill();
  ctx.fillStyle = "#f59e2b";
  ctx.beginPath(); ctx.moveTo(x - 6, by - w * .1); ctx.lineTo(x + 6, by - w * .1); ctx.lineTo(x, by + 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(x - 12, by - w * .3, 5, 6); ctx.fillRect(x + 7, by - w * .3, 5, 6);
  ctx.fillStyle = "#e3342f";
  ctx.fillRect(x - 3, by + 4, 6, 6);
}
