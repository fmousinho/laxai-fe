import { useRef, useEffect, useCallback } from 'react';
import { findBboxAtPoint } from '@/lib/annotation-selection';
import { getPlayerColor } from '@/lib/player-colors';
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
  onSelectionChange?: (sel: { tracker_id?: number; player_id: number } | null) => void;
}

export function useAnnotationCanvas({
  sessionId,
  currentFrameId,
  currentRecipe,
  onSelectionChange,
}: UseAnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageLoadedRef = useRef(false);
  const selectionCbRef = useRef(onSelectionChange);

  useEffect(() => {
    selectionCbRef.current = onSelectionChange;
  }, [onSelectionChange]);

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
   * Convert any color to RGBA with specified alpha
   */
  const colorToRgba = useCallback((color: string, alpha: number): string => {
    // Create a temporary canvas to convert any color format to rgba
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return `rgba(128, 128, 128, ${alpha})`; // fallback gray
    
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    return `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${alpha})`;
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
    [dimColor]
  );

  /**
   * Draw bounding box annotation
   */
  const drawBbox = useCallback(
    (ctx: CanvasRenderingContext2D, instruction: AnnotationInstruction) => {
      const [x1, y1, x2, y2] = instruction.coords;
      const style = getStyle(instruction.style_preset, instruction.player_id);

      // For unidentified players (player_id === -1), fill with transparent color
      if (instruction.player_id === -1) {
        ctx.fillStyle = colorToRgba(style.bbox_color, 0.3); // 30% opacity
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      }

      // Draw rectangle
      ctx.strokeStyle = style.bbox_color;
      ctx.lineWidth = style.bbox_thickness;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      // Draw label - just player number, no "P" prefix, no confidence
      // Use player_id directly if it's >= 0, otherwise show nothing
      if (instruction.player_id >= 0) {
        const label = `${instruction.player_id}`;
        
        ctx.font = `bold ${style.label_font_size}px Arial`;
        const textMetrics = ctx.measureText(label);
        const padding = 4;
        const labelWidth = textMetrics.width + padding * 2;
        const labelHeight = style.label_font_size + padding * 2;

        // Position label in bottom-right corner, inside the box
        const labelX = x2 - labelWidth;
        const labelY = y2 - labelHeight;

        // Label background with box color
        ctx.fillStyle = style.bbox_color;
        ctx.fillRect(labelX, labelY, labelWidth, labelHeight);

        // Label text in white
        ctx.fillStyle = 'white';
        ctx.textBaseline = 'top';
        ctx.fillText(label, labelX + padding, labelY + padding);
        ctx.textBaseline = 'alphabetic'; // Reset to default
      }
    },
    [getStyle, colorToRgba]
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

  // Handle click selection on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleClick = (evt: MouseEvent) => {
      if (!currentRecipe) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (evt.clientX - rect.left) * scaleX;
      const y = (evt.clientY - rect.top) * scaleY;

      const res = findBboxAtPoint(currentRecipe.instructions as any, x, y);
      selectionCbRef.current?.(res ? { tracker_id: res.tracker_id, player_id: res.player_id } : null);
    };

    canvas.addEventListener('click', handleClick);
    return () => canvas.removeEventListener('click', handleClick);
  }, [currentRecipe]);

  /**
   * Load and render frame with annotations
   */
  const loadFrame = useCallback(
    async (frameId: number) => {
      if (!sessionId || !canvasRef.current) return;

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      // Mark image as not loaded
      imageLoadedRef.current = false;

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

            // Mark image as loaded
            imageLoadedRef.current = true;

            // Render annotations if recipe is loaded
            if (currentRecipe) {
              renderAnnotations();
            }

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
    [sessionId]
  );

  // Re-render annotations when recipe changes and image is loaded
  useEffect(() => {
    if (currentRecipe && currentFrameId !== null && imageLoadedRef.current) {
      renderAnnotations();
    }
  }, [currentRecipe, currentFrameId, renderAnnotations]);

  return {
    canvasRef,
    loadFrame,
    renderAnnotations,
  };
}
