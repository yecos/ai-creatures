export type Mood = "idle" | "happy" | "sleepy" | "hungry" | "curious";
export type PersonalityId = "curious" | "affectionate" | "mischievous" | "glutton" | "shy" | "sleepy";
export type IdleReaction = "peek" | "bounce" | "shy" | "wiggle" | "sleep";

export type PersonalityProfile = {
  id: PersonalityId;
  name: string;
  icon: string;
  description: string;
  quirk: string;
  favoriteSnack: string;
  traits: {
    curiosity: number;
    affection: number;
    playfulness: number;
    appetite: number;
    courage: number;
    sleepiness: number;
  };
  modifiers: {
    hungerRate: number;
    energyDrain: number;
    happinessDecay: number;
    moveSpeed: number;
    chatterChance: number;
    idleActionRate: number;
    petBondGain: number;
    playBoost: number;
    feedBoost: number;
  };
};

type PersonalityTemplate = Omit<PersonalityProfile, "quirk" | "favoriteSnack"> & {
  quirks: string[];
};

const snacks = ["fresa", "mochi", "arándano", "galleta lunar", "uva cósmica", "gomita estelar"];

const templates: PersonalityTemplate[] = [
  {
    id: "curious",
    name: "Curioso",
    icon: "✦",
    description: "Todo le parece un misterio que vale la pena investigar.",
    quirks: ["colecciona reflejos", "vigila el cursor", "se distrae con cualquier brillo"],
    traits: { curiosity: 94, affection: 61, playfulness: 72, appetite: 48, courage: 76, sleepiness: 34 },
    modifiers: { hungerRate: 1, energyDrain: 1.02, happinessDecay: .9, moveSpeed: 1.12, chatterChance: .92, idleActionRate: .62, petBondGain: 1, playBoost: 1.08, feedBoost: .95 }
  },
  {
    id: "affectionate",
    name: "Cariñoso",
    icon: "♥",
    description: "Busca compañía y se encariña muy rápido contigo.",
    quirks: ["se derrite con las caricias", "te espera cuando vuelves", "hace ruiditos cuando está feliz"],
    traits: { curiosity: 58, affection: 96, playfulness: 67, appetite: 52, courage: 66, sleepiness: 41 },
    modifiers: { hungerRate: .98, energyDrain: .96, happinessDecay: 1.12, moveSpeed: .96, chatterChance: .86, idleActionRate: .54, petBondGain: 1.6, playBoost: 1, feedBoost: 1.04 }
  },
  {
    id: "mischievous",
    name: "Travieso",
    icon: "⚡",
    description: "Tiene demasiada energía y siempre parece estar tramando algo.",
    quirks: ["salta sin motivo", "odia quedarse quieto", "finge que no hizo nada"],
    traits: { curiosity: 81, affection: 55, playfulness: 98, appetite: 61, courage: 88, sleepiness: 21 },
    modifiers: { hungerRate: 1.14, energyDrain: 1.15, happinessDecay: .88, moveSpeed: 1.28, chatterChance: .82, idleActionRate: .74, petBondGain: .92, playBoost: 1.42, feedBoost: 1 }
  },
  {
    id: "glutton",
    name: "Goloso",
    icon: "●",
    description: "Su filosofía de vida consiste en encontrar el próximo snack.",
    quirks: ["detecta comida imaginaria", "sueña con fresas", "negocia cariño por bocados"],
    traits: { curiosity: 54, affection: 66, playfulness: 51, appetite: 99, courage: 64, sleepiness: 47 },
    modifiers: { hungerRate: 1.48, energyDrain: 1, happinessDecay: 1.02, moveSpeed: .94, chatterChance: .9, idleActionRate: .48, petBondGain: 1, playBoost: .9, feedBoost: 1.65 }
  },
  {
    id: "shy",
    name: "Tímido",
    icon: "☁",
    description: "Observa primero, confía después y recuerda quién fue amable.",
    quirks: ["se esconde cuando se sorprende", "mira de reojo", "se acerca cuando cree que no lo ves"],
    traits: { curiosity: 68, affection: 82, playfulness: 46, appetite: 49, courage: 22, sleepiness: 53 },
    modifiers: { hungerRate: .96, energyDrain: .92, happinessDecay: .94, moveSpeed: .78, chatterChance: .48, idleActionRate: .42, petBondGain: 1.85, playBoost: .86, feedBoost: 1.08 }
  },
  {
    id: "sleepy",
    name: "Dormilón",
    icon: "☾",
    description: "Puede convertir prácticamente cualquier lugar en una cama.",
    quirks: ["bosteza en momentos dramáticos", "adora las siestas", "camina medio dormido"],
    traits: { curiosity: 43, affection: 71, playfulness: 39, appetite: 57, courage: 58, sleepiness: 99 },
    modifiers: { hungerRate: .91, energyDrain: 1.2, happinessDecay: .78, moveSpeed: .7, chatterChance: .58, idleActionRate: .44, petBondGain: 1.12, playBoost: .78, feedBoost: 1.05 }
  }
];

function jitter(value: number) {
  return Math.max(5, Math.min(100, Math.round(value + (Math.random() - .5) * 12)));
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function createPersonality(): PersonalityProfile {
  const base = pick(templates);
  return {
    id: base.id,
    name: base.name,
    icon: base.icon,
    description: base.description,
    quirk: pick(base.quirks),
    favoriteSnack: pick(snacks),
    traits: {
      curiosity: jitter(base.traits.curiosity),
      affection: jitter(base.traits.affection),
      playfulness: jitter(base.traits.playfulness),
      appetite: jitter(base.traits.appetite),
      courage: jitter(base.traits.courage),
      sleepiness: jitter(base.traits.sleepiness)
    },
    modifiers: { ...base.modifiers }
  };
}

export function personalityLine(profile: PersonalityProfile | null, mood: Mood): string {
  const generic: Record<Mood, string[]> = {
    curious: ["¿qué hay ahí?", "hmm…", "te estoy mirando", "✦ ✦ ✦"],
    happy: ["hoy es buen día ✦", "hehe", "¡vamos!", "♡"],
    hungry: ["¿snack?", "mi pancita…", "ñam?"],
    sleepy: ["cinco minutitos…", "zzZ", "…"],
    idle: ["…", "boop", "aquí sigo"]
  };

  if (!profile) return pick(generic[mood]);

  const signature: Record<PersonalityId, Record<Mood, string[]>> = {
    curious: {
      curious: ["¿qué hace eso?", "vi algo moverse", "quiero investigar ✦"],
      happy: ["¡encontré algo!", "mira mira ✦", "hehe"],
      hungry: ["investiguemos la comida", "¿esa fresa era para mí?"],
      sleepy: ["seguiré investigando… mañana", "mis ojos pesan"],
      idle: ["algo pasa por allá", "hmm…", "¿tocamos eso?"]
    },
    affectionate: {
      curious: ["¿te quedas conmigo?", "hola otra vez ♡"],
      happy: ["♡ ♡ ♡", "me gustas mucho", "mrrp ✦"],
      hungry: ["snack juntos?", "tengo hambre… pero primero cariño"],
      sleepy: ["quédate cerquita", "zzZ ♡"],
      idle: ["aquí contigo", "mrrp", "¿caricia?"]
    },
    mischievous: {
      curious: ["no fui yo", "¿y si saltamos?", "hehe…"],
      happy: ["¡otra vez!", "⚡⚡", "más rápido"],
      hungry: ["robaré un snack", "necesito combustible"],
      sleepy: ["no tengo sueño…", "solo cerré los ojos"],
      idle: ["tengo una idea", "hehe", "mira esto"]
    },
    glutton: {
      curious: ["¿eso se come?", "huelo algo…"],
      happy: ["¡snack!", "perfecto ✦", "ñam ñam"],
      hungry: ["emergencia de pancita", "fresa. ahora.", "¿mi " + profile.favoriteSnack + "?"],
      sleepy: ["soñando con " + profile.favoriteSnack, "zzZ… ñam"],
      idle: ["pensando en comida", "quizá un snack pequeño", "ñam?"]
    },
    shy: {
      curious: ["…¿hola?", "te vi", "solo estaba mirando"],
      happy: ["♡", "gracias…", "mrrp"],
      hungry: ["quizá… un snack", "tengo un poquito de hambre"],
      sleepy: ["me esconderé a dormir", "zzZ"],
      idle: ["…", "estoy aquí", "no mires tanto"]
    },
    sleepy: {
      curious: ["¿eh?", "¿qué pasó?", "cinco minutos más"],
      happy: ["feliz… y con sueño", "mrrp…"],
      hungry: ["snack y siesta", "comer cansa"],
      sleepy: ["zzZ", "modo almohada", "buenas noches…"],
      idle: ["bostezo", "¿ya es hora de dormir?", "…zz"]
    }
  };

  return pick(signature[profile.id][mood]);
}

export function chooseIdleReaction(profile: PersonalityProfile | null): IdleReaction {
  const roll = Math.random();
  if (!profile) return roll < .5 ? "peek" : "bounce";

  switch (profile.id) {
    case "curious":
      return roll < .52 ? "peek" : roll < .76 ? "wiggle" : roll < .94 ? "bounce" : "shy";
    case "affectionate":
      return roll < .38 ? "wiggle" : roll < .68 ? "peek" : roll < .92 ? "bounce" : "sleep";
    case "mischievous":
      return roll < .48 ? "bounce" : roll < .82 ? "wiggle" : "peek";
    case "glutton":
      return roll < .4 ? "peek" : roll < .7 ? "wiggle" : roll < .88 ? "bounce" : "sleep";
    case "shy":
      return roll < .54 ? "shy" : roll < .8 ? "peek" : "sleep";
    case "sleepy":
      return roll < .56 ? "sleep" : roll < .76 ? "shy" : roll < .92 ? "peek" : "bounce";
  }
}
