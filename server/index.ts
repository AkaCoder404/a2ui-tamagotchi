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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.listen(PORT, () => {
  console.log(`🐾 A2UI Tamagotchi Server running on http://localhost:${PORT}`);
  console.log(`   Init:     GET  http://localhost:${PORT}/api/init?sessionId=abc`);
  console.log(`   Action:   POST http://localhost:${PORT}/api/action?sessionId=abc`);
  console.log(`   State:    GET  http://localhost:${PORT}/api/state?sessionId=abc`);
});
