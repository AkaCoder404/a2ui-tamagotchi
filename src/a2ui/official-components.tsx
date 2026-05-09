/**
 * Tamagotchi Custom Components for Official A2UI v0.8 Renderer
 *
 * These components are registered with the official @a2ui/react ComponentRegistry
 * and use useA2UIComponent for value resolution and action dispatching.
 */

import React, { memo, useCallback } from 'react';
import {
  ComponentRegistry,
  ComponentNode,
  useA2UIComponent,
  useA2UIActions,
} from '@a2ui/react/v0_8';

// ============== THEME DATA ==============

const bgGradients: Record<string, string> = {
  room: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
  park: 'linear-gradient(135deg, #dcfce7 0%, #86efac 100%)',
  bedroom: 'linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%)',
  void: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
  'golden-room': 'linear-gradient(135deg, #fef9c3 0%, #facc15 100%)',
};

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

const statColors: Record<string, string> = {
  hunger: '#f97316',
  happiness: '#22c55e',
  energy: '#3b82f6',
  affection: '#ec4899',
};

const actionIcons: Record<string, string> = {
  feed: '🍎',
  play: '🎾',
  sleep: '🌙',
  talk: '💬',
  hug: '🤗',
};

const itemEmojis: Record<string, string> = {
  'toy-ball': '🎾',
  crown: '👑',
};

const sizeMap: Record<string, number> = { small: 48, normal: 64, big: 80 };

// ============== FLEXIBLE VALUE RESOLVER ==============

/**
 * Hook that resolves property values, handling both raw primitives
 * and official A2UI bound value wrappers ({path}, {literalString}, etc.).
 */
function useFlexibleResolver(node: any, surfaceId: string) {
  const { resolveString, resolveNumber, resolveBoolean, getValue } =
    useA2UIComponent(node, surfaceId);

  const resolveStringFlex = useCallback(
    (value: unknown): string | null => {
      if (typeof value === 'string') return value;
      if (value === null || value === undefined) return null;
      return resolveString(value as any);
    },
    [resolveString]
  );

  const resolveNumberFlex = useCallback(
    (value: unknown): number | null => {
      if (typeof value === 'number') return value;
      if (value === null || value === undefined) return null;
      return resolveNumber(value as any);
    },
    [resolveNumber]
  );

  const resolveBooleanFlex = useCallback(
    (value: unknown): boolean | null => {
      if (typeof value === 'boolean') return value;
      if (value === null || value === undefined) return null;
      return resolveBoolean(value as any);
    },
    [resolveBoolean]
  );

  return { resolveStringFlex, resolveNumberFlex, resolveBooleanFlex, getValue };
}

// ============== CUSTOM COMPONENTS ==============

const Scene = memo(function Scene({ node, surfaceId }: any) {
  const { resolveNumberFlex } = useFlexibleResolver(node, surfaceId);
  const props = node.properties as Record<string, unknown>;
  const children = (props.children as any[]) || [];
  const height = resolveNumberFlex(props.height) ?? 400;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        overflow: 'hidden',
        minHeight: 320,
      }}
    >
      {children
        .filter(Boolean)
        .map((child) => (
          <ComponentNode key={child.id} node={child} surfaceId={surfaceId} />
        ))}
      {/* Ground line */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 280,
          height: 2,
          background: 'rgba(255,255,255,0.15)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />
      {/* Ground shadow */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 280,
          height: 60,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.08), transparent)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
});

const Background = memo(function Background({ node }: any) {
  const props = node.properties as Record<string, unknown>;
  const variant = String(props.variant || 'room');
  const moodTint = String(props.moodTint || '');
  const gradient = bgGradients[variant] || bgGradients.room;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: moodTint || gradient,
        transition: 'background 0.8s ease-in-out',
        zIndex: 0,
      }}
    />
  );
});

const PetAvatar = memo(function PetAvatar({ node, surfaceId }: any) {
  const { resolveStringFlex, resolveNumberFlex, resolveBooleanFlex } =
    useFlexibleResolver(node, surfaceId);
  const props = node.properties as Record<string, unknown>;

  const x = resolveNumberFlex(props.x) ?? 400;
  const y = resolveNumberFlex(props.y) ?? 280;
  const size = resolveStringFlex(props.size) || 'normal';
  const expression = resolveStringFlex(props.expression) || 'neutral';
  const bounce = resolveBooleanFlex(props.bounce) ?? false;

  const pixelSize = sizeMap[size] || 64;
  const color = expressionColors[expression] || expressionColors.neutral;
  const glow = glowColors[expression] || glowColors.neutral;

  const eyeOffsetY = expression === 'sleepy' ? 4 : 0;
  const mouthType =
    expression === 'happy' || expression === 'excited' || expression === 'dance'
      ? 'smile'
      : expression === 'sad'
        ? 'frown'
        : expression === 'sleepy'
          ? 'sleep'
          : 'neutral';

  return (
    <div
      data-pet-id={node.id}
      style={{
        position: 'absolute',
        left: x - pixelSize / 2,
        top: y - pixelSize / 2,
        width: pixelSize,
        height: pixelSize,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 4px 20px ${glow}`,
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div
            style={{
              width: pixelSize * 0.1,
              height: mouthType === 'sleep' ? 2 : pixelSize * 0.1,
              borderRadius: mouthType === 'sleep' ? 1 : '50%',
              background: '#1f2937',
              transform: `translateY(${eyeOffsetY}px)`,
              transition: 'all 0.3s',
            }}
          />
          <div
            style={{
              width: pixelSize * 0.1,
              height: mouthType === 'sleep' ? 2 : pixelSize * 0.1,
              borderRadius: mouthType === 'sleep' ? 1 : '50%',
              background: '#1f2937',
              transform: `translateY(${eyeOffsetY}px)`,
              transition: 'all 0.3s',
            }}
          />
        </div>
        {/* Mouth */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: pixelSize * 0.15,
            height:
              mouthType === 'smile' ? 6 : mouthType === 'frown' ? 4 : 2,
            borderRadius:
              mouthType === 'smile'
                ? '0 0 10px 10px'
                : mouthType === 'frown'
                  ? '10px 10px 0 0'
                  : 1,
            background: '#1f2937',
            marginTop: 4,
          }}
        />
      </div>
    </div>
  );
});

const ThoughtBubble = memo(function ThoughtBubble({
  node,
  surfaceId,
}: any) {
  const { resolveStringFlex, resolveBooleanFlex } = useFlexibleResolver(
    node,
    surfaceId
  );
  const actions = useA2UIActions();
  const props = node.properties as Record<string, unknown>;

  const text = resolveStringFlex(props.text) || '';
  const visible = resolveBooleanFlex(props.visible) !== false;

  // Read pet position from raw surface components for positioning
  const surface = actions.getSurface(surfaceId);
  const petComp = surface?.components.get('pet');
  const petProps = (petComp?.component as any)?.['pet-avatar'];
  let petX = 400;
  let petY = 280;
  if (petProps) {
    if (typeof petProps.x === 'number') {
      petX = petProps.x;
    } else if (petProps.x?.literalNumber !== undefined) {
      petX = petProps.x.literalNumber;
    } else if (petProps.x?.path === '/pet/position/x') {
      const val = actions.getData(node, '/pet/position/x', surfaceId);
      if (typeof val === 'number') petX = val;
    }
    if (typeof petProps.y === 'number') {
      petY = petProps.y;
    } else if (petProps.y?.literalNumber !== undefined) {
      petY = petProps.y.literalNumber;
    }
  }

  const bubbleX = petX + 40;
  const bubbleY = petY - 50;

  if (!visible) return null;

  return (
    <div
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
      <div
        style={{
          position: 'absolute',
          bottom: -6,
          left: 16,
          width: 12,
          height: 12,
          background: '#fff',
          transform: 'rotate(45deg)',
          borderRadius: 2,
        }}
      />
    </div>
  );
});

const StatBars = memo(function StatBars({ node, surfaceId }: any) {
  const { resolveNumberFlex } = useFlexibleResolver(node, surfaceId);
  const props = node.properties as Record<string, unknown>;

  const hunger = resolveNumberFlex(props.hunger) ?? 0;
  const happiness = resolveNumberFlex(props.happiness) ?? 0;
  const energy = resolveNumberFlex(props.energy) ?? 0;
  const affection = resolveNumberFlex(props.affection) ?? 0;

  const stats = [
    { label: 'hunger', value: hunger, color: statColors.hunger },
    { label: 'happiness', value: happiness, color: statColors.happiness },
    { label: 'energy', value: energy, color: statColors.energy },
    { label: 'affection', value: affection, color: statColors.affection },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '16px 0',
        width: '100%',
        maxWidth: 400,
        margin: '0 auto',
      }}
    >
      {stats.map((stat) => (
        <div key={stat.label}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              fontWeight: 600,
              color: '#6b7280',
              textTransform: 'capitalize',
              marginBottom: 4,
            }}
          >
            <span>{stat.label}</span>
            <span>{Math.round(stat.value)}</span>
          </div>
          <div
            style={{
              height: 10,
              background: '#e5e7eb',
              borderRadius: 5,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.max(0, Math.min(100, stat.value))}%`,
                height: '100%',
                background: stat.color,
                borderRadius: 5,
                transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
});

const ActionPalette = memo(function ActionPalette({ node, surfaceId }: any) {
  const { resolveStringFlex } = useFlexibleResolver(node, surfaceId);
  const actions = useA2UIActions();
  const props = node.properties as Record<string, unknown>;

  let actionList: string[] = [];
  if (Array.isArray(props.actions)) {
    actionList = props.actions
      .map((a: any) =>
        typeof a === 'string' ? a : resolveStringFlex(a) || ''
      )
      .filter(Boolean);
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
        gap: 10,
        padding: '12px 0',
        width: '100%',
        maxWidth: 500,
        margin: '0 auto',
      }}
    >
      {actionList.map((action: string) => (
        <button
          key={action}
          onClick={() => {
            actions.dispatch({
              userAction: {
                name: action,
                surfaceId,
                sourceComponentId: node.id,
                timestamp: new Date().toISOString(),
                context: {},
              },
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

const InventorySlot = memo(function InventorySlot({ node, surfaceId }: any) {
  const { resolveStringFlex } = useFlexibleResolver(node, surfaceId);
  const props = node.properties as Record<string, unknown>;

  let items: string[] = [];
  if (Array.isArray(props.items)) {
    items = props.items
      .map((a: any) =>
        typeof a === 'string' ? a : resolveStringFlex(a) || ''
      )
      .filter(Boolean);
  }

  return (
    <div
      style={{
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
      }}
    >
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

// ============== REGISTRATION ==============

export function registerTamagotchiComponents() {
  const registry = ComponentRegistry.getInstance();
  registry.register('scene', { component: Scene });
  registry.register('background', { component: Background });
  registry.register('pet-avatar', { component: PetAvatar });
  registry.register('thought-bubble', { component: ThoughtBubble });
  registry.register('stat-bars', { component: StatBars });
  registry.register('action-palette', { component: ActionPalette });
  registry.register('inventory-slot', { component: InventorySlot });
}
