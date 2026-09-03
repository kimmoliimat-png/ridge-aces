import { useEffect, useRef, useState, type PointerEvent as PE, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Bomb, ChevronDown, ChevronUp, Crosshair, Gauge, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CAMPAIGN, FACTION_META, FACTION_ORDER, QUICK, SKIRMISH, fillCopy, nextCampaignOf, rivalOf } from "@/game/constants";
import { RidgeAcesGame } from "@/game/engine";
import { loadSave } from "@/game/save";
import { useGameUI } from "@/game/store";
import type { FactionId } from "@/game/types";
import { cn } from "@/lib/utils";

export function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<RidgeAcesGame | null>(null);
  const pendingMission = useRef<string | null>(null);
  const overlay = useGameUI((s) => s.overlay);
  const hud = useGameUI((s) => s.hud);
  const [portrait, setPortrait] = useState(false);
  const [showTouch, setShowTouch] = useState(true);

  useEffect(() => {
    const mq = () => setPortrait(window.innerHeight > window.innerWidth * 1.05);
    mq();
    window.addEventListener("resize", mq);
    setShowTouch(matchMedia("(pointer: coarse)").matches || matchMedia("(hover: none)").matches);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const save = loadSave();
    const game = new RidgeAcesGame(
      canvas,
      {
        onOverlay: (o) => useGameUI.getState().setOverlay(o),
        onHud: (h) => useGameUI.getState().setHud(h),
      },
      save,
    );
    gameRef.current = game;
    game.start();
    const queued = pendingMission.current ?? (useGameUI.getState().overlay === "play" ? useGameUI.getState().missionId : null);
    if (queued) {
      pendingMission.current = null;
      game.play(queued, useGameUI.getState().faction);
    }
    return () => {
      game.stop();
      gameRef.current = null;
    };
  }, []);

  const play = (missionId: string, faction?: FactionId) => {
    const ui = useGameUI.getState();
    if (faction) ui.setFaction(faction);
    ui.setMission(missionId);
    pendingMission.current = missionId;
    const run = (n = 0) => {
      const g = gameRef.current;
      if (!g) {
        ui.setOverlay("play");
        if (n < 30) requestAnimationFrame(() => run(n + 1));
        return;
      }
      try {
        g.play(missionId, faction ?? ui.faction);
        pendingMission.current = null;
        ui.setOverlay("play");
      } catch (err) {
        console.error(err);
        if (n < 8) window.setTimeout(() => run(n + 1), 40);
        else ui.setOverlay("menu");
      }
    };
    run();
  };

  const go = (id: string) => {
    useGameUI.getState().setMission(id);
    useGameUI.getState().setOverlay("briefing");
  };

  const inRaid = overlay === "play" || overlay === "pause";
  const showWorld = inRaid || overlay === "results";

  return (
    <div
      className={cn("relative h-[100dvh] w-full bg-bg text-fg overflow-hidden", inRaid ? "touch-none" : "")}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          visibility: showWorld ? "visible" : "hidden",
          zIndex: 0,
        }}
      />

      {overlay === "menu" && <Menu onPlay={play} onGo={go} />}
      {overlay === "factions" && (
        <FactionSelect
          onPick={(f) => {
            useGameUI.getState().setFaction(f);
            useGameUI.getState().setOverlay("campaign");
          }}
          onBack={() => useGameUI.getState().setOverlay("menu")}
        />
      )}
      {overlay === "campaign" && (
        <CampaignSelect
          game={gameRef.current}
          onPick={(id) => go(id)}
          onBack={() => useGameUI.getState().setOverlay("factions")}
        />
      )}
      {overlay === "briefing" && (
        <Briefing
          onGo={() => play(useGameUI.getState().missionId)}
          onBack={() => useGameUI.getState().setOverlay(useGameUI.getState().missionId.startsWith("m") ? "campaign" : "menu")}
        />
      )}
      {overlay === "howto" && <HowTo onBack={() => useGameUI.getState().setOverlay("menu")} />}
      {overlay === "settings" && (
        <SettingsPanel game={gameRef.current} onBack={() => useGameUI.getState().setOverlay("menu")} />
      )}
      {(overlay === "play" || overlay === "pause") && (
        <Hud
          hud={hud}
          onPause={() => gameRef.current?.setPaused(true)}
          showTouch={showTouch}
          input={gameRef.current?.input}
        />
      )}
      {overlay === "pause" && (
        <PauseMenu
          onResume={() => gameRef.current?.setPaused(false)}
          onMenu={() => {
            useGameUI.getState().setOverlay("menu");
            if (gameRef.current) {
              gameRef.current.overlay = "menu";
              gameRef.current.audio.setEngine(0, 0, false);
            }
          }}
        />
      )}
      {overlay === "results" && (
        <Results
          game={gameRef.current}
          onRetry={() => play(useGameUI.getState().missionId)}
          onNext={(id) => {
            useGameUI.getState().setMission(id);
            useGameUI.getState().setOverlay("briefing");
            if (gameRef.current) {
              gameRef.current.overlay = "briefing";
              gameRef.current.audio.setEngine(0, 0, false);
            }
          }}
          onMenu={() => {
            useGameUI.getState().setOverlay("menu");
            if (gameRef.current) {
              gameRef.current.overlay = "menu";
              gameRef.current.audio.setEngine(0, 0, false);
            }
          }}
        />
      )}
      {portrait && overlay === "play" && (
        <p className="pointer-events-none absolute top-10 left-0 right-0 text-center text-xs tracking-wide text-fg/80">
          Rotate the device for a wider sky
        </p>
      )}
    </div>
  );
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative z-10 mx-auto flex max-h-[100dvh] w-[min(440px,calc(100%-24px))] flex-col gap-4 overflow-y-auto rounded-[28px] border border-border bg-surface/92 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function tapify(fn: () => void) {
  let lock = false;
  return (e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    if (lock) return;
    lock = true;
    fn();
    window.setTimeout(() => {
      lock = false;
    }, 350);
  };
}

function HitButton({
  label,
  onTap,
  kind = "primary",
}: {
  label: string;
  onTap: () => void;
  kind?: "primary" | "secondary" | "ghost";
}) {
  const go = tapify(onTap);
  const cls =
    kind === "primary"
      ? "bg-accent text-fg"
      : kind === "secondary"
        ? "border border-border bg-surface-2 text-fg"
        : "text-muted";
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "relative z-[60] flex min-h-14 w-full items-center justify-center gap-2 rounded-[14px] px-5 font-display text-base tracking-wide",
        cls,
      )}
      style={{ touchAction: "manipulation", WebkitTapHighlightColor: "rgba(239,230,204,0.25)" }}
      onPointerDown={go}
      onTouchStart={go}
      onClick={go}
    >
      {label}
    </button>
  );
}

function Menu({ onPlay, onGo }: { onPlay: (id: string) => void; onGo: (id: string) => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ pointerEvents: "auto" }}
    >
      <Panel>
        <p className="font-display text-xs tracking-[0.35em] text-muted uppercase">The ridge war</p>
        <h1 className="font-display text-5xl tracking-[0.12em] text-fg sm:text-6xl">RIDGE ACES</h1>
        <p className="mt-2 text-sm text-muted">Five raids. Push them off the ridge. Hold left to climb. Bomb the bases.</p>
        <HitButton label="Start" onTap={() => onPlay("quick")} />
        <HitButton label="Campaign" kind="secondary" onTap={() => useGameUI.getState().setOverlay("factions")} />
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <HitButton label="How to fly" kind="ghost" onTap={() => useGameUI.getState().setOverlay("howto")} />
          </div>
          <div className="min-w-0 flex-1">
            <HitButton label="Settings" kind="ghost" onTap={() => useGameUI.getState().setOverlay("settings")} />
          </div>
        </div>
        <button
          type="button"
          className="text-left text-xs text-muted hover:text-fg"
          style={{ touchAction: "manipulation" }}
          onPointerDown={tapify(() => onGo("skirmish"))}
          onClick={tapify(() => onGo("skirmish"))}
        >
          Skirmish
        </button>
        <Link to="/privacy" className="text-xs text-muted underline decoration-border underline-offset-4 hover:text-fg">
          Privacy
        </Link>
      </Panel>
    </div>
  );
}

function FactionSelect({ onPick, onBack }: { onPick: (f: FactionId) => void; onBack: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <Panel>
        <h2 className="font-display text-2xl tracking-wide">Choose a squadron</h2>
        <p className="text-sm text-muted">Each crate handles differently. Learn one, then try the others.</p>
        <div className="flex flex-col gap-2">
          {FACTION_ORDER.map((f) => {
            const m = FACTION_META[f];
            return (
              <button
                key={f}
                type="button"
                onPointerDown={() => onPick(f)}
                onTouchStart={() => onPick(f)}
                onClick={() => onPick(f)}
                className="rounded-[18px] border border-border bg-surface-2 px-4 py-3 text-left hover:border-fg/30"
              >
                <div className="flex items-center gap-3">
                  <span className="size-3 rounded-full" style={{ background: m.color }} />
                  <div>
                    <div className="font-display tracking-wide">{m.label}</div>
                    <div className="text-xs text-muted">{m.blurb}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </Panel>
    </div>
  );
}

function CampaignSelect({
  game,
  onPick,
  onBack,
}: {
  game: RidgeAcesGame | null;
  onPick: (id: string) => void;
  onBack: () => void;
}) {
  const faction = useGameUI((s) => s.faction);
  const unlocked = game?.save.unlocked[faction] ?? 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <Panel>
        <h2 className="font-display text-2xl tracking-wide">
          {FACTION_META[faction].label} vs {FACTION_META[rivalOf(faction)].label}
        </h2>
        <p className="text-sm text-muted">Five raids along the ridge. Each one is longer and meaner than the last.</p>
        <div className="flex flex-col gap-2">
          {CAMPAIGN.map((m) => {
            const locked = m.index > unlocked;
            return (
              <button
                key={m.id}
                type="button"
                disabled={locked}
                onClick={() => onPick(m.id)}
                className="rounded-[18px] border border-border bg-surface-2 px-4 py-3 text-left disabled:opacity-40"
              >
                <div className="font-display tracking-wide">
                  Raid {m.index + 1}. {m.title}
                </div>
                <div className="text-xs text-muted">{locked ? `Win raid ${unlocked + 1} to unlock` : fillCopy(m.story, faction)}</div>
              </button>
            );
          })}
        </div>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </Panel>
    </div>
  );
}

function Briefing({ onGo, onBack }: { onGo: () => void; onBack: () => void }) {
  const id = useGameUI((s) => s.missionId);
  const faction = useGameUI((s) => s.faction);
  const mission = [QUICK, SKIRMISH, ...CAMPAIGN].find((m) => m.id === id) ?? QUICK;
  const raid = mission.mode === "campaign" ? `Raid ${mission.index + 1} of ${CAMPAIGN.length}` : "Briefing";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <Panel>
        <p className="text-xs uppercase tracking-[0.25em] text-muted">{raid}</p>
        <h2 className="font-display text-3xl tracking-wide">{mission.title}</h2>
        <p className="text-sm leading-relaxed text-muted">{fillCopy(mission.brief, faction)}</p>
        <Button size="lg" className="w-full" onClick={onGo}>
          Take off
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </Panel>
    </div>
  );
}

function HowTo({ onBack }: { onBack: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <Panel className="max-w-lg">
        <h2 className="font-display text-2xl tracking-wide">How to fly</h2>
        <ul className="space-y-2 text-sm text-muted">
          <li>
            <span className="text-fg">Phone</span> — hold the left pad to raise the nose. Slide down to dive. Slide left/right to turn around.
          </li>
          <li>
            <span className="text-fg">W / Up</span> — pull the nose up. Loops are allowed.
          </li>
          <li>
            <span className="text-fg">S / Down</span> — push the nose into a dive
          </li>
          <li>
            <span className="text-fg">A / D</span> — fly left or right
          </li>
          <li>
            <span className="text-fg">Space</span> — machine gun
          </li>
          <li>
            <span className="text-fg">X / Bomb</span> — bombs keep your speed. Pull up to loft them; hang vertical to drop them straight down.
          </li>
          <li>
            <span className="text-fg">Fuel</span> — empty tank cuts the engine. You still glide. Follow the green STRIP marker, land, sit still.
          </li>
          <li>
            <span className="text-fg">Campaign</span> — five raids vs the next squadron. Each one is longer and meaner.
          </li>
        </ul>
        <Button onClick={onBack}>Got it</Button>
      </Panel>
    </div>
  );
}

function SettingsPanel({ game, onBack }: { game: RidgeAcesGame | null; onBack: () => void }) {
  const s = game?.save.settings;
  if (!s) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Panel>
          <p className="text-muted">Settings load with the hangar.</p>
          <Button onClick={onBack}>Back</Button>
        </Panel>
      </div>
    );
  }
  const bump = () => game?.applySettings();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <Panel>
        <h2 className="font-display text-2xl tracking-wide">Settings</h2>
        <label className="flex items-center justify-between text-sm">
          Invert pitch
          <input
            type="checkbox"
            checked={s.invertPitch}
            onChange={(e) => {
              s.invertPitch = e.target.checked;
              bump();
            }}
          />
        </label>
        <label className="text-sm">
          SFX
          <input
            className="mt-1 w-full"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.sfx}
            onChange={(e) => {
              s.sfx = Number(e.target.value);
              bump();
            }}
          />
        </label>
        <Button onClick={onBack}>Back</Button>
      </Panel>
    </div>
  );
}

function Hud({
  hud,
  onPause,
  showTouch,
  input,
}: {
  hud: ReturnType<typeof useGameUI.getState>["hud"];
  onPause: () => void;
  showTouch: boolean;
  input?: RidgeAcesGame["input"];
}) {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-6 z-10 flex items-start justify-between px-3 sm:px-5">
        <div className="pointer-events-auto">
          <button
            type="button"
            onClick={onPause}
            className="flex size-11 items-center justify-center rounded-[10px] border border-border bg-surface/80"
            aria-label="Pause"
          >
            <Pause className="size-5" />
          </button>
        </div>
        <div className="rounded-[10px] border border-border bg-surface/75 px-3 py-1.5 text-right">
          <div className="font-display text-lg tabular-nums leading-none">{hud.score}</div>
          <div className="text-[11px] text-muted">{hud.objective}</div>
          {hud.stripHint && (
            <div className={cn("text-[11px] font-medium", hud.fuelEmpty ? "text-accent" : "text-ok")}>{hud.stripHint}</div>
          )}
        </div>
      </div>
      {hud.hurt && (
        <div
          className="pointer-events-none absolute inset-0 z-[6]"
          style={{ background: "radial-gradient(circle at center, transparent 42%, rgba(196,92,72,0.5) 100%)" }}
        />
      )}
      <div className="pointer-events-none absolute left-3 top-24 z-10 w-44 space-y-1.5 sm:left-5">
        <Bar label="Airframe" value={hud.hp / hud.hpMax} color="bg-accent" hot={hud.hurt} fat />
        <Bar label={hud.fuelEmpty ? "Fuel (glide)" : "Fuel"} value={hud.fuel / hud.fuelMax} color={hud.fuelEmpty ? "bg-accent" : "bg-ok"} />
        <div className="flex gap-3 text-[11px] tabular-nums text-muted">
          <span>Gun {hud.ammo}</span>
          <span>Bombs {hud.bombs}</span>
        </div>
        <div className="flex gap-3 text-[11px] tabular-nums text-muted">
          <span className="inline-flex items-center gap-1">
            <Gauge className="size-3" /> {Math.round(hud.speed)}
          </span>
          <span>Alt {Math.max(0, Math.round(hud.alt))}</span>
        </div>
        {hud.stalled && (
          <p className="font-display text-xs tracking-wide text-accent">{hud.alt < 120 && hud.speed > 90 ? "PULL UP" : "STALL"}</p>
        )}
        {hud.message && <p className="font-display text-sm text-fg">{hud.message}</p>}
      </div>
      {showTouch && input && <TouchPad input={input} />}
    </>
  );
}

function Bar({
  label,
  value,
  color,
  hot,
  fat,
}: {
  label: string;
  value: number;
  color: string;
  hot?: boolean;
  fat?: boolean;
}) {
  return (
    <div>
      <div className={cn("mb-0.5 text-[10px] uppercase tracking-wider", hot ? "text-accent" : "text-muted")}>
        {label}
        {hot ? "  HIT" : ""}
      </div>
      <div className={cn("overflow-hidden rounded-full bg-surface-2", fat ? "h-2.5" : "h-1.5", hot && "ring-1 ring-accent")}>
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
      </div>
    </div>
  );
}

function TouchPad({ input }: { input: RidgeAcesGame["input"] }) {
  const origin = useRef({ x: 0, y: 0 });
  const onDown = (e: PE<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    origin.current = { x: e.clientX, y: e.clientY };
    input.touchStick = true;
    input.touchPitch = 0.85;
    input.touchTurn = 0;
  };
  const onMove = (e: PE<HTMLDivElement>) => {
    if (!input.touchStick) return;
    const dx = e.clientX - origin.current.x;
    const dy = e.clientY - origin.current.y;
    input.touchPitch = Math.max(-1, Math.min(1, 0.85 - dy / 70));
    input.touchTurn = Math.max(-1, Math.min(1, -dx / 80));
  };
  const onUp = () => {
    input.touchStick = false;
    input.touchPitch = 0;
    input.touchTurn = 0;
  };
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
      <div
        className="pointer-events-auto size-36 rounded-full border border-border/80 bg-surface/40"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div className="flex h-full flex-col items-center justify-center text-[10px] uppercase tracking-wider text-muted">
          <ChevronUp className="size-4" />
          Fly
          <ChevronDown className="size-4" />
        </div>
      </div>
      <div className="pointer-events-auto mb-2 flex gap-3">
        <button
          type="button"
          className="flex size-16 items-center justify-center rounded-full border border-border bg-surface/80"
          onPointerDown={() => {
            input.touchFire = true;
          }}
          onPointerUp={() => {
            input.touchFire = false;
          }}
          onPointerCancel={() => {
            input.touchFire = false;
          }}
        >
          <Crosshair className="size-6" />
        </button>
        <button
          type="button"
          className="flex size-16 items-center justify-center rounded-full border border-accent bg-accent/80"
          onPointerDown={() => {
            input.touchBomb = true;
          }}
          onPointerUp={() => {
            input.touchBomb = false;
          }}
          onPointerCancel={() => {
            input.touchBomb = false;
          }}
        >
          <Bomb className="size-6" />
        </button>
      </div>
    </div>
  );
}

function PauseMenu({ onResume, onMenu }: { onResume: () => void; onMenu: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg/50 p-4">
      <Panel>
        <h2 className="font-display text-2xl tracking-wide">Paused</h2>
        <Button size="lg" className="w-full" onClick={onResume}>
          <Play className="size-4" /> Resume
        </Button>
        <Button variant="secondary" className="w-full" onClick={onMenu}>
          Hangar
        </Button>
      </Panel>
    </div>
  );
}

function Results({
  game,
  onRetry,
  onNext,
  onMenu,
}: {
  game: RidgeAcesGame | null;
  onRetry: () => void;
  onNext: (id: string) => void;
  onMenu: () => void;
}) {
  const win = game?.sim.over === "win";
  const score = game?.sim.score ?? 0;
  const best = game?.save.best ?? 0;
  const mission = game?.sim.mission;
  const faction = useGameUI((s) => s.faction);
  const next = win && mission?.mode === "campaign" ? nextCampaignOf(mission.id) : null;
  const campaignDone = win && mission?.mode === "campaign" && !next;
  const headline = campaignDone ? "The ridge is yours" : win ? fillCopy(mission?.winLine ?? "The ridge holds.", faction) : "Walk home";
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg/55 p-4">
      <Panel>
        <p className="text-xs uppercase tracking-[0.25em] text-muted">
          {campaignDone ? "Campaign complete" : win && mission?.mode === "campaign" ? `Raid ${mission.index + 1} complete` : win ? "Mission complete" : "Downed"}
        </p>
        <h2 className="font-display text-3xl tracking-wide">{headline}</h2>
        {next && (
          <p className="text-sm text-muted">
            Next: Raid {next.index + 1}. {next.title} — {fillCopy(next.story, faction)}
          </p>
        )}
        <p className="font-display text-2xl tabular-nums">{score}</p>
        <p className="text-xs text-muted">Best {best}</p>
        {next && (
          <Button size="lg" className="w-full" onClick={() => onNext(next.id)}>
            <Play className="size-4" /> Next raid — {next.title}
          </Button>
        )}
        <Button size={next ? "md" : "lg"} variant={next ? "secondary" : "primary"} className="w-full" onClick={onRetry}>
          <RotateCcw className="size-4" /> {win ? "Fly it again" : "Try again"}
        </Button>
        <Button variant="ghost" className="w-full" onClick={onMenu}>
          Hangar
        </Button>
      </Panel>
    </div>
  );
}
