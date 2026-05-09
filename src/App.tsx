import { useCallback, useEffect, useRef, useState } from 'react';
import { A2UIProvider, A2UIRenderer, useA2UI } from '@a2ui/react/v0_8';
import type { Types } from '@a2ui/react/v0_8';
import { registerTamagotchiComponents } from './a2ui/official-components';
import { useA2UIStream } from './hooks/useA2UIStream';

// Register custom components on the global registry once
registerTamagotchiComponents();

function AppInner({
  actionSenderRef,
}: {
  actionSenderRef: React.MutableRefObject<(name: string) => void>;
}) {
  const { processMessages, getSurface } = useA2UI();
  const [logs, setLogs] = useState<string[]>([]);
  const [unlockedNotice, setUnlockedNotice] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [spawnCommand, setSpawnCommand] = useState('');

  const handleMessage = useCallback(
    (rawMsg: Types.ServerToClientMessage) => {
      const msg = rawMsg as any;

      // Handle spawn cleanup (non-standard A2UI message from our backend)
      if (msg.spawnCleanup) {
        const surface = getSurface('main');
        const spawnComps: { id: string; props: any }[] = [];
        if (surface) {
          for (const [id, comp] of surface.components) {
            if (id.startsWith('spawn-') && comp.component && 'spawned-item' in comp.component) {
              spawnComps.push({ id, props: comp.component['spawned-item'] });
            }
          }
        }
        if (spawnComps.length > 0) {
          // Batch cleanup: preserve all existing props and add cleaningUp: true
          const cleanupMessages = spawnComps.map(({ id, props }) => ({
            surfaceUpdate: {
              surfaceId: 'main',
              components: [
                {
                  id,
                  component: {
                    'spawned-item': {
                      ...props,
                      cleaningUp: true,
                    },
                  },
                },
              ],
            },
          }));
          try {
            processMessages(cleanupMessages as any);
          } catch (err) {
            console.warn('Cleanup error:', err);
          }
          setLogs((prev) =>
            [...prev, `CLEANUP: fading out ${spawnComps.length} items`].slice(-30)
          );
        } else {
          setLogs((prev) => [...prev, 'CLEANUP: nothing to clean'].slice(-30));
        }
        return;
      }

      // Normalize common Gemini mistakes before feeding to the processor
      if (msg.dataModelUpdate && msg.dataModelUpdate.contents) {
        if (!Array.isArray(msg.dataModelUpdate.contents)) {
          msg.dataModelUpdate.contents = [msg.dataModelUpdate.contents];
        }
      }

      try {
        processMessages([msg]);
      } catch (err) {
        console.warn('[A2UI] Message processing error:', err);
        setLogs((prev) => [
          ...prev,
          `ERROR: ${err instanceof Error ? err.message : String(err)}`,
        ]);
        return;
      }
      setLogs((prev) => [...prev, JSON.stringify(msg)].slice(-30));

      // Unlock detection: check if action-palette includes 'hug'
      if ('surfaceUpdate' in msg && msg.surfaceUpdate) {
        const components = msg.surfaceUpdate.components;
        const actionPalette = components.find(
          (c) => c.component && 'action-palette' in c.component
        );
        if (actionPalette) {
          const props = (actionPalette.component as Record<string, unknown>)['action-palette'] as Record<string, unknown>;
          const actions = props?.actions;
          if (Array.isArray(actions) && actions.includes('hug')) {
            setUnlockedNotice('🤗 Hug unlocked! Your pet trusts you!');
            setTimeout(() => setUnlockedNotice(null), 4000);
          }
        }
      }
    },
    [processMessages]
  );

  const { sendMessage, sendAction, sendSpawn, isLoading, error } =
    useA2UIStream(handleMessage);

  // Wire action sender ref so parent A2UIProvider can trigger backend calls
  useEffect(() => {
    actionSenderRef.current = (name: string) => {
      setLogs((prev) => [...prev, `ACTION: ${name}`].slice(-30));
      sendAction(name);
    };
  }, [sendAction, actionSenderRef]);

  // Initialize on mount
  useEffect(() => {
    sendMessage('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSpawnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!spawnCommand.trim()) return;
    setLogs((prev) => [...prev, `SPAWN: ${spawnCommand.trim()}`].slice(-30));
    sendSpawn(spawnCommand.trim());
    setSpawnCommand('');
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#111827',
      }}
    >
      {/* Official A2UI Surface */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
        }}
      >
        <A2UIRenderer
          surfaceId="main"
          fallback={
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ca3af',
                flexDirection: 'column',
              }}
            >
              <div style={{ fontSize: 64, marginBottom: 16 }}>🥚</div>
              <p>Your pet is about to hatch...</p>
            </div>
          }
        />
      </div>

      {/* Title overlay */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 10,
        }}
      >
        <div
          style={{
            background: 'rgba(17,24,39,0.85)',
            backdropFilter: 'blur(12px)',
            borderRadius: 16,
            padding: '14px 18px',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}
        >
          <h1
            style={{
              fontSize: 18,
              fontWeight: 800,
              margin: 0,
              color: '#fbbf24',
              letterSpacing: '-0.5px',
            }}
          >
            🐾 A2UI Tamagotchi
          </h1>
          <p
            style={{
              fontSize: 11,
              color: '#9ca3af',
              margin: '4px 0 0',
              lineHeight: 1.4,
            }}
          >
            Powered by official @a2ui/react v0.8
          </p>
        </div>
      </div>

      {/* Thinking Indicator */}
      {isLoading && (
        <div
          style={{
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
          }}
        >
          <span style={{ animation: 'pulse 1s ease infinite', fontSize: 20 }}>
            🤔
          </span>
          <span>Your pet is thinking...</span>
        </div>
      )}

      {/* Unlock Notification */}
      {unlockedNotice && (
        <div
          style={{
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
          }}
        >
          ✨ {unlockedNotice}
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div
          style={{
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
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Spawn Input */}
      <form
        onSubmit={handleSpawnSubmit}
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(17,24,39,0.9)',
          backdropFilter: 'blur(12px)',
          borderRadius: 14,
          padding: '8px 12px',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          width: 'min(90vw, 420px)',
        }}
      >
        <span style={{ fontSize: 18, marginLeft: 4 }}>✨</span>
        <input
          type="text"
          value={spawnCommand}
          onChange={(e) => setSpawnCommand(e.target.value)}
          placeholder='Try "Spawn a pizza" or "Spawn a toy"'
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: '#e5e7eb',
            fontSize: 14,
            outline: 'none',
            padding: '6px 4px',
          }}
        />
        <button
          type="submit"
          disabled={!spawnCommand.trim() || isLoading}
          style={{
            background: spawnCommand.trim()
              ? 'rgba(251,191,36,0.9)'
              : 'rgba(55,65,81,0.5)',
            border: 'none',
            borderRadius: 10,
            padding: '8px 16px',
            color: spawnCommand.trim() ? '#111827' : '#9ca3af',
            fontSize: 13,
            fontWeight: 700,
            cursor: spawnCommand.trim() ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}
        >
          Spawn
        </button>
      </form>

      {/* Protocol Log */}
      <div
        style={{
          position: 'absolute',
          bottom: 72,
          right: 16,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 8,
        }}
      >
        <button
          onClick={() => setShowLog(!showLog)}
          style={{
            background: showLog
              ? 'rgba(251,191,36,0.9)'
              : 'rgba(17,24,39,0.85)',
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
          <span
            style={{
              background: showLog ? '#111827' : '#fbbf24',
              color: showLog ? '#fbbf24' : '#111827',
              borderRadius: 10,
              padding: '2px 8px',
              fontSize: 10,
              fontWeight: 800,
            }}
          >
            {logs.length}
          </span>
        </button>

        {showLog && (
          <div
            style={{
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
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 8,
              }}
            >
              Live A2UI Stream
            </div>
            <pre
              style={{
                margin: 0,
                fontSize: 9,
                fontFamily: 'monospace',
                color: '#10b981',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {logs.join('\n---\n') || 'Waiting for messages...'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const actionSenderRef = useRef<(name: string) => void>(() => {});

  return (
    <A2UIProvider
      onAction={(msg) => {
        const userAction = msg.userAction;
        if (userAction) {
          actionSenderRef.current(userAction.name);
        }
      }}
    >
      <AppInner actionSenderRef={actionSenderRef} />
    </A2UIProvider>
  );
}

export default App;
