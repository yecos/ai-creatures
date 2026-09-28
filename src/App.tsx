import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalPosition } from "@tauri-apps/api/dpi";

const STORAGE_KEY = "ai-creatures:v0.2";

type Mood = "idle" | "happy" | "sleepy" | "hungry" | "curious";
type Reaction = "none" | "pet" | "feed" | "play" | "sleep" | "peek" | "bounce";
type ParticleKind = "heart" | "star" | "crumb" | "zzz";

type CreatureState = {
  name: string;
  level: number;
  xp: number;
  hunger: number;
  energy: number;
  happiness: number;
  bond: number;
  ageSeconds: number;
  mood: Mood;
  lastSavedAt: number;
  hatched: boolean;
};

type Particle = {
  id: number;
  kind: ParticleKind;
  x: number;
  y: number;
  drift: number;
};

const initialState: CreatureState = {
  name: "Miko",
  level: 1,
  xp: 0,
  hunger: 18,
  energy: 92,
  happiness: 78,
  bond: 10,
  ageSeconds: 0,
  mood: "curious",
  lastSavedAt: Date.now(),
  hatched: false
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function readState(): CreatureState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as CreatureState;
    const awayMinutes = Math.max(0, (Date.now() - parsed.lastSavedAt) / 60000);
    return {
      ...initialState,
      ...parsed,
      hunger: clamp(parsed.hunger + awayMinutes * 0.7),
      energy: clamp(parsed.energy + awayMinutes * 0.45),
      happiness: clamp(parsed.happiness - awayMinutes * 0.12),
      lastSavedAt: Date.now()
    };
  } catch {
    return initialState;
  }
}

function getMood(s: CreatureState): Mood {
  if (s.energy < 20) return "sleepy";
  if (s.hunger > 78) return "hungry";
  if (s.happiness > 84) return "happy";
  if (s.bond > 42) return "curious";
  return "idle";
}

function moodLabel(mood: Mood) {
  const labels: Record<Mood, string> = {
    idle: "tranquilo",
    happy: "radiante",
    sleepy: "soñoliento",
    hungry: "hambriento",
    curious: "curioso"
  };
  return labels[mood];
}

export default function App() {
  const [creature, setCreature] = useState<CreatureState>(() => readState());
  const [menuOpen, setMenuOpen] = useState(false);
  const [message, setMessage] = useState("hola ✦");
  const [reaction, setReaction] = useState<Reaction>("none");
  const [hatchPhase, setHatchPhase] = useState<"egg" | "cracking" | "hatched">(() => creature.hatched ? "hatched" : "egg");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [particles, setParticles] = useState<Particle[]>([]);
  const stageRef = useRef<HTMLElement | null>(null);
  const moveRef = useRef({ dx: 1.15, dy: 0 });
  const reactionTimer = useRef<number | null>(null);
  const particleId = useRef(0);
  const hatchTimer = useRef<number | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCreature((prev) => {
        const next = {
          ...prev,
          ageSeconds: prev.ageSeconds + 1,
          hunger: clamp(prev.hunger + 0.075),
          energy: clamp(prev.energy - 0.023),
          happiness: clamp(prev.happiness - 0.01),
          lastSavedAt: Date.now()
        };
        next.mood = getMood(next);
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const save = window.setInterval(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...creature, lastSavedAt: Date.now() }));
    }, 3000);
    return () => clearInterval(save);
  }, [creature]);

  useEffect(() => {
    const chatter = window.setInterval(() => {
      if (menuOpen || reaction !== "none") return;
      const lines: Record<Mood, string[]> = {
        curious: ["¿qué hay ahí?", "hmm…", "te estoy mirando", "✦ ✦ ✦"],
        happy: ["hoy es buen día ✦", "hehe", "¡vamos!", "♡"],
        hungry: ["¿snack?", "mi pancita…", "ñam?"],
        sleepy: ["cinco minutitos…", "zzZ", "…"],
        idle: ["…", "boop", "aquí sigo"]
      };
      const options = lines[creature.mood];
      setMessage(options[Math.floor(Math.random() * options.length)]);
    }, 8500);
    return () => clearInterval(chatter);
  }, [creature.mood, menuOpen, reaction]);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;

    async function wander() {
      if (stopped || !creature.hatched || menuOpen || reaction === "sleep" || creature.mood === "sleepy") return;
      try {
        const appWindow = getCurrentWindow();
        const monitor = await currentMonitor();
        const pos = await appWindow.outerPosition();
        const size = await appWindow.outerSize();
        if (!monitor) return;

        const area = monitor.workArea;
        const left = area.position.x;
        const top = area.position.y;
        const right = left + area.size.width - size.width;
        const bottom = top + area.size.height - size.height;

        let { dx, dy } = moveRef.current;
        if (pos.x <= left + 8) dx = Math.abs(dx);
        if (pos.x >= right - 8) dx = -Math.abs(dx);
        if (pos.y <= top + 8) dy = Math.abs(dy || 0.12);
        if (pos.y >= bottom - 8) dy = -Math.abs(dy || 0.12);

        if (Math.random() < 0.014) {
          dx = (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 1.25);
          dy = (Math.random() - 0.5) * 0.34;
        }

        moveRef.current = { dx, dy };
        const nextDirection: 1 | -1 = dx >= 0 ? 1 : -1;
        setDirection((old) => old === nextDirection ? old : nextDirection);
        await appWindow.setPosition(new PhysicalPosition(pos.x + dx, pos.y + dy));
      } catch {
        // Browser preview: animations still run, only desktop wandering is skipped.
      }
    }

    timer = window.setInterval(wander, 48);
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, [menuOpen, reaction, creature.mood, creature.hatched]);

  useEffect(() => {
    return () => {
      if (reactionTimer.current) window.clearTimeout(reactionTimer.current);
      if (hatchTimer.current) window.clearTimeout(hatchTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!creature.hatched) return;
    const idle = window.setInterval(() => {
      if (menuOpen || reaction !== "none") return;
      const roll = Math.random();
      if (roll < 0.42) {
        const next: Reaction = roll < 0.21 ? "peek" : "bounce";
        setTemporaryReaction(next, next === "peek" ? 1250 : 900);
      }
    }, 7200);
    return () => clearInterval(idle);
  }, [creature.hatched, menuOpen, reaction]);

  function setTemporaryReaction(next: Reaction, duration = 1500) {
    if (reactionTimer.current) window.clearTimeout(reactionTimer.current);
    setReaction(next);
    reactionTimer.current = window.setTimeout(() => setReaction("none"), duration);
  }

  function burst(kind: ParticleKind, count: number) {
    const fresh: Particle[] = Array.from({ length: count }, (_, index) => ({
      id: ++particleId.current,
      kind,
      x: 44 + Math.random() * 22,
      y: 46 + Math.random() * 16,
      drift: -22 + Math.random() * 44 + index * 1.5
    }));
    setParticles((prev) => [...prev, ...fresh]);
    window.setTimeout(() => {
      const ids = new Set(fresh.map((item) => item.id));
      setParticles((prev) => prev.filter((item) => !ids.has(item.id)));
    }, 1500);
  }

  function gainXp(amount: number) {
    setCreature((prev) => {
      let xp = prev.xp + amount;
      let level = prev.level;
      while (xp >= level * 100) {
        xp -= level * 100;
        level += 1;
      }
      return { ...prev, xp, level };
    });
  }

  function hatch() {
    if (hatchPhase !== "egg") return;
    setHatchPhase("cracking");
    setMessage("¿...?");
    burst("star", 5);
    hatchTimer.current = window.setTimeout(() => {
      setCreature((prev) => ({ ...prev, hatched: true, happiness: 88, bond: Math.max(prev.bond, 8), mood: "happy" }));
      setHatchPhase("hatched");
      setMessage("¡mrrp! ✦");
      setTemporaryReaction("bounce", 1300);
      burst("heart", 7);
      burst("star", 7);
    }, 1550);
  }

  function feed() {
    setCreature((p) => ({ ...p, hunger: clamp(p.hunger - 28), happiness: clamp(p.happiness + 4), mood: "happy" }));
    gainXp(6);
    setMessage("crunch crunch ✦");
    setTemporaryReaction("feed", 1700);
    burst("crumb", 7);
  }

  function play() {
    setCreature((p) => ({ ...p, happiness: clamp(p.happiness + 18), energy: clamp(p.energy - 10), bond: clamp(p.bond + 3), mood: "happy" }));
    gainXp(9);
    setMessage("¡otra vez! ✦");
    setTemporaryReaction("play", 1850);
    burst("star", 9);
  }

  function pet() {
    setCreature((p) => ({ ...p, happiness: clamp(p.happiness + 9), bond: clamp(p.bond + 4), mood: "happy" }));
    gainXp(4);
    setMessage("mrrp… ♡");
    setTemporaryReaction("pet", 1450);
    burst("heart", 6);
  }

  function sleep() {
    setCreature((p) => ({ ...p, energy: clamp(p.energy + 24), mood: "sleepy" }));
    setMessage("zzZ…");
    setTemporaryReaction("sleep", 4200);
    burst("zzz", 4);
  }

  function trackPointer(event: ReactPointerEvent<HTMLElement>) {
    const node = stageRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
    node.style.setProperty("--look-x", String(x * 5 * direction) + "px");
    node.style.setProperty("--look-y", String(y * 3.5) + "px");
  }

  const stageStyle = { "--direction": direction } as CSSProperties;

  return (
    <main
      ref={stageRef}
      style={stageStyle}
      className={"stage mood-" + creature.mood + " reaction-" + reaction}
      onPointerMove={trackPointer}
      onPointerLeave={() => {
        stageRef.current?.style.setProperty("--look-x", "0px");
        stageRef.current?.style.setProperty("--look-y", "0px");
      }}
      onContextMenu={(event: ReactMouseEvent<HTMLElement>) => {
        event.preventDefault();
        setMenuOpen((value) => !value);
      }}
    >
      <div className={"speech " + (message === "…" ? "quiet" : "")}>
        <span>{message}</span>
      </div>

      <div className="particle-layer" aria-hidden="true">
        {particles.map((particle) => (
          <i
            key={particle.id}
            className={"particle particle-" + particle.kind}
            style={{
              left: String(particle.x) + "%",
              top: String(particle.y) + "%",
              "--drift": String(particle.drift) + "px"
            } as CSSProperties}
          >
            {particle.kind === "heart" ? "♥" : particle.kind === "star" ? "✦" : particle.kind === "zzz" ? "z" : "·"}
          </i>
        ))}
      </div>

      {hatchPhase === "hatched" ? (
        <button
          className="creature-hitbox"
          aria-label="Acariciar a Miko"
          onClick={pet}
          onDoubleClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            setMenuOpen((value) => !value);
          }}
        >
          <div className="creature-wrap">
            <div className="floor-shadow" />
            <div className="miko">
              <span className="ear ear-left"><i /></span>
              <span className="ear ear-right"><i /></span>
              <span className="antenna"><i /></span>
              <span className="tail" />

              <span className="body">
                <span className="body-shine" />
                <span className="belly-glow" />
                <span className="blush blush-left" />
                <span className="blush blush-right" />

                <span className="eye eye-left"><i className="pupil" /></span>
                <span className="eye eye-right"><i className="pupil" /></span>
                <span className="mouth" />

                <span className="paw paw-left" />
                <span className="paw paw-right" />
              </span>
            </div>
          </div>
        </button>
      ) : (
        <button className={"egg-hitbox " + hatchPhase} onClick={hatch} aria-label="Eclosionar huevo">
          <span className="egg-shadow" />
          <span className="egg">
            <i className="egg-glow" />
            <i className="crack crack-a" />
            <i className="crack crack-b" />
            <i className="crack crack-c" />
          </span>
          <small>{hatchPhase === "egg" ? "tócame" : "..."}</small>
        </button>
      )}

      {hatchPhase === "hatched" && <section className={"panel " + (menuOpen ? "open" : "")} >
        <header>
          <div className="identity">
            <span className="avatar-dot">✦</span>
            <div>
              <strong>{creature.name}</strong>
              <span>Nivel {creature.level} · {moodLabel(creature.mood)}</span>
            </div>
          </div>
          <button className="close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">×</button>
        </header>

        <div className="stats">
          <Stat icon="🍓" value={100 - creature.hunger} label="Saciedad" />
          <Stat icon="⚡" value={creature.energy} label="Energía" />
          <Stat icon="♥" value={creature.happiness} label="Felicidad" />
          <Stat icon="✦" value={creature.bond} label="Vínculo" />
        </div>

        <div className="actions">
          <button onClick={feed}><span>🍓</span>Alimentar</button>
          <button onClick={play}><span>◉</span>Jugar</button>
          <button onClick={pet}><span>♡</span>Acariciar</button>
          <button onClick={sleep}><span>☾</span>Dormir</button>
        </div>

        <div className="xp">
          <span>XP</span>
          <div><i style={{ width: String(Math.min(100, (creature.xp / (creature.level * 100)) * 100)) + "%" }} /></div>
          <small>{creature.xp}/{creature.level * 100}</small>
        </div>
      </section>}

      {!menuOpen && hatchPhase === "hatched" && <div className="hint">clic · cariño &nbsp;&nbsp; clic derecho · menú</div>}
    </main>
  );
}

function Stat({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <div className="stat" title={label}>
      <span>{icon}</span>
      <div><i style={{ width: String(clamp(value)) + "%" }} /></div>
    </div>
  );
}
