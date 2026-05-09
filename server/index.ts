/**
 * Express server with phased SSE streaming for the Tamagotchi
 */

import express from 'express';
import cors from 'cors';
import { processSessionAction, getSessionState } from './state-store';
import { generateSceneA2UI, generateFallbackScene, generateSpawnItemA2UI } from './agent';
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
 * Commands: "Spawn a toy", "Spawn a pizza", "Spawn a form", "Clean up", etc.
 */
app.post('/api/spawn', async (req, res) => {
  const sessionId = (req.query.sessionId as string) || 'default';
  const command = req.body.command as string;

  if (!command || typeof command !== 'string') {
    res.status(400).json({ error: 'Missing command. Send { command: "Spawn a toy" }' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Handle cleanup
  if (/^clean\s*up/i.test(command) || /^clear/i.test(command) || /^remove/i.test(command)) {
    res.write(`data: ${JSON.stringify({ spawnCleanup: true })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  // Parse: "Spawn a pizza order form" → "pizza order form"
  const itemName = command.replace(/^spawn\s+/i, '').trim();
  const itemKey = itemName.toLowerCase();
  const spawnX = Math.floor(Math.random() * 680) + 60;
  const itemId = `spawn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // Generate rich item properties dynamically (Gemini) with deterministic fallback
  let itemProps: Record<string, unknown>;
  try {
    const generated = await generateSpawnItemA2UI(command);
    if (generated && typeof generated === 'object' && 'type' in generated) {
      itemProps = generated;
    } else {
      itemProps = generateSpawnItemFallback(itemName, itemKey);
    }
  } catch {
    itemProps = generateSpawnItemFallback(itemName, itemKey);
  }

  try {
    // Phase 1: Appear at top
    res.write(`data: ${JSON.stringify({
      surfaceUpdate: {
        surfaceId: 'main',
        components: [
          { id: itemId, component: { 'spawned-item': { x: spawnX, y: -80, dropping: true, ...itemProps } } },
        ],
      },
    })}\n\n`);

    await sleep(80);

    // Phase 2: Drop to ground
    res.write(`data: ${JSON.stringify({
      surfaceUpdate: {
        surfaceId: 'main',
        components: [
          { id: itemId, component: { 'spawned-item': { x: spawnX, y: 280, dropping: false, ...itemProps } } },
        ],
      },
    })}\n\n`);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
  }

  res.write('data: [DONE]\n\n');
  res.end();
});

/**
 * Deterministic fallback for spawn item generation when Gemini fails.
 */
function generateSpawnItemFallback(itemName: string, itemKey: string): Record<string, unknown> {
  // Form / survey / quiz
  if (itemKey.includes('form') || itemKey.includes('survey') || itemKey.includes('quiz')) {
    return {
      type: 'form',
      title: itemName.charAt(0).toUpperCase() + itemName.slice(1),
      emoji: '📝',
      color: '#3b82f6',
      fields: [
        { label: 'Name', placeholder: 'Your name' },
        { label: 'Message', placeholder: 'Type something...' },
      ],
    };
  }

  // Button / clicker
  if (itemKey.includes('button') || itemKey.includes('clicker')) {
    return {
      type: 'button',
      title: itemName,
      emoji: '👆',
      color: '#22c55e',
      buttonLabel: 'Tap me!',
      action: 'spawn-click',
    };
  }

  // Card / info / display
  if (itemKey.includes('card') || itemKey.includes('info') || itemKey.includes('note')) {
    return {
      type: 'card',
      title: itemName,
      emoji: '📇',
      color: '#8b5cf6',
      content: `This is your ${itemName}. Generated by your pet agent!`,
    };
  }

  // Food items
  if (itemKey.includes('pizza')) {
    return { type: 'emoji', title: 'Pizza', emoji: '🍕', color: '#f97316' };
  }
  if (itemKey.includes('burger')) {
    return { type: 'emoji', title: 'Burger', emoji: '🍔', color: '#f97316' };
  }
  if (itemKey.includes('cake')) {
    return { type: 'emoji', title: 'Cake', emoji: '🎂', color: '#fbbf24' };
  }
  if (itemKey.includes('ice cream')) {
    return { type: 'emoji', title: 'Ice Cream', emoji: '🍦', color: '#f472b6' };
  }

  // Objects
  if (itemKey.includes('toy')) {
    return { type: 'emoji', title: 'Toy', emoji: '🧸', color: '#f472b6' };
  }
  if (itemKey.includes('ball')) {
    return { type: 'emoji', title: 'Ball', emoji: '⚽', color: '#22c55e' };
  }
  if (itemKey.includes('car')) {
    return { type: 'emoji', title: 'Car', emoji: '🚗', color: '#ef4444' };
  }
  if (itemKey.includes('rocket')) {
    return { type: 'emoji', title: 'Rocket', emoji: '🚀', color: '#6366f1' };
  }
  if (itemKey.includes('robot')) {
    return { type: 'emoji', title: 'Robot', emoji: '🤖', color: '#8b5cf6' };
  }
  if (itemKey.includes('flower')) {
    return { type: 'emoji', title: 'Flower', emoji: '🌸', color: '#ec4899' };
  }
  if (itemKey.includes('diamond') || itemKey.includes('gem')) {
    return { type: 'emoji', title: 'Gem', emoji: '💎', color: '#06b6d4' };
  }
  if (itemKey.includes('book')) {
    return { type: 'emoji', title: 'Book', emoji: '📚', color: '#a855f7' };
  }
  if (itemKey.includes('phone')) {
    return { type: 'emoji', title: 'Phone', emoji: '📱', color: '#3b82f6' };
  }
  if (itemKey.includes('gift') || itemKey.includes('present')) {
    return { type: 'emoji', title: 'Gift', emoji: '🎁', color: '#ec4899' };
  }
  if (itemKey.includes('music') || itemKey.includes('song')) {
    return { type: 'emoji', title: 'Music', emoji: '🎵', color: '#f59e0b' };
  }
  if (itemKey.includes('camera') || itemKey.includes('photo')) {
    return { type: 'emoji', title: 'Camera', emoji: '📷', color: '#64748b' };
  }
  if (itemKey.includes('clock') || itemKey.includes('time')) {
    return { type: 'emoji', title: 'Clock', emoji: '⏰', color: '#ef4444' };
  }
  if (itemKey.includes('star')) {
    return { type: 'emoji', title: 'Star', emoji: '⭐', color: '#fbbf24' };
  }
  if (itemKey.includes('heart')) {
    return { type: 'emoji', title: 'Heart', emoji: '❤️', color: '#ef4444' };
  }
  if (itemKey.includes('rainbow')) {
    return { type: 'emoji', title: 'Rainbow', emoji: '🌈', color: '#ec4899' };
  }
  if (itemKey.includes('crown')) {
    return { type: 'emoji', title: 'Crown', emoji: '👑', color: '#fbbf24' };
  }
  if (itemKey.includes('ghost')) {
    return { type: 'emoji', title: 'Ghost', emoji: '👻', color: '#a855f7' };
  }
  if (itemKey.includes('alien')) {
    return { type: 'emoji', title: 'Alien', emoji: '👽', color: '#22c55e' };
  }
  if (itemKey.includes('dinosaur') || itemKey.includes('dino')) {
    return { type: 'emoji', title: 'Dino', emoji: '🦖', color: '#16a34a' };
  }
  if (itemKey.includes('dragon')) {
    return { type: 'emoji', title: 'Dragon', emoji: '🐉', color: '#dc2626' };
  }
  if (itemKey.includes('unicorn')) {
    return { type: 'emoji', title: 'Unicorn', emoji: '🦄', color: '#ec4899' };
  }

  // Default: generic emoji item
  return {
    type: 'emoji',
    title: itemName.charAt(0).toUpperCase() + itemName.slice(1),
    emoji: '📦',
    color: '#9ca3af',
  };
}

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
