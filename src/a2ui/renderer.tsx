/**
 * A2UI React Renderer — Tamagotchi Edition
 * Extended with custom animated components.
 */

import React from 'react';
import type {
  A2Component,
  RenderContext,
  BoundValue,
  UserAction,
  Surface,
} from './types';

function resolveValue(
  bv: BoundValue | string | number | boolean | undefined,
  dataModel: Record<string, unknown>
): unknown {
  if (bv === undefined) return undefined;
  if (typeof bv !== 'object') return bv;
  const bound = bv as BoundValue;
  if (bound.path !== undefined && bound.literalString !== undefined) {
    setPath(dataModel, bound.path, bound.literalString);
    return getPath(dataModel, bound.path);
  }
  if (bound.path !== undefined && bound.literalNumber !== undefined) {
    setPath(dataModel, bound.path, bound.literalNumber);
    return getPath(dataModel, bound.path);
  }
  if (bound.path !== undefined && bound.literalBoolean !== undefined) {
    setPath(dataModel, bound.path, bound.literalBoolean);
    return getPath(dataModel, bound.path);
  }
  if (bound.path !== undefined) return getPath(dataModel, bound.path);
  if (bound.literalString !== undefined) return bound.literalString;
  if (bound.literalNumber !== undefined) return bound.literalNumber;
  if (bound.literalBoolean !== undefined) return bound.literalBoolean;
  return undefined;
}

function getPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('/').filter(Boolean);
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function setPath(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split('/').filter(Boolean);
  let current: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

export type ComponentRenderer = (
  ctx: RenderContext,
  id: string,
  props: Record<string, unknown>
) => React.ReactNode;

export class ComponentRegistry {
  private map = new Map<string, ComponentRenderer>();

  register(name: string, renderer: ComponentRenderer) {
    this.map.set(name, renderer);
  }

  render(ctx: RenderContext, comp: A2Component | undefined): React.ReactNode {
    if (!comp) return null;
    const variant = comp.component;
    const typeName = Object.keys(variant)[0] as string;
    const props = (variant as Record<string, unknown>)[typeName] as Record<string, unknown>;
    const renderer = this.map.get(typeName);
    if (!renderer) {
      return (
        <div key={comp.id} style={{ padding: 8, color: 'red', border: '1px dashed red', borderRadius: 4 }}>
          Unknown: {typeName}
        </div>
      );
    }
    return renderer(ctx, comp.id, props);
  }
}

// ==================== STANDARD COMPONENTS ====================

export function createDefaultRegistry(): ComponentRegistry {
  const reg = new ComponentRegistry();

  reg.register('Text', (ctx, id, props) => {
    const text = String(ctx.resolve(props.text as BoundValue) ?? '');
    const hint = props.usageHint as string;
    const styles: Record<string, React.CSSProperties> = {
      h1: { fontSize: 28, fontWeight: 700, margin: '8px 0' },
      h2: { fontSize: 22, fontWeight: 600, margin: '6px 0' },
      h3: { fontSize: 18, fontWeight: 600, margin: '4px 0' },
      body: { fontSize: 14, lineHeight: 1.5 },
      caption: { fontSize: 12, color: '#666' },
    };
    return <span key={id} style={styles[hint] || styles.body}>{text}</span>;
  });

  reg.register('Button', (ctx, id, props) => {
    const label = props.label ? String(ctx.resolve(props.label as BoundValue) ?? '') : null;
    const childId = props.child as string;
    const variant = (props.variant as string) || 'secondary';
    const action = props.action as { name: string; context?: Record<string, BoundValue> } | undefined;

    const colors = {
      primary: { bg: '#2563eb', color: '#fff' },
      secondary: { bg: '#e5e7eb', color: '#111' },
      danger: { bg: '#dc2626', color: '#fff' },
    };
    const c = colors[variant as keyof typeof colors] || colors.secondary;

    const handleClick = () => {
      if (!action) return;
      const resolvedContext: Record<string, unknown> = {};
      if (action.context) {
        for (const [k, v] of Object.entries(action.context)) {
          resolvedContext[k] = ctx.resolve(v);
        }
      }
      ctx.onAction({
        name: action.name,
        surfaceId: ctx.surfaceId,
        sourceComponentId: id,
        timestamp: new Date().toISOString(),
        context: resolvedContext,
      });
    };

    let content: React.ReactNode = label;
    if (childId && ctx.componentMap.has(childId)) {
      content = reg.render(ctx, ctx.componentMap.get(childId)!);
    }

    return (
      <button key={id} onClick={handleClick} style={{
        padding: '8px 16px', borderRadius: 8, border: 'none',
        background: c.bg, color: c.color, cursor: 'pointer',
        fontSize: 14, fontWeight: 500, transition: 'all 0.2s',
      }}>
        {content}
      </button>
    );
  });

  reg.register('Card', (ctx, id, props) => {
    const childId = props.child as string;
    const childrenIds = props.children as string[];
    const ids = childrenIds || (childId ? [childId] : []);
    return (
      <div key={id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        {ids.map(cid => {
          const c = ctx.componentMap.get(cid);
          return c ? <div key={cid}>{reg.render(ctx, c)}</div> : null;
        })}
      </div>
    );
  });

  reg.register('Column', (ctx, id, props) => {
    const children = props.children as { explicitList?: string[] };
    const align = (props.align as string) || 'stretch';
    const justify = (props.justify as string) || 'start';
    const gap = (props.gap as number) || 8;
    const alignItems = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' }[align] || 'stretch';
    const justifyContent = { start: 'flex-start', center: 'center', end: 'flex-end', spaceBetween: 'space-between', spaceAround: 'space-around' }[justify] || 'flex-start';

    return (
      <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems, justifyContent, gap }}>
        {(children.explicitList || []).map(cid => {
          const c = ctx.componentMap.get(cid);
          return c ? <div key={cid}>{reg.render(ctx, c)}</div> : null;
        })}
      </div>
    );
  });

  reg.register('Row', (ctx, id, props) => {
    const children = props.children as { explicitList?: string[] };
    const align = (props.align as string) || 'center';
    const justify = (props.justify as string) || 'start';
    const gap = (props.gap as number) || 8;
    const alignItems = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' }[align] || 'center';
    const justifyContent = { start: 'flex-start', center: 'center', end: 'flex-end', spaceBetween: 'space-between', spaceAround: 'space-around' }[justify] || 'flex-start';

    return (
      <div key={id} style={{ display: 'flex', flexDirection: 'row', alignItems, justifyContent, gap, flexWrap: 'wrap' }}>
        {(children.explicitList || []).map(cid => {
          const c = ctx.componentMap.get(cid);
          return c ? <div key={cid}>{reg.render(ctx, c)}</div> : null;
        })}
      </div>
    );
  });

  reg.register('Divider', (_ctx, id, props) => {
    const axis = (props.axis as string) || 'horizontal';
    if (axis === 'vertical') {
      return <div key={id} style={{ width: 1, background: '#e5e7eb', alignSelf: 'stretch' }} />;
    }
    return <hr key={id} style={{ border: 'none', borderTop: '1px solid #e5e7eb', width: '100%', margin: '8px 0' }} />;
  });

  // ==================== TAMAGOTCHI CUSTOM COMPONENTS ====================

  // scene — viewport container
  reg.register('scene', (ctx, id, props) => {
    const children = props.children as { explicitList?: string[] };
    const childIds = children.explicitList || [];
    // All children render inside the full-screen viewport
    return (
      <div key={id} style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}>
        {childIds.map(cid => {
          const c = ctx.componentMap.get(cid);
          return c ? <React.Fragment key={cid}>{reg.render(ctx, c)}</React.Fragment> : null;
        })}
        {/* Ground line — where the pet walks */}
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 280,
          height: 2,
          background: 'rgba(255,255,255,0.15)',
          zIndex: 1,
          pointerEvents: 'none',
        }} />
        {/* Ground shadow gradient */}
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 280,
          height: 60,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.08), transparent)',
          zIndex: 0,
          pointerEvents: 'none',
        }} />
      </div>
    );
  });

  // background — full-bleed backdrop with gradient transition
  const bgGradients: Record<string, string> = {
    room: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    park: 'linear-gradient(135deg, #dcfce7 0%, #86efac 100%)',
    bedroom: 'linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%)',
    void: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
    'golden-room': 'linear-gradient(135deg, #fef9c3 0%, #facc15 100%)',
  };

  reg.register('background', (_ctx, id, props) => {
    const variant = String(props.variant || 'room');
    const moodTint = String(props.moodTint || '');
    const gradient = bgGradients[variant] || bgGradients.room;
    return (
      <div key={id} style={{
        position: 'absolute',
        inset: 0,
        background: moodTint || gradient,
        transition: 'background 0.8s ease-in-out',
        zIndex: 0,
      }} />
    );
  });

  // pet-avatar — animated pet circle with face
  reg.register('pet-avatar', (ctx, id, props) => {
    const x = ctx.resolve(props.x as BoundValue) as number || 400;
    const y = ctx.resolve(props.y as BoundValue) as number || 200;
    const size = String(props.size || 'normal');
    const expression = String(props.expression || 'neutral');
    const bounce = !!props.bounce;

    const sizeMap: Record<string, number> = { small: 48, normal: 64, big: 80 };
    const pixelSize = sizeMap[size] || 64;

    const expressionColors: Record<string, string> = {
      neutral: '#9ca3af',
      happy: '#fbbf24',
      sad: '#93c5fd',
      sleepy: '#c4b5fd',
      excited: '#f472b6',
      hungry: '#fca5a5',
      grumpy: '#6b7280',
      dance: '#fbbf24',
    };

    const glowColors: Record<string, string> = {
      neutral: 'rgba(156,163,175,0.3)',
      happy: 'rgba(251,191,36,0.4)',
      sad: 'rgba(147,197,253,0.3)',
      sleepy: 'rgba(196,181,253,0.3)',
      excited: 'rgba(244,114,182,0.5)',
      hungry: 'rgba(252,165,165,0.3)',
      grumpy: 'rgba(107,114,128,0.3)',
      dance: 'rgba(251,191,36,0.6)',
    };

    // Face expressions
    const eyeOffsetY = expression === 'sleepy' ? 4 : 0;
    const mouthType = expression === 'happy' || expression === 'excited' || expression === 'dance'
      ? 'smile'
      : expression === 'sad'
      ? 'frown'
      : expression === 'sleepy'
      ? 'sleep'
      : 'neutral';

    return (
      <div
        key={id}
        data-pet-id={id}
        style={{
          position: 'absolute',
          left: x - pixelSize / 2,
          top: y - pixelSize / 2,
          width: pixelSize,
          height: pixelSize,
          borderRadius: '50%',
          background: expressionColors[expression] || expressionColors.neutral,
          boxShadow: `0 4px 20px ${glowColors[expression] || glowColors.neutral}`,
          transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: bounce ? 'bounce 0.6s ease infinite' : 'none',
        }}
      >
        {/* Face */}
        <div style={{ position: 'relative', width: '60%', height: '40%' }}>
          {/* Eyes */}
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <div style={{
              width: pixelSize * 0.1,
              height: mouthType === 'sleep' ? 2 : pixelSize * 0.1,
              borderRadius: mouthType === 'sleep' ? 1 : '50%',
              background: '#1f2937',
              transform: `translateY(${eyeOffsetY}px)`,
              transition: 'all 0.3s',
            }} />
            <div style={{
              width: pixelSize * 0.1,
              height: mouthType === 'sleep' ? 2 : pixelSize * 0.1,
              borderRadius: mouthType === 'sleep' ? 1 : '50%',
              background: '#1f2937',
              transform: `translateY(${eyeOffsetY}px)`,
              transition: 'all 0.3s',
            }} />
          </div>
          {/* Mouth */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: pixelSize * 0.15,
            height: mouthType === 'smile' ? 6 : mouthType === 'frown' ? 4 : 2,
            borderRadius: mouthType === 'smile' ? '0 0 10px 10px' : mouthType === 'frown' ? '10px 10px 0 0' : 1,
            background: '#1f2937',
            marginTop: 4,
          }} />
        </div>
      </div>
    );
  });

  // thought-bubble — floating text
  reg.register('thought-bubble', (ctx, id, props) => {
    const text = String(ctx.resolve(props.text as BoundValue) ?? '');
    const visible = ctx.resolve(props.visible as BoundValue) !== false;

    // Find pet position to position bubble above it
    const pet = Array.from(ctx.componentMap.values()).find(c => 'pet-avatar' in c.component);
    let bubbleX = 100;
    let bubbleY = 80;
    if (pet) {
      const petProps = (pet.component as Record<string, unknown>)['pet-avatar'] as Record<string, unknown>;
      const px = ctx.resolve(petProps.x as BoundValue) as number || 400;
      const py = ctx.resolve(petProps.y as BoundValue) as number || 200;
      bubbleX = px + 40;
      bubbleY = py - 50;
    }

    if (!visible) return null;

    return (
      <div
        key={id}
        style={{
          position: 'absolute',
          left: bubbleX,
          top: Math.max(10, bubbleY),
          background: '#fff',
          padding: '10px 16px',
          borderRadius: 20,
          fontSize: 13,
          color: '#374151',
          boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
          zIndex: 3,
          pointerEvents: 'none',
          maxWidth: 200,
          lineHeight: 1.4,
          animation: 'fadeInUp 0.4s ease',
        }}
      >
        {text}
        {/* Bubble tail */}
        <div style={{
          position: 'absolute',
          bottom: -6,
          left: 16,
          width: 12,
          height: 12,
          background: '#fff',
          transform: 'rotate(45deg)',
          borderRadius: 2,
        }} />
      </div>
    );
  });

  // stat-bars — morphing progress bars
  const statColors: Record<string, string> = {
    hunger: '#f97316',
    happiness: '#22c55e',
    energy: '#3b82f6',
    affection: '#ec4899',
  };

  reg.register('stat-bars', (ctx, id, props) => {
    const hunger = ctx.resolve(props.hunger as BoundValue) as number || 0;
    const happiness = ctx.resolve(props.happiness as BoundValue) as number || 0;
    const energy = ctx.resolve(props.energy as BoundValue) as number || 0;
    const affection = ctx.resolve(props.affection as BoundValue) as number || 0;

    const stats = [
      { label: 'hunger', value: hunger, color: statColors.hunger },
      { label: 'happiness', value: happiness, color: statColors.happiness },
      { label: 'energy', value: energy, color: statColors.energy },
      { label: 'affection', value: affection, color: statColors.affection },
    ];

    return (
      <div key={id} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 0', width: '100%', maxWidth: 400, margin: '0 auto' }}>
        {stats.map(stat => (
          <div key={stat.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'capitalize', marginBottom: 4 }}>
              <span>{stat.label}</span>
              <span>{Math.round(stat.value)}</span>
            </div>
            <div style={{ height: 10, background: '#e5e7eb', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.max(0, Math.min(100, stat.value))}%`,
                height: '100%',
                background: stat.color,
                borderRadius: 5,
                transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
              }} />
            </div>
          </div>
        ))}
      </div>
    );
  });

  // action-palette — dynamic button grid
  const actionIcons: Record<string, string> = {
    feed: '🍎',
    play: '🎾',
    sleep: '🌙',
    talk: '💬',
    hug: '🤗',
  };

  reg.register('action-palette', (ctx, id, props) => {
    const rawActions = props.actions;
    const actions = Array.isArray(rawActions)
      ? rawActions as string[]
      : (ctx.resolve(rawActions as BoundValue) as string[]) || [];

    return (
      <div key={id} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 10, padding: '12px 0', width: '100%', maxWidth: 500, margin: '0 auto' }}>
        {actions.map((action: string) => (
          <button
            key={action}
            onClick={() => {
              ctx.onAction({
                name: action,
                surfaceId: ctx.surfaceId,
                sourceComponentId: `btn-${action}`,
                timestamp: new Date().toISOString(),
                context: {},
              });
            }}
            style={{
              padding: '12px 8px',
              borderRadius: 12,
              border: '2px solid #e5e7eb',
              background: '#fff',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              color: '#374151',
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f3f4f6';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <span style={{ fontSize: 24 }}>{actionIcons[action] || '●'}</span>
            <span style={{ textTransform: 'capitalize' }}>{action}</span>
          </button>
        ))}
      </div>
    );
  });

  // inventory-slot — collected items
  const itemEmojis: Record<string, string> = {
    'toy-ball': '🎾',
    crown: '👑',
  };

  reg.register('inventory-slot', (ctx, id, props) => {
    const rawItems = props.items;
    const items = Array.isArray(rawItems)
      ? rawItems as string[]
      : (ctx.resolve(rawItems as BoundValue) as string[]) || [];

    return (
      <div key={id} style={{
        position: 'absolute',
        bottom: 12,
        right: 12,
        display: 'flex',
        gap: 8,
        padding: '8px 12px',
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(4px)',
        borderRadius: 12,
        zIndex: 2,
      }}>
        {items.length === 0 && (
          <span style={{ fontSize: 12, color: '#9ca3af' }}>No items yet</span>
        )}
        {items.map((item: string) => (
          <div key={item} style={{ fontSize: 28, animation: 'popIn 0.4s ease' }}>
            {itemEmojis[item] || '✨'}
          </div>
        ))}
      </div>
    );
  });

  return reg;
}

// ==================== SURFACE RENDERER ====================

export function SurfaceRenderer({
  surface,
  registry,
  onAction,
}: {
  surface: Surface;
  registry: ComponentRegistry;
  onAction: (action: UserAction) => void;
}) {
  if (!surface.isReady || !surface.rootId) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🥚</div>
        <p>Your pet is hatching...</p>
      </div>
    );
  }

  const ctx: RenderContext = {
    surfaceId: surface.surfaceId,
    componentMap: surface.componentMap,
    dataModel: surface.dataModel,
    onAction,
    resolve: (bv) => resolveValue(bv, surface.dataModel),
  };

  const rootComp = surface.componentMap.get(surface.rootId);
  if (!rootComp) {
    return <div style={{ padding: 20, color: 'red' }}>Root not found: {surface.rootId}</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {registry.render(ctx, rootComp)}
    </div>
  );
}
