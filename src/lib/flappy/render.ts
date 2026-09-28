import { BIRD_FRAMES, CITY, CLOUDS, PAL } from "./sprites";
import { FlappyEngine, GROUND, H, PLAY_H, W } from "./engine";

const INK = "#543847";
function blit(ctx: CanvasRenderingContext2D, map: string[], px: number, py: number, scale: number) {
  map.forEach((row, y) => [...row].forEach((cell, x) => { if (PAL[cell]) { ctx.fillStyle = PAL[cell]; ctx.fillRect(px + x * scale, py + y * scale, scale, scale); } }));
}
function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, fill = "#fff") {
  ctx.font = `bold ${size}px monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineJoin = "round"; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(value, x, y); ctx.fillStyle = fill; ctx.fillText(value, x, y);
}
function pipeBody(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  if (h <= 0) return;
  ctx.fillStyle = INK; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#73bf2e"; ctx.fillRect(x + 2, y, w - 4, h);
  ctx.fillStyle = "#9ae05c"; ctx.fillRect(x + 3, y, 7, h);
  ctx.fillStyle = "#d0f08a"; ctx.fillRect(x + 4, y, 3, h);
  ctx.fillStyle = "#4d9a1c"; ctx.fillRect(x + w - 10, y, 6, h);
  ctx.fillStyle = "#2e6a12"; ctx.fillRect(x + w - 6, y, 2, h);
}
function pipeCap(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const px = x - 4, w = 60, h = 26;
  ctx.fillStyle = INK; ctx.fillRect(px, y, w, h);
  ctx.fillStyle = "#73bf2e"; ctx.fillRect(px + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = "#9ae05c"; ctx.fillRect(px + 3, y + 2, 8, h - 4);
  ctx.fillStyle = "#d0f08a"; ctx.fillRect(px + 4, y + 2, 3, h - 4);
  ctx.fillStyle = "#4d9a1c"; ctx.fillRect(px + w - 12, y + 2, 7, h - 4);
}

export function renderFlappy(ctx: CanvasRenderingContext2D, engine: FlappyEngine, now: number, best: number) {
  ctx.fillStyle = "#70c5ce"; ctx.fillRect(0, 0, W, H);
  for (const cloud of CLOUDS) {
    ctx.save(); ctx.translate(cloud.x, cloud.y); ctx.scale(cloud.s, cloud.s);
    ctx.fillStyle = "#eefafa"; ctx.fillRect(6, 10, 28, 10); ctx.fillRect(12, 4, 16, 10); ctx.fillRect(0, 12, 14, 8); ctx.fillRect(30, 12, 12, 8);
    ctx.fillStyle = "#c5ecec"; ctx.fillRect(8, 16, 22, 4); ctx.restore();
  }
  for (const [x, w, h] of CITY) {
    ctx.fillStyle = "#e0f6ee"; ctx.fillRect(x, PLAY_H - h, w, h);
    ctx.fillStyle = "#c5e6de"; ctx.fillRect(x + w - 3, PLAY_H - h, 3, h);
    ctx.fillStyle = "#9ec9c2";
    for (let wy = PLAY_H - h + 5; wy < PLAY_H - 6; wy += 7) { ctx.fillRect(x + 3, wy, 2, 2); ctx.fillRect(x + 8, wy, 2, 2); }
  }
  for (const pipe of engine.pipes) {
    pipeBody(ctx, pipe.x, 0, pipe.w, pipe.top); pipeCap(ctx, pipe.x, pipe.top - 26);
    const lower = pipe.top + pipe.gap;
    pipeBody(ctx, pipe.x, lower, pipe.w, PLAY_H - lower); pipeCap(ctx, pipe.x, lower);
  }
  ctx.fillStyle = "#ded895"; ctx.fillRect(0, PLAY_H, W, GROUND);
  ctx.fillStyle = "#5ee270"; ctx.fillRect(0, PLAY_H, W, 16);
  ctx.fillStyle = "#9ae05c"; ctx.fillRect(0, PLAY_H, W, 7);
  ctx.fillStyle = INK; ctx.fillRect(0, PLAY_H, W, 2); ctx.fillRect(0, PLAY_H + 18, W, 2);
  const off = -(engine.scroll % 24);
  for (let row = 0; row < 8; row++) for (let col = -2; col < 28; col++) {
    const x = off + col * 12 + (row % 2 ? 6 : 0), y = PLAY_H + 22 + row * 10;
    ctx.fillStyle = (col + row) % 2 ? "#e6dda4" : "#d5cc82"; ctx.fillRect(x, y, 11, 9);
  }
  const bird = engine.bird;
  const y = engine.status === "ready" ? bird.y + Math.sin(now / 220) * 6 : bird.y;
  const rot = engine.status === "dying" || engine.status === "dead" ? Math.min(1.2, .35 + bird.vy / 280) : Math.max(-.5, Math.min(.65, bird.vy / 380));
  ctx.save(); ctx.translate(bird.x, y); ctx.rotate(rot); ctx.imageSmoothingEnabled = false;
  blit(ctx, BIRD_FRAMES[Math.floor(now / 80) % BIRD_FRAMES.length], -22, -14, 2);
  ctx.fillStyle = INK; ctx.fillRect(4, -8, 12, 12); ctx.fillStyle = "#fff"; ctx.fillRect(6, -6, 8, 8);
  ctx.fillStyle = INK; ctx.fillRect(10, -4, 4, 4); ctx.fillStyle = "#f35c4f"; ctx.fillRect(2, 2, 8, 6);
  ctx.fillStyle = INK; ctx.fillRect(16, -2, 12, 8); ctx.fillStyle = "#f5a623"; ctx.fillRect(16, -1, 10, 3); ctx.fillStyle = "#e37b2d"; ctx.fillRect(16, 3, 10, 3); ctx.restore();
  if (engine.status === "ready") { text(ctx, "FLAPPY BIRD", W / 2, 110, 23, "#f8e14e"); text(ctx, "GET READY", W / 2, 160, 14, "#8bde1c"); text(ctx, "Toca para empezar", W / 2, 318, 13); }
  else if (engine.status === "dead") { text(ctx, "GAME OVER", W / 2, 118, 23, "#f8e14e"); ctx.fillStyle = "#e5d9a1"; ctx.fillRect(38, 150, 212, 140); text(ctx, "SCORE", 190, 185, 13, "#e37b2d"); text(ctx, String(engine.score), 190, 220, 23); text(ctx, `BEST ${best}`, 140, 270, 14, "#e37b2d"); text(ctx, "Toca para repetir", W / 2, 343, 12); }
  else text(ctx, String(engine.score), W / 2, 48, 25);
}
