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
  onSelectionChange?: (sel: { tracker_id?: number; player_id: number; bbox?: [number, number, number, number] } | null) => void;
  selectedBbox?: { player_id: number; tracker_id?: number; bbox?: [number, number, number, number] } | null;
}

export function useAnnotationCanvas({
  sessionId,
  currentFrameId,
  currentRecipe,
  onSelectionChange,
  selectedBbox,
}: UseAnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageLoadedRef = useRef(false);
  const baseImageRef = useRef<ImageData | null>(null);
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
    const colorWithAlpha = useCallback((color: string, alpha: number): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return `rgba(128, 128, 128, ${alpha})`; // fallback gray
    
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    return `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${alpha})`;
  }, []);

  /**
   * Check if an instruction matches the selected bbox
   */
  const isSelected = useCallback(
    (instruction: AnnotationInstruction): boolean => {
      if (!selectedBbox) return false;
      
      // Match by player_id if it's >= 0
      if (selectedBbox.player_id >= 0 && instruction.player_id === selectedBbox.player_id) {
        return true;
      }
      
      // For unidentified players (player_id === -1), match by tracker_id
      if (
        selectedBbox.player_id === -1 &&
        instruction.player_id === -1 &&
        selectedBbox.tracker_id !== undefined &&
        instruction.tracker_id === selectedBbox.tracker_id
      ) {
        return true;
      }
      
      return false;
    },
    [selectedBbox]
  );

  /**
   * Get style configuration for player and preset
   */
  const getStyle = useCallback(
    (preset: StylePreset | undefined, playerId: number, instruction?: AnnotationInstruction): StyleConfig => {
      const baseColor = getPlayerColor(playerId);
      
      // Check if this instruction is selected
      const selected = instruction ? isSelected(instruction) : false;

      const styles: Record<StylePreset, StyleConfig> = {
        default: {
          bbox_color: baseColor,
          bbox_thickness: selected ? 5 : 2,
          label_bg_color: 'black',
          label_text_color: 'white',
          label_font_size: selected ? 18 : 14,
        },
        highlighted: {
          bbox_color: baseColor,
          bbox_thickness: selected ? 6 : 3,
          label_bg_color: baseColor,
          label_text_color: 'white',
          label_font_size: selected ? 20 : 16,
        },
        dimmed: {
          bbox_color: dimColor(baseColor),
          bbox_thickness: selected ? 4 : 1,
          label_bg_color: 'rgba(0,0,0,0.5)',
          label_text_color: 'white',
          label_font_size: selected ? 16 : 12,
        },
      };

      return styles[preset || 'default'];
    },
    [dimColor, isSelected]
  );

  /**
   * Draw bounding box annotation
   */
  const drawBbox = useCallback(
    (ctx: CanvasRenderingContext2D, instruction: AnnotationInstruction) => {
      const [x1, y1, x2, y2] = instruction.coords;
      const style = getStyle(instruction.style_preset, instruction.player_id, instruction);
      const selected = isSelected(instruction);

      // For unidentified players (player_id === -1), fill with transparent color
      if (instruction.player_id === -1) {
        ctx.fillStyle = colorWithAlpha(style.bbox_color, 0.3); // 30% opacity
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      }

      // If selected, add a glowing effect with multiple strokes
      if (selected) {
        // Outer glow
        ctx.strokeStyle = colorWithAlpha(style.bbox_color, 0.3);
        ctx.lineWidth = style.bbox_thickness + 8;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        
        // Middle glow
        ctx.strokeStyle = colorWithAlpha(style.bbox_color, 0.5);
        ctx.lineWidth = style.bbox_thickness + 4;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      }

      // Draw main rectangle
      ctx.strokeStyle = style.bbox_color;
      ctx.lineWidth = style.bbox_thickness;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      // Draw label - just player number, no "P" prefix, no confidence
      // Use player_id directly if it's >= 0, otherwise show nothing
      if (instruction.player_id >= 0) {
        const label = `${instruction.player_id}`;
        
        ctx.font = `bold ${style.label_font_size}px Arial`;
        const textMetrics = ctx.measureText(label);
        const padding = selected ? 6 : 4;
        const labelWidth = textMetrics.width + padding * 2;
        const labelHeight = style.label_font_size + padding * 2;

        // Position label in bottom-right corner, inside the box
        const labelX = x2 - labelWidth;
        const labelY = y2 - labelHeight;

        // Label background with box color
        ctx.fillStyle = style.bbox_color;
        ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
        
        // If selected, add a bright border around the label
        if (selected) {
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.strokeRect(labelX, labelY, labelWidth, labelHeight);
        }

        // Label text in white
        ctx.fillStyle = 'white';
        ctx.textBaseline = 'top';
        ctx.fillText(label, labelX + padding, labelY + padding);
        ctx.textBaseline = 'alphabetic'; // Reset to default
      }
    },
    [getStyle, colorWithAlpha, isSelected]
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

    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Restore base image without annotations
    if (baseImageRef.current) {
      ctx.putImageData(baseImageRef.current, 0, 0);
    } else {
      // If no base image stored, clear canvas
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    
    // Now draw annotations on top of clean image
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
      
      if (res) {
        // Check if clicking the same player - if so, deselect
        const isSamePlayer = selectedBbox && (
          (selectedBbox.player_id >= 0 && selectedBbox.player_id === res.player_id) ||
          (selectedBbox.player_id === -1 && selectedBbox.tracker_id === res.tracker_id && res.player_id === -1)
        );
        
        if (isSamePlayer) {
          // Deselect
          selectionCbRef.current?.(null);
        } else {
          // Select new player
          selectionCbRef.current?.({ tracker_id: res.tracker_id, player_id: res.player_id, bbox: res.bbox });
        }
      } else {
        // Clicked empty space - deselect
        selectionCbRef.current?.(null);
      }
    };

    canvas.addEventListener('click', handleClick);
    return () => canvas.removeEventListener('click', handleClick);
  }, [currentRecipe, selectedBbox]);

  /**
   * Load image from blob and render on canvas
   */
  const loadImageFromBlob = useCallback(
    async (imageBlob: Blob, recipe?: Recipe) => {
      if (!canvasRef.current) return;

      const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Mark image as not loaded
      imageLoadedRef.current = false;

      const imageUrl = URL.createObjectURL(imageBlob);
      const img = new Image();

      return new Promise<void>((resolve, reject) => {
        img.onload = () => {
          // Set canvas size to match image
          canvasRef.current!.width = img.width;
          canvasRef.current!.height = img.height;

          // Clear canvas first
          ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);

          // Draw base image
          ctx.drawImage(img, 0, 0);

          // Store the base image without annotations for later re-rendering
          baseImageRef.current = ctx.getImageData(0, 0, canvasRef.current!.width, canvasRef.current!.height);

          // Mark image as loaded
          imageLoadedRef.current = true;

          // Render annotations using provided recipe or current recipe
          const recipeToRender = recipe || currentRecipe;
          if (recipeToRender && canvasRef.current) {
            const renderCtx = canvasRef.current.getContext('2d', { willReadFrequently: true });
            if (renderCtx) {
              recipeToRender.instructions.forEach((instruction) => {
                switch (instruction.type) {
                  case 'bbox':
                    drawBbox(renderCtx, instruction);
                    break;
                  case 'label':
                    drawLabel(renderCtx, instruction);
                    break;
                  case 'point':
                    drawPoint(renderCtx, instruction);
                    break;
                  case 'line':
                    drawLine(renderCtx, instruction);
                    break;
                }
              });
            }
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
    },
    [currentRecipe, drawBbox, drawLabel, drawPoint, drawLine]
  );

  /**
   * Load and render frame with annotations
   */
  const loadFrame = useCallback(
    async (frameId: number, cachedBlob?: Blob, recipe?: Recipe) => {
      if (!sessionId || !canvasRef.current) return;

      // Mark image as not loaded
      imageLoadedRef.current = false;

      try {
        let imageBlob: Blob;

        if (cachedBlob) {
          // Use cached blob
          imageBlob = cachedBlob;
        } else {
          // Fetch image blob
          const imageResponse = await fetch(
            `/api/stitch/video/frames/${sessionId}/${frameId}/image?format=jpg`
          );
          
          if (!imageResponse.ok) {
            throw new Error('Failed to fetch frame image');
          }

          imageBlob = await imageResponse.blob();
        }

        await loadImageFromBlob(imageBlob, recipe);
        return imageBlob; // Return blob for caching
      } catch (error) {
        console.error('Error loading frame:', error);
        throw error;
      }
    },
    [sessionId, loadImageFromBlob]
  );

  // Re-render annotations when recipe, frame, or selection changes and image is loaded
  useEffect(() => {
    if (currentRecipe && currentFrameId !== null && imageLoadedRef.current) {
      renderAnnotations();
    }
  }, [currentRecipe, currentFrameId, renderAnnotations, selectedBbox]);

  return {
    canvasRef,
    loadFrame,
    renderAnnotations,
  };
}
