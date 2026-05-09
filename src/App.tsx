import { useCallback, useEffect, useMemo, useState } from 'react';
import { SurfaceStore } from './a2ui/store';
import { createDefaultRegistry, SurfaceRenderer } from './a2ui/renderer';
import { useA2UIStream } from './hooks/useA2UIStream';
import type { ServerMessage, UserAction, RenderContext } from './a2ui/types';

function App() {
  const [store] = useState(() => new SurfaceStore());
  const [surfaces, setSurfaces] = useState(store.getAllSurfaces());
  const [logs, setLogs] = useState<string[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [unlockedNotice, setUnlockedNotice] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const registry = useMemo(() => createDefaultRegistry(), []);

  const handleMessage = useCallback(
    (msg: ServerMessage) => {
      store.processMessage(msg);
      setSurfaces(store.getAllSurfaces());
      setLogs((prev) => [...prev, JSON.stringify(msg)].slice(-30));

      if ('surfaceUpdate' in msg) {
        const components = msg.surfaceUpdate.components;
        const actionPalette = components.find(c => 'action-palette' in c.component);
        if (actionPalette) {
          const props = (actionPalette.component as Record<string, unknown>)['action-palette'] as Record<string, unknown>;
          const actions = props.actions as string[] || [];
          if (actions.includes('hug')) {
            setUnlockedNotice('🤗 Hug unlocked! Your pet trusts you!');
            setTimeout(() => setUnlockedNotice(null), 4000);
          }
        }
      }
    },
    [store]
  );

  const { sendMessage, sendAction, isLoading, error } = useA2UIStream(handleMessage);

  useEffect(() => {
    sendMessage('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setIsThinking(isLoading);
  }, [isLoading]);

  const handleAction = (action: UserAction) => {
    setLogs((prev) => [...prev, `ACTION: ${action.name}`].slice(-30));
    sendAction(action);
  };

  // Extract specific components from the surface for overlay positioning
  const surface = surfaces[0];
  const ctx: RenderContext | null = surface ? {
    surfaceId: surface.surfaceId,
    componentMap: surface.componentMap,
    dataModel: surface.dataModel,
    onAction: handleAction,
    resolve: (bv) => {
      if (typeof bv !== 'object' || bv === null) return bv;
      const bound = bv as { path?: string; literalString?: string; literalNumber?: number; literalBoolean?: boolean };
      if (bound.path) {
        const parts = bound.path.split('/').filter(Boolean);
        let current: unknown = surface.dataModel;
        for (const part of parts) {
          if (current && typeof current === 'object') {
            current = (current as Record<string, unknown>)[part];
          } else {
            return undefined;
          }
        }
        return current;
      }
      if (bound.literalString !== undefined) return bound.literalString;
      if (bound.literalNumber !== undefined) return bound.literalNumber;
      if (bound.literalBoolean !== undefined) return bound.literalBoolean;
      return undefined;
    },
  } : null;

  const statBarsComp = surface ? Array.from(surface.componentMap.values()).find(c => 'stat-bars' in c.component) : undefined;
  const actionPaletteComp = surface ? Array.from(surface.componentMap.values()).find(c => 'action-palette' in c.component) : undefined;

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      position: 'relative',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: '#111827',
    }}>
      {/* Full-screen Scene */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
      }}>
        {surface && (
          <SurfaceRenderer
            surface={surface}
            registry={registry}
            onAction={handleAction}
          />
        )}
        {surfaces.length === 0 && !isLoading && (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9ca3af',
            flexDirection: 'column',
          }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🥚</div>
            <p>Your pet is about to hatch...</p>
          </div>
        )}
      </div>

      {/* Top-left: Title + Stats Panel */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        maxWidth: 280,
      }}>
        {/* Title Card */}
        <div style={{
          background: 'rgba(17,24,39,0.85)',
          backdropFilter: 'blur(12px)',
          borderRadius: 16,
          padding: '14px 18px',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}>
          <h1 style={{
            fontSize: 18,
            fontWeight: 800,
            margin: 0,
            color: '#fbbf24',
            letterSpacing: '-0.5px',
          }}>
            🐾 A2UI Tamagotchi
          </h1>
          <p style={{
            fontSize: 11,
            color: '#9ca3af',
            margin: '4px 0 0',
            lineHeight: 1.4,
          }}>
            Every pixel generated by your pet agent
          </p>
        </div>

        {/* Stats Panel */}
        {ctx && statBarsComp && (
          <div style={{
            background: 'rgba(17,24,39,0.85)',
            backdropFilter: 'blur(12px)',
            borderRadius: 16,
            padding: '14px 18px',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 10,
            }}>
              Pet Stats
            </div>
            {registry.render(ctx, statBarsComp)}
          </div>
        )}
      </div>

      {/* Bottom-left: Action Buttons */}
      {ctx && actionPaletteComp && (
        <div style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          zIndex: 10,
          maxWidth: 320,
        }}>
          <div style={{
            background: 'rgba(17,24,39,0.85)',
            backdropFilter: 'blur(12px)',
            borderRadius: 16,
            padding: '12px 14px',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 8,
            }}>
              Actions
            </div>
            {registry.render(ctx, actionPaletteComp)}
          </div>
        </div>
      )}

      {/* Thinking Indicator (centered) */}
      {isThinking && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 20,
          background: 'rgba(17,24,39,0.9)',
          backdropFilter: 'blur(12px)',
          borderRadius: 20,
          padding: '16px 28px',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 14,
          color: '#e5e7eb',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <span style={{ animation: 'pulse 1s ease infinite', fontSize: 20 }}>🤔</span>
          <span>Your pet is thinking...</span>
        </div>
      )}

      {/* Unlock Notification (top center) */}
      {unlockedNotice && (
        <div style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          background: 'rgba(254,243,199,0.95)',
          border: '2px solid #fbbf24',
          borderRadius: 16,
          padding: '12px 24px',
          fontSize: 14,
          fontWeight: 700,
          color: '#92400e',
          animation: 'slideInDown 0.4s ease',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}>
          ✨ {unlockedNotice}
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div style={{
          position: 'absolute',
          top: 20,
          right: 20,
          zIndex: 20,
          background: 'rgba(254,226,226,0.95)',
          color: '#dc2626',
          borderRadius: 12,
          padding: '10px 16px',
          fontSize: 13,
          fontWeight: 500,
          maxWidth: 320,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Bottom-right: Log Toggle + Overlay */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
      }}>
        <button
          onClick={() => setShowLog(!showLog)}
          style={{
            background: showLog ? 'rgba(251,191,36,0.9)' : 'rgba(17,24,39,0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: '10px 16px',
            color: showLog ? '#111827' : '#9ca3af',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            transition: 'all 0.2s',
          }}
        >
          <span>📡</span>
          <span>Protocol Log</span>
          <span style={{
            background: showLog ? '#111827' : '#fbbf24',
            color: showLog ? '#fbbf24' : '#111827',
            borderRadius: 10,
            padding: '2px 8px',
            fontSize: 10,
            fontWeight: 800,
          }}>
            {logs.length}
          </span>
        </button>

        {showLog && (
          <div style={{
            background: 'rgba(17,24,39,0.95)',
            backdropFilter: 'blur(12px)',
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.1)',
            padding: 14,
            width: 380,
            maxHeight: 280,
            overflow: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            animation: 'fadeInUp 0.2s ease',
          }}>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 8,
            }}>
              Live A2UI Stream
            </div>
            <pre style={{
              margin: 0,
              fontSize: 9,
              fontFamily: 'monospace',
              color: '#10b981',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {logs.join('\n---\n') || 'Waiting for messages...'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
