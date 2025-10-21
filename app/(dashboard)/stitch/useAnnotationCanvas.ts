import { useRef, useEffect, useCallback, useState } from 'react';
import type {
  Recipe,
  AnnotationInstruction,
  StyleConfig,
  StylePreset,
} from './FrameRenderer.types';

interface UseAnnotationCanvasProps {
  sessionId: string | null;
  currentFrameId: number | null;
  currentRecipe: Recipe | null;
}

export function useAnnotationCanvas({
  sessionId,
  currentFrameId,
  currentRecipe,
}: UseAnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [colorPalette, setColorPalette] = useState<Record<number, string>>({});

  /**
   * Get color for player ID using HSL color space
   */
  const getPlayerColor = useCallback((playerId: number): string => {
    if (colorPalette[playerId]) {
      return colorPalette[playerId];
    }

    const hue = (playerId * 137.5) % 360;
    const color = `hsl(${hue}, 70%, 50%)`;
    
    setColorPalette((prev) => ({ ...prev, [playerId]: color }));
    return color;
  }, [colorPalette]);

  /**
   * Dim a color by reducing opacity
   */
  const dimColor = useCallback((color: string): string => {
    return color
      .replace(')', ', 0.5)')
      .replace('rgb', 'rgba')
      .replace('hsl', 'hsla');
  }, []);

  /**
   * Get style configuration for player and preset
   */
  const getStyle = useCallback(
    (preset: StylePreset | undefined, playerId: number): StyleConfig => {
      const baseColor = getPlayerColor(playerId);

      const styles: Record<StylePreset, StyleConfig> = {
        default: {
          bbox_color: baseColor,
          bbox_thickness: 2,
          label_bg_color: 'black',
          label_text_color: 'white',
          label_font_size: 14,
        },
        highlighted: {
          bbox_color: baseColor,
          bbox_thickness: 3,
          label_bg_color: baseColor,
          label_text_color: 'white',
          label_font_size: 16,
        },
        dimmed: {
          bbox_color: dimColor(baseColor),
          bbox_thickness: 1,
          label_bg_color: 'rgba(0,0,0,0.5)',
          label_text_color: 'white',
          label_font_size: 12,
        },
      };

      return styles[preset || 'default'];
    },
    [getPlayerColor, dimColor]
  );

  /**
   * Draw bounding box annotation
   */
  const drawBbox = useCallback(
    (ctx: CanvasRenderingContext2D, instruction: AnnotationInstruction) => {
      const [x1, y1, x2, y2] = instruction.coords;
      const style = getStyle(instruction.style_preset, instruction.player_id);

      // Draw rectangle
      ctx.strokeStyle = style.bbox_color;
      ctx.lineWidth = style.bbox_thickness;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      // Draw label
      const label = instruction.label_text || `P${instruction.player_id}`;
      const fullLabel = instruction.confidence
        ? `${label} ${instruction.confidence.toFixed(2)}`
        : label;

      ctx.font = `${style.label_font_size}px Arial`;
      const textMetrics = ctx.measureText(fullLabel);

      // Label background
      ctx.fillStyle = style.label_bg_color;
      ctx.fillRect(x1, y1 - 20, textMetrics.width + 10, 20);

      // Label text
      ctx.fillStyle = style.label_text_color;
      ctx.fillText(fullLabel, x1 + 5, y1 - 5);
    },
    [getStyle]
  );

  /**
   * Draw label annotation
   */
  const drawLabel = useCallback(
    (ctx: CanvasRenderingContext2D, instruction: AnnotationInstruction) => {
      const [x, y] = instruction.coords;
      const style = getStyle(instruction.style_preset, instruction.player_id);
      const label = instruction.label_text || `P${instruction.player_id}`;

      ctx.font = `${style.label_font_size}px Arial`;
      const textMetrics = ctx.measureText(label);

      // Background
      ctx.fillStyle = style.label_bg_color;
      ctx.fillRect(x, y - 18, textMetrics.width + 8, 20);

      // Text
      ctx.fillStyle = style.label_text_color;
      ctx.fillText(label, x + 4, y - 3);
    },
    [getStyle]
  );

  /**
   * Draw point marker
   */
  const drawPoint = useCallback(
    (ctx: CanvasRenderingContext2D, instruction: AnnotationInstruction) => {
      const [x, y] = instruction.coords;
      const style = getStyle(instruction.style_preset, instruction.player_id);

      // Filled circle
      ctx.fillStyle = style.bbox_color;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();

      // Outline
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1;
      ctx.stroke();
    },
    [getStyle]
  );

  /**
   * Draw line
   */
  const drawLine = useCallback(
    (ctx: CanvasRenderingContext2D, instruction: AnnotationInstruction) => {
      const [x1, y1, x2, y2] = instruction.coords;
      const style = getStyle(instruction.style_preset, instruction.player_id);

      ctx.strokeStyle = style.bbox_color;
      ctx.lineWidth = style.bbox_thickness;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    },
    [getStyle]
  );

  /**
   * Render all annotations from recipe
   */
  const renderAnnotations = useCallback(() => {
    if (!canvasRef.current || !currentRecipe) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    currentRecipe.instructions.forEach((instruction) => {
      switch (instruction.type) {
        case 'bbox':
          drawBbox(ctx, instruction);
          break;
        case 'label':
          drawLabel(ctx, instruction);
          break;
        case 'point':
          drawPoint(ctx, instruction);
          break;
        case 'line':
          drawLine(ctx, instruction);
          break;
      }
    });
  }, [currentRecipe, drawBbox, drawLabel, drawPoint, drawLine]);

  /**
   * Load and render frame with annotations
   */
  const loadFrame = useCallback(
    async (frameId: number) => {
      if (!sessionId || !canvasRef.current) return;

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      try {
        // Fetch image blob
        const imageResponse = await fetch(
          `/api/stitch/video/frames/${sessionId}/${frameId}/image?format=jpg`
        );
        
        if (!imageResponse.ok) {
          throw new Error('Failed to fetch frame image');
        }

        const imageBlob = await imageResponse.blob();
        const imageUrl = URL.createObjectURL(imageBlob);
        const img = new Image();

        return new Promise<void>((resolve, reject) => {
          img.onload = () => {
            // Set canvas size to match image
            canvasRef.current!.width = img.width;
            canvasRef.current!.height = img.height;

            // Draw base image
            ctx.drawImage(img, 0, 0);

            // Render annotations if recipe is loaded
            renderAnnotations();

            // Clean up
            URL.revokeObjectURL(imageUrl);
            resolve();
          };

          img.onerror = () => {
            URL.revokeObjectURL(imageUrl);
            reject(new Error('Failed to load image'));
          };

          img.src = imageUrl;
        });
      } catch (error) {
        console.error('Error loading frame:', error);
        throw error;
      }
    },
    [sessionId, renderAnnotations]
  );

  // Re-render annotations when recipe changes
  useEffect(() => {
    if (currentRecipe && currentFrameId !== null) {
      renderAnnotations();
    }
  }, [currentRecipe, currentFrameId, renderAnnotations]);

  return {
    canvasRef,
    loadFrame,
    renderAnnotations,
  };
}
