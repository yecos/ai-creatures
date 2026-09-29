import type { PersonalityProfile } from "./personality";
import type { Treasure } from "./life";

export type EvolutionId = "lumiko" | "voltik" | "mossling" | "noctiko" | "berryn" | "riftling";

export type CareStats = {
  feeds: number;
  plays: number;
  pets: number;
  sleeps: number;
  talks: number;
};

export type EvolutionState = {
  form: EvolutionId | null;
  evolvedAt: number | null;
  care: CareStats;
};

export type EvolutionForm = {
  id: EvolutionId;
  name: string;
  icon: string;
  title: string;
  description: string;
  passive: string;
  secret?: boolean;
};

export type EvolutionContext = {
  level: number;
  bond: number;
  happiness: number;
  energy: number;
  hunger: number;
  ageSeconds: number;
  personality: PersonalityProfile | null;
  treasures: Treasure[];
  care: CareStats;
};

export const initialEvolutionState: EvolutionState = {
  form: null,
  evolvedAt: null,
  care: {
    feeds: 0,
    plays: 0,
    pets: 0,
    sleeps: 0,
    talks: 0
  }
};

const forms: Record<EvolutionId, EvolutionForm> = {
  lumiko: {
    id: "lumiko",
    name: "Lumiko",
    icon: "✦",
    title: "Corazón de luz",
    description: "Una forma luminosa nacida de mucho vínculo y cariño.",
    passive: "El vínculo crece más rápido al recibir cariño."
  },
  voltik: {
    id: "voltik",
    name: "Voltik",
    icon: "⚡",
    title: "Chispa inquieta",
    description: "Una evolución rápida, juguetona y difícil de mantener quieta.",
    passive: "Jugar produce más felicidad y sus movimientos son más enérgicos."
  },
  mossling: {
    id: "mossling",
    name: "Mossling",
    icon: "❈",
    title: "Guardián del escritorio",
    description: "Una criatura tranquila que parece haber aprendido a crecer entre objetos perdidos.",
    passive: "Pierde felicidad más lentamente y encuentra tesoros con calma."
  },
  noctiko: {
    id: "noctiko",
    name: "Noctiko",
    icon: "☾",
    title: "Soñador lunar",
    description: "Su brillo cambia con la noche y parece escuchar cosas mientras duerme.",
    passive: "Recupera más energía al dormir y tiene afinidad con hallazgos nocturnos."
  },
  berryn: {
    id: "berryn",
    name: "Berryn",
    icon: "🍓",
    title: "Alma golosa",
    description: "Redondo, feliz y absolutamente convencido de que todo mejora con un snack.",
    passive: "La comida restaura más felicidad y saciedad."
  },
  riftling: {
    id: "riftling",
    name: "Riftling",
    icon: "◇",
    title: "Eco del portal",
    description: "Algo del fragmento de portal respondió a Miko. Nadie sabe exactamente qué.",
    passive: "Los sucesos extraños parecen encontrarlo con mayor frecuencia.",
    secret: true
  }
};

export function evolutionForm(id: EvolutionId | null): EvolutionForm | null {
  return id ? forms[id] : null;
}

function hasTreasure(ctx: EvolutionContext, id: string) {
  return ctx.treasures.some((item) => item.id === id);
}

function totalCare(care: CareStats) {
  return care.feeds + care.plays + care.pets + care.sleeps + care.talks;
}

export function evolutionReadiness(ctx: EvolutionContext) {
  const levelScore = Math.min(36, ctx.level * 12);
  const bondScore = Math.min(28, ctx.bond * 0.42);
  const careScore = Math.min(22, totalCare(ctx.care) * 1.8);
  const treasureScore = Math.min(14, ctx.treasures.length * 2.8);
  return Math.max(0, Math.min(100, Math.round(levelScore + bondScore + careScore + treasureScore)));
}

export function canEvolve(ctx: EvolutionContext) {
  return ctx.level >= 3
    && ctx.bond >= 24
    && totalCare(ctx.care) >= 8
    && evolutionReadiness(ctx) >= 72;
}

type ScoredForm = {
  id: EvolutionId;
  score: number;
};

export function chooseEvolution(ctx: EvolutionContext): EvolutionId {
  const p = ctx.personality;
  const care = ctx.care;

  // Secret route: the rarest treasure can fundamentally alter Miko.
  if (
    hasTreasure(ctx, "portal-shard")
    && ctx.level >= 4
    && (p?.id === "curious" || p?.id === "mischievous")
    && ctx.bond >= 35
  ) {
    return "riftling";
  }

  const scores: ScoredForm[] = [
    {
      id: "lumiko",
      score:
        care.pets * 4.3 +
        care.talks * 2.1 +
        ctx.bond * .72 +
        (p?.id === "affectionate" ? 28 : 0) +
        (p?.traits.affection ?? 50) * .16 +
        (hasTreasure(ctx, "paper-star") ? 13 : 0)
    },
    {
      id: "voltik",
      score:
        care.plays * 5 +
        ctx.energy * .18 +
        (p?.id === "mischievous" ? 30 : 0) +
        (p?.traits.playfulness ?? 50) * .2 +
        (hasTreasure(ctx, "space-screw") ? 12 : 0)
    },
    {
      id: "mossling",
      score:
        ctx.happiness * .17 +
        ctx.treasures.length * 3 +
        Math.min(care.feeds, care.sleeps) * 3 +
        (p?.id === "shy" ? 17 : 0) +
        (p?.id === "curious" ? 8 : 0) +
        (hasTreasure(ctx, "leaf") ? 20 : 0)
    },
    {
      id: "noctiko",
      score:
        care.sleeps * 5 +
        (p?.id === "sleepy" ? 34 : 0) +
        (p?.traits.sleepiness ?? 50) * .22 +
        (hasTreasure(ctx, "moon-seed") ? 24 : 0) +
        (hasTreasure(ctx, "holo-feather") ? 10 : 0)
    },
    {
      id: "berryn",
      score:
        care.feeds * 5 +
        (100 - ctx.hunger) * .14 +
        (p?.id === "glutton" ? 36 : 0) +
        (p?.traits.appetite ?? 50) * .22 +
        (hasTreasure(ctx, "old-berry") ? 25 : 0)
    }
  ];

  scores.sort((a, b) => b.score - a.score);
  return scores[0]?.id ?? "mossling";
}

export function evolutionMessage(id: EvolutionId) {
  const form = forms[id];
  const messages: Record<EvolutionId, string> = {
    lumiko: "algo dentro de Miko empezó a brillar…",
    voltik: "¡una chispa recorrió todo su cuerpo!",
    mossling: "una pequeña vida verde despertó en Miko…",
    noctiko: "la luz de la noche respondió…",
    berryn: "Miko brilló con energía de snack…",
    riftling: "el fragmento de portal acaba de reaccionar."
  };
  return { prelude: messages[id], reveal: form.icon + " " + form.name + " ✦" };
}

export function evolutionModifiers(id: EvolutionId | null) {
  switch (id) {
    case "lumiko":
      return { petBond: 1.3, playHappy: 1, feedHappy: 1, sleepEnergy: 1, happinessDecay: .82, discovery: 1, moveSpeed: 1.02 };
    case "voltik":
      return { petBond: 1, playHappy: 1.42, feedHappy: .96, sleepEnergy: .9, happinessDecay: 1, discovery: 1.12, moveSpeed: 1.34 };
    case "mossling":
      return { petBond: 1.08, playHappy: .96, feedHappy: 1.06, sleepEnergy: 1.08, happinessDecay: .68, discovery: 1.15, moveSpeed: .84 };
    case "noctiko":
      return { petBond: 1.05, playHappy: .9, feedHappy: 1, sleepEnergy: 1.48, happinessDecay: .78, discovery: 1.18, moveSpeed: .78 };
    case "berryn":
      return { petBond: 1, playHappy: .9, feedHappy: 1.55, sleepEnergy: 1, happinessDecay: .9, discovery: 1, moveSpeed: .9 };
    case "riftling":
      return { petBond: 1.16, playHappy: 1.18, feedHappy: 1.08, sleepEnergy: 1.18, happinessDecay: .72, discovery: 1.5, moveSpeed: 1.2 };
    default:
      return { petBond: 1, playHappy: 1, feedHappy: 1, sleepEnergy: 1, happinessDecay: 1, discovery: 1, moveSpeed: 1 };
  }
}
