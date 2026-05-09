/**
 * State Store — In-memory session state management
 */

import { type PetState, createNewPet, processAction, applyDecay } from './game-engine';
import type { ActionName } from './game-engine';

interface Session {
  pet: PetState;
  lastInteractionAt: number;
  decayInterval: ReturnType<typeof setInterval> | null;
}

const sessions = new Map<string, Session>();

export function getOrCreateSession(sessionId: string): Session {
  if (!sessions.has(sessionId)) {
    const session: Session = {
      pet: createNewPet(),
      lastInteractionAt: Date.now(),
      decayInterval: null,
    };

    // Start decay timer
    session.decayInterval = setInterval(() => {
      session.pet = applyDecay(session.pet);
    }, 30000);

    sessions.set(sessionId, session);
  }
  return sessions.get(sessionId)!;
}

export function processSessionAction(sessionId: string, action: ActionName): PetState {
  const session = getOrCreateSession(sessionId);
  session.pet = processAction(session.pet, action);
  session.lastInteractionAt = Date.now();
  return session.pet;
}

export function getSessionState(sessionId: string): PetState {
  return getOrCreateSession(sessionId).pet;
}

export function cleanupSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session?.decayInterval) {
    clearInterval(session.decayInterval);
  }
  sessions.delete(sessionId);
}
