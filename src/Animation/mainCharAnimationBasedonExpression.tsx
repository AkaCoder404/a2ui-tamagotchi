import { useState, useRef, useEffect, useMemo } from 'react';
import { Rectangle, Sprite, Texture } from 'pixi.js';

interface UseSpriteAnimationProps {
  expression: string;
  texturePath: string;
  frameWidth: number;
  frameHeight: number;
  totalFrames: number;
  animationSpeed: number;
}

export const useMainCharAnimation = ({
  expression,
  texturePath,
  frameWidth,
  frameHeight,
  totalFrames,
  animationSpeed,
}: UseSpriteAnimationProps) => {
  // 1. Load the base texture once
  const mainTexture = useMemo(() => Texture.from(texturePath), [texturePath]);

  // 2. Initialize the Sprite with a unique texture instance
  // We clone the texture so this sprite's frame doesn't affect others
  const [sprite] = useState(() => {
    const tex = new Texture({
      source: mainTexture.source,
      frame: new Rectangle(0, 0, frameWidth, frameHeight),
    });
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.width = 64; // Set your desired display size
    s.height = 64;
    return s;
  });

  const frameRef = useRef(0);
  const elapsedTimeRef = useRef(0);

  // 3. Map AI Expressions to Spritesheet Rows
  const getRowByExpression = (exp: string): number => {
    switch (exp) {
      case "happy":  return 3;
      case "sad":    return 4;
      case "sleepy": return 6;
      case "dance":  return 8;
      default:       return 5; // Neutral/Idle row
    }
  };

  // 4. Reset animation when the AI changes the mood
  useEffect(() => {
    frameRef.current = 0;
    elapsedTimeRef.current = 0;
  }, [expression]);

  // 5. The Update Loop (Called by your game ticker)
  const updateSprite = (delta: number) => {
    const row = getRowByExpression(expression);

    // Update frame timing
    elapsedTimeRef.current += animationSpeed * delta;

    if (elapsedTimeRef.current >= 1) {
      elapsedTimeRef.current = 0;
      frameRef.current = (frameRef.current + 1) % totalFrames;

      // Update the frame using the proper method to avoid "read-only" errors
      const newFrame = new Rectangle(
        frameRef.current * frameWidth,
        row * frameHeight,
        frameWidth,
        frameHeight
      );

      // In PixiJS v8, we update the frame via the texture's internal frame setter
      sprite.texture.frame = newFrame;
      
      // Force UV update (math that maps pixels to the sprite)
      sprite.texture.updateUvs();
    }
  };

  return { sprite, updateSprite };
};