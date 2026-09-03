import { FACTION_META, clamp, wrap } from "./constants";
import type { Sim } from "./sim";
import type { Building, Plane } from "./types";

export function toScreen(x: number, y: number, camX: number, camY: number, w: number, h: number) {
  return { x: w / 2 + (x - camX), y: h / 2 - (y - camY) };
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  sim: Sim,
  camX: number,
  camY: number,
  w: number,
  h: number,
  shakeX: number,
  shakeY: number,
  time: number,
): void {
  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawSky(ctx, w, h, camY);
  drawSun(ctx, w, h, camY);
  drawClouds(ctx, camX, camY, w, h, time);
  drawFarRidge(ctx, sim, camX, camY, w, h, 0.22, 70, "#6a7a88", 0.00055);
  drawFarRidge(ctx, sim, camX, camY, w, h, 0.4, 44, "#4e5d48", 0.0009);
  drawTerrain(ctx, sim, camX, camY, w, h);
  drawScatter(ctx, sim, camX, camY, w, h);
  for (const af of sim.airfields) {
    if (Math.abs(af.x - camX) > w * 0.55 + af.half) continue;
    drawRunway(ctx, sim, af, camX, camY, w, h);
  }
  for (const b of sim.buildings) {
    if (b.hp <= 0) continue;
    drawBuilding(ctx, b, camX, camY, w, h, time);
  }
  for (const p of sim.particles) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    const s = toScreen(p.x, p.y, camX, camY, w, h);
    ctx.beginPath();
    ctx.arc(s.x, s.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const bomb of sim.bombs) {
    const s = toScreen(bomb.x, bomb.y, camX, camY, w, h);
    ctx.fillStyle = "#2a2a24";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c45c48";
    ctx.fillRect(s.x - 1, s.y - 6, 2, 5);
  }
  for (const b of sim.bullets) {
    const s = toScreen(b.x, b.y, camX, camY, w, h);
    if (b.aa) {
      ctx.fillStyle = "rgba(255,170,50,0.35)";
      ctx.beginPath();
      ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffe08a";
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3.4, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    const mag = Math.hypot(b.vx, b.vy) || 1;
    const ux = b.vx / mag;
    const uy = -b.vy / mag;
    ctx.strokeStyle = b.faction === sim.faction ? "#fff8e0" : "#ff4a28";
    ctx.lineWidth = b.faction === sim.faction ? 3 : 4.4;
    ctx.beginPath();
    ctx.moveTo(s.x - ux * 22, s.y - uy * 22);
    ctx.lineTo(s.x + ux * 4, s.y + uy * 4);
    ctx.stroke();
  }
  for (const p of sim.planes) {
    if (p.state === "dead") continue;
    drawPlane(ctx, p, camX, camY, w, h, time);
  }
  drawOffscreen(ctx, sim, camX, camY, w, h);
  drawBaseMarkers(ctx, sim, camX, camY, w, h, time);
  drawStripMarkers(ctx, sim, camX, camY, w, h, time);
  for (const ex of sim.explosions) {
    const s = toScreen(ex.x, ex.y, camX, camY, w, h);
    const r = 18 + ex.t * 90 * ex.scale;
    ctx.fillStyle = `rgba(255,160,60,${1 - ex.t / 0.42})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const f of sim.floaters) {
    const s = toScreen(f.x, f.y, camX, camY, w, h);
    ctx.globalAlpha = Math.max(0, f.life / f.max);
    ctx.fillStyle = f.color;
    ctx.font = "700 16px Oswald, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(f.text, s.x, s.y);
    ctx.globalAlpha = 1;
  }
  drawMinimap(ctx, sim, w);
  ctx.restore();
}

function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, camY: number): void {
  const t = clamp((camY - 180) / 900, 0, 1);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `rgb(${72 + t * 18},${88 + t * 10},${118 - t * 8})`);
  g.addColorStop(0.42, `rgb(${140 + t * 20},${148},${158 - t * 16})`);
  g.addColorStop(0.72, `rgb(${214},${176 - t * 10},${128})`);
  g.addColorStop(1, `rgb(${232},${198},${150})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawSun(ctx: CanvasRenderingContext2D, w: number, h: number, camY: number): void {
  const y = h * 0.38 + (camY - 400) * 0.05;
  const x = w * 0.78;
  const glow = ctx.createRadialGradient(x, y, 8, x, y, 90);
  glow.addColorStop(0, "rgba(255,220,140,0.95)");
  glow.addColorStop(0.35, "rgba(255,180,90,0.35)");
  glow.addColorStop(1, "rgba(255,160,80,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffe08a";
  ctx.beginPath();
  ctx.arc(x, y, 26, 0, Math.PI * 2);
  ctx.fill();
}

function drawClouds(ctx: CanvasRenderingContext2D, camX: number, camY: number, w: number, h: number, time: number): void {
  for (let i = 0; i < 7; i++) {
    const span = w + 280;
    const x = ((i * 390 - camX * 0.18 + time * 4) % span + span) % span - 100;
    const y = 48 + ((i * 53) % 86) - (camY - 400) * 0.025;
    ctx.fillStyle = i % 2 ? "rgba(255,244,220,0.28)" : "rgba(255,255,255,0.22)";
    puff(ctx, x, y, 62, 16);
    puff(ctx, x + 38, y + 4, 44, 13);
    puff(ctx, x - 30, y + 6, 36, 11);
  }
}

function puff(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawFarRidge(
  ctx: CanvasRenderingContext2D,
  sim: Sim,
  camX: number,
  camY: number,
  w: number,
  h: number,
  parallax: number,
  lift: number,
  color: string,
  freq: number,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  const step = 16;
  for (let sx = 0; sx <= w + step; sx += step) {
    const wx = camX + (sx - w / 2) / Math.max(0.35, parallax);
    const ground = toScreen(wx, sim.heightAt(wx), camX, camY, w, h).y;
    const peak = lift + 18 * Math.sin(wx * freq) + 10 * Math.sin(wx * freq * 2.4);
    ctx.lineTo(sx, ground - peak * parallax);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

function drawTerrain(ctx: CanvasRenderingContext2D, sim: Sim, camX: number, camY: number, w: number, h: number): void {
  const step = 6;
  const ridge: number[] = [];
  for (let sx = 0; sx <= w + step; sx += step) {
    const wx = camX + (sx - w / 2);
    ridge.push(toScreen(wx, sim.heightAt(wx), camX, camY, w, h).y);
  }
  ctx.beginPath();
  ctx.moveTo(0, h);
  ridge.forEach((y, i) => ctx.lineTo(i * step, y));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = "#3d4a32";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, h);
  ridge.forEach((y, i) => ctx.lineTo(i * step, y + 16));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = "#5a4a38";
  ctx.fill();

  ctx.strokeStyle = "#6e804c";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ridge.forEach((y, i) => (i === 0 ? ctx.moveTo(i * step, y) : ctx.lineTo(i * step, y)));
  ctx.stroke();
}

function drawScatter(ctx: CanvasRenderingContext2D, sim: Sim, camX: number, camY: number, w: number, h: number): void {
  const start = Math.floor((camX - w) / 70) * 70;
  for (let wx = start; wx < camX + w; wx += 70) {
    const x = wrap(wx);
    let onPad = false;
    for (const af of sim.airfields) {
      if (Math.abs(wrap(x - af.x)) < af.half - 8 || Math.abs(x - af.x) < af.half - 8) onPad = true;
    }
    if (onPad) continue;
    const g = sim.heightAt(x);
    const s = toScreen(x, g, camX, camY, w, h);
    if (s.x < -20 || s.x > w + 20) continue;
    const kind = Math.abs(Math.sin(x * 0.017));
    ctx.fillStyle = "#2f3a28";
    if (kind > 0.55) {
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - 16 - kind * 10);
      ctx.lineTo(s.x + 7, s.y + 2);
      ctx.lineTo(s.x - 7, s.y + 2);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(s.x - 5, s.y - 5, 10, 6);
    }
  }
}

function drawRunway(
  ctx: CanvasRenderingContext2D,
  sim: Sim,
  af: { x: number; half: number; friendly: boolean },
  camX: number,
  camY: number,
  w: number,
  h: number,
): void {
  ctx.strokeStyle = af.friendly ? "rgba(210,200,170,0.92)" : "rgba(90,80,70,0.75)";
  ctx.lineWidth = 14;
  ctx.lineCap = "butt";
  ctx.beginPath();
  let started = false;
  for (let ox = -af.half; ox <= af.half; ox += 10) {
    const s = toScreen(af.x + ox, sim.heightAt(af.x + ox) + 2, camX, camY, w, h);
    if (!started) {
      ctx.moveTo(s.x, s.y);
      started = true;
    } else ctx.lineTo(s.x, s.y);
  }
  ctx.stroke();
  ctx.strokeStyle = af.friendly ? "rgba(70,80,50,0.85)" : "rgba(40,36,30,0.7)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 12]);
  ctx.beginPath();
  started = false;
  for (let ox = -af.half + 12; ox <= af.half - 12; ox += 10) {
    const s = toScreen(af.x + ox, sim.heightAt(af.x + ox) + 3, camX, camY, w, h);
    if (!started) {
      ctx.moveTo(s.x, s.y);
      started = true;
    } else ctx.lineTo(s.x, s.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  if (af.friendly) {
    const s = toScreen(af.x, sim.heightAt(af.x) + 28, camX, camY, w, h);
    ctx.fillStyle = "rgba(232, 214, 150, 0.95)";
    ctx.font = "700 12px Oswald, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(af.half > 230 ? "HOME" : "STRIP", s.x, s.y - 8);
  }
}

function drawBuilding(ctx: CanvasRenderingContext2D, b: Building, camX: number, camY: number, w: number, h: number, time: number): void {
  const s = toScreen(b.x, b.y, camX, camY, w, h);
  const x = s.x;
  const y = s.y;
  if (b.kind === "hangar") {
    ctx.fillStyle = "#6a6558";
    ctx.fillRect(x - b.w / 2, y - b.h + 14, b.w, b.h - 14);
    ctx.fillStyle = "#8a7a62";
    ctx.beginPath();
    ctx.moveTo(x - b.w / 2 - 6, y - b.h + 16);
    ctx.lineTo(x, y - b.h - 10);
    ctx.lineTo(x + b.w / 2 + 6, y - b.h + 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2a2a24";
    ctx.fillRect(x - 16, y - 28, 32, 28);
    return;
  }
  if (b.kind === "hq" || b.kind === "base") {
    ctx.fillStyle = b.kind === "base" ? "#8a3c32" : "#7a6a58";
    ctx.fillRect(x - b.w / 2, y - b.h + 8, b.w, b.h - 8);
    ctx.fillStyle = b.kind === "base" ? "#c45c48" : "#5a5044";
    ctx.fillRect(x - b.w / 2 - 2, y - b.h, b.w + 4, 10);
    const pulse = 0.55 + 0.45 * Math.sin(time * 4);
    ctx.fillStyle = `rgba(196,92,72,${pulse})`;
    ctx.fillRect(x - 2, y - b.h - 22, 4, 22);
    ctx.fillRect(x - 2, y - b.h - 28, 16, 9);
    return;
  }
  if (b.kind === "aa") {
    ctx.fillStyle = "#5a584c";
    ctx.beginPath();
    ctx.ellipse(x, y - 4, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a2a24";
    ctx.save();
    ctx.translate(x, y - 10);
    ctx.rotate(-0.4);
    ctx.fillRect(0, -3, 22, 6);
    ctx.restore();
    return;
  }
  ctx.fillStyle = "#7a6a4a";
  ctx.fillRect(x - b.w / 2, y - b.h, b.w, b.h);
  ctx.fillStyle = "#4a4034";
  ctx.fillRect(x - b.w / 2, y - b.h, b.w, 7);
}

function drawPlane(ctx: CanvasRenderingContext2D, p: Plane, camX: number, camY: number, w: number, h: number, time: number): void {
  const s = toScreen(p.x, p.y, camX, camY, w, h);
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.scale(p.facing, 1);
  ctx.rotate(-p.angle);
  if (p.flash > 0) ctx.globalAlpha = 0.45 + 0.55 * Math.sin(time * 40);
  const col = FACTION_META[p.faction].color;
  ctx.fillStyle = "#3a3a34";
  ctx.fillRect(-6, 6, 3, 10);
  ctx.fillRect(4, 6, 3, 10);
  ctx.fillRect(-8, 15, 8, 2);
  ctx.fillRect(2, 15, 8, 2);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(28, 0);
  ctx.lineTo(10, -5);
  ctx.lineTo(-16, -4);
  ctx.lineTo(-22, 0);
  ctx.lineTo(-16, 4);
  ctx.lineTo(10, 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#efe6cc";
  ctx.fillRect(-2, -17, 22, 3.2);
  ctx.fillRect(-4, -8, 24, 3.4);
  ctx.fillRect(-2, 6, 22, 3.2);
  ctx.strokeStyle = "#2a2a24";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(6, -16);
  ctx.lineTo(6, 8);
  ctx.moveTo(16, -16);
  ctx.lineTo(16, 8);
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.fillRect(-22, -11, 5, 22);
  ctx.fillRect(-26, -2, 10, 3);
  ctx.fillStyle = "#2a2a24";
  ctx.beginPath();
  ctx.arc(4, -1, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c45c48";
  ctx.beginPath();
  ctx.arc(-6, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#efe6cc";
  ctx.beginPath();
  ctx.arc(-6, 0, 1.4, 0, Math.PI * 2);
  ctx.fill();
  if (p.fuel > 0 && p.state === "air") {
    ctx.fillStyle = "rgba(230,220,190,0.85)";
    const spin = (time * 28) % 1;
    ctx.globalAlpha = 0.55 + 0.35 * Math.abs(Math.sin(spin * Math.PI));
    ctx.fillRect(26, -8, 5, 16);
  }
  ctx.restore();
}

function drawOffscreen(ctx: CanvasRenderingContext2D, sim: Sim, camX: number, camY: number, w: number, h: number): void {
  const pad = 28;
  for (const p of sim.planes) {
    if (p.player || p.state === "dead" || p.state === "crash") continue;
    const s = toScreen(p.x, p.y, camX, camY, w, h);
    if (s.x > 24 && s.x < w - 24 && s.y > 24 && s.y < h - 24) continue;
    const ax = clamp(s.x, pad, w - pad);
    const ay = clamp(s.y, 36, h - 90);
    ctx.fillStyle = FACTION_META[p.faction].color;
    ctx.beginPath();
    ctx.arc(ax, ay, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBaseMarkers(ctx: CanvasRenderingContext2D, sim: Sim, camX: number, camY: number, w: number, h: number, time: number): void {
  const pad = 30;
  for (const b of sim.buildings) {
    if (b.kind !== "base" || b.hp <= 0) continue;
    const s = toScreen(b.x, b.y + b.h + 40, camX, camY, w, h);
    if (s.x > 28 && s.x < w - 28 && s.y > 28 && s.y < h - 28) continue;
    const ax = clamp(s.x, pad, w - pad);
    const ay = clamp(s.y, 40, h - 96);
    const pulse = 0.55 + 0.45 * Math.sin(time * 5);
    ctx.fillStyle = `rgba(196,92,72,${pulse})`;
    ctx.beginPath();
    ctx.moveTo(ax, ay + 11);
    ctx.lineTo(ax + 9, ay - 8);
    ctx.lineTo(ax - 9, ay - 8);
    ctx.closePath();
    ctx.fill();
    ctx.font = "700 11px Oswald, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("BASE", ax, ay - 12);
  }
}

function drawStripMarkers(ctx: CanvasRenderingContext2D, sim: Sim, camX: number, camY: number, w: number, h: number, time: number): void {
  const p = sim.player();
  if (!p) return;
  let nearest = null as (typeof sim.airfields)[0] | null;
  let bestD = 1e9;
  for (const a of sim.airfields) {
    if (!a.friendly) continue;
    const d = Math.abs(a.x - p.x);
    if (d < bestD) {
      bestD = d;
      nearest = a;
    }
  }
  if (!nearest) return;
  const empty = p.fuel <= 0;
  const pulse = 0.5 + 0.5 * Math.sin(time * (empty ? 7 : 4));
  const s = toScreen(nearest.x, sim.heightAt(nearest.x) + 28, camX, camY, w, h);
  const onScreen = s.x > 36 && s.x < w - 36 && s.y > 36 && s.y < h - 80;
  if (onScreen) {
    ctx.strokeStyle = `rgba(200,212,160,${0.25 + pulse * 0.55})`;
    ctx.lineWidth = empty ? 4 : 2.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y - 10, 22 + pulse * 10, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  const ax = clamp(s.x, 30, w - 30);
  const ay = clamp(s.y, 44, h - 96);
  ctx.fillStyle = `rgba(200,212,160,${0.55 + pulse * 0.45})`;
  ctx.beginPath();
  ctx.moveTo(ax, ay + 12);
  ctx.lineTo(ax + 10, ay - 9);
  ctx.lineTo(ax - 10, ay - 9);
  ctx.closePath();
  ctx.fill();
  ctx.font = "700 11px Oswald, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("STRIP", ax, ay - 14);
}

function drawMinimap(ctx: CanvasRenderingContext2D, sim: Sim, w: number): void {
  const mw = Math.min(440, w - 28);
  const mh = 16;
  const x = (w - mw) / 2;
  const y = 8;
  ctx.fillStyle = "rgba(20,22,16,0.55)";
  ctx.fillRect(x, y, mw, mh);
  const span = Math.max(400, sim.frontMax - sim.frontMin);
  const toX = (wx: number) => x + (clamp(wx - sim.frontMin, 0, span) / span) * mw;
  for (const af of sim.airfields) {
    if (!af.friendly) continue;
    ctx.fillStyle = "#c8d4a0";
    ctx.fillRect(toX(af.x) - 2, y + 4, 4, mh - 8);
  }
  for (const b of sim.buildings) {
    if (b.kind !== "base" || b.hp <= 0) continue;
    ctx.fillStyle = "#c45c48";
    ctx.fillRect(toX(b.x) - 3, y + 2, 6, mh - 4);
  }
  for (const p of sim.planes) {
    if (p.state === "dead") continue;
    ctx.fillStyle = p.player ? "#efe6cc" : FACTION_META[p.faction].color;
    ctx.beginPath();
    ctx.arc(toX(p.x), y + mh / 2, p.player ? 3.2 : 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}
