import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import {
  chooseIdleReaction,
  createPersonality,
  personalityLine,
  type Mood,
  type PersonalityProfile
} from "./personality";
import {
  createEvent,
  dayPhaseMeta,
  discoverTreasure,
  discoveryChance,
  discoveryMessage,
  getDayPhase,
  rarityLabel,
  type DayPhase,
  type LifeEvent,
  type Treasure
} from "./life";
import {
  askBrain,
  defaultBrainConfig,
  loadBrainConfig,
  loadBrainStatus,
  saveBrainConfig,
  type BrainReply,
  type BrainStatus,
  type PublicBrainConfig
} from "./brain";

const STORAGE_KEY = "ai-creatures:v0.4";
const LEGACY_STORAGE_KEYS = ["ai-creatures:v0.3", "ai-creatures:v0.2"];

type Reaction = "none" | "pet" | "feed" | "play" | "sleep" | "peek" | "bounce" | "shy" | "wiggle";
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
  personality: PersonalityProfile | null;
  treasures: Treasure[];
  journal: LifeEvent[];
  lastDiscoveryAt: number;
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
  hatched: false,
  personality: null,
  treasures: [],
  journal: [],
  lastDiscoveryAt: 0
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function readState(): CreatureState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
      ?? LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean)
      ?? null;
    if (!raw) return initialState;

    const parsed = JSON.parse(raw) as Partial<CreatureState>;
    const awayMinutes = Math.max(0, (Date.now() - (parsed.lastSavedAt ?? Date.now())) / 60000);
    const personality = parsed.personality ?? (parsed.hatched ? createPersonality() : null);
    const modifiers = personality?.modifiers;
    let journal = parsed.journal ?? [];

    if (parsed.hatched && awayMinutes >= 30) {
      const returnMessage = awayMinutes >= 240
        ? "Miko se emocionó mucho cuando volviste."
        : "Miko notó que regresaste.";
      journal = [createEvent(returnMessage, "return"), ...journal].slice(0, 8);
    }

    return {
      ...initialState,
      ...parsed,
      personality,
      treasures: parsed.treasures ?? [],
      journal,
      lastDiscoveryAt: parsed.lastDiscoveryAt ?? 0,
      hunger: clamp((parsed.hunger ?? initialState.hunger) + awayMinutes * 0.7 * (modifiers?.hungerRate ?? 1)),
      energy: clamp((parsed.energy ?? initialState.energy) + awayMinutes * 0.45),
      happiness: clamp((parsed.happiness ?? initialState.happiness) - awayMinutes * 0.12 * (modifiers?.happinessDecay ?? 1)),
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
  const [panelView, setPanelView] = useState<"main" | "treasures" | "brain">("main");
  const [dayPhase, setDayPhase] = useState<DayPhase>(() => getDayPhase());
  const [brainConfig, setBrainConfig] = useState<PublicBrainConfig>(defaultBrainConfig);
  const [brainStatus, setBrainStatus] = useState<BrainStatus | null>(null);
  const [brainKeyDraft, setBrainKeyDraft] = useState("");
  const [brainThinking, setBrainThinking] = useState(false);
  const [brainError, setBrainError] = useState("");
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
  const creatureRef = useRef(creature);
  const brainThinkingRef = useRef(false);

  useEffect(() => {
    creatureRef.current = creature;
  }, [creature]);

  useEffect(() => {
    loadBrainConfig()
      .then((config) => setBrainConfig(config))
      .catch(() => {
        // Browser preview or Tauri backend unavailable: keep local brain.
      });
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCreature((prev) => {
        const modifiers = prev.personality?.modifiers;
        const next = {
          ...prev,
          ageSeconds: prev.ageSeconds + 1,
          hunger: clamp(prev.hunger + 0.075 * (modifiers?.hungerRate ?? 1)),
          energy: clamp(prev.energy - 0.023 * (modifiers?.energyDrain ?? 1)),
          happiness: clamp(prev.happiness - 0.01 * (modifiers?.happinessDecay ?? 1)),
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
    const clock = window.setInterval(() => setDayPhase(getDayPhase()), 60000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    const chatter = window.setInterval(() => {
      if (menuOpen || reaction !== "none" || !creature.hatched) return;
      const chance = creature.personality?.modifiers.chatterChance ?? .75;
      if (Math.random() > chance) return;
      setMessage(personalityLine(creature.personality, creature.mood));
    }, 7600);
    return () => clearInterval(chatter);
  }, [creature.mood, creature.personality, creature.hatched, menuOpen, reaction]);

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
          const speed = creature.personality?.modifiers.moveSpeed ?? 1;
          dx = (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 1.25) * speed;
          dy = (Math.random() - 0.5) * 0.34 * speed;
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
      const rate = creature.personality?.modifiers.idleActionRate ?? .42;
      if (Math.random() > rate) return;

      let next = chooseIdleReaction(creature.personality);
      if (dayPhase === "night" && Math.random() < .24) next = "sleep";
      setTemporaryReaction(next, next === "sleep" ? 2800 : next === "peek" ? 1250 : 1000);

      if (next === "sleep") {
        setMessage("zzZ…");
        burst("zzz", 2);
      } else if (next === "wiggle" && creature.personality?.id === "affectionate") {
        setMessage("♡");
        burst("heart", 2);
      } else if (next === "shy") {
        setMessage("…");
      } else {
        setMessage(personalityLine(creature.personality, "idle"));
      }
    }, 6500);
    return () => clearInterval(idle);
  }, [creature.hatched, creature.personality, dayPhase, menuOpen, reaction]);

  useEffect(() => {
    if (!creature.hatched) return;

    const discovery = window.setInterval(() => {
      const current = creatureRef.current;
      if (!current.hatched || current.treasures.length >= 10) return;
      if (current.mood === "sleepy" || current.energy < 14) return;
      if (Date.now() - current.lastDiscoveryAt < 30000) return;

      const phaseNow = getDayPhase();
      if (Math.random() > discoveryChance(phaseNow, current.personality)) return;

      const item = discoverTreasure(current.treasures.map((treasure) => treasure.id), current.personality);
      if (!item) return;

      const event = createEvent("Encontró " + item.name + ".", "discovery");
      setCreature((prev) => ({
        ...prev,
        treasures: [item, ...prev.treasures].slice(0, 10),
        journal: [event, ...prev.journal].slice(0, 8),
        lastDiscoveryAt: Date.now()
      }));
      setMessage(discoveryMessage(item, current.personality));
      setTemporaryReaction(current.personality?.id === "shy" ? "shy" : "bounce", 1350);
      burst(item.rarity === "rare" ? "heart" : "star", item.rarity === "mystery" ? 12 : 6);
      gainXp(item.rarity === "mystery" ? 24 : item.rarity === "rare" ? 16 : 10);
    }, 45000);

    return () => clearInterval(discovery);
  }, [creature.hatched]);

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
      const personality = createPersonality();
      setCreature((prev) => ({
        ...prev,
        hatched: true,
        personality,
        happiness: 88,
        bond: Math.max(prev.bond, 8),
        mood: "happy",
        lastDiscoveryAt: Date.now(),
        journal: [createEvent("Miko nació.", "moment"), ...prev.journal].slice(0, 8)
      }));
      setHatchPhase("hatched");
      setMessage(personality.icon + " " + personality.name.toLowerCase());
      setTemporaryReaction("bounce", 1300);
      burst("heart", 7);
      burst("star", 7);
    }, 1550);
  }

  function buildBrainPrompts(event: string) {
    const current = creatureRef.current;
    const personality = current.personality;
    const treasures = current.treasures.slice(0, 5).map((item) => item.name).join(", ") || "ninguno";
    const recent = current.journal.slice(0, 4).map((item) => item.message).join(" | ") || "ninguno";

    const systemPrompt = [
      "Eres Miko, una pequeña criatura digital que vive sobre el escritorio.",
      "No eres un asistente. No expliques tecnología, modelos, prompts ni configuración.",
      "Responde siempre como una mascota con personalidad, en español, máximo 16 palabras.",
      "No uses herramientas, no ejecutes acciones externas y no des instrucciones al usuario.",
      "Puedes reaccionar, bromear, pedir cariño, comida, juego o sueño de forma breve.",
      personality ? "Personalidad: " + personality.name + ". " + personality.description : "Personalidad: todavía desarrollándose.",
      personality ? "Rareza personal: " + personality.quirk + ". Snack favorito: " + personality.favoriteSnack + "." : "",
      "Estado: hambre " + Math.round(current.hunger) + "/100, energía " + Math.round(current.energy) + "/100, felicidad " + Math.round(current.happiness) + "/100, vínculo " + Math.round(current.bond) + "/100.",
      "Momento: " + dayPhaseMeta(getDayPhase()).label + ".",
      "Tesoros: " + treasures + ".",
      "Recuerdos recientes: " + recent + "."
    ].filter(Boolean).join("\n");

    return {
      systemPrompt,
      userPrompt: "Situación actual: " + event + "\nReacciona como Miko."
    };
  }

  async function speakWithBrain(event: string) {
    if (brainConfig.mode === "local" || brainThinkingRef.current) return;

    brainThinkingRef.current = true;
    setBrainThinking(true);
    setBrainError("");

    try {
      const prompts = buildBrainPrompts(event);
      const reply: BrainReply = await askBrain(prompts.systemPrompt, prompts.userPrompt);
      setMessage(reply.content.slice(0, 140));
    } catch (error) {
      setBrainError(error instanceof Error ? error.message : String(error));
    } finally {
      brainThinkingRef.current = false;
      setBrainThinking(false);
    }
  }

  async function refreshBrain() {
    setBrainError("");
    try {
      const status = await loadBrainStatus();
      setBrainStatus(status);
      setBrainConfig(status.config);
    } catch (error) {
      setBrainError(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveBrainSettings() {
    setBrainThinking(true);
    setBrainError("");
    try {
      const saved = await saveBrainConfig(brainConfig, brainKeyDraft || undefined);
      setBrainConfig(saved);
      setBrainKeyDraft("");
      const status = await loadBrainStatus();
      setBrainStatus(status);
    } catch (error) {
      setBrainError(error instanceof Error ? error.message : String(error));
    } finally {
      setBrainThinking(false);
    }
  }

  function openBrainPanel() {
    setPanelView("brain");
    void refreshBrain();
  }

  function talk() {
    const localLine = personalityLine(creature.personality, creature.mood);
    setMessage(brainConfig.mode === "local" ? localLine : "hmm…");
    setTemporaryReaction("peek", 1200);
    void speakWithBrain("El humano quiere conversar contigo y te está prestando atención.");
  }

  function feed() {
    setCreature((p) => {
      const boost = p.personality?.modifiers.feedBoost ?? 1;
      return { ...p, hunger: clamp(p.hunger - 28), happiness: clamp(p.happiness + 4 * boost), mood: "happy" };
    });
    gainXp(6);
    setMessage(creature.personality?.id === "glutton" ? "¡EL MEJOR DÍA! ✦" : "crunch crunch ✦");
    setTemporaryReaction("feed", 1700);
    burst("crumb", 7);
    void speakWithBrain("El humano acaba de darte comida.");
  }

  function play() {
    setCreature((p) => {
      const boost = p.personality?.modifiers.playBoost ?? 1;
      return {
        ...p,
        happiness: clamp(p.happiness + 18 * boost),
        energy: clamp(p.energy - 10),
        bond: clamp(p.bond + 3),
        mood: "happy"
      };
    });
    gainXp(9);
    setMessage(creature.personality?.id === "mischievous" ? "¡MÁS RÁPIDO! ⚡" : "¡otra vez! ✦");
    setTemporaryReaction("play", 1850);
    burst("star", 9);
    void speakWithBrain("El humano acaba de jugar contigo.");
  }

  function pet() {
    setCreature((p) => {
      const bondGain = p.personality?.modifiers.petBondGain ?? 1;
      return {
        ...p,
        happiness: clamp(p.happiness + 9),
        bond: clamp(p.bond + 4 * bondGain),
        mood: "happy"
      };
    });
    gainXp(4);
    setMessage(creature.personality?.id === "shy" ? "…♡" : "mrrp… ♡");
    setTemporaryReaction("pet", 1450);
    burst("heart", 6);
    void speakWithBrain("El humano acaba de acariciarte.");
  }

  function sleep() {
    setCreature((p) => ({ ...p, energy: clamp(p.energy + 24), mood: "sleepy" }));
    setMessage("zzZ…");
    setTemporaryReaction("sleep", 4200);
    burst("zzz", 4);
    void speakWithBrain("El humano te acomodó para dormir.");
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
  const phase = dayPhaseMeta(dayPhase);

  return (
    <main
      ref={stageRef}
      style={stageStyle}
      className={"stage mood-" + creature.mood + " reaction-" + reaction + " personality-" + (creature.personality?.id ?? "unborn") + " phase-" + dayPhase}
      onPointerMove={trackPointer}
      onPointerLeave={() => {
        stageRef.current?.style.setProperty("--look-x", "0px");
        stageRef.current?.style.setProperty("--look-y", "0px");
      }}
      onContextMenu={(event: ReactMouseEvent<HTMLElement>) => {
        event.preventDefault();
        setPanelView("main");
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
              <span>Nivel {creature.level} · {moodLabel(creature.mood)} · {phase.icon} {phase.label}</span>
            </div>
          </div>
          <button
            className="close"
            onClick={() => {
              if (panelView !== "main") setPanelView("main");
              else setMenuOpen(false);
            }}
            aria-label={panelView !== "main" ? "Volver" : "Cerrar menú"}
          >
            {panelView !== "main" ? "‹" : "×"}
          </button>
        </header>

        {panelView === "main" ? <>
        {creature.personality && (
          <div className="personality-card" title={creature.personality.description}>
            <span className="personality-icon">{creature.personality.icon}</span>
            <div className="personality-copy">
              <div><b>{creature.personality.name}</b><small>{creature.personality.quirk}</small></div>
              <span className="favorite">favorito · {creature.personality.favoriteSnack}</span>
            </div>
            <div className="trait-pips" aria-label="Rasgos">
              <TraitPip label="curiosidad" value={creature.personality.traits.curiosity} />
              <TraitPip label="juego" value={creature.personality.traits.playfulness} />
              <TraitPip label="afecto" value={creature.personality.traits.affection} />
            </div>
          </div>
        )}

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
          <button onClick={talk} disabled={brainThinking}><span>💬</span>{brainThinking ? "Pensando…" : "Hablar"}</button>
          <button onClick={openBrainPanel}><span>🧠</span>Cerebro</button>
        </div>

        <button className="treasure-button" onClick={() => setPanelView("treasures")}>
          <span>🎒</span>
          <div>
            <b>Tesoros</b>
            <small>{creature.treasures.length ? creature.treasures[0].name : "Miko todavía no ha encontrado nada"}</small>
          </div>
          <i>{creature.treasures.length}/10</i>
        </button>

        <div className="xp">
          <span>XP</span>
          <div><i style={{ width: String(Math.min(100, (creature.xp / (creature.level * 100)) * 100)) + "%" }} /></div>
          <small>{creature.xp}/{creature.level * 100}</small>
        </div>
        </> : panelView === "treasures" ? (
          <TreasureView treasures={creature.treasures} journal={creature.journal} />
        ) : (
          <BrainView
            config={brainConfig}
            status={brainStatus}
            apiKeyDraft={brainKeyDraft}
            busy={brainThinking}
            error={brainError}
            onConfig={setBrainConfig}
            onApiKey={setBrainKeyDraft}
            onSave={() => void saveBrainSettings()}
            onRefresh={() => void refreshBrain()}
          />
        )}
      </section>}

      {!menuOpen && hatchPhase === "hatched" && <div className="hint">clic · cariño &nbsp;&nbsp; clic derecho · menú</div>}
    </main>
  );
}

function BrainView({
  config,
  status,
  apiKeyDraft,
  busy,
  error,
  onConfig,
  onApiKey,
  onSave,
  onRefresh
}: {
  config: PublicBrainConfig;
  status: BrainStatus | null;
  apiKeyDraft: string;
  busy: boolean;
  error: string;
  onConfig: (config: PublicBrainConfig) => void;
  onApiKey: (value: string) => void;
  onSave: () => void;
  onRefresh: () => void;
}) {
  const patch = (next: Partial<PublicBrainConfig>) => onConfig({ ...config, ...next });

  return (
    <div className="brain-view">
      <div className="brain-heading">
        <div>
          <b>Cerebro de Miko</b>
          <span>Local, Hermes u Ollama</span>
        </div>
        <button onClick={onRefresh} disabled={busy}>↻</button>
      </div>

      <div className="brain-modes">
        {(["local", "auto", "hermes", "ollama"] as const).map((mode) => (
          <button
            key={mode}
            className={config.mode === mode ? "active" : ""}
            onClick={() => patch({ mode })}
          >
            {mode === "local" ? "Local" : mode === "auto" ? "Auto" : mode === "hermes" ? "Hermes" : "Ollama"}
          </button>
        ))}
      </div>

      <div className="provider-statuses">
        <ProviderBadge label="Hermes" status={status?.hermes ?? null} />
        <ProviderBadge label="Ollama" status={status?.ollama ?? null} />
      </div>

      {(config.mode === "hermes" || config.mode === "auto") && (
        <div className="brain-fields">
          <label>
            <span>Hermes endpoint</span>
            <input value={config.hermesUrl} onChange={(e) => patch({ hermesUrl: e.target.value })} />
          </label>
          <label>
            <span>API key {config.hermesKeySet ? "· guardada" : ""}</span>
            <input
              type="password"
              value={apiKeyDraft}
              placeholder={config.hermesKeySet ? "•••••••• (dejar vacío para conservar)" : "API_SERVER_KEY"}
              onChange={(e) => onApiKey(e.target.value)}
            />
          </label>
        </div>
      )}

      {(config.mode === "ollama" || config.mode === "auto" || config.fallbackToOllama) && (
        <div className="brain-fields">
          <label>
            <span>Ollama endpoint</span>
            <input value={config.ollamaUrl} onChange={(e) => patch({ ollamaUrl: e.target.value })} />
          </label>
          <label>
            <span>Modelo</span>
            <input value={config.ollamaModel} onChange={(e) => patch({ ollamaModel: e.target.value })} />
          </label>
        </div>
      )}

      {(config.mode === "hermes" || config.mode === "auto") && (
        <>
          <label className="brain-toggle">
            <input
              type="checkbox"
              checked={config.fallbackToOllama}
              onChange={(e) => patch({ fallbackToOllama: e.target.checked })}
            />
            <span>Usar Ollama si Hermes no responde</span>
          </label>

          <label className="brain-toggle brain-toggle-danger">
            <input
              type="checkbox"
              checked={config.allowHermesTools}
              onChange={(e) => patch({ allowHermesTools: e.target.checked })}
            />
            <span>Permitir Hermes aunque tenga herramientas activas</span>
          </label>
        </>
      )}

      <div className={"brain-safe " + ((status?.hermes.toolsetsEnabled ?? 0) > 0 && !config.allowHermesTools ? "blocked" : "")}>
        <span>{(status?.hermes.toolsetsEnabled ?? 0) > 0 && !config.allowHermesTools ? "🛑" : "🔒"}</span>
        <p>
          {(status?.hermes.toolsetsEnabled ?? 0) > 0 && !config.allowHermesTools
            ? "Hermes tiene herramientas activas: AI Creatures lo bloqueará y usará fallback."
            : "Modo mascota: Hermes solo se usa si no expone herramientas, salvo autorización avanzada."}
        </p>
      </div>

      {error && <div className="brain-error">{error}</div>}

      <button className="brain-save" onClick={onSave} disabled={busy}>
        {busy ? "Comprobando…" : "Guardar y probar"}
      </button>
    </div>
  );
}

function ProviderBadge({ label, status }: { label: string; status: BrainStatus["hermes"] | null }) {
  return (
    <div className={"provider-badge " + (status?.online ? "online" : "offline")}>
      <i />
      <div>
        <b>{label}</b>
        <span>{status ? status.detail : "sin comprobar"}</span>
      </div>
    </div>
  );
}

function TreasureView({ treasures, journal }: { treasures: Treasure[]; journal: LifeEvent[] }) {
  return (
    <div className="treasure-view">
      <div className="treasure-heading">
        <div>
          <b>Colección</b>
          <span>{treasures.length}/10 descubrimientos</span>
        </div>
        <span>✦</span>
      </div>

      <div className="treasure-grid">
        {treasures.length ? treasures.map((item) => (
          <div className={"treasure-item rarity-" + item.rarity} key={item.id} title={item.flavor}>
            <span>{item.icon}</span>
            <div>
              <b>{item.name}</b>
              <small>{rarityLabel(item.rarity)}</small>
            </div>
          </div>
        )) : (
          <div className="empty-treasures">Miko saldrá a explorar por su cuenta.</div>
        )}
      </div>

      <div className="journal">
        <b>Últimos momentos</b>
        {journal.length ? journal.slice(0, 4).map((event) => (
          <div key={event.id}>
            <span>{new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            <p>{event.message}</p>
          </div>
        )) : <small>Aquí aparecerá su pequeña historia.</small>}
      </div>
    </div>
  );
}

function TraitPip({ label, value }: { label: string; value: number }) {
  return (
    <span className="trait-pip" title={label}>
      <i style={{ opacity: .35 + value / 155 }} />
    </span>
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
