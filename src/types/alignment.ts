/**
 * Core types for multi-image alignment and registration
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface LandmarkPoint {
  id: string;
  x: number; // relative to image natural width
  y: number; // relative to image natural height
  label: string;
}

export interface ImageTransform {
  x: number; // horizontal translation in pixels relative to base image
  y: number; // vertical translation in pixels relative to base image
  rotation: number; // rotation in degrees
  scaleX: number; // horizontal scale factor (1 = 100%)
  scaleY: number; // vertical scale factor (1 = 100%)
  flipH: boolean; // flip horizontally
  flipV: boolean; // flip vertically
}

export interface ImageItem {
  id: string;
  name: string;
  src: string;
  width: number;
  height: number;
  aspectRatio: number;
  fileSize?: number;
  isBase: boolean;
  transform: ImageTransform;
  landmarks: LandmarkPoint[]; // Point A and Point B for landmark registration
  status: 'pending' | 'aligned' | 'auto_aligned';
  score?: number; // similarity match percentage (0 - 100)
}

export type ViewMode =
  | 'onion'        // Opacity blend slider (0-100%)
  | 'difference'   // Difference blend mode (black = perfect match)
  | 'split'        // Draggable curtain wiper (Base vs Target)
  | 'flicker'      // Rapid strobe comparison
  | 'edges'        // Sobel edge outline overlay
  | 'side_by_side';// Dual synchronized viewports

export type ToolMode =
  | 'move'         // Drag to position
  | 'rotate'       // Interactive rotation handle
  | 'scale'        // Interactive scale handles
  | 'landmarks';   // 2-point landmark pinning mode

export interface ExportSettings {
  format: 'image/png' | 'image/jpeg' | 'image/webp';
  quality: number;
  cropToBase: boolean; // Crop/expand all images to match base image dimensions
  enableFovCrop: boolean; // Whether to crop field of view (e.g. 80% FOV)
  cropFov: number; // Field of view percentage (e.g. 80 for 80% FOV, 100 for no crop)
  includeCroppedImages: boolean; // Include cropped images folder (e.g. cropped_images/)
  includeFullImages: boolean; // Include full aligned images folder (e.g. aligned_images_full/)
  includeImages: boolean; // Backwards compatible alias
  includeVideo: boolean; // Include stabilized video file in video/ folder
  videoFps: number; // Video playback FPS (e.g. 4, 6, 12, 24)
  videoLoops: number; // Number of sequence loops in video
  includeManifest: boolean; // Include JSON manifest with coordinates
}


export type AlignmentMode = 'ultra_max' | 'ai_gemini' | 'fast';

export interface OptimizationProgress {
  stage: string;
  iteration: number;
  maxIterations: number;
  currentScore: number;
  bestScore: number;
  currentTransform: ImageTransform;
}

export interface SimilarityMetrics {
  overall: number; // 0 - 100%
  zncc: number; // Zero-mean Normalized Cross-Correlation (0 - 100%)
  ssim: number; // Structural Similarity Index (0 - 100%)
  overlapAreaRatio: number; // Percentage of canvas where both frames overlap
}

