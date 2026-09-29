import { createPersonality, type PersonalityId, type PersonalityProfile } from "./personality";
import type { EvolutionId } from "./evolution";

export type RelationshipTone = "new" | "friend" | "best-friend" | "rival" | "family";

export type CreatureGenes = {
  hue: number;
  glow: number;
  size: number;
  energy: number;
  affection: number;
  curiosity: number;
};

export type SocialCreature = {
  id: string;
  name: string;
  generation: number;
  bornAt: number;
  personality: PersonalityProfile;
  evolution: EvolutionId | null;
  genes: CreatureGenes;
  relation: {
    affinity: number;
    rivalry: number;
    meetings: number;
    gifts: number;
    lastMetAt: number;
  };
  parents?: [string, string];
};

export type EcosystemState = {
  known: SocialCreature[];
  activeVisitorId: string | null;
  lastEncounterAt: number;
  monitorTrips: number;
  autoTravel: boolean;
  offspringCount: number;
};

export const initialEcosystemState: EcosystemState = {
  known: [],
  activeVisitorId: null,
  lastEncounterAt: 0,
  monitorTrips: 0,
  autoTravel: true,
  offspringCount: 0
};

const names = [
  "Nori", "Luma", "Pip", "Kumo", "Tavi", "Bibi", "Moa", "Nix",
  "Yuki", "Toto", "Mimi", "Kiri", "Zuno", "Fae", "Poko", "Iko"
];

const evolutionPool: EvolutionId[] = ["lumiko", "voltik", "mossling", "noctiko", "berryn"];

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function jitter(value: number, amount = 14) {
  return clamp(Math.round(value + (Math.random() - .5) * amount));
}

function id(prefix = "creature") {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function chooseName(used: string[]) {
  const free = names.filter((name) => !used.includes(name));
  return (free.length ? free : names)[Math.floor(Math.random() * (free.length ? free.length : names.length))];
}

export function genesFromPersonality(profile: PersonalityProfile): CreatureGenes {
  return {
    hue: Math.round(185 + profile.traits.curiosity * 1.25 + (Math.random() - .5) * 45) % 360,
    glow: clamp(Math.round(35 + profile.traits.affection * .58)),
    size: clamp(Math.round(42 + profile.traits.appetite * .35 + (Math.random() - .5) * 15), 35, 90),
    energy: profile.traits.playfulness,
    affection: profile.traits.affection,
    curiosity: profile.traits.curiosity
  };
}

export function createVisitor(existing: SocialCreature[]): SocialCreature {
  const personality = createPersonality();
  const evolved = Math.random() < .52
    ? evolutionPool[Math.floor(Math.random() * evolutionPool.length)]
    : null;

  return {
    id: id(),
    name: chooseName(existing.map((item) => item.name)),
    generation: 1,
    bornAt: Date.now(),
    personality,
    evolution: evolved,
    genes: genesFromPersonality(personality),
    relation: {
      affinity: 8 + Math.round(Math.random() * 18),
      rivalry: Math.round(Math.random() * 8),
      meetings: 1,
      gifts: 0,
      lastMetAt: Date.now()
    }
  };
}

function compatibility(a: PersonalityProfile | null, b: PersonalityProfile) {
  if (!a) return 0;

  const affinityPairs: Record<PersonalityId, PersonalityId[]> = {
    curious: ["curious", "shy", "mischievous"],
    affectionate: ["affectionate", "shy", "sleepy"],
    mischievous: ["mischievous", "curious", "glutton"],
    glutton: ["glutton", "affectionate", "mischievous"],
    shy: ["affectionate", "curious", "sleepy"],
    sleepy: ["sleepy", "affectionate", "shy"]
  };

  return affinityPairs[a.id].includes(b.id) ? 8 : a.id === b.id ? 5 : -1;
}

export function socialize(
  visitor: SocialCreature,
  mikoPersonality: PersonalityProfile | null
): { creature: SocialCreature; message: string; positive: boolean } {
  const pairBonus = compatibility(mikoPersonality, visitor.personality);
  const playMatch = mikoPersonality
    ? 8 - Math.abs(mikoPersonality.traits.playfulness - visitor.personality.traits.playfulness) / 14
    : 2;
  const roll = Math.random() * 10;
  const positive = pairBonus + playMatch + roll > 6;

  const affinityGain = positive ? Math.round(5 + Math.random() * 9 + Math.max(0, pairBonus)) : Math.round(Math.random() * 3);
  const rivalryGain = positive ? Math.round(Math.random() * 2) : Math.round(4 + Math.random() * 8);

  const next: SocialCreature = {
    ...visitor,
    relation: {
      ...visitor.relation,
      affinity: clamp(visitor.relation.affinity + affinityGain),
      rivalry: clamp(visitor.relation.rivalry + rivalryGain),
      meetings: visitor.relation.meetings + 1,
      lastMetAt: Date.now()
    }
  };

  const message = positive
    ? visitor.relation.affinity + affinityGain >= 80
      ? visitor.name + " y Miko parecen inseparables ♡"
      : visitor.name + " y Miko jugaron juntos ✦"
    : visitor.relation.rivalry + rivalryGain >= 45
      ? visitor.name + " desafió a Miko ⚡"
      : visitor.name + " y Miko no se pusieron de acuerdo…";

  return { creature: next, message, positive };
}

export function giveGift(visitor: SocialCreature): SocialCreature {
  return {
    ...visitor,
    relation: {
      ...visitor.relation,
      affinity: clamp(visitor.relation.affinity + 8),
      rivalry: clamp(visitor.relation.rivalry - 2),
      gifts: visitor.relation.gifts + 1,
      lastMetAt: Date.now()
    }
  };
}

export function relationTone(creature: SocialCreature): RelationshipTone {
  if (creature.parents) return "family";
  if (creature.relation.rivalry >= 48 && creature.relation.rivalry > creature.relation.affinity * .72) return "rival";
  if (creature.relation.affinity >= 82) return "best-friend";
  if (creature.relation.affinity >= 42) return "friend";
  return "new";
}

export function relationLabel(creature: SocialCreature) {
  const tone = relationTone(creature);
  const labels: Record<RelationshipTone, string> = {
    new: "conocido",
    friend: "amigo",
    "best-friend": "mejor amigo",
    rival: "rival",
    family: "familia"
  };
  return labels[tone];
}

export function canHaveOffspring(
  visitor: SocialCreature,
  mikoLevel: number,
  mikoBond: number,
  offspringCount: number
) {
  return !visitor.parents
    && visitor.relation.affinity >= 82
    && visitor.relation.meetings >= 5
    && visitor.relation.rivalry < 35
    && mikoLevel >= 5
    && mikoBond >= 55
    && offspringCount < 3;
}

function inheritNumber(a: number, b: number) {
  const mutation = (Math.random() - .5) * 16;
  return clamp(Math.round((a + b) / 2 + mutation));
}

export function createOffspring(
  mikoName: string,
  mikoPersonality: PersonalityProfile,
  mikoEvolution: EvolutionId | null,
  parent: SocialCreature,
  existing: SocialCreature[]
): SocialCreature {
  const personality = createPersonality();
  const mikoGenes = genesFromPersonality(mikoPersonality);

  const inheritedPersonality = {
    ...personality,
    traits: {
      ...personality.traits,
      curiosity: inheritNumber(mikoPersonality.traits.curiosity, parent.personality.traits.curiosity),
      affection: inheritNumber(mikoPersonality.traits.affection, parent.personality.traits.affection),
      playfulness: inheritNumber(mikoPersonality.traits.playfulness, parent.personality.traits.playfulness),
      appetite: inheritNumber(mikoPersonality.traits.appetite, parent.personality.traits.appetite),
      courage: inheritNumber(mikoPersonality.traits.courage, parent.personality.traits.courage),
      sleepiness: inheritNumber(mikoPersonality.traits.sleepiness, parent.personality.traits.sleepiness)
    }
  };

  const possibleEvolution = Math.random() < .48
    ? (Math.random() < .5 ? mikoEvolution : parent.evolution)
    : null;

  return {
    id: id("child"),
    name: chooseName(existing.map((item) => item.name)),
    generation: Math.max(2, parent.generation + 1),
    bornAt: Date.now(),
    personality: inheritedPersonality,
    evolution: possibleEvolution,
    genes: {
      hue: inheritNumber(mikoGenes.hue, parent.genes.hue),
      glow: inheritNumber(mikoGenes.glow, parent.genes.glow),
      size: inheritNumber(mikoGenes.size, parent.genes.size),
      energy: inheritNumber(mikoGenes.energy, parent.genes.energy),
      affection: inheritNumber(mikoGenes.affection, parent.genes.affection),
      curiosity: inheritNumber(mikoGenes.curiosity, parent.genes.curiosity)
    },
    relation: {
      affinity: 92,
      rivalry: 0,
      meetings: 1,
      gifts: 0,
      lastMetAt: Date.now()
    },
    parents: [mikoName, parent.name]
  };
}

export function ecosystemPromptSummary(state: EcosystemState) {
  if (!state.known.length) return "Miko todavía no conoce otras criaturas.";

  const top = [...state.known]
    .sort((a, b) => b.relation.affinity - a.relation.affinity)
    .slice(0, 4)
    .map((item) => item.name + " (" + relationLabel(item) + ")")
    .join(", ");

  return "Criaturas conocidas: " + top + ". Viajes entre monitores: " + state.monitorTrips + ".";
}
