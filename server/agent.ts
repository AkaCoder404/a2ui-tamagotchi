/**
 * Gemini Agent — UI generation for the Tamagotchi pet
 */

import type { PetState, ActionName } from './game-engine';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are a virtual pet's creative director. Your job is to generate A2UI JSON that renders an interactive Tamagotchi scene.

A2UI is a declarative UI protocol using flat adjacency lists. Components have unique IDs and reference children by ID. Never nest components.

CUSTOM COMPONENT CATALOG:
- scene { width?: number, height?: number, children: { explicitList: string[] } } — viewport container with position:relative. Always use this as the root wrapper.
- background { variant: string, moodTint?: string } — full-bleed backdrop. Variants: "room", "park", "bedroom", "void", "golden-room".
- pet-avatar { x: number, y: number, size: "small" | "normal" | "big", expression: "neutral" | "happy" | "sad" | "sleepy" | "excited" | "dance", bounce?: boolean } — the pet. Position using x,y (0-800, 0-400). Size reflects mood.
- stat-bars { hunger: number, happiness: number, energy: number, affection: number } — horizontal progress bars (0-100).
- thought-bubble { text: string, visible?: boolean } — floating text above the pet.
- action-palette { actions: string[] } — grid of action buttons. Include ALL unlocked actions.
- inventory-slot { items: string[] } — items the pet has collected. Show at bottom-right of scene.
- Text { text: string | {path} | {literalString}, usageHint?: "h1"|"h2"|"h3"|"body"|"caption" } — standard text
- Button { label?: string, variant?: "primary"|"secondary", action?: { name: string } } — standard button

RULES:
1. Output ONLY a JSON array of A2UI messages. No markdown, no explanations.
2. Always wrap scene content in a "scene" component first.
3. Use stable IDs for animated elements: "background", "pet", "thought", "stats", "actions", "inventory".
4. Position pet-avatar using x within 0-800. Y is always fixed at 280 (pet walks on a horizontal ground line).
5. Size reflects mood: "small" for sad/sleepy/grumpy, "normal" for neutral/hungry, "big" for happy/excited/dance.
6. Include a thought-bubble with the pet's thought text.
7. The action-palette must include all available actions (feed, play, sleep, talk, and hug if unlocked).
8. Background variant matches the pet's location.
9. Set bounce: true when mood is excited or dance.
10. Use dataModelUpdate to set stat values. Use surfaceUpdate for all components.
11. CRITICAL: Each component MUST use the format: {"id": "...", "component": {"ComponentName": {props}}}. NEVER use {"id": "...", "type": "...", "props": {...}}.
12. Place stat-bars and action-palette OUTSIDE the scene (not inside it) so they're clearly visible.

OUTPUT FORMAT:
[
  { "surfaceUpdate": { "surfaceId": "main", "components": [...] } },
  { "dataModelUpdate": { "surfaceId": "main", "contents": [...] } },
  { "beginRendering": { "surfaceId": "main", "root": "root" } }
]`;

export async function generateSceneA2UI(
  pet: PetState,
  action: ActionName,
  thought: string
): Promise<unknown[]> {
  if (!GEMINI_API_KEY) {
    return [{
      surfaceUpdate: {
        surfaceId: 'main',
        components: [
          { id: 'root', component: { Card: { child: 'error_text' } } },
          { id: 'error_text', component: { Text: { text: { literalString: 'GEMINI_API_KEY not set' } } } },
        ],
      },
    }, { beginRendering: { surfaceId: 'main', root: 'root' } }];
  }

  const availableActions = ['feed', 'play', 'sleep', 'talk'];
  if (pet.unlockedComponents.includes('hug')) {
    availableActions.push('hug');
  }

  const userPrompt = `Generate a Tamagotchi scene.

PET STATE:
- hunger: ${pet.hunger}, happiness: ${pet.happiness}, energy: ${pet.energy}, affection: ${pet.affection}
- mood: ${pet.mood}, location: ${pet.location}
- position: x=${pet.position.x}, y=${pet.position.y}
- unlocked: [${pet.unlockedComponents.join(', ')}]
- inventory: [${pet.inventory.join(', ')}]
- available actions: [${availableActions.join(', ')}]

LAST ACTION: ${action}
PET THOUGHT: "${thought}"

Generate the A2UI JSON array now.`;

  try {
    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
          { role: 'model', parts: [{ text: 'Understood. I will generate A2UI JSON scenes.' }] },
          { role: 'user', parts: [{ text: userPrompt }] },
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
      return [parsed];
    } catch {
      // Try extracting from markdown code block
      const match = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          if (Array.isArray(parsed)) return parsed;
          return [parsed];
        } catch {
          // fall through
        }
      }
      return [{ error: 'Failed to parse Gemini response as JSON', raw: text }];
    }
  } catch (err) {
    return [{ error: String(err) }];
  }
}

// Fallback templates per mood for when Gemini fails or is slow
export function generateFallbackScene(pet: PetState, action: ActionName, thought: string): unknown[] {
  const availableActions = ['feed', 'play', 'sleep', 'talk'];
  if (pet.unlockedComponents.includes('hug')) availableActions.push('hug');

  const bgGradients: Record<string, string> = {
    room: '#fef3c7',
    park: '#dcfce7',
    bedroom: '#dbeafe',
    void: '#1e1b4b',
    'golden-room': '#fef9c3',
  };

  const expressionColors: Record<string, string> = {
    neutral: '#9ca3af',
    happy: '#fbbf24',
    sad: '#93c5fd',
    sleepy: '#c4b5fd',
    excited: '#f472b6',
    hungry: '#fca5a5',
    grumpy: '#e5e7eb',
    dance: '#fbbf24',
  };

  const sizeMap: Record<string, number> = { small: 48, normal: 64, big: 80 };
  const petSize = sizeMap[pet.mood === 'sad' || pet.mood === 'sleepy' || pet.mood === 'grumpy' ? 'small' : pet.mood === 'happy' || pet.mood === 'excited' || pet.mood === 'dance' ? 'big' : 'normal'];

  return [
    {
      surfaceUpdate: {
        surfaceId: 'main',
        components: [
          { id: 'root', component: { Column: { children: { explicitList: ['scene_wrapper', 'stats', 'actions'] }, gap: 16, align: 'stretch' } } },
          { id: 'scene_wrapper', component: { scene: { width: 800, height: 400, children: { explicitList: ['bg', 'pet', 'thought', 'inventory'] } } } },
          { id: 'bg', component: { background: { variant: pet.location, moodTint: bgGradients[pet.location] || '#fef3c7' } } },
          { id: 'pet', component: { 'pet-avatar': { x: pet.position.x, y: pet.position.y, size: petSize === 48 ? 'small' : petSize === 80 ? 'big' : 'normal', expression: pet.mood, bounce: pet.mood === 'excited' || pet.mood === 'dance' } } },
          { id: 'thought', component: { 'thought-bubble': { text: thought, visible: true } } },
          { id: 'inventory', component: { 'inventory-slot': { items: pet.inventory } } },
          { id: 'stats', component: { 'stat-bars': { hunger: pet.hunger, happiness: pet.happiness, energy: pet.energy, affection: pet.affection } } },
          { id: 'actions', component: { 'action-palette': { actions: availableActions } } },
        ],
      },
    },
    {
      dataModelUpdate: {
        surfaceId: 'main',
        contents: [
          { key: 'pet', valueMap: [
            { key: 'hunger', valueNumber: pet.hunger },
            { key: 'happiness', valueNumber: pet.happiness },
            { key: 'energy', valueNumber: pet.energy },
            { key: 'affection', valueNumber: pet.affection },
          ] },
        ],
      },
    },
    { beginRendering: { surfaceId: 'main', root: 'root' } },
  ];
}
