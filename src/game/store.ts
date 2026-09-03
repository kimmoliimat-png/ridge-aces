import { create } from "zustand";
import type { FactionId, HudState, Overlay } from "./types";

type GameUI = {
  overlay: Overlay;
  faction: FactionId;
  missionId: string;
  hud: HudState;
  setOverlay: (overlay: Overlay) => void;
  setFaction: (faction: FactionId) => void;
  setMission: (missionId: string) => void;
  setHud: (hud: HudState) => void;
};

const emptyHud: HudState = {
  hp: 0,
  hpMax: 1,
  fuel: 0,
  fuelMax: 1,
  ammo: 0,
  bombs: 0,
  speed: 0,
  alt: 0,
  score: 0,
  objective: "",
  stripHint: "",
  fuelEmpty: false,
  stalled: false,
  grounded: false,
  hurt: false,
  faction: "westmere",
  message: "",
};

export const useGameUI = create<GameUI>((set) => ({
  overlay: "menu",
  faction: "westmere",
  missionId: "quick",
  hud: emptyHud,
  setOverlay: (overlay) => set({ overlay }),
  setFaction: (faction) => set({ faction }),
  setMission: (missionId) => set({ missionId }),
  setHud: (hud) => set({ hud }),
}));
