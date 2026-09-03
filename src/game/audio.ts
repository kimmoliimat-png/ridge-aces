export class GameAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  sfx: GainNode | null = null;
  music: GainNode | null = null;
  engineGain: GainNode | null = null;
  engineOsc: OscillatorNode | null = null;
  muted = false;
  sfxVol = 0.85;
  musicVol = 0.35;
  private noise: AudioBuffer | null = null;
  private musicTimer = 0;
  private nextNote = 0;
  private engineOn = false;

  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.engineGain = this.ctx.createGain();
      this.sfx.connect(this.master);
      this.music.connect(this.master);
      this.engineGain.connect(this.sfx);
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise();
      this.applyVolumes();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setVolumes(sfx: number, music: number): void {
    this.sfxVol = sfx;
    this.musicVol = music;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    const t = this.ctx?.currentTime ?? 0;
    this.sfx?.gain.setTargetAtTime(this.muted ? 0 : this.sfxVol ** 2, t, 0.03);
    this.music?.gain.setTargetAtTime(this.muted ? 0 : this.musicVol ** 2 * 0.22, t, 0.05);
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  startEngine(): void {
    if (!this.ctx || !this.engineGain || this.engineOn) return;
    this.engineOn = true;
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 70;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 420;
    const g = this.ctx.createGain();
    g.gain.value = 0.08;
    osc.connect(f);
    f.connect(g);
    g.connect(this.engineGain);
    osc.start();
    this.engineOsc = osc;
  }

  setEngine(throttle: number, speed: number, airborne: boolean): void {
    if (!this.ctx || !this.engineOsc || !this.engineGain) return;
    const t = this.ctx.currentTime;
    if (!airborne || throttle <= 0) {
      this.engineGain.gain.setTargetAtTime(0, t, 0.06);
      this.engineOsc.frequency.setTargetAtTime(42, t, 0.1);
      return;
    }
    const rpm = 55 + speed * 0.35 + throttle * 40;
    this.engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
    const vol = 0.07 + throttle * 0.06 + Math.min(speed, 300) * 0.00012;
    this.engineGain.gain.setTargetAtTime(vol, t, 0.05);
  }

  gun(): void {
    this.burst(0.05, 1800, 0.18, "square");
    this.noiseBurst(0.04, 0.12, 3500);
  }
  bombDrop(): void {
    this.burst(0.12, 180, 0.1, "sine");
  }
  explosion(big = false): void {
    this.noiseBurst(big ? 0.35 : 0.18, big ? 0.45 : 0.22, 900);
    this.burst(big ? 0.28 : 0.16, 70, big ? 0.35 : 0.18, "sine");
  }
  hit(): void {
    this.burst(0.14, 180, 0.22, "sawtooth");
  }
  stallWarn(): void {
    this.burst(0.06, 880, 0.08, "square");
  }
  win(): void {
    this.burst(0.2, 392, 0.2, "sine");
    setTimeout(() => this.burst(0.2, 523, 0.22, "sine"), 140);
  }
  lose(): void {
    this.burst(0.3, 110, 0.35, "sawtooth");
  }

  tickMusic(dt: number): void {
    if (!this.ctx || !this.music) return;
    this.musicTimer += dt;
    if (this.musicTimer < this.nextNote) return;
    this.nextNote = this.musicTimer + 1.6 + Math.random() * 0.4;
    const notes = [196, 247, 294, 330, 392];
    const f = notes[Math.floor(Math.random() * notes.length)]!;
    this.tone(f, 1.2, 0.04, this.music);
  }

  private burst(dur: number, freq: number, vol: number, type: OscillatorType): void {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.4), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol * (0.85 + Math.random() * 0.2), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.sfx);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private tone(freq: number, dur: number, vol: number, bus: GainNode): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noiseBurst(dur: number, vol: number, cutoff: number): void {
    if (!this.ctx || !this.sfx || !this.noise) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  destroy(): void {
    try {
      this.engineOsc?.stop();
      void this.ctx?.close();
    } catch {
      /* closed */
    }
    this.ctx = null;
    this.engineOn = false;
  }
}
