/**
 * React hook for connecting to the Tamagotchi SSE backend.
 * Works with official A2UI v0.8 message format.
 */

import { useCallback, useRef, useState } from 'react';
import type { Types } from '@a2ui/react/v0_8';

export type ServerMessage = Types.ServerToClientMessage;

export interface StreamState {
  isLoading: boolean;
  error: string | null;
}

const API_BASE = 'http://localhost:3001';

export function useA2UIStream(
  onMessage: (msg: ServerMessage) => void
) {
  const [state, setState] = useState<StreamState>({ isLoading: false, error: null });
  const sessionId = useRef(`session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (_message: string) => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();
      setState({ isLoading: true, error: null });

      try {
        const url = `${API_BASE}/api/init?sessionId=${encodeURIComponent(sessionId.current)}`;
        const response = await fetch(url, {
          signal: abortRef.current.signal,
        });

        if (!response.body) {
          throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;

            try {
              const msg = JSON.parse(data) as ServerMessage;
              if ('error' in msg && Object.keys(msg).length === 1) {
                setState((s) => ({ ...s, error: String((msg as Record<string, unknown>).error) }));
              } else {
                onMessage(msg);
              }
            } catch {
              // Ignore malformed lines
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setState({ isLoading: false, error: String(err) });
        }
      } finally {
        setState((s) => ({ ...s, isLoading: false }));
      }
    },
    [onMessage]
  );

  const sendAction = useCallback(
    async (actionName: string) => {
      setState({ isLoading: true, error: null });

      try {
        const response = await fetch(
          `${API_BASE}/api/action?sessionId=${encodeURIComponent(sessionId.current)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: actionName }),
          }
        );

        if (!response.body) {
          throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;

            try {
              const msg = JSON.parse(data) as ServerMessage;
              if ('error' in msg && Object.keys(msg).length === 1) {
                setState((s) => ({ ...s, error: String((msg as Record<string, unknown>).error) }));
              } else {
                onMessage(msg);
              }
            } catch {
              // Ignore
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setState({ isLoading: false, error: String(err) });
        }
      } finally {
        setState((s) => ({ ...s, isLoading: false }));
      }
    },
    [onMessage]
  );

  return { sendMessage, sendAction, isLoading: state.isLoading, error: state.error };
}
