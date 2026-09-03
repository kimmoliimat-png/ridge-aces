import type { FactionId, MissionDef, PlaneStats } from "./types";

export const STEP = 1 / 60;
export const WORLD_W = 16800;
export const WORLD_CEILING = 1180;
export const GRAVITY = -155;
export const BULLET_SPEED = 820;
export const BULLET_LIFE = 0.75;
export const BOMB_FUSE = 0.18;
export const PLANE_RAD = 28;
export const GEAR = 18;
export const CRUISE = 215;
export const PITCH_RATE = 2.05;
export const THRUST = 1180;
export const HOME_X = 1800;

export const FACTION_ORDER: FactionId[] = ["westmere", "ironvale", "frostholm", "sunreach"];

export const FACTION_META: Record<
  FactionId,
  { label: string; blurb: string; color: string; plane: string; stats: PlaneStats }
> = {
  westmere: {
    label: "Westmere",
    blurb: "Balanced Kestrel triplane. The ridge's old hands.",
    color: "#6a8a4a",
    plane: "Kestrel",
    stats: { name: "Kestrel", power: 455, turn: 2.7, hp: 140, ammo: 140, bombs: 5, fuel: 50, burn: 1.65, drag: 0.00115, stall: 72 },
  },
  ironvale: {
    label: "Ironvale",
    blurb: "Armored Ironback. Slow to turn, hard to knock down.",
    color: "#6a6e76",
    plane: "Ironback",
    stats: { name: "Ironback", power: 410, turn: 2.15, hp: 150, ammo: 120, bombs: 6, fuel: 56, burn: 1.6, drag: 0.00128, stall: 78 },
  },
  frostholm: {
    label: "Frostholm",
    blurb: "Snowfox. Tough hide, sharp pitch authority.",
    color: "#7a96a8",
    plane: "Snowfox",
    stats: { name: "Snowfox", power: 430, turn: 2.9, hp: 125, ammo: 130, bombs: 5, fuel: 52, burn: 1.6, drag: 0.0011, stall: 70 },
  },
  sunreach: {
    label: "Sunreach",
    blurb: "Firedart. Fast, fragile, first to the merge.",
    color: "#c45c48",
    plane: "Firedart",
    stats: { name: "Firedart", power: 510, turn: 3.2, hp: 78, ammo: 110, bombs: 4, fuel: 46, burn: 1.75, drag: 0.00098, stall: 68 },
  },
};

export const CAMPAIGN: MissionDef[] = [
  {
    id: "m1",
    title: "First Blood",
    story: "Silence {rival}'s lookout on the next hill.",
    brief:
      "Dawn patrol. {rival} parked a lookout over the next rise — one roof, green AA, one crate on station. Put a bomb through the HQ and come home. A green strip sits on the way if they hole you.",
    winLine: "The lookout is silent.",
    mode: "campaign",
    index: 0,
    airborne: true,
    enemyCount: 1,
    bombers: 0,
    ace: false,
    bases: 1,
    aaPerBase: 1,
    objective: { kind: "bases", need: 1, have: 0, label: "Bomb the lookout" },
  },
  {
    id: "m2",
    title: "Cut the Dumps",
    story: "Burn the two dumps that were feeding that lookout.",
    brief:
      "The lookout was a finger. The dumps are the arm. Two posts, guns on both. Hit each HQ before {rival} hauls the ammo west. Land and sit still if the first run leaves you leaking.",
    winLine: "Their dumps are burning.",
    mode: "campaign",
    index: 1,
    airborne: true,
    enemyCount: 2,
    bombers: 0,
    ace: false,
    bases: 2,
    aaPerBase: 2,
    objective: { kind: "bases", need: 2, have: 0, label: "Bomb 2 dumps" },
  },
  {
    id: "m3",
    title: "The Battery",
    story: "Three posts of their gun line. Fuel will run thin.",
    brief:
      "{rival} dug a battery along the ridge — three HQs, flak on the flanks. You can stretch a tank almost to the last gun, but a green strip is there for a reason. Land, sit still, then finish the line.",
    winLine: "The battery is quiet.",
    mode: "campaign",
    index: 2,
    airborne: true,
    enemyCount: 2,
    bombers: 0,
    ace: false,
    bases: 3,
    aaPerBase: 2,
    objective: { kind: "bases", need: 3, have: 0, label: "Bomb 3 battery posts" },
  },
  {
    id: "m4",
    title: "Their Hunt",
    story: "They send a bomber for your hangar. Break the ring.",
    brief:
      "Counter-raid. A {rival} bomber is inbound on your hangar while three posts still stand. Do not skip the strips — the far HQ is past a tank. Kill the bomber if you can. The HQs still win the day.",
    winLine: "The hunt is broken.",
    mode: "campaign",
    index: 3,
    airborne: true,
    enemyCount: 3,
    bombers: 1,
    ace: false,
    bases: 3,
    aaPerBase: 3,
    objective: { kind: "bases", need: 3, have: 0, label: "Bomb 3 ring posts" },
  },
  {
    id: "m5",
    title: "Ace of the Ridge",
    story: "Their ace holds the last four yards.",
    brief:
      "Last light. Four HQs and {rival}'s ace in the air. The last yard is past a tank of fuel — you must land and sit still on a green strip at least once. Knock the house down. Come home.",
    winLine: "The ridge is yours.",
    mode: "campaign",
    index: 4,
    airborne: true,
    enemyCount: 4,
    bombers: 0,
    ace: true,
    bases: 4,
    aaPerBase: 3,
    objective: { kind: "bases", need: 4, have: 0, label: "Bomb 4 last posts" },
  },
];

export const QUICK: MissionDef = {
  id: "quick",
  title: "Dawn Raid",
  story: "One post over the next hill.",
  brief: "One enemy base over the next hill. A green strip is on the way if you take hits. Bomb the HQ.",
  winLine: "The post is down.",
  mode: "quick",
  index: 0,
  airborne: true,
  enemyCount: 1,
  bombers: 0,
  ace: false,
  bases: 1,
  aaPerBase: 2,
  objective: { kind: "bases", need: 1, have: 0, label: "Bomb 1 base" },
};

export const SKIRMISH: MissionDef = {
  id: "skirmish",
  title: "Free Hunt",
  story: "Two posts. Fill up if you start leaking.",
  brief: "Two posts down a longer ridge. Sit still on a friendly strip to fill tanks and sew fabric.",
  winLine: "The ridge is clear.",
  mode: "skirmish",
  index: 1,
  airborne: true,
  enemyCount: 2,
  bombers: 0,
  ace: false,
  bases: 2,
  aaPerBase: 2,
  objective: { kind: "bases", need: 2, have: 0, label: "Bomb 2 bases" },
};

export function wrap(x: number, w = WORLD_W): number {
  return ((x % w) + w) % w;
}
export function wrapDelta(from: number, to: number, w = WORLD_W): number {
  let d = to - from;
  d = ((((d + w / 2) % w) + w) % w) - w / 2;
  return d;
}
export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function rivalOf(f: FactionId): FactionId {
  return FACTION_ORDER[(FACTION_ORDER.indexOf(f) + 1) % FACTION_ORDER.length]!;
}
export function fillCopy(text: string, faction: FactionId): string {
  return text.replaceAll("{rival}", FACTION_META[rivalOf(faction)].label);
}
export function nextCampaignOf(id: string): MissionDef | null {
  const i = CAMPAIGN.findIndex((m) => m.id === id);
  if (i < 0 || i >= CAMPAIGN.length - 1) return null;
  return CAMPAIGN[i + 1] ?? null;
}
export function missionById(id: string): MissionDef {
  return [QUICK, SKIRMISH, ...CAMPAIGN].find((m) => m.id === id) ?? QUICK;
}
