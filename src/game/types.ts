export type FactionId = "westmere" | "ironvale" | "frostholm" | "sunreach";

export type PlaneState = "parked" | "taxi" | "air" | "crash" | "dead";
export type AiMode = "hunt" | "attack" | "evade" | "bomb" | "rtb" | "takeoff";
export type BuildingKind = "hangar" | "hq" | "depot" | "aa" | "base";
export type GameMode = "quick" | "campaign" | "skirmish";

export type Overlay =
  | "menu"
  | "play"
  | "pause"
  | "briefing"
  | "results"
  | "settings"
  | "howto"
  | "campaign"
  | "factions";

export type PlaneStats = {
  name: string;
  power: number;
  turn: number;
  hp: number;
  ammo: number;
  bombs: number;
  fuel: number;
  burn: number;
  drag: number;
  stall: number;
};

export type Plane = {
  id: number;
  faction: FactionId;
  player: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hp: number;
  fuel: number;
  ammo: number;
  bombs: number;
  state: PlaneState;
  inverted: boolean;
  facing: number;
  lastHitBy: number;
  fireCd: number;
  bombCd: number;
  flash: number;
  smoke: number;
  crashT: number;
  onRunway: boolean;
  iframes: number;
  ai: AiMode;
  aiTimer: number;
  stats: PlaneStats;
};

export type Building = {
  id: number;
  kind: BuildingKind;
  faction: FactionId;
  airfield: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  fireCd: number;
};

export type Airfield = {
  id: number;
  faction: FactionId;
  x: number;
  elev: number;
  half: number;
  friendly: boolean;
};

export type Objective = {
  kind: "kills" | "buildings" | "defend" | "bases";
  need: number;
  have: number;
  label: string;
};

export type MissionDef = {
  id: string;
  title: string;
  brief: string;
  story: string;
  winLine: string;
  mode: GameMode;
  index: number;
  airborne: boolean;
  enemyCount: number;
  bombers: number;
  ace: boolean;
  bases: number;
  aaPerBase: number;
  objective: Objective;
};

export type HudState = {
  hp: number;
  hpMax: number;
  fuel: number;
  fuelMax: number;
  ammo: number;
  bombs: number;
  speed: number;
  alt: number;
  score: number;
  objective: string;
  stripHint: string;
  fuelEmpty: boolean;
  stalled: boolean;
  grounded: boolean;
  hurt: boolean;
  faction: FactionId;
  message: string;
};

export type Actions = {
  pitch: number;
  turn: number;
  throttle: number;
  fire: boolean;
  bomb: boolean;
  flip: boolean;
  pause: boolean;
};

export type Settings = {
  version: number;
  invertPitch: boolean;
  sfx: number;
  music: number;
  shake: boolean;
  touch: "on" | "off";
};

export type Bullet = {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  owner: number;
  faction: FactionId;
  aa: boolean;
};

export type Bomb = {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fuse: number;
  owner: number;
  faction: FactionId;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
};

export type Explosion = { x: number; y: number; t: number; scale: number };
export type Floater = { x: number; y: number; life: number; max: number; text: string; color: string };
