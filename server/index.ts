/**
 * Express server with phased SSE streaming for the Tamagotchi
 */

import express from 'express';
import cors from 'cors';
import { processSessionAction, getSessionState } from './state-store';
import { generateSceneA2UI, generateFallbackScene } from './agent';
import { generateThought } from './game-engine';
import type { ActionName } from './game-engine';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

/**
 * POST /api/action — Handle user interaction with phased streaming
 */
app.post('/api/action', async (req, res) => {
  const sessionId = (req.query.sessionId as string) || 'default';
  const action = req.body.action as ActionName;

  if (!action || !['feed', 'play', 'sleep', 'talk', 'hug'].includes(action)) {
    res.status(400).json({ error: 'Invalid action. Must be: feed, play, sleep, talk, hug' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Phase 1: Process game logic
    const pet = processSessionAction(sessionId, action);
    const thought = generateThought(pet, action);

    // Phase 2: Send "thinking" state immediately
    const thinkingScene = generateFallbackScene(
      { ...pet, mood: 'neutral', position: pet.position },
      action,
      '...'
    );
    // Only send the thought-bubble update
    res.write(`data: ${JSON.stringify({
      surfaceUpdate: {
        surfaceId: 'main',
        components: [
          { id: 'thought', component: { 'thought-bubble': { text: '...', visible: true } } },
        ],
      },
    })}\n\n`);

    // Wait for "thinking" drama
    await sleep(600);

    // Phase 3: Call Gemini for creative scene
    let messages: unknown[] = [];
    try {
      messages = await generateSceneA2UI(pet, action, thought);
    } catch {
      // Fallback if Gemini fails
      messages = generateFallbackScene(pet, action, thought);
    }

    // Stream each message with small delays for progressive feel
    for (const msg of messages) {
      res.write(`data: ${JSON.stringify(msg)}\n\n`);
      await sleep(80);
    }
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
  }

  res.write('data: [DONE]\n\n');
  res.end();
});

/**
 * GET /api/state — Get current pet state (for initial load)
 */
app.get('/api/state', (req, res) => {
  const sessionId = (req.query.sessionId as string) || 'default';
  const pet = getSessionState(sessionId);
  res.json(pet);
});

/**
 * GET /api/init — Initialize the pet and stream initial scene
 */
app.get('/api/init', async (req, res) => {
  const sessionId = (req.query.sessionId as string) || 'default';
  const pet = getSessionState(sessionId);
  const thought = 'Hello! I am your new pet. Take care of me!';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    let messages: unknown[] = [];
    try {
      messages = await generateSceneA2UI(pet, 'talk', thought);
    } catch {
      messages = generateFallbackScene(pet, 'talk', thought);
    }

    for (const msg of messages) {
      res.write(`data: ${JSON.stringify(msg)}\n\n`);
      await sleep(100);
    }
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
  }

  res.write('data: [DONE]\n\n');
  res.end();
});

/**
 * POST /api/spawn — Spawn an item from user text command
 * Commands: "Spawn a toy", "Spawn a pizza", "Spawn a form", etc.
 */
app.post('/api/spawn', async (req, res) => {
  const sessionId = (req.query.sessionId as string) || 'default';
  const command = req.body.command as string;

  if (!command || typeof command !== 'string') {
    res.status(400).json({ error: 'Missing command. Send { command: "Spawn a toy" }' });
    return;
  }

  // Parse: "Spawn a toy" → "toy"
  const itemName = command.replace(/^spawn\s+a?\s*/i, '').trim();
  const itemKey = itemName.toLowerCase();

  // Random x position (keep within scene bounds with padding)
  const spawnX = Math.floor(Math.random() * 700) + 50;

  // Item catalog
  const itemCatalog: Record<string, { emoji: string; color: string; label: string }> = {
    toy: { emoji: '🧸', color: '#f472b6', label: 'Toy' },
    pizza: { emoji: '🍕', color: '#f97316', label: 'Pizza' },
    form: { emoji: '📝', color: '#3b82f6', label: 'Form' },
    ball: { emoji: '⚽', color: '#22c55e', label: 'Ball' },
    car: { emoji: '🚗', color: '#ef4444', label: 'Car' },
    flower: { emoji: '🌸', color: '#ec4899', label: 'Flower' },
    cake: { emoji: '🎂', color: '#fbbf24', label: 'Cake' },
    rocket: { emoji: '🚀', color: '#6366f1', label: 'Rocket' },
    robot: { emoji: '🤖', color: '#8b5cf6', label: 'Robot' },
    diamond: { emoji: '💎', color: '#06b6d4', label: 'Diamond' },
  };

  const item = itemCatalog[itemKey] || { emoji: '📦', color: '#9ca3af', label: itemName || 'Item' };
  const itemId = `spawn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Phase 1: Appear at top (above viewport)
    res.write(`data: ${JSON.stringify({
      surfaceUpdate: {
        surfaceId: 'main',
        components: [
          { id: itemId, component: { 'spawned-item': {
            x: spawnX,
            y: -60,
            label: item.label,
            emoji: item.emoji,
            color: item.color,
            dropping: true,
          } } },
        ],
      },
    })}

`);

    // Small delay so browser creates DOM element before moving it
    await sleep(80);

    // Phase 2: Drop to ground
    res.write(`data: ${JSON.stringify({
      surfaceUpdate: {
        surfaceId: 'main',
        components: [
          { id: itemId, component: { 'spawned-item': {
            x: spawnX,
            y: 280,
            label: item.label,
            emoji: item.emoji,
            color: item.color,
            dropping: false,
          } } },
        ],
      },
    })}

`);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: String(err) })}

`);
  }

  res.write('data: [DONE]\n\n');
  res.end();
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.listen(PORT, () => {
  console.log(`🐾 A2UI Tamagotchi Server running on http://localhost:${PORT}`);
  console.log(`   Init:     GET  http://localhost:${PORT}/api/init?sessionId=abc`);
  console.log(`   Action:   POST http://localhost:${PORT}/api/action?sessionId=abc`);
  console.log(`   State:    GET  http://localhost:${PORT}/api/state?sessionId=abc`);
  console.log(`   Spawn:    POST http://localhost:${PORT}/api/spawn?sessionId=abc`);
});
