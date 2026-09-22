/**
 * Built-in sample datasets for immediate testing and demonstration
 */

import { ImageItem } from '../types/alignment';

// Asset paths generated via generate_image
const BOTANICAL_PATH = '/src/assets/images/sample_botanical_leaf_1790111497831.jpg';
const ARCHITECTURE_PATH = '/src/assets/images/sample_building_facade_1790111509250.jpg';

/**
 * Creates shifted variants from a source image to simulate handheld multi-shot camera drift
 */
async function createDriftFrames(
  srcUrl: string,
  baseName: string,
  drifts: Array<{ dx: number; dy: number; rot: number; scale: number; name: string }>
): Promise<ImageItem[]> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = srcUrl;
  });

  const w = img.naturalWidth || 800;
  const h = img.naturalHeight || 600;

  const items: ImageItem[] = [];

  // Frame 1: Master Base Reference
  items.push({
    id: `base_${Date.now()}_0`,
    name: `${baseName}_01_REF.jpg`,
    src: srcUrl,
    width: w,
    height: h,
    aspectRatio: w / h,
    isBase: true,
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, flipH: false, flipV: false },
    landmarks: [
      { id: 'p1', x: Math.round(w * 0.35), y: Math.round(h * 0.4), label: 'Anchor A' },
      { id: 'p2', x: Math.round(w * 0.65), y: Math.round(h * 0.6), label: 'Anchor B' },
    ],
    status: 'aligned',
    score: 100,
  });

  // Generate shifted variants
  for (let i = 0; i < drifts.length; i++) {
    const drift = drifts[i];
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Draw shifted onto canvas
    ctx.save();
    ctx.translate(w / 2 + drift.dx, h / 2 + drift.dy);
    ctx.rotate((drift.rot * Math.PI) / 180);
    ctx.scale(drift.scale, drift.scale);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    items.push({
      id: `target_${Date.now()}_${i + 1}`,
      name: `${baseName}_0${i + 2}_${drift.name}.jpg`,
      src: dataUrl,
      width: w,
      height: h,
      aspectRatio: w / h,
      isBase: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, flipH: false, flipV: false },
      landmarks: [
        { id: 'p1', x: Math.round(w * 0.35 + drift.dx), y: Math.round(h * 0.4 + drift.dy), label: 'Target A' },
        { id: 'p2', x: Math.round(w * 0.65 + drift.dx), y: Math.round(h * 0.6 + drift.dy), label: 'Target B' },
      ],
      status: 'pending',
    });
  }

  return items;
}

export async function loadSampleDataset(type: 'botanical' | 'architecture'): Promise<ImageItem[]> {
  if (type === 'botanical') {
    return createDriftFrames(BOTANICAL_PATH, 'Monstera_Specimen', [
      { dx: 18, dy: -12, rot: 1.5, scale: 1.015, name: 'Shift_A' },
      { dx: -15, dy: 22, rot: -2.0, scale: 0.99, name: 'Shift_B' },
      { dx: 26, dy: 14, rot: 0.8, scale: 1.01, name: 'Shift_C' },
    ]);
  } else {
    return createDriftFrames(ARCHITECTURE_PATH, 'Facade_Grid', [
      { dx: -24, dy: -16, rot: -1.2, scale: 1.02, name: 'Perspective_A' },
      { dx: 20, dy: 28, rot: 1.8, scale: 0.985, name: 'Perspective_B' },
    ]);
  }
}
