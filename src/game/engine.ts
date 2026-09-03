import { CAMPAIGN, clamp, lerp, missionById, STEP } from "./constants";
import { GameAudio } from "./audio";
import { GameInput } from "./input";
import { renderWorld } from "./render";
import { writeSave, type SaveData } from "./save";
import { Sim, freshEvents } from "./sim";
import type { FactionId, HudState, Overlay } from "./types";

type Hooks = {
  onOverlay: (o: Overlay) => void;
  onHud: (h: HudState) => void;
};

export class RidgeAcesGame {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  sim = new Sim();
  input = new GameInput();
  audio = new GameAudio();
  save: SaveData;
  overlay: Overlay = "menu";
  paused = false;
  running = false;
  camX = 1800;
  camY = 420;
  acc = 0;
  last = 0;
  hudTimer = 0;
  resultTimer = 0;
  reduced = false;
  private detach: (() => void) | null = null;
  private hooks: Hooks;

  constructor(canvas: HTMLCanvasElement, hooks: Hooks, save: SaveData) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.canvas.style.pointerEvents = "none";
    this.hooks = hooks;
    this.save = save;
    this.input.invertPitch = save.settings.invertPitch;
    this.reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.detach = this.input.attach(this.canvas);
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    this.wireControlsTest();
  }

  stop(): void {
    this.running = false;
    this.detach?.();
    this.audio.destroy();
  }

  unlockAudio(): void {
    this.audio.unlock();
    this.audio.setVolumes(this.save.settings.sfx, this.save.settings.music);
    this.audio.startEngine();
  }

  play(missionId: string, faction: FactionId): void {
    if (this.resultTimer) window.clearTimeout(this.resultTimer);
    try {
      this.unlockAudio();
    } catch {
      /* autoplay */
    }
    const mission = missionById(missionId);
    this.sim.reset(mission, faction);
    const p = this.sim.player();
    if (p) {
      this.camX = p.x;
      this.camY = p.y;
    }
    this.paused = false;
    this.overlay = "play";
    this.hooks.onOverlay("play");
    this.hooks.onHud(this.sim.hud());
  }

  setPaused(v: boolean): void {
    this.paused = v;
    this.overlay = v ? "pause" : "play";
    this.hooks.onOverlay(this.overlay);
  }

  applySettings(): void {
    this.input.invertPitch = this.save.settings.invertPitch;
    this.audio.setVolumes(this.save.settings.sfx, this.save.settings.music);
    writeSave(this.save);
  }

  private frame(dt: number): void {
    this.resize();
    const act = this.input.sample();
    if (this.overlay === "play" && act.pause) this.setPaused(true);
    else if (this.overlay === "pause" && act.pause) this.setPaused(false);

    if (this.overlay === "play" && !this.paused) {
      this.acc += dt;
      const events = freshEvents();
      let steps = 0;
      while (this.acc >= STEP && steps < 5) {
        this.sim.step(act, events);
        this.acc -= STEP;
        steps++;
      }
      this.handleEvents(events);
      this.updateCam(dt);
      const pl = this.sim.player();
      const live = !!pl && pl.fuel > 0 && pl.state === "air";
      this.audio.setEngine(live ? 1 : 0, pl ? Math.hypot(pl.vx, pl.vy) : 0, live);
      this.audio.tickMusic(dt);
    } else {
      this.audio.setEngine(0, 0, false);
    }

    this.hudTimer += dt;
    if (this.hudTimer > 0.08) {
      this.hudTimer = 0;
      this.hooks.onHud(this.sim.hud());
    }
    this.draw();
  }

  private handleEvents(events: ReturnType<typeof freshEvents>): void {
    if (events.gun) this.audio.gun();
    if (events.bomb) this.audio.bombDrop();
    if (events.boom) this.audio.explosion(events.bigBoom);
    if (events.hit) this.audio.hit();
    const hud = this.sim.hud();
    if (hud.stalled && this.sim.time % 0.6 < STEP * 2) this.audio.stallWarn();
    if (events.over) {
      if (events.over === "win") {
        this.audio.win();
        this.scoreWin();
      } else this.audio.lose();
      if (this.resultTimer) window.clearTimeout(this.resultTimer);
      this.resultTimer = window.setTimeout(() => {
        this.resultTimer = 0;
        if (!this.running) return;
        this.audio.setEngine(0, 0, false);
        this.hooks.onOverlay("results");
        this.overlay = "results";
      }, events.over === "win" ? 900 : 1400);
    }
  }

  private scoreWin(): void {
    const bonus = Math.max(0, 80 - Math.floor(this.sim.time));
    this.sim.score += bonus;
    this.save.best = Math.max(this.save.best, this.sim.score);
    if (this.sim.mission.mode === "campaign") {
      const next = this.sim.mission.index + 1;
      const cur = this.save.unlocked[this.sim.faction] ?? 0;
      if (next > cur && next < CAMPAIGN.length) this.save.unlocked[this.sim.faction] = next;
      if (next >= CAMPAIGN.length) this.save.unlocked[this.sim.faction] = CAMPAIGN.length - 1;
    }
    writeSave(this.save);
  }

  private updateCam(dt: number): void {
    const p = this.sim.player();
    if (!p) return;
    const look = p.facing * clamp(Math.abs(p.vx), 0, 280) * 0.28;
    const k = 1 - Math.exp(-5.5 * dt);
    this.camX += (p.x + look - this.camX) * k;
    this.camY = lerp(this.camY, p.y + 20, 1 - Math.exp(-4 * dt));
    this.camY = clamp(this.camY, 260, 920);
  }

  private viewSize(): { w: number; h: number } {
    const w = this.canvas.clientWidth || this.canvas.parentElement?.clientWidth || window.innerWidth || 1280;
    const h = this.canvas.clientHeight || this.canvas.parentElement?.clientHeight || window.innerHeight || 720;
    return { w: Math.max(1, w), h: Math.max(1, h) };
  }

  private resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const { w, h } = this.viewSize();
    if (this.canvas.width !== Math.floor(w * dpr) || this.canvas.height !== Math.floor(h * dpr)) {
      this.canvas.width = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private draw(): void {
    const { w, h } = this.viewSize();
    const ctx = this.ctx;
    if (this.overlay === "menu" || this.overlay === "howto" || this.overlay === "settings" || this.overlay === "campaign" || this.overlay === "factions" || this.overlay === "briefing") {
      ctx.fillStyle = "#141610";
      ctx.fillRect(0, 0, w, h);
      this.drawMenuSky(ctx, w, h);
      return;
    }
    let sx = 0;
    let sy = 0;
    if (this.save.settings.shake && !this.reduced) {
      const t = this.sim.trauma * this.sim.trauma;
      sx = (Math.random() * 2 - 1) * t * 14;
      sy = (Math.random() * 2 - 1) * t * 10;
    }
    renderWorld(ctx, this.sim, this.camX, this.camY, w, h, sx, sy, this.sim.time);
  }

  private drawMenuSky(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#5a7084");
    g.addColorStop(1, "#c4c8a8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#4a5a38";
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 16) ctx.lineTo(x, h * 0.62 + Math.sin(x * 0.01) * 18);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  private wireControlsTest(): void {
    window.__controlsTest = {
      getYaw: () => ((this.sim.player()?.facing ?? 1) < 0 ? 1 : 0),
      getSpeed: () => {
        const p = this.sim.player();
        return p ? Math.hypot(p.vx, p.vy) : 0;
      },
      setSteer: (v: number) => this.input.setSteer(v),
      setKeys: (codes: string[]) => {
        this.input.setKeys(codes);
        if (codes.length && this.paused) this.setPaused(false);
      },
      setTouch: (pitch: number, stick = true) => {
        this.input.touchPitch = pitch;
        this.input.touchStick = stick;
        if (!stick) {
          this.input.touchPitch = 0;
          this.input.touchTurn = 0;
        }
      },
      goBase: () => {
        const p = this.sim.player();
        const b = this.sim.buildings.find((x) => x.kind === "base" && x.hp > 0);
        if (!p || !b) return;
        p.x = b.x;
        p.y = b.y + 180;
        p.vx = 0;
        p.vy = 0;
        p.angle = 0;
        p.facing = 1;
        p.state = "air";
        p.iframes = 2;
        this.camX = p.x;
        this.camY = p.y;
      },
      goStrip: () => {
        const p = this.sim.player();
        const af = this.sim.airfields.find((a) => a.friendly && a.half <= 230) ?? this.sim.airfields.find((a) => a.friendly);
        if (!p || !af) return;
        p.x = af.x;
        p.y = this.sim.heightAt(af.x) + 18;
        p.vx = 0;
        p.vy = 0;
        p.state = "parked";
        this.camX = p.x;
        this.camY = p.y + 80;
      },
      startMission: (id: string) => this.play(id, "westmere"),
      setFuel: (v: number) => {
        const pl = this.sim.player();
        if (pl) pl.fuel = Math.max(0, v);
      },
      dump: () => {
        const p = this.sim.player();
        return {
          over: this.sim.over,
          score: this.sim.score,
          obj: this.sim.objective,
          time: this.sim.time,
          overlay: this.overlay,
          fuel: p ? Math.round(p.fuel * 10) / 10 : 0,
          angle: p ? Math.round((p.angle ?? 0) * 100) / 100 : 0,
          front: [Math.round(this.sim.frontMin), Math.round(this.sim.frontMax)],
          fuelMax: p?.stats.fuel ?? 0,
          burn: p?.stats.burn ?? 0,
          range: p ? Math.round((p.stats.fuel / p.stats.burn) * 215) : 0,
          strips: this.sim.airfields.filter((a) => a.friendly).map((a) => ({ x: Math.round(a.x), half: a.half, home: a.half > 230 })),
          planes: this.sim.planes.map((pl) => ({
            id: pl.id,
            fac: pl.faction,
            player: pl.player,
            st: pl.state,
            x: Math.round(pl.x),
            y: Math.round(pl.y),
            spd: Math.round(Math.hypot(pl.vx, pl.vy)),
            bombs: pl.bombs,
            facing: pl.facing,
            hp: Math.round(pl.hp),
            alt: Math.round(pl.y - this.sim.heightAt(pl.x)),
          })),
          bombs: this.sim.bombs.filter((b) => b.alive).map((b) => ({ x: Math.round(b.x), y: Math.round(b.y), vx: Math.round(b.vx), vy: Math.round(b.vy) })),
          bases: this.sim.buildings.filter((b) => b.kind === "base").map((b) => ({ x: Math.round(b.x), hp: b.hp, fac: b.faction })),
          aa: this.sim.buildings.filter((b) => b.kind === "aa" && b.hp > 0).length,
        };
      },
    };
  }
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setSteer: (v: number) => void;
      setKeys: (codes: string[]) => void;
      setTouch: (pitch: number, stick?: boolean) => void;
      goBase: () => void;
      goStrip: () => void;
      startMission: (id: string) => void;
      setFuel: (v: number) => void;
      dump: () => unknown;
    };
  }
}
