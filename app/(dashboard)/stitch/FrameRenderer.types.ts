/**
 * Type definitions for Stitch Module (Frame Renderer & Annotations)
 */

export type StylePreset = 'default' | 'highlighted' | 'dimmed';

export type AnnotationType = 'bbox' | 'label' | 'point' | 'line';

export interface AnnotationInstruction {
  type: AnnotationType;
  coords: number[]; // [x1, y1, x2, y2] for bbox/line, [x, y] for point/label
  player_id: number;
  tracker_id?: number;
  label_text?: string;
  confidence?: number;
  style_preset?: StylePreset;
}

export interface Recipe {
  frame_id: number;
  video_id: string;
  instructions: AnnotationInstruction[];
}

export interface RecipeResponse {
  recipe: Recipe;
}

export interface VideoLoadResponse {
  session_id: string;
  total_frames: number;
  video_id: string;
  has_next_frame: boolean;
  has_previous_frame: boolean;
}

export interface FrameMetadata {
  frame_id: number;
  video_id: string;
  has_next_frame: boolean;
  has_previous_frame: boolean;
}

export interface StyleConfig {
  bbox_color: string;
  bbox_thickness: number;
  label_bg_color: string;
  label_text_color: string;
  label_font_size: number;
}

export interface VideoFile {
  fileName: string;
  signedUrl: string;
  // Optional metadata returned by list_video API
  uploadedAt: string;
  size: number;
  status: 'ready' | 'processing' | 'failed';
  folder?: string; // e.g. 'process/abc/imported/'
  fullPath?: string; // e.g. 'process/abc/imported/file.mp4'
}
