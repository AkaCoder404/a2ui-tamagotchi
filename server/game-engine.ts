/**
 * Game Engine — Deterministic pet stat logic, mood calc, unlocks, position
 */

export interface PetState {
  hunger: number;
  happiness: number;
  energy: number;
  affection: number;
  location: "room" | "park" | "bedroom" | "void";
  mood:
    | "happy"
    | "sad"
    | "sleepy"
    | "excited"
    | "hungry"
    | "neutral"
    | "grumpy";
  position: { x: number; y: number };
  unlockedComponents: string[];
  inventory: string[];
  interactionHistory: Array<{
    action: string;
    timestamp: number;
    statsAfter: Partial<PetState>;
  }>;
  totalInteractions: number;
  bornAt: number;
}

export type ActionName = "feed" | "play" | "sleep" | "talk" | "hug";

const GROUND_Y = 280; // Pet stands on this horizontal line

export function createNewPet(): PetState {
  return {
    hunger: 50,
    happiness: 50,
    energy: 50,
    affection: 80,
    location: "room",
    mood: "neutral",
    position: { x: 400, y: GROUND_Y },
    unlockedComponents: [],
    inventory: [],
    interactionHistory: [],
    totalInteractions: 0,
    bornAt: Date.now(),
  };
}

export function processAction(pet: PetState, action: ActionName): PetState {
  const next = { ...pet, position: { ...pet.position } };

  switch (action) {
    case "feed":
      if (next.hunger < 90) {
        next.hunger = clamp(next.hunger + 25);
        next.happiness = clamp(next.happiness + 5);
        next.energy = clamp(next.energy + 5);
        next.affection = clamp(next.affection + 3);
      }
      next.location = "room";
      break;
    case "play":
      if (next.energy >= 20) {
        next.hunger = clamp(next.hunger - 15);
        next.happiness = clamp(next.happiness + 20);
        next.energy = clamp(next.energy - 20);
        next.affection = clamp(next.affection + 5);
      }
      next.location = "park";
      break;
    case "sleep":
      if (next.energy <= 80) {
        next.hunger = clamp(next.hunger - 10);
        next.energy = clamp(next.energy + 40);
        next.affection = clamp(next.affection + 2);
      }
      next.location = "bedroom";
      break;
    case "talk":
      next.hunger = clamp(next.hunger - 5);
      next.happiness = clamp(next.happiness + 10);
      next.energy = clamp(next.energy - 5);
      next.affection = clamp(next.affection + 8);
      next.location = "room";
      break;
    case "hug":
      if (next.affection >= 80) {
        next.hunger = clamp(next.hunger - 5);
        next.happiness = clamp(next.happiness + 15);
        next.energy = clamp(next.energy - 5);
        next.affection = clamp(next.affection + 15);
      }
      next.location = "room";
      break;
  }

  next.mood = deriveMood(next);
  next.position = generatePosition(next.mood, next.location);
  next.totalInteractions += 1;

  const newUnlocks = checkUnlocks(next);
  for (const u of newUnlocks) {
    if (!next.unlockedComponents.includes(u)) {
      next.unlockedComponents.push(u);
    }
  }

  for (const item of newUnlocks) {
    if (
      ["toy-ball", "crown"].includes(item) &&
      !next.inventory.includes(item)
    ) {
      next.inventory.push(item);
    }
  }

  next.interactionHistory.push({
    action,
    timestamp: Date.now(),
    statsAfter: {
      hunger: next.hunger,
      happiness: next.happiness,
      energy: next.energy,
      affection: next.affection,
    },
  });
  if (next.interactionHistory.length > 20) {
    next.interactionHistory.shift();
  }

  return next;
}

export function applyDecay(pet: PetState): PetState {
  const next = { ...pet, position: { ...pet.position } };
  next.hunger = clamp(next.hunger - 3);
  next.happiness = clamp(next.happiness - 2);
  next.energy = clamp(next.energy - 1);
  next.mood = deriveMood(next);
  return next;
}

function deriveMood(pet: PetState): PetState["mood"] {
  if (pet.energy < 20) return "sleepy";
  if (pet.hunger < 25) return "hungry";
  if (pet.happiness > 80 && pet.energy > 50) return "excited";
  if (pet.happiness > 60 && pet.energy > 30) return "happy";
  if (pet.happiness < 30) return "sad";
  if (pet.hunger < 40 && pet.happiness < 40) return "grumpy";
  return "neutral";
}

function checkUnlocks(pet: PetState): string[] {
  const unlocks: string[] = [];
  if (pet.affection >= 80 && !pet.unlockedComponents.includes("hug"))
    unlocks.push("hug");
  if (pet.happiness >= 60 && !pet.unlockedComponents.includes("toy-ball"))
    unlocks.push("toy-ball");
  if (pet.affection >= 90 && !pet.unlockedComponents.includes("crown"))
    unlocks.push("crown");
  if (
    pet.totalInteractions >= 20 &&
    !pet.unlockedComponents.includes("golden-room")
  )
    unlocks.push("golden-room");
  if (
    pet.happiness >= 90 &&
    pet.energy >= 60 &&
    !pet.unlockedComponents.includes("dance")
  )
    unlocks.push("dance");
  return unlocks;
}

function generatePosition(
  mood: PetState["mood"],
  location: PetState["location"],
): { x: number; y: number } {
  const bounds: Record<string, { minX: number; maxX: number }> = {
    room: { minX: 100, maxX: 700 },
    park: { minX: 50, maxX: 750 },
    bedroom: { minX: 150, maxX: 650 },
    void: { minX: 200, maxX: 600 },
  };

  const b = bounds[location] || bounds.room;

  const rangeMultipliers: Record<string, number> = {
    excited: 1.2,
    happy: 1.0,
    neutral: 0.8,
    grumpy: 0.6,
    hungry: 0.7,
    sad: 0.5,
    sleepy: 0.4,
  };

  const mult = rangeMultipliers[mood] || 0.8;
  const centerX = (b.minX + b.maxX) / 2;
  const rangeX = ((b.maxX - b.minX) / 2) * mult;

  // Pet moves horizontally only (Y stays on ground line)
  // Future: jump will temporarily reduce Y, then spring back to GROUND_Y
  return {
    x: Math.round(centerX + (Math.random() - 0.5) * 2 * rangeX),
    y: GROUND_Y,
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function generateThought(pet: PetState, action: ActionName): string {
  const thoughts: Record<string, Record<string, string[]>> = {
    feed: {
      happy: [
        "Yum! That was delicious!",
        "More please! I love this!",
        "So tasty! Thank you!",
      ],
      excited: ["WHEEE FOOD!", "BEST DAY EVER!"],
      neutral: ["Thanks for the food.", "That was okay."],
      sad: ["...I guess I will eat...", "Food will not fix everything..."],
      sleepy: ["*munch* *munch*... so sleepy..."],
      hungry: ["FINALLY! I was starving!", "Oh thank goodness!"],
      grumpy: ["Took you long enough.", "Hmph. About time."],
    },
    play: {
      happy: ["That was fun! Again!", "I love playing with you!"],
      excited: ["WHEEE! LET US GO!", "I CAN DO THIS ALL DAY!"],
      neutral: ["That was alright.", "Nice game."],
      sad: ["...thanks for trying...", "I used to love this..."],
      sleepy: ["*yawn*... maybe later..."],
      hungry: ["Too tired to play... need food first..."],
      grumpy: ["Fine. I will play. But I will not enjoy it."],
    },
    sleep: {
      happy: ["Zzz... sweet dreams...", "So cozy... thank you..."],
      excited: ["But I do not wanna sleep yet! ...zzz..."],
      neutral: ["*yawn* Bedtime."],
      sad: ["*sniff*... at least dreams are nice..."],
      sleepy: ["FINALLY... zzz...", "Best feeling ever..."],
      hungry: ["*stomach growls* ...zzz..."],
      grumpy: ["Leave me alone. I am sleeping."],
    },
    talk: {
      happy: ["I love our chats!", "Tell me more!"],
      excited: ["YES! LET US TALK ALL DAY!", "YOU ARE THE BEST!"],
      neutral: ["Hmm? What is it?", "I am listening."],
      sad: ["...do you really mean that?", "*sniff*..."],
      sleepy: ["*yawn*... that is nice..."],
      hungry: ["...can we talk after food?..."],
      grumpy: ["What do you want now?"],
    },
    hug: {
      happy: ["*melts* ...so warm...", "I feel so loved!"],
      excited: ["BEST! HUG! EVER!", "I LOVE YOU!"],
      neutral: ["...thanks...", "That was nice."],
      sad: ["*tight squeeze* ...do not let go..."],
      sleepy: ["*snuggles* ...zzz..."],
      hungry: ["*hug* ...but also food please..."],
      grumpy: ["...fine. One hug.", "Hmph. *secretly enjoys it*"],
    },
  };

  const pool = thoughts[action]?.[pet.mood] || ["..."];
  return pool[Math.floor(Math.random() * pool.length)];
}
