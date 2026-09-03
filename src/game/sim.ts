import {
  BOMB_FUSE,
  BULLET_LIFE,
  BULLET_SPEED,
  CRUISE,
  FACTION_META,
  GEAR,
  GRAVITY,
  HOME_X,
  PLANE_RAD,
  PITCH_RATE,
  QUICK,
  STEP,
  THRUST,
  WORLD_CEILING,
  WORLD_W,
  clamp,
  rivalOf,
  wrap,
  wrapDelta,
} from "./constants";
import type {
  Actions,
  Airfield,
  Bomb,
  Building,
  Bullet,
  Explosion,
  FactionId,
  Floater,
  HudState,
  MissionDef,
  Particle,
  Plane,
} from "./types";

let nid = 1;
const id = () => nid++;

export class Sim {
  time = 0;
  score = 0;
  faction: FactionId = "westmere";
  mission: MissionDef = QUICK;
  objective = { ...QUICK.objective };
  planes: Plane[] = [];
  buildings: Building[] = [];
  airfields: Airfield[] = [];
  bullets: Bullet[] = [];
  bombs: Bomb[] = [];
  particles: Particle[] = [];
  explosions: Explosion[] = [];
  floaters: Floater[] = [];
  heights: number[] = [];
  frontMin = 120;
  frontMax = 5000;
  playerId = 0;
  over: "win" | "lose" | null = null;
  overT = 0;
  trauma = 0;
  message = "";
  messageT = 0;
  private bulletPool: Bullet[] = [];
  private bombPool: Bomb[] = [];

  reset(mission: MissionDef, faction: FactionId): void {
    this.time = 0;
    this.score = 0;
    this.faction = faction;
    this.mission = mission;
    this.objective = { ...mission.objective, have: 0 };
    this.planes = [];
    this.buildings = [];
    this.airfields = [];
    this.bullets = [];
    this.bombs = [];
    this.particles = [];
    this.explosions = [];
    this.floaters = [];
    this.over = null;
    this.overT = 0;
    this.trauma = 0;
    this.message = mission.title;
    this.messageT = 2.2;
    this.buildWorld(faction);
    this.spawnPlayer(faction, mission.airborne);
    this.spawnEnemies(faction, mission);
  }

  player(): Plane | undefined {
    return this.planes.find((p) => p.id === this.playerId);
  }

  heightAt(x: number): number {
    const wx = wrap(x);
    const n = this.heights.length;
    if (n < 2) return 168;
    const f = wx / 40;
    const i0 = Math.floor(f);
    const t = f - i0;
    const a = this.heights[clamp(i0, 0, n - 1)] ?? 168;
    const b = this.heights[clamp(i0 + 1, 0, n - 1)] ?? a;
    return a + (b - a) * t;
  }

  private raidLayout() {
    const homeX = HOME_X;
    const far =
      this.mission.index >= 4 ? 8400 : this.mission.index >= 3 ? 7400 : this.mission.index >= 2 ? 5600 : this.mission.index >= 1 ? 4000 : 2400;
    const n = Math.max(1, this.mission.bases);
    const bases: number[] = [];
    for (let i = 0; i < n; i++) bases.push(wrap(homeX + far * ((i + 1) / n)));
    const hops = this.mission.index >= 2 || n >= 3 ? 2 : 1;
    const strips: number[] = [];
    for (let i = 1; i <= hops; i++) {
      let x = wrap(homeX + (far * i) / (hops + 1));
      for (const bx of bases) {
        if (Math.abs(wrapDelta(x, bx)) < 420) x = wrap(x - 500);
      }
      strips.push(x);
    }
    return { homeX, bases, strips, far };
  }

  private addField(faction: FactionId, x: number, half: number, friendly: boolean): Airfield {
    const af: Airfield = { id: this.airfields.length, faction, x: wrap(x), elev: 168, half, friendly };
    this.airfields.push(af);
    return af;
  }

  private bakeHeight(pads: { x: number; half: number; elev: number }[]): void {
    const n = Math.ceil(WORLD_W / 40) + 2;
    this.heights = [];
    for (let i = 0; i < n; i++) {
      const x = i * 40;
      let h = 150 + Math.sin(x * 0.0011) * 28 + Math.sin(x * 0.00037) * 18;
      for (const p of pads) {
        const d = Math.abs(wrapDelta(x, p.x));
        if (d < p.half) {
          const t = 1 - d / p.half;
          h = h * (1 - t) + p.elev * t;
        }
      }
      this.heights.push(h);
    }
  }

  private addBuilding(kind: Building["kind"], af: Airfield, ox: number, w: number, h: number, hp: number): void {
    const x = wrap(af.x + ox);
    this.buildings.push({
      id: id(),
      kind,
      faction: af.faction,
      airfield: af.id,
      x,
      y: this.heightAt(x),
      w,
      h,
      hp,
      maxHp: hp,
      fireCd: 0,
    });
  }

  private buildWorld(playerFac: FactionId): void {
    const layout = this.raidLayout();
    this.frontMin = Math.max(120, layout.homeX - 720);
    this.frontMax = layout.homeX + layout.far + 920;
    const home = this.addField(playerFac, layout.homeX, 260, true);
    const stripFields = layout.strips.map((x) => this.addField(playerFac, x, 200, true));
    const rival = rivalOf(playerFac);
    const enemyFields = layout.bases.map((x) => this.addField(rival, x, 220, false));
    this.bakeHeight(this.airfields.map((a, i) => ({ x: a.x, half: a.half + 36, elev: 166 + (i % 2) * 8 })));
    for (const a of this.airfields) a.elev = this.heightAt(a.x);
    this.addBuilding("hangar", home, -130, 120, 52, 80);
    this.addBuilding("hq", home, 30, 70, 78, 70);
    this.addBuilding("depot", home, 150, 88, 58, 55);
    for (const s of stripFields) this.addBuilding("depot", s, 40, 64, 42, 48);
    const aaN = Math.max(1, this.mission.aaPerBase);
    const offsets = [-210, 210, -100, 100, 0, -300];
    for (const af of enemyFields) {
      this.addBuilding("base", af, 0, 100, 74, 72);
      this.addBuilding("depot", af, 118, 78, 48, 48);
      for (let i = 0; i < aaN; i++) this.addBuilding("aa", af, offsets[i] ?? -160 + i * 70, 46, 36, 34);
    }
  }

  private mkPlane(faction: FactionId, player: boolean): Plane {
    const stats = { ...FACTION_META[faction].stats };
    return {
      id: id(),
      faction,
      player,
      x: 0,
      y: 400,
      vx: 0,
      vy: 0,
      angle: 0,
      hp: stats.hp,
      fuel: stats.fuel,
      ammo: stats.ammo,
      bombs: stats.bombs,
      state: "air",
      inverted: false,
      facing: 1,
      lastHitBy: -1,
      fireCd: 0,
      bombCd: 0,
      flash: 0,
      smoke: 0,
      crashT: 0,
      onRunway: false,
      iframes: 0,
      ai: "hunt",
      aiTimer: 0,
      stats,
    };
  }

  private spawnPlayer(faction: FactionId, airborne: boolean): void {
    const af = this.airfields.find((a) => a.friendly) ?? this.airfields[0]!;
    const p = this.mkPlane(faction, true);
    if (airborne) {
      p.x = wrap(af.x + 80);
      p.y = af.elev + 340;
      p.facing = 1;
      p.vx = CRUISE;
      p.vy = 12;
      p.angle = 0;
      p.state = "air";
    } else {
      p.x = wrap(af.x - 40);
      p.y = this.heightAt(p.x) + GEAR;
      p.state = "parked";
    }
    p.iframes = 2.6;
    p.bombs = Math.max(p.stats.bombs, this.mission.bases + 2);
    p.stats.bombs = p.bombs;
    this.planes.push(p);
    this.playerId = p.id;
  }

  private spawnEnemies(playerFac: FactionId, mission: MissionDef): void {
    const rival = rivalOf(playerFac);
    const n = mission.enemyCount + mission.bombers;
    const bases = this.buildings.filter((b) => b.kind === "base");
    for (let i = 0; i < n; i++) {
      const bomber = i >= mission.enemyCount;
      const e = this.mkPlane(rival, false);
      if (mission.ace && i === 0) {
        e.stats = { ...e.stats, hp: e.stats.hp + 40, turn: e.stats.turn + 0.4, power: e.stats.power + 40 };
        e.hp = e.stats.hp;
      }
      const spot = bomber || (mission.ace && i === 0) ? bases[bases.length - 1] : bases[i % Math.max(1, bases.length)];
      const anchor = spot?.x ?? HOME_X + 2000;
      e.ai = bomber ? "bomb" : "hunt";
      e.x = wrap(anchor + (bomber ? -60 : 70 + (i % 3) * 55));
      e.y = this.heightAt(e.x) + 340 + (i % 3) * 40;
      e.facing = -1;
      e.vx = e.facing * CRUISE * 0.62;
      e.vy = 0;
      e.angle = 0;
      e.state = "air";
      if (bomber) e.bombs = 4;
      this.planes.push(e);
    }
  }

  step(act: Actions, events: SimEvents): void {
    this.time += STEP;
    this.trauma = Math.max(0, this.trauma - STEP * 1.8);
    this.messageT = Math.max(0, this.messageT - STEP);
    if (this.over) {
      this.overT += STEP;
      for (const p of this.planes) this.integrate(p, events);
      this.stepBullets(events);
      this.stepBombs(events);
      this.stepFx();
      return;
    }

    const player = this.player();
    if (player && player.state !== "dead" && player.state !== "crash") {
      if (act.turn > 0.35 && player.facing > 0) player.facing = -1;
      if (act.turn < -0.35 && player.facing < 0) player.facing = 1;
      this.arcade(player, act.pitch);
      if (act.fire) this.tryFire(player, events);
      if (act.bomb) this.tryBomb(player, events);
    }

    for (const p of this.planes) {
      if (p.player) continue;
      if (p.state === "air") this.think(p, events);
      else this.arcade(p, 0);
    }
    for (const p of this.planes) this.integrate(p, events);
    this.stepBullets(events);
    this.stepBombs(events);
    this.stepAA(events);
    this.rearmCheck();
    this.stepFx();
    this.checkObjectives(events);
  }

  private arcade(p: Plane, climb: number): void {
    if (p.state === "crash" || p.state === "dead") return;
    const live = p.fuel > 0;
    const thrust = p.player ? THRUST : THRUST * 0.62;

    if (p.state === "parked") {
      if (climb > 0.18) {
        if (!live) {
          if (p.player) this.say("Engine's dead. No fuel.");
          return;
        }
        p.state = "air";
        p.angle = 0.42;
        p.vx = p.facing * 110;
        p.vy = 95;
      } else {
        p.vx = 0;
        p.vy = 0;
        p.angle = 0;
        return;
      }
    }
    if (p.state === "taxi") {
      if (climb > 0.18) {
        if (!live) {
          if (p.player) this.say("Engine's dead. No fuel.");
          p.vx *= 0.84;
          return;
        }
        p.state = "air";
        p.angle = 0.38;
        p.vy = 90;
      } else {
        p.vx *= 0.84;
        if (Math.abs(p.vx) < 12) {
          p.vx = 0;
          p.state = "parked";
        }
        p.vy = 0;
        p.angle = 0;
        return;
      }
    }

    if (p.state === "air") {
      p.angle += climb * PITCH_RATE * STEP;
      if (p.angle > Math.PI) p.angle -= Math.PI * 2;
      if (p.angle < -Math.PI) p.angle += Math.PI * 2;
      if (Math.abs(climb) < 0.08) {
        const spd = Math.hypot(p.vx, p.vy);
        if (spd < 88) p.angle -= 1.85 * STEP;
        else p.angle += (0 - p.angle) * Math.min(1, 0.7 * STEP);
      }
      const c = Math.cos(p.angle);
      const s = Math.sin(p.angle);
      const spd = Math.hypot(p.vx, p.vy);
      if (live) {
        p.vx += p.facing * c * thrust * STEP;
        p.vy += s * thrust * STEP;
        p.vy += 78 * STEP;
        p.vy += GRAVITY * STEP;
        const drag = 0.7 + spd * 0.018 + (Math.abs(p.angle) > 1.05 ? 1.8 : 0);
        p.vx -= p.vx * drag * STEP;
        p.vy -= p.vy * drag * STEP;
      } else {
        const wantVx = p.facing * c * spd;
        const wantVy = s * spd;
        p.vx += (wantVx - p.vx) * Math.min(1, 3.2 * STEP);
        p.vy += (wantVy - p.vy) * Math.min(1, 3.2 * STEP);
        p.vy += GRAVITY * 0.48 * STEP;
        p.vx -= p.vx * 0.14 * STEP;
        p.vy -= p.vy * 0.08 * STEP;
      }
      if (p.y > WORLD_CEILING - 50 && s > 0.2) p.vy = Math.min(p.vy, 24);
      if (live && p.player) p.fuel = Math.max(0, p.fuel - p.stats.burn * STEP);
      if (live && p.fuel <= 0 && p.player) this.say("Engine cut — glide to the green STRIP.");
    }
    p.inverted = Math.abs(p.angle) > 1.45;
  }

  private integrate(p: Plane, events: SimEvents): void {
    p.fireCd = Math.max(0, p.fireCd - STEP);
    p.bombCd = Math.max(0, p.bombCd - STEP);
    p.flash = Math.max(0, p.flash - STEP);
    p.iframes = Math.max(0, p.iframes - STEP);
    p.aiTimer = Math.max(0, p.aiTimer - STEP);
    if (p.state === "dead") return;
    if (p.state === "crash") {
      p.crashT += STEP;
      p.angle += 5 * STEP;
      p.vy += GRAVITY * 1.4 * STEP;
      p.x += p.vx * STEP;
      p.y += p.vy * STEP;
      if (p.crashT > 1.4) p.state = "dead";
      return;
    }
    p.x += p.vx * STEP;
    p.y += p.vy * STEP;
    this.holdFront(p);
    const g = this.heightAt(p.x);
    p.onRunway = this.friendlyRunwayAt(p.x) != null && p.y < g + 80;
    if (p.y < g + GEAR) {
      if (p.state === "air" && p.vy < -90) this.damage(p, 10, events, -1);
      if (p.player && p.state === "air" && p.vy < -40) this.say("Hard landing.");
      p.y = g + GEAR;
      if (p.vy < 0) p.vy = 0;
      p.vx *= 0.96;
      if (!p.player) {
        p.y = g + GEAR + 80;
        p.vy = 120;
        p.state = "air";
        return;
      }
      if (p.state === "air") {
        p.state = "taxi";
        this.say("Down. Press up to take off.");
      }
      if (p.state === "taxi" && Math.abs(p.vx) < 12) {
        p.state = "parked";
        p.vx = 0;
      }
    } else if (p.state === "taxi" || p.state === "parked") {
      p.state = "air";
    }
    if (p.player && p.state === "air") {
      if (p.fuel <= 0 && this.messageT <= 0) this.say("Fuel gone. Glide to a green strip.");
      else if (p.fuel < 9 && this.messageT <= 0) this.say("Fuel low — land on a green strip.");
    }
  }

  private holdFront(p: Plane): void {
    const pad = 40;
    if (p.x < this.frontMin + 260) {
      p.vx += 220 * STEP;
      if (p.x < this.frontMin + 140 && p.player) this.say("End of the front — turn around.");
    }
    if (p.x > this.frontMax - 260) {
      p.vx -= 220 * STEP;
      if (p.x > this.frontMax - 140 && p.player) this.say("End of the front — turn around.");
    }
    if (p.x < this.frontMin + pad) {
      p.x = this.frontMin + pad;
      if (p.vx < 0) p.vx = 70;
      p.facing = 1;
    }
    if (p.x > this.frontMax - pad) {
      p.x = this.frontMax - pad;
      if (p.vx > 0) p.vx = -70;
      p.facing = -1;
    }
  }

  private think(p: Plane, events: SimEvents): void {
    const player = this.player();
    const alt = p.y - this.heightAt(p.x);
    let targetY = this.heightAt(p.x) + 340;
    let wantFire = false;
    let wantBomb = false;
    if (p.ai === "bomb") {
      const homes = this.buildings.filter((b) => b.hp > 0 && b.faction !== p.faction && (b.kind === "hangar" || b.kind === "hq"));
      const best = homes[0];
      if (best) {
        targetY = this.heightAt(best.x) + 240;
        if (Math.abs(wrapDelta(p.x, best.x)) < 40 && alt < 280) wantBomb = true;
        if (wrapDelta(p.x, best.x) > 40) p.facing = 1;
        if (wrapDelta(p.x, best.x) < -40) p.facing = -1;
      }
    } else if (player && player.state === "air") {
      const dx = wrapDelta(p.x, player.x);
      const dy = player.y - p.y;
      const dist = Math.hypot(dx, dy);
      targetY = player.y + 55;
      if (p.aiTimer <= 0 && Math.sign(dx) !== p.facing && Math.abs(dx) > 280) {
        p.facing = dx >= 0 ? 1 : -1;
        p.aiTimer = 1.8;
      }
      const aligned = Math.abs(dy) < 36 && Math.sign(dx) === p.facing;
      if (this.time > 8 && aligned && dist < 240 && dist > 90) wantFire = true;
      if (dist < 70) {
        p.ai = "evade";
        p.aiTimer = 1.1;
      }
    }
    if (p.ai === "evade") {
      targetY = p.y + 140;
      if (p.aiTimer <= 0) p.ai = "hunt";
    }
    const dy = targetY - p.y;
    const want = clamp(Math.atan2(dy, 220), -0.7, 0.85);
    let climb = clamp((want - p.angle) * 1.6, -1, 1);
    if (alt < 180) climb = Math.max(climb, 0.85);
    this.arcade(p, climb);
    p.angle = clamp(p.angle, -0.85, 1.0);
    if (wantFire) this.tryFire(p, events);
    if (wantBomb) this.tryBomb(p, events);
  }

  private tryFire(p: Plane, events: SimEvents): void {
    if (p.fireCd > 0 || p.ammo <= 0 || p.state === "parked") return;
    p.fireCd = p.player ? 0.1 : 0.95;
    p.ammo -= 1;
    const b = this.allocBullet();
    if (!b) return;
    const c = Math.cos(p.angle);
    const s = Math.sin(p.angle);
    b.alive = true;
    b.x = p.x + p.facing * c * 28;
    b.y = p.y + s * 28;
    b.vx = p.facing * c * BULLET_SPEED + p.vx * 0.2;
    b.vy = s * BULLET_SPEED + p.vy * 0.2;
    b.life = BULLET_LIFE;
    b.owner = p.id;
    b.faction = p.faction;
    b.aa = false;
    this.bullets.push(b);
    if (p.player) events.gun = true;
  }

  private tryBomb(p: Plane, events: SimEvents): void {
    if (p.bombCd > 0 || p.bombs <= 0 || p.state === "parked") return;
    p.bombCd = 0.55;
    p.bombs -= 1;
    const b = this.allocBomb();
    if (!b) return;
    b.alive = true;
    b.x = p.x;
    b.y = p.y - 12;
    const vertical = p.angle > 1.22 && p.angle < 2.12;
    if (vertical) {
      b.vx = p.vx * 0.15;
      b.vy = -90;
    } else {
      b.vx = p.vx * 1.08;
      b.vy = p.vy * 0.95 - 16;
    }
    b.fuse = BOMB_FUSE;
    b.owner = p.id;
    b.faction = p.faction;
    this.bombs.push(b);
    if (p.player) events.bomb = true;
  }

  private stepBullets(events: SimEvents): void {
    for (const b of this.bullets) {
      if (!b.alive) continue;
      b.x += b.vx * STEP;
      b.y += b.vy * STEP;
      b.life -= STEP;
      if (b.life <= 0 || b.x < this.frontMin - 80 || b.x > this.frontMax + 80) {
        b.alive = false;
        continue;
      }
      if (b.y <= this.heightAt(b.x) + 4) {
        b.alive = false;
        continue;
      }
      for (const p of this.planes) {
        if (!b.alive || p.state === "dead" || p.id === b.owner || p.faction === b.faction) continue;
        if (Math.hypot(p.x - b.x, p.y - b.y) < PLANE_RAD) {
          this.damage(p, b.aa ? 8 : 18, events, b.owner);
          b.alive = false;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => {
      if (b.alive) return true;
      this.bulletPool.push(b);
      return false;
    });
  }

  private stepBombs(events: SimEvents): void {
    for (const b of this.bombs) {
      if (!b.alive) continue;
      b.vy += GRAVITY * 0.92 * STEP;
      b.x += b.vx * STEP;
      b.y += b.vy * STEP;
      b.fuse -= STEP;
      const g = this.heightAt(b.x);
      let hit = b.y <= g + 4;
      if (b.fuse <= 0) {
        for (const bd of this.buildings) {
          if (bd.hp <= 0) continue;
          const rad = bd.kind === "base" ? 120 : Math.max(bd.w, 40) * 0.75;
          if (Math.hypot(b.x - bd.x, b.y - (bd.y + bd.h * 0.4)) < rad) {
            this.hurtBuilding(bd, 200, b.owner, events);
            hit = true;
          }
        }
      }
      if (hit) {
        this.boom(b.x, Math.max(b.y, g), 1.1, events);
        b.alive = false;
      }
    }
    this.bombs = this.bombs.filter((b) => {
      if (b.alive) return true;
      this.bombPool.push(b);
      return false;
    });
  }

  private stepAA(events: SimEvents): void {
    const hostiles = this.planes.filter((p) => p.state === "air");
    const heat = Math.max(0.55, 1.45 - this.mission.index * 0.16);
    const range = 250 + this.mission.index * 30;
    const maxAlt = 220 + this.mission.index * 40;
    for (const bd of this.buildings) {
      if (bd.kind !== "aa" || bd.hp <= 0) continue;
      bd.fireCd -= STEP;
      if (bd.fireCd > 0) continue;
      let best: Plane | null = null;
      let bestD = range + 40;
      for (const p of hostiles) {
        if (p.faction === bd.faction) continue;
        const dx = Math.abs(wrapDelta(bd.x, p.x));
        const alt = p.y - this.heightAt(p.x);
        if (dx > range) continue;
        if (p.player) {
          if (this.time < 3.5) continue;
          if (alt > maxAlt) continue;
        } else if (alt > 240) continue;
        const d = Math.hypot(dx, bd.y + 40 - p.y);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      if (!best) continue;
      bd.fireCd = best.player ? heat : heat + 0.25;
      const dx = wrapDelta(bd.x, best.x + best.vx * 0.18);
      const dy = best.y - (bd.y + 28);
      const a = Math.atan2(dy, dx);
      const b = this.allocBullet();
      if (!b) continue;
      b.alive = true;
      b.x = bd.x;
      b.y = bd.y + 28;
      b.vx = Math.cos(a) * 420;
      b.vy = Math.sin(a) * 420;
      b.life = 0.55;
      b.owner = -2;
      b.faction = bd.faction;
      b.aa = true;
      this.bullets.push(b);
      if (best.player) this.say("Flak!");
    }
  }

  private friendlyRunwayAt(x: number): Airfield | null {
    for (const a of this.airfields) {
      if (!a.friendly) continue;
      if (Math.abs(x - a.x) < a.half) return a;
    }
    return null;
  }

  private rearmCheck(): void {
    const p = this.player();
    if (!p || p.state === "dead") return;
    if ((p.state !== "parked" && p.state !== "taxi") || Math.abs(p.vx) > 32) return;
    const af = this.friendlyRunwayAt(p.x);
    if (!af) return;
    p.fuel = Math.min(p.stats.fuel, p.fuel + 12 * STEP);
    p.hp = Math.min(p.stats.hp, p.hp + 18 * STEP);
    p.ammo = Math.min(p.stats.ammo, p.ammo + 20 * STEP);
    if (p.bombs < p.stats.bombs && this.time % 1.2 < STEP) p.bombs += 1;
    if (this.messageT <= 0) this.say("Service — sit still.");
  }

  private damage(p: Plane, amt: number, events: SimEvents, by: number): void {
    if (p.state === "dead" || p.state === "crash") return;
    if (p.iframes > 0 && p.player) return;
    p.hp -= amt;
    p.flash = 0.18;
    p.lastHitBy = by;
    events.hit = true;
    if (p.player) {
      p.iframes = 1.2;
      this.trauma = Math.min(1, this.trauma + 0.35);
      this.say(amt > 12 ? "Taking fire!" : "Hit.");
    }
    if (p.hp <= 0) {
      p.state = "crash";
      p.crashT = 0;
      this.boom(p.x, p.y, 0.9, events);
      if (p.player) this.finish("lose", events);
      else if (by === this.playerId) this.score += 40;
    }
  }

  private hurtBuilding(bd: Building, amt: number, owner: number, events: SimEvents): void {
    if (bd.hp <= 0) return;
    bd.hp -= amt;
    this.floaters.push({ x: bd.x, y: bd.y + bd.h + 20, life: 0.9, max: 0.9, text: bd.kind === "base" ? "HQ" : "HIT", color: "#efe6cc" });
    if (bd.hp <= 0) {
      bd.hp = 0;
      this.boom(bd.x, bd.y + bd.h * 0.4, 1.3, events);
      if (bd.kind === "base" && owner === this.playerId) {
        this.objective.have += 1;
        this.score += 120;
        this.say("Base down.");
      }
    }
  }

  private boom(x: number, y: number, scale: number, events: SimEvents): void {
    this.explosions.push({ x, y, t: 0, scale });
    events.boom = true;
    events.bigBoom = scale > 1;
    this.trauma = Math.min(1, this.trauma + 0.25 * scale);
    for (let i = 0; i < 10; i++) {
      this.emit(x, y, (Math.random() - 0.5) * 180, 40 + Math.random() * 80, "#e8c090", 5, 0.5);
    }
  }

  private emit(x: number, y: number, vx: number, vy: number, color: string, size: number, life: number): void {
    this.particles.push({ x, y, vx, vy, life, max: life, size, color });
  }

  private stepFx(): void {
    for (const p of this.particles) {
      p.x += p.vx * STEP;
      p.y += p.vy * STEP;
      p.vy += GRAVITY * 0.2 * STEP;
      p.life -= STEP;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const e of this.explosions) e.t += STEP;
    this.explosions = this.explosions.filter((e) => e.t < 0.42);
    for (const f of this.floaters) {
      f.y += 30 * STEP;
      f.life -= STEP;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
  }

  private checkObjectives(events: SimEvents): void {
    if (this.over) return;
    if (this.objective.kind === "bases" && this.objective.have >= this.objective.need) this.finish("win", events);
  }

  private finish(kind: "win" | "lose", events: SimEvents): void {
    if (this.over) return;
    this.over = kind;
    this.overT = 0;
    events.over = kind;
  }

  private say(text: string): void {
    this.message = text;
    this.messageT = 1.6;
  }

  private allocBullet(): Bullet | null {
    return this.bulletPool.pop() ?? (this.bullets.length < 120 ? { alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, owner: 0, faction: "westmere", aa: false } : null);
  }
  private allocBomb(): Bomb | null {
    return this.bombPool.pop() ?? (this.bombs.length < 20 ? { alive: false, x: 0, y: 0, vx: 0, vy: 0, fuse: 0, owner: 0, faction: "westmere" } : null);
  }

  private nearestFriendly(x: number): Airfield | null {
    let best: Airfield | null = null;
    let bestD = 1e9;
    for (const a of this.airfields) {
      if (!a.friendly) continue;
      const d = Math.abs(x - a.x);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }
  private nearestBase(x: number): Building | null {
    let best: Building | null = null;
    let bestD = 1e9;
    for (const b of this.buildings) {
      if (b.kind !== "base" || b.hp <= 0) continue;
      const d = Math.abs(x - b.x);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  hud(): HudState {
    const p = this.player();
    const spd = p ? Math.hypot(p.vx, p.vy) : 0;
    const g = p ? this.heightAt(p.x) : 0;
    const objHave = Math.min(this.objective.have, this.objective.need);
    let obj = `${this.objective.label}  ${objHave}/${this.objective.need}`;
    let stripHint = "";
    if (p && this.objective.kind === "bases") {
      const nb = this.nearestBase(p.x);
      if (nb) {
        const d = Math.abs(p.x - nb.x);
        obj = `Bases ${objHave}/${this.objective.need} · ${Math.round(d)} ${p.x <= nb.x ? "ahead" : "behind"}`;
      }
    }
    if (p) {
      const strip = this.nearestFriendly(p.x);
      if (strip && Math.abs(p.x - strip.x) > 80) {
        const d = Math.abs(p.x - strip.x);
        const tag = strip.half > 230 ? "HOME" : "STRIP";
        stripHint = `${tag} ${Math.round(d)} ${p.x <= strip.x ? "ahead" : "behind"}`;
        if (p.fuel <= 0) stripHint = `GLIDE → ${stripHint}`;
        else if (p.fuel < p.stats.fuel * 0.4) stripHint = `Fuel low · ${stripHint}`;
      } else if (strip) stripHint = "Over a strip — sit still to refill";
    }
    return {
      hp: p?.hp ?? 0,
      hpMax: p?.stats.hp ?? 1,
      fuel: p?.fuel ?? 0,
      fuelMax: p?.stats.fuel ?? 1,
      ammo: Math.floor(p?.ammo ?? 0),
      bombs: p?.bombs ?? 0,
      speed: spd,
      alt: p ? p.y - g : 0,
      score: this.score,
      objective: obj,
      stripHint,
      fuelEmpty: !!p && p.fuel <= 0 && p.state === "air",
      stalled: !!p && p.state === "air" && (p.angle > 0.75 || (p.y - g < 110 && p.vy < -50)),
      grounded: !!p && (p.state === "parked" || p.state === "taxi"),
      hurt: !!p && (p.flash > 0 || p.iframes > 0.2),
      faction: this.faction,
      message: this.messageT > 0 ? this.message : "",
    };
  }
}

export type SimEvents = {
  gun: boolean;
  bomb: boolean;
  boom: boolean;
  bigBoom: boolean;
  hit: boolean;
  over: "win" | "lose" | null;
};

export function freshEvents(): SimEvents {
  return { gun: false, bomb: false, boom: false, bigBoom: false, hit: false, over: null };
}

