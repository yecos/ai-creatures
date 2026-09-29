import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { availableMonitors, currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
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
import {
  canEvolve,
  chooseEvolution,
  evolutionForm,
  evolutionMessage,
  evolutionModifiers,
  evolutionReadiness,
  initialEvolutionState,
  type CareStats,
  type EvolutionState
} from "./evolution";
import {
  canHaveOffspring,
  createOffspring,
  createVisitor,
  ecosystemPromptSummary,
  giveGift,
  initialEcosystemState,
  relationLabel,
  relationTone,
  socialize,
  type EcosystemState,
  type SocialCreature
} from "./ecosystem";

const STORAGE_KEY = "ai-creatures:v0.7";
const LEGACY_STORAGE_KEYS = ["ai-creatures:v0.6", "ai-creatures:v0.4", "ai-creatures:v0.3", "ai-creatures:v0.2"];

type Reaction = "none" | "pet" | "feed" | "play" | "sleep" | "peek" | "bounce" | "shy" | "wiggle" | "evolve";
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
  evolution: EvolutionState;
  ecosystem: EcosystemState;
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
  lastDiscoveryAt: 0,
  evolution: initialEvolutionState,
  ecosystem: initialEcosystemState
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
    const evolution = parsed.evolution ?? initialEvolutionState;
    const ecosystem = parsed.ecosystem ?? initialEcosystemState;
    const evolvedModifiers = evolutionModifiers(evolution.form);
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
      evolution,
      ecosystem,
      hunger: clamp((parsed.hunger ?? initialState.hunger) + awayMinutes * 0.7 * (modifiers?.hungerRate ?? 1)),
      energy: clamp((parsed.energy ?? initialState.energy) + awayMinutes * 0.45),
      happiness: clamp((parsed.happiness ?? initialState.happiness) - awayMinutes * 0.12 * (modifiers?.happinessDecay ?? 1) * evolvedModifiers.happinessDecay),
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
  const [panelView, setPanelView] = useState<"main" | "treasures" | "brain" | "chat" | "ecosystem">("main");
  const [dayPhase, setDayPhase] = useState<DayPhase>(() => getDayPhase());
  const [brainConfig, setBrainConfig] = useState<PublicBrainConfig>(defaultBrainConfig);
  const [brainStatus, setBrainStatus] = useState<BrainStatus | null>(null);
  const [brainKeyDraft, setBrainKeyDraft] = useState("");
  const [brainChatDraft, setBrainChatDraft] = useState("");
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
  const evolutionTimer = useRef<number | null>(null);
  const visitorTimer = useRef<number | null>(null);
  const evolutionPendingRef = useRef(false);
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
        const evolved = evolutionModifiers(prev.evolution.form);
        const next = {
          ...prev,
          ageSeconds: prev.ageSeconds + 1,
          hunger: clamp(prev.hunger + 0.075 * (modifiers?.hungerRate ?? 1)),
          energy: clamp(prev.energy - 0.023 * (modifiers?.energyDrain ?? 1)),
          happiness: clamp(prev.happiness - 0.01 * (modifiers?.happinessDecay ?? 1) * evolved.happinessDecay),
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
      if (stopped || !creature.hatched || menuOpen || reaction === "sleep" || reaction === "evolve" || creature.mood === "sleepy") return;
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
          const personalitySpeed = creature.personality?.modifiers.moveSpeed ?? 1;
          const evolvedSpeed = evolutionModifiers(creature.evolution.form).moveSpeed;
          const speed = personalitySpeed * evolvedSpeed;
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
      if (evolutionTimer.current) window.clearTimeout(evolutionTimer.current);
      if (visitorTimer.current) window.clearTimeout(visitorTimer.current);
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
      const evolved = evolutionModifiers(current.evolution.form);
      const chance = Math.min(.72, discoveryChance(phaseNow, current.personality) * evolved.discovery);
      if (Math.random() > chance) return;

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

  useEffect(() => {
    if (!creature.hatched || creature.evolution.form || evolutionPendingRef.current) return;

    const context = {
      level: creature.level,
      bond: creature.bond,
      happiness: creature.happiness,
      energy: creature.energy,
      hunger: creature.hunger,
      ageSeconds: creature.ageSeconds,
      personality: creature.personality,
      treasures: creature.treasures,
      care: creature.evolution.care
    };

    if (!canEvolve(context)) return;

    const nextForm = chooseEvolution(context);
    const lines = evolutionMessage(nextForm);
    evolutionPendingRef.current = true;
    setMessage(lines.prelude);
    setReaction("evolve");
    burst("star", nextForm === "riftling" ? 18 : 12);

    evolutionTimer.current = window.setTimeout(() => {
      const form = evolutionForm(nextForm);
      setCreature((prev) => ({
        ...prev,
        evolution: {
          ...prev.evolution,
          form: nextForm,
          evolvedAt: Date.now()
        },
        happiness: 100,
        energy: clamp(prev.energy + 18),
        bond: clamp(prev.bond + 8),
        journal: [
          createEvent("Miko evolucionó a " + (form?.name ?? nextForm) + ".", "moment"),
          ...prev.journal
        ].slice(0, 8)
      }));
      setMessage(lines.reveal);
      burst(nextForm === "riftling" ? "star" : "heart", nextForm === "riftling" ? 18 : 10);
      setReaction("bounce");
      evolutionPendingRef.current = false;
      evolutionTimer.current = window.setTimeout(() => setReaction("none"), 1800);
    }, 2300);
  }, [
    creature.hatched,
    creature.evolution.form,
    creature.evolution.care,
    creature.level,
    creature.bond,
    creature.happiness,
    creature.energy,
    creature.hunger,
    creature.ageSeconds,
    creature.personality,
    creature.treasures
  ]);


  useEffect(() => {
    if (!creature.hatched || creature.level < 2) return;

    const encounters = window.setInterval(() => {
      const current = creatureRef.current;
      if (!current.hatched || current.ecosystem.activeVisitorId) return;
      if (Date.now() - current.ecosystem.lastEncounterAt < 60000) return;
      if (current.energy < 20 || Math.random() > .42) return;

      const known = current.ecosystem.known;
      const shouldMeetNew = known.length === 0 || (known.length < 8 && Math.random() < .46);
      const visitor = shouldMeetNew
        ? createVisitor(known)
        : known[Math.floor(Math.random() * known.length)];

      setCreature((prev) => {
        const exists = prev.ecosystem.known.some((item) => item.id === visitor.id);
        return {
          ...prev,
          ecosystem: {
            ...prev.ecosystem,
            known: exists ? prev.ecosystem.known : [visitor, ...prev.ecosystem.known].slice(0, 12),
            activeVisitorId: visitor.id,
            lastEncounterAt: Date.now()
          },
          journal: [
            createEvent(visitor.name + " vino a visitar a Miko.", "moment"),
            ...prev.journal
          ].slice(0, 8)
        };
      });

      setMessage(visitor.name + " vino de visita ✦");
      burst("star", 5);

      if (visitorTimer.current) window.clearTimeout(visitorTimer.current);
      visitorTimer.current = window.setTimeout(() => {
        setCreature((prev) => ({
          ...prev,
          ecosystem: { ...prev.ecosystem, activeVisitorId: null }
        }));
      }, 28000);
    }, 45000);

    return () => clearInterval(encounters);
  }, [creature.hatched, creature.level]);

  useEffect(() => {
    if (!creature.hatched || !creature.ecosystem.autoTravel || creature.level < 3) return;

    const travel = window.setInterval(() => {
      const current = creatureRef.current;
      if (!current.ecosystem.autoTravel || current.energy < 35 || menuOpen || reaction !== "none") return;
      if (Math.random() > .18) return;
      void travelToAnotherMonitor(false);
    }, 120000);

    return () => clearInterval(travel);
  }, [creature.hatched, creature.level, creature.ecosystem.autoTravel, menuOpen, reaction]);

  function addCare(kind: keyof CareStats) {
    setCreature((prev) => ({
      ...prev,
      evolution: {
        ...prev.evolution,
        care: {
          ...prev.evolution.care,
          [kind]: prev.evolution.care[kind] + 1
        }
      }
    }));
  }

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
      current.evolution.form
        ? "Forma evolucionada: " + (evolutionForm(current.evolution.form)?.name ?? current.evolution.form) + ". " + (evolutionForm(current.evolution.form)?.description ?? "")
        : "Aún no ha evolucionado.",
      "Tesoros: " + treasures + ".",
      "Recuerdos recientes: " + recent + ".",
      ecosystemPromptSummary(current.ecosystem)
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

  function openEcosystemPanel() {
    setPanelView("ecosystem");
  }

  function socializeWithVisitor() {
    const current = creatureRef.current;
    const visitor = current.ecosystem.known.find((item) => item.id === current.ecosystem.activeVisitorId);
    if (!visitor) return;

    const result = socialize(visitor, current.personality);
    setCreature((prev) => ({
      ...prev,
      happiness: clamp(prev.happiness + (result.positive ? 5 : 1)),
      ecosystem: {
        ...prev.ecosystem,
        known: prev.ecosystem.known.map((item) => item.id === result.creature.id ? result.creature : item)
      },
      journal: [createEvent(result.message, "moment"), ...prev.journal].slice(0, 8)
    }));
    setMessage(result.message);
    setTemporaryReaction(result.positive ? "wiggle" : "peek", 1300);
    burst(result.positive ? "heart" : "star", result.positive ? 5 : 3);
    gainXp(result.positive ? 8 : 4);
  }

  function giftVisitor(id: string) {
    const current = creatureRef.current;
    const visitor = current.ecosystem.known.find((item) => item.id === id);
    if (!visitor) return;

    const updated = giveGift(visitor);
    setCreature((prev) => ({
      ...prev,
      ecosystem: {
        ...prev.ecosystem,
        known: prev.ecosystem.known.map((item) => item.id === id ? updated : item)
      },
      journal: [createEvent("Miko le dio un pequeño regalo a " + visitor.name + ".", "moment"), ...prev.journal].slice(0, 8)
    }));
    setMessage(visitor.name + " aceptó el regalo ♡");
    burst("heart", 5);
  }

  function createFamily(id: string) {
    const current = creatureRef.current;
    const parent = current.ecosystem.known.find((item) => item.id === id);
    if (!parent || !current.personality) return;
    if (!canHaveOffspring(parent, current.level, current.bond, current.ecosystem.offspringCount)) return;

    const child = createOffspring(
      current.name,
      current.personality,
      current.evolution.form,
      parent,
      current.ecosystem.known
    );

    setCreature((prev) => ({
      ...prev,
      happiness: 100,
      bond: clamp(prev.bond + 6),
      ecosystem: {
        ...prev.ecosystem,
        known: [child, ...prev.ecosystem.known],
        activeVisitorId: child.id,
        offspringCount: prev.ecosystem.offspringCount + 1
      },
      journal: [
        createEvent("Nació " + child.name + ", descendiente de Miko y " + parent.name + ".", "moment"),
        ...prev.journal
      ].slice(0, 8)
    }));
    setMessage("🥚 " + child.name + " nació ✦");
    burst("heart", 10);
    burst("star", 8);
    gainXp(30);

    if (visitorTimer.current) window.clearTimeout(visitorTimer.current);
    visitorTimer.current = window.setTimeout(() => {
      setCreature((prev) => ({
        ...prev,
        ecosystem: { ...prev.ecosystem, activeVisitorId: null }
      }));
    }, 32000);
  }

  async function travelToAnotherMonitor(manual = true) {
    try {
      const monitors = await availableMonitors();
      if (monitors.length < 2) {
        if (manual) setMessage("solo veo una pantalla 👀");
        return;
      }

      const appWindow = getCurrentWindow();
      const current = await currentMonitor();
      const size = await appWindow.outerSize();
      const alternatives = monitors.filter((monitor) => {
        if (!current) return true;
        return monitor.position.x !== current.position.x || monitor.position.y !== current.position.y;
      });
      if (!alternatives.length) return;

      const target = alternatives[Math.floor(Math.random() * alternatives.length)];
      const area = target.workArea;
      const maxX = Math.max(20, area.size.width - size.width - 20);
      const maxY = Math.max(20, area.size.height - size.height - 20);
      const x = area.position.x + 20 + Math.random() * Math.max(1, maxX - 20);
      const y = area.position.y + 20 + Math.random() * Math.max(1, maxY - 20);

      await appWindow.setPosition(new PhysicalPosition(x, y));
      setCreature((prev) => ({
        ...prev,
        ecosystem: {
          ...prev.ecosystem,
          monitorTrips: prev.ecosystem.monitorTrips + 1
        },
        journal: [createEvent("Miko exploró otra pantalla.", "moment"), ...prev.journal].slice(0, 8)
      }));
      setMessage("¡otra pantalla! ✦");
      setTemporaryReaction("bounce", 1300);
      burst("star", 6);
    } catch {
      if (manual) setMessage("no pude viajar ahora");
    }
  }

  function setAutoTravel(value: boolean) {
    setCreature((prev) => ({
      ...prev,
      ecosystem: { ...prev.ecosystem, autoTravel: value }
    }));
  }

  function talk() {
    const localLine = personalityLine(creature.personality, creature.mood);
    setTemporaryReaction("peek", 1200);

    if (brainConfig.mode === "local") {
      setMessage(localLine);
      return;
    }

    setPanelView("chat");
    setMessage("te escucho ✦");
  }

  function sendChat() {
    const text = brainChatDraft.trim();
    if (!text || brainThinking) return;

    setBrainChatDraft("");
    addCare("talks");
    setMessage("hmm…");
    setTemporaryReaction("peek", 1400);
    void speakWithBrain('El humano te dijo: "' + text + '". Respóndele directamente como Miko.');
  }

  function feed() {
    setCreature((p) => {
      const boost = p.personality?.modifiers.feedBoost ?? 1;
      const evolved = evolutionModifiers(p.evolution.form);
      return {
        ...p,
        hunger: clamp(p.hunger - 28 * (p.evolution.form === "berryn" ? 1.22 : 1)),
        happiness: clamp(p.happiness + 4 * boost * evolved.feedHappy),
        mood: "happy",
        evolution: { ...p.evolution, care: { ...p.evolution.care, feeds: p.evolution.care.feeds + 1 } }
      };
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
      const evolved = evolutionModifiers(p.evolution.form);
      return {
        ...p,
        happiness: clamp(p.happiness + 18 * boost * evolved.playHappy),
        energy: clamp(p.energy - 10),
        bond: clamp(p.bond + 3),
        mood: "happy",
        evolution: { ...p.evolution, care: { ...p.evolution.care, plays: p.evolution.care.plays + 1 } }
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
      const evolved = evolutionModifiers(p.evolution.form);
      return {
        ...p,
        happiness: clamp(p.happiness + 9),
        bond: clamp(p.bond + 4 * bondGain * evolved.petBond),
        mood: "happy",
        evolution: { ...p.evolution, care: { ...p.evolution.care, pets: p.evolution.care.pets + 1 } }
      };
    });
    gainXp(4);
    setMessage(creature.personality?.id === "shy" ? "…♡" : "mrrp… ♡");
    setTemporaryReaction("pet", 1450);
    burst("heart", 6);
    void speakWithBrain("El humano acaba de acariciarte.");
  }

  function sleep() {
    setCreature((p) => {
      const evolved = evolutionModifiers(p.evolution.form);
      return {
        ...p,
        energy: clamp(p.energy + 24 * evolved.sleepEnergy),
        mood: "sleepy",
        evolution: { ...p.evolution, care: { ...p.evolution.care, sleeps: p.evolution.care.sleeps + 1 } }
      };
    });
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
  const evolvedForm = evolutionForm(creature.evolution.form);
  const activeVisitor = creature.ecosystem.known.find((item) => item.id === creature.ecosystem.activeVisitorId) ?? null;
  const resonance = evolutionReadiness({
    level: creature.level,
    bond: creature.bond,
    happiness: creature.happiness,
    energy: creature.energy,
    hunger: creature.hunger,
    ageSeconds: creature.ageSeconds,
    personality: creature.personality,
    treasures: creature.treasures,
    care: creature.evolution.care
  });

  return (
    <main
      ref={stageRef}
      style={stageStyle}
      className={"stage mood-" + creature.mood + " reaction-" + reaction + " personality-" + (creature.personality?.id ?? "unborn") + " phase-" + dayPhase + " evolution-" + (creature.evolution.form ?? "baby")}
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

      {activeVisitor && (
        <button
          className={"visitor-creature visitor-" + relationTone(activeVisitor)}
          style={{
            "--visitor-hue": activeVisitor.genes.hue + "deg",
            "--visitor-scale": String(.78 + activeVisitor.genes.size / 260),
            "--visitor-glow": String(.2 + activeVisitor.genes.glow / 140)
          } as CSSProperties}
          onClick={socializeWithVisitor}
          title={"Interactuar con " + activeVisitor.name}
        >
          <span className="visitor-ear visitor-ear-left" />
          <span className="visitor-ear visitor-ear-right" />
          <span className="visitor-body">
            <i className="visitor-eye visitor-eye-left" />
            <i className="visitor-eye visitor-eye-right" />
            <i className="visitor-mouth" />
          </span>
          <small>{activeVisitor.parents ? "familia" : activeVisitor.name}</small>
        </button>
      )}

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
              <span className="evolution-aura" />
              <span className="evolution-mark" />
              <span className="evolution-wing evolution-wing-left" />
              <span className="evolution-wing evolution-wing-right" />
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
              <span>
                Nivel {creature.level} · {evolvedForm ? evolvedForm.icon + " " + evolvedForm.name : moodLabel(creature.mood)} · {phase.icon} {phase.label}
              </span>
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
        {evolvedForm ? (
          <div className={"evolution-card evolution-card-" + evolvedForm.id}>
            <span className="evolution-card-icon">{evolvedForm.icon}</span>
            <div>
              <b>{evolvedForm.name}</b>
              <small>{evolvedForm.title}</small>
              <p>{evolvedForm.passive}</p>
            </div>
            {evolvedForm.secret && <i>SECRETA</i>}
          </div>
        ) : (
          <div className="resonance-card">
            <div className="resonance-copy">
              <b>Resonancia</b>
              <span>{resonance < 35 ? "Miko apenas está creciendo" : resonance < 72 ? "algo está cambiando…" : "la evolución está cerca"}</span>
            </div>
            <strong>{resonance}%</strong>
            <div className="resonance-track"><i style={{ width: resonance + "%" }} /></div>
          </div>
        )}

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
          <button onClick={openEcosystemPanel}><span>◌</span>Ecosistema</button>
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
        ) : panelView === "brain" ? (
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
        ) : panelView === "chat" ? (
          <ChatView
            mode={brainConfig.mode}
            draft={brainChatDraft}
            busy={brainThinking}
            error={brainError}
            onDraft={setBrainChatDraft}
            onSend={sendChat}
          />
        ) : (
          <EcosystemView
            ecosystem={creature.ecosystem}
            mikoLevel={creature.level}
            mikoBond={creature.bond}
            onSocialize={socializeWithVisitor}
            onGift={giftVisitor}
            onFamily={createFamily}
            onTravel={() => void travelToAnotherMonitor(true)}
            onAutoTravel={setAutoTravel}
          />
        )}
      </section>}

      {!menuOpen && hatchPhase === "hatched" && <div className="hint">clic · cariño &nbsp;&nbsp; clic derecho · menú</div>}
    </main>
  );
}

function EcosystemView({
  ecosystem,
  mikoLevel,
  mikoBond,
  onSocialize,
  onGift,
  onFamily,
  onTravel,
  onAutoTravel
}: {
  ecosystem: EcosystemState;
  mikoLevel: number;
  mikoBond: number;
  onSocialize: () => void;
  onGift: (id: string) => void;
  onFamily: (id: string) => void;
  onTravel: () => void;
  onAutoTravel: (value: boolean) => void;
}) {
  const active = ecosystem.known.find((item) => item.id === ecosystem.activeVisitorId) ?? null;
  const ordered = [...ecosystem.known].sort((a, b) => {
    if (Boolean(a.parents) !== Boolean(b.parents)) return a.parents ? -1 : 1;
    return b.relation.affinity - a.relation.affinity;
  });

  return (
    <div className="ecosystem-view">
      <div className="ecosystem-heading">
        <div>
          <b>Ecosistema</b>
          <span>{ecosystem.known.length} criaturas conocidas · {ecosystem.offspringCount} descendientes</span>
        </div>
        <span>◌</span>
      </div>

      {active && (
        <div className={"active-social-card tone-" + relationTone(active)}>
          <span
            className="social-avatar"
            style={{ filter: "hue-rotate(" + active.genes.hue + "deg)" }}
          >
            {active.parents ? "🥚" : active.personality.icon}
          </span>
          <div>
            <b>{active.name}</b>
            <small>{active.personality.name} · {relationLabel(active)}</small>
            <div className="social-meter">
              <i style={{ width: active.relation.affinity + "%" }} />
            </div>
          </div>
          <button onClick={onSocialize}>saludar</button>
        </div>
      )}

      <div className="ecosystem-travel">
        <div>
          <b>Explorar pantallas</b>
          <span>{ecosystem.monitorTrips} viajes</span>
        </div>
        <button onClick={onTravel}>Viajar</button>
        <label>
          <input
            type="checkbox"
            checked={ecosystem.autoTravel}
            onChange={(event) => onAutoTravel(event.target.checked)}
          />
          auto
        </label>
      </div>

      <div className="social-list">
        {ordered.length ? ordered.map((item) => {
          const canFamily = canHaveOffspring(item, mikoLevel, mikoBond, ecosystem.offspringCount);
          return (
            <div className={"social-row tone-" + relationTone(item)} key={item.id}>
              <span
                className="social-avatar"
                style={{ filter: "hue-rotate(" + item.genes.hue + "deg)" }}
              >
                {item.parents ? "✧" : item.personality.icon}
              </span>
              <div className="social-copy">
                <div>
                  <b>{item.name}</b>
                  <small>gen {item.generation}</small>
                </div>
                <span>{relationLabel(item)} · ♥ {item.relation.affinity} · ⚡ {item.relation.rivalry}</span>
                {item.parents && <em>{item.parents[0]} × {item.parents[1]}</em>}
              </div>
              <div className="social-actions">
                <button onClick={() => onGift(item.id)}>♡</button>
                {canFamily && <button className="egg-action" onClick={() => onFamily(item.id)}>🥚</button>}
              </div>
            </div>
          );
        }) : (
          <div className="ecosystem-empty">
            Miko todavía no conoce otras criaturas. Las visitas empiezan a partir del nivel 2.
          </div>
        )}
      </div>

      <small className="ecosystem-note">
        La afinidad y rivalidad cambian con encuentros, personalidades y regalos. La descendencia hereda rasgos con pequeñas mutaciones.
      </small>
    </div>
  );
}

function ChatView({
  mode,
  draft,
  busy,
  error,
  onDraft,
  onSend
}: {
  mode: PublicBrainConfig["mode"];
  draft: string;
  busy: boolean;
  error: string;
  onDraft: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="chat-view">
      <div className="chat-heading">
        <span className="chat-orb">💬</span>
        <div>
          <b>Hablar con Miko</b>
          <span>cerebro · {mode}</span>
        </div>
      </div>

      <p>Escríbele algo. Miko responderá en la burbuja sobre su cabeza.</p>

      <div className="chat-compose">
        <input
          autoFocus
          value={draft}
          maxLength={180}
          placeholder="¿Qué estás haciendo, Miko?"
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSend();
          }}
        />
        <button onClick={onSend} disabled={busy || !draft.trim()}>
          {busy ? "…" : "↑"}
        </button>
      </div>

      {error && <div className="brain-error">{error}</div>}

      <small>Hermes/Ollama reciben el estado y recuerdos recientes de Miko.</small>
    </div>
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
