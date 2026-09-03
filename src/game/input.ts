import type { Actions } from "./types";

export class GameInput {
  keys = new Set<string>();
  invertPitch = false;
  touchPitch = 0;
  touchTurn = 0;
  touchStick = false;
  touchFire = false;
  touchBomb = false;
  private steerOverride: number | null = null;
  private keyOverride: string[] | null = null;
  private pauseEdge = false;

  attach(el: HTMLElement): () => void {
    const down = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.code);
    const blur = () => this.keys.clear();
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", blur);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", blur);
    };
  }

  setKeys(codes: string[]): void {
    this.keyOverride = codes;
  }

  setSteer(v: number): void {
    this.steerOverride = v;
  }

  sample(): Actions {
    const keys = this.keyOverride ?? [...this.keys];
    const has = (c: string) => (this.keyOverride ? this.keyOverride.includes(c) : this.keys.has(c));
    void keys;
    let pitch = 0;
    if (has("KeyW") || has("ArrowUp")) pitch += 1;
    if (has("KeyS") || has("ArrowDown")) pitch -= 1;
    if (this.touchStick) pitch += this.touchPitch;
    if (this.invertPitch) pitch *= -1;

    let turn = 0;
    if (has("KeyA") || has("ArrowLeft")) turn += 1;
    if (has("KeyD") || has("ArrowRight")) turn -= 1;
    if (this.touchStick) turn += this.touchTurn;
    if (this.steerOverride != null) turn = this.steerOverride;

    const pause = has("Escape") || has("KeyP");
    const edge = pause && !this.pauseEdge;
    this.pauseEdge = pause;

    return {
      pitch: Math.max(-1, Math.min(1, pitch)),
      turn: Math.max(-1, Math.min(1, turn)),
      throttle: 1,
      fire: has("Space") || this.touchFire,
      bomb: has("KeyX") || has("KeyB") || this.touchBomb,
      flip: has("KeyF"),
      pause: edge,
    };
  }
}
