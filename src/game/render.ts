import { FACTION_META, clamp } from "./constants";
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
  drawClouds(ctx, camX, camY, w, h);
  drawSilhouette(ctx, camX, camY, w, h, 0.18, 36, "#3a4e5c", 0.00072);
  drawSilhouette(ctx, camX, camY, w, h, 0.34, 48, "#44543a", 0.0012);
  drawTerrain(ctx, sim, camX, camY, w, h);
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
  const t = clamp((camY - 200) / 800, 0, 1);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `rgb(${80 + t * 40},${120 + t * 20},${160 - t * 20})`);
  g.addColorStop(1, `rgb(${190},${200 - t * 20},${170})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawSun(ctx: CanvasRenderingContext2D, w: number, h: number, camY: number): void {
  const y = 70 + (camY - 400) * 0.04;
  ctx.fillStyle = "rgba(255,210,120,0.9)";
  ctx.beginPath();
  ctx.arc(w * 0.78, y, 34, 0, Math.PI * 2);
  ctx.fill();
}

function drawClouds(ctx: CanvasRenderingContext2D, camX: number, camY: number, w: number, h: number): void {
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  for (let i = 0; i < 8; i++) {
    const x = ((i * 420 - camX * 0.22) % (w + 200)) - 80;
    const y = 40 + ((i * 47) % 90) - (camY - 400) * 0.03;
    ctx.beginPath();
    ctx.ellipse(x, y, 70, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSilhouette(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  w: number,
  h: number,
  parallax: number,
  amp: number,
  color: string,
  freq: number,
): void {
  const groundSy = h / 2 - (168 - camY);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let sx = 0; sx <= w; sx += 18) {
    const wx = camX + (sx - w / 2) / Math.max(0.2, parallax);
    const hy = amp * Math.sin(wx * freq) + amp * 0.4 * Math.sin(wx * freq * 2.1);
    ctx.lineTo(sx, groundSy - 40 - hy * parallax);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

function drawTerrain(ctx: CanvasRenderingContext2D, sim: Sim, camX: number, camY: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(0, h);
  const step = 8;
  for (let sx = 0; sx <= w; sx += step) {
    const wx = camX + (sx - w / 2);
    const s = toScreen(wx, sim.heightAt(wx), camX, camY, w, h);
    ctx.lineTo(sx, s.y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = "#4a5a38";
  ctx.fill();
  ctx.fillStyle = "#5c6e44";
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let sx = 0; sx <= w; sx += step) {
    const wx = camX + (sx - w / 2);
    const s = toScreen(wx, sim.heightAt(wx) - 12, camX, camY, w, h);
    ctx.lineTo(sx, s.y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

function drawRunway(ctx: CanvasRenderingContext2D, sim: Sim, af: { x: number; half: number; friendly: boolean }, camX: number, camY: number, w: number, h: number): void {
  const dx = af.x - camX;
  if (Math.abs(dx) > w / 2 + af.half) return;
  ctx.strokeStyle = af.friendly ? "rgba(200,212,160,0.85)" : "rgba(80,70,60,0.7)";
  ctx.lineWidth = 10;
  ctx.lineCap = "butt";
  ctx.beginPath();
  let started = false;
  for (let ox = -af.half; ox <= af.half; ox += 12) {
    const s = toScreen(af.x + ox, sim.heightAt(af.x + ox) + 3, camX, camY, w, h);
    if (!started) {
      ctx.moveTo(s.x, s.y);
      started = true;
    } else ctx.lineTo(s.x, s.y);
  }
  ctx.stroke();
  if (af.friendly) {
    const s = toScreen(af.x, sim.heightAt(af.x) + 28, camX, camY, w, h);
    ctx.fillStyle = "rgba(200,212,160,0.9)";
    ctx.font = "700 12px Oswald, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(af.half > 230 ? "HOME" : "STRIP", s.x, s.y - 8);
  }
}

function drawBuilding(ctx: CanvasRenderingContext2D, b: Building, camX: number, camY: number, w: number, h: number, time: number): void {
  const s = toScreen(b.x, b.y, camX, camY, w, h);
  const colors: Record<string, string> = {
    hangar: "#6a6558",
    hq: "#c45c48",
    depot: "#7a6a4a",
    aa: "#4a4a42",
    base: "#8a3c32",
  };
  ctx.fillStyle = colors[b.kind] ?? "#555";
  ctx.fillRect(s.x - b.w / 2, s.y - b.h, b.w, b.h);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(s.x - b.w / 2, s.y - b.h, b.w, 6);
  if (b.kind === "base") {
    ctx.fillStyle = `rgba(196,92,72,${0.6 + 0.4 * Math.sin(time * 4)})`;
    ctx.fillRect(s.x - 4, s.y - b.h - 22, 8, 22);
    ctx.fillRect(s.x - 4, s.y - b.h - 28, 18, 10);
  }
  if (b.kind === "aa") {
    ctx.fillStyle = "#2a2a24";
    ctx.fillRect(s.x - 3, s.y - b.h - 14, 6, 14);
  }
}

function drawPlane(ctx: CanvasRenderingContext2D, p: Plane, camX: number, camY: number, w: number, h: number, time: number): void {
  const s = toScreen(p.x, p.y, camX, camY, w, h);
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.scale(p.facing, 1);
  ctx.rotate(-p.angle);
  if (p.flash > 0) ctx.globalAlpha = 0.45 + 0.55 * Math.sin(time * 40);
  ctx.fillStyle = FACTION_META[p.faction].color;
  ctx.beginPath();
  ctx.moveTo(26, 0);
  ctx.lineTo(-8, -7);
  ctx.lineTo(-18, -2);
  ctx.lineTo(-18, 2);
  ctx.lineTo(-8, 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#efe6cc";
  ctx.fillRect(-6, -16, 18, 3);
  ctx.fillRect(-4, 13, 16, 3);
  ctx.fillRect(-10, -12, 14, 2);
  ctx.fillStyle = "#2a2a24";
  ctx.fillRect(-4, -3, 8, 6);
  if (p.fuel > 0 && p.state === "air") {
    ctx.fillStyle = "#d8d0b0";
    const spin = (time * 40) % 1;
    ctx.fillRect(22, -6 + spin * 2, 6, 12);
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
    ctx.moveTo(ax, ay);
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
    ctx.fillStyle = `rgba(196,92,72,${pulse})`;
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
