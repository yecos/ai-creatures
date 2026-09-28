import type { PersonalityProfile } from "./personality";

export type DayPhase = "morning" | "day" | "evening" | "night";
export type Rarity = "common" | "uncommon" | "rare" | "mystery";

export type Treasure = {
  id: string;
  name: string;
  icon: string;
  rarity: Rarity;
  flavor: string;
  foundAt: number;
};

export type LifeEvent = {
  id: string;
  message: string;
  at: number;
  kind: "discovery" | "return" | "moment";
};

type TreasureTemplate = Omit<Treasure, "foundAt"> & {
  weight: number;
  affinity?: PersonalityProfile["id"][];
};

const treasurePool: TreasureTemplate[] = [
  { id: "button", name: "botón brillante", icon: "●", rarity: "common", flavor: "Miko está convencido de que es valioso.", weight: 18 },
  { id: "blue-pebble", name: "piedrita azul", icon: "◆", rarity: "common", flavor: "Está perfectamente lisa y extrañamente fría.", weight: 16, affinity: ["curious", "shy"] },
  { id: "leaf", name: "hojita perfecta", icon: "🍃", rarity: "common", flavor: "No se sabe de dónde salió en un escritorio.", weight: 15 },
  { id: "cap", name: "tapita misteriosa", icon: "◉", rarity: "common", flavor: "Miko la hace rodar cuando cree que no lo ves.", weight: 13, affinity: ["mischievous"] },
  { id: "paper-star", name: "estrella de papel", icon: "★", rarity: "uncommon", flavor: "Tiene un pliegue que parece hecho por manos diminutas.", weight: 9, affinity: ["affectionate"] },
  { id: "space-screw", name: "tornillo espacial", icon: "⌁", rarity: "uncommon", flavor: "Definitivamente no pertenece a tu computador. Probablemente.", weight: 8, affinity: ["mischievous", "curious"] },
  { id: "old-berry", name: "fresa fosilizada", icon: "🍓", rarity: "uncommon", flavor: "Miko insiste en conservarla y no comérsela.", weight: 7, affinity: ["glutton"] },
  { id: "holo-feather", name: "pluma holográfica", icon: "〽", rarity: "rare", flavor: "Cambia de color cuando Miko respira cerca.", weight: 4, affinity: ["shy", "sleepy"] },
  { id: "moon-seed", name: "semilla lunar", icon: "✧", rarity: "rare", flavor: "Pulsa suavemente una vez cada varios segundos.", weight: 3, affinity: ["sleepy", "affectionate"] },
  { id: "portal-shard", name: "fragmento de portal", icon: "◇", rarity: "mystery", flavor: "Durante un instante refleja un lugar que no está en tu habitación.", weight: 1.2, affinity: ["curious", "mischievous"] }
];

export function getDayPhase(date = new Date()): DayPhase {
  const hour = date.getHours();
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 18) return "day";
  if (hour >= 18 && hour < 22) return "evening";
  return "night";
}

export function dayPhaseMeta(phase: DayPhase) {
  const data: Record<DayPhase, { icon: string; label: string }> = {
    morning: { icon: "☀", label: "mañana" },
    day: { icon: "☼", label: "día" },
    evening: { icon: "◐", label: "tarde" },
    night: { icon: "☾", label: "noche" }
  };
  return data[phase];
}

function weightedPick(items: TreasureTemplate[], profile: PersonalityProfile | null): TreasureTemplate | null {
  if (!items.length) return null;

  const weighted = items.map((item) => {
    const affinityBoost = profile && item.affinity?.includes(profile.id) ? 1.9 : 1;
    return { item, weight: item.weight * affinityBoost };
  });
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;

  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.item;
  }
  return weighted[weighted.length - 1].item;
}

export function discoverTreasure(existingIds: string[], profile: PersonalityProfile | null): Treasure | null {
  const unseen = treasurePool.filter((item) => !existingIds.includes(item.id));
  const template = weightedPick(unseen, profile);
  if (!template) return null;

  return {
    id: template.id,
    name: template.name,
    icon: template.icon,
    rarity: template.rarity,
    flavor: template.flavor,
    foundAt: Date.now()
  };
}

export function createEvent(message: string, kind: LifeEvent["kind"]): LifeEvent {
  return {
    id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8),
    message,
    at: Date.now(),
    kind
  };
}

export function discoveryMessage(item: Treasure, profile: PersonalityProfile | null) {
  if (!profile) return "¡Miko encontró " + item.name + "!";

  switch (profile.id) {
    case "curious":
      return "¡descubrimiento! " + item.icon + " " + item.name;
    case "affectionate":
      return "te traje algo ♡ " + item.icon;
    case "mischievous":
      return "yo no robé esto… " + item.icon;
    case "glutton":
      return item.id === "old-berry" ? "¡TESORO SUPREMO! 🍓" : "¿esto se come? " + item.icon;
    case "shy":
      return "encontré esto… " + item.icon;
    case "sleepy":
      return "lo encontré medio dormido " + item.icon;
  }

  return "¡Miko encontró " + item.name + "!";
}

export function discoveryChance(phase: DayPhase, profile: PersonalityProfile | null) {
  let chance = phase === "night" ? .13 : phase === "evening" ? .22 : .3;
  if (profile?.id === "curious") chance += .14;
  if (profile?.id === "mischievous") chance += .1;
  if (profile?.id === "sleepy" && phase === "night") chance -= .08;
  return Math.max(.05, Math.min(.55, chance));
}

export function rarityLabel(rarity: Rarity) {
  const labels: Record<Rarity, string> = {
    common: "común",
    uncommon: "inusual",
    rare: "raro",
    mystery: "???"
  };
  return labels[rarity];
}
