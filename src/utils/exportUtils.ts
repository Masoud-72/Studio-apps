/**
 * Export and rendering utilities:
 * - High-resolution canvas rendering with affine transforms
 * - 80% Field of View (FOV) center crop (trims edge gaps and rotation borders)
 * - Stabilized video recording via Canvas MediaRecorder
 * - Bundled ZIP export with organized 'cropped_images/', 'aligned_images_full/', and 'video/' folders
 * - Direct local folder export via Web File System Access API (showDirectoryPicker)
 * - Single image downloads for both cropped and full-frame aligned images
 * - Alignment JSON manifest generation
 */

import JSZip from 'jszip';
import { ImageItem, ExportSettings } from '../types/alignment';

/**
 * Loads an HTMLImageElement from a URL
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Renders an aligned image onto a target canvas sized to match the base image,
 * with optional Field of View (FOV) crop (e.g. 80% FOV to remove edge voids).
 */
export async function renderAlignedCanvas(
  baseItem: ImageItem,
  targetItem: ImageItem,
  cropFov: number = 100
): Promise<HTMLCanvasElement> {
  const targetImg = await loadImage(targetItem.src);
  const baseW = baseItem.width;
  const baseH = baseItem.height;

  // Intermediate full-resolution canvas matching base dimensions
  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = baseW;
  fullCanvas.height = baseH;

  const ctx = fullCanvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (targetItem.id === baseItem.id) {
    // Base image itself
    ctx.drawImage(targetImg, 0, 0, baseW, baseH);
  } else {
    const { x, y, rotation, scaleX, scaleY, flipH, flipV } = targetItem.transform;

    ctx.save();
    // Transform originates at center of base reference frame
    ctx.translate(baseW / 2 + x, baseH / 2 + y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scaleX * (flipH ? -1 : 1), scaleY * (flipV ? -1 : 1));

    // Draw target image centered
    ctx.drawImage(
      targetImg,
      -targetItem.width / 2,
      -targetItem.height / 2,
      targetItem.width,
      targetItem.height
    );
    ctx.restore();
  }

  // If 100% FOV (no crop requested), return full canvas
  if (cropFov >= 99.9) {
    return fullCanvas;
  }

  // Field of View Crop: Extract center (cropFov)% of canvas
  const fovRatio = Math.max(0.1, Math.min(1, cropFov / 100));
  const cropW = Math.round(baseW * fovRatio);
  const cropH = Math.round(baseH * fovRatio);
  const cropX = Math.round((baseW - cropW) / 2);
  const cropY = Math.round((baseH - cropH) / 2);

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropW;
  croppedCanvas.height = cropH;

  const croppedCtx = croppedCanvas.getContext('2d')!;
  croppedCtx.imageSmoothingEnabled = true;
  croppedCtx.imageSmoothingQuality = 'high';

  croppedCtx.drawImage(
    fullCanvas,
    cropX,
    cropY,
    cropW,
    cropH,
    0,
    0,
    cropW,
    cropH
  );

  return croppedCanvas;
}

/**
 * Exports a single image to Blob with FOV crop
 */
export async function exportSingleImageBlob(
  baseItem: ImageItem,
  targetItem: ImageItem,
  format: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/png',
  quality: number = 0.95,
  cropFov: number = 100
): Promise<Blob> {
  const canvas = await renderAlignedCanvas(baseItem, targetItem, cropFov);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      },
      format,
      quality
    );
  });
}

/**
 * Directly downloads a single image (either 80% FOV cropped or full frame)
 */
export async function downloadSingleImage(
  baseItem: ImageItem,
  targetItem: ImageItem,
  isCropped: boolean = true,
  cropFov: number = 80,
  format: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/png',
  quality: number = 0.95
): Promise<void> {
  const fov = isCropped ? cropFov : 100;
  const blob = await exportSingleImageBlob(baseItem, targetItem, format, quality, fov);
  const ext = format === 'image/png' ? 'png' : format === 'image/webp' ? 'webp' : 'jpg';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cropTag = isCropped ? `_cropped_${fov}fov` : '_aligned_full';
  a.download = `${targetItem.name.replace(/\.[^/.]+$/, '')}${cropTag}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Records a stabilized video/animation of the aligned sequence playing smoothly
 * with FOV crop applied so borders remain perfectly clean.
 */
export async function recordSequenceVideo(
  images: ImageItem[],
  baseItem: ImageItem,
  fps: number = 6,
  loops: number = 3,
  cropFov: number = 100,
  onProgress?: (progress: number, message: string) => void
): Promise<Blob> {
  const renderedFrames: HTMLCanvasElement[] = [];
  for (let i = 0; i < images.length; i++) {
    if (onProgress) {
      onProgress(
        Math.round(((i + 1) / images.length) * 40),
        `Rendering video frame ${i + 1} of ${images.length} (${cropFov}% FOV)...`
      );
    }
    const frameCanvas = await renderAlignedCanvas(baseItem, images[i], cropFov);
    renderedFrames.push(frameCanvas);
  }

  const frameW = renderedFrames[0].width;
  const frameH = renderedFrames[0].height;

  const animCanvas = document.createElement('canvas');
  animCanvas.width = frameW;
  animCanvas.height = frameH;
  const animCtx = animCanvas.getContext('2d')!;

  const stream = animCanvas.captureStream(fps);

  let mimeType = 'video/webm';
  if (typeof MediaRecorder !== 'undefined') {
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      mimeType = 'video/webm;codecs=vp9';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
      mimeType = 'video/webm;codecs=vp8';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      mimeType = 'video/webm';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    }
  }

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 6000000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }));
    };

    recorder.onerror = (e) => {
      reject(e);
    };

    recorder.start();

    let frameIndex = 0;
    const totalFrames = images.length * loops;
    const intervalMs = Math.round(1000 / fps);

    const intervalId = setInterval(() => {
      if (frameIndex >= totalFrames) {
        clearInterval(intervalId);
        recorder.stop();
        return;
      }

      const activeCanvas = renderedFrames[frameIndex % images.length];
      animCtx.clearRect(0, 0, frameW, frameH);
      animCtx.drawImage(activeCanvas, 0, 0);

      if (onProgress) {
        const pct = 40 + Math.round((frameIndex / totalFrames) * 60);
        onProgress(pct, `Encoding video frame ${frameIndex + 1} of ${totalFrames}...`);
      }

      frameIndex++;
    }, intervalMs);
  });
}

/**
 * Batch exports images and stabilized video packaged into organized folders inside a ZIP archive.
 * Folder structure:
 *  - cropped_images/ (80% FOV cropped images)
 *  - aligned_images_full/ (Full frame intact aligned images)
 *  - video/ (Stabilized loop video)
 *  - alignment_manifest.json (Coordinates & crop parameters)
 */
export async function exportAllImagesAsZip(
  images: ImageItem[],
  baseItem: ImageItem,
  settings: ExportSettings,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<void> {
  const zip = new JSZip();
  const effectiveFov = settings.enableFovCrop ? settings.cropFov : 80;

  const extMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
  };
  const ext = extMap[settings.format] || 'png';

  const manifestData: Record<string, unknown>[] = [];
  const includeCropped = settings.includeCroppedImages !== false; // Default true
  const includeFull = settings.includeFullImages !== false;       // Default true

  const stepsPerImage = (includeCropped ? 1 : 0) + (includeFull ? 1 : 0);
  const totalSteps = images.length * stepsPerImage + (settings.includeVideo ? 5 : 0) + 2;
  let currentStep = 0;

  // 1. Folder: cropped_images/ (Cropped to requested FOV, e.g. 80%)
  if (includeCropped) {
    const croppedFolder = zip.folder('cropped_images') || zip;

    for (let i = 0; i < images.length; i++) {
      currentStep++;
      const item = images[i];
      const indexStr = String(i + 1).padStart(2, '0');
      const isBase = item.id === baseItem.id;
      const filename = `${indexStr}_${isBase ? 'BASE_' : 'aligned_'}${item.name.replace(/\.[^/.]+$/, '')}_cropped_${effectiveFov}fov.${ext}`;

      if (onProgress) {
        onProgress(
          currentStep,
          totalSteps,
          `Rendering cropped_images/${filename} (${effectiveFov}% FOV)...`
        );
      }

      const blob = await exportSingleImageBlob(
        baseItem,
        item,
        settings.format,
        settings.quality,
        effectiveFov
      );
      croppedFolder.file(filename, blob);
    }
  }

  // 2. Folder: aligned_images_full/ (Full intact frame 100% FOV)
  if (includeFull) {
    const fullFolder = zip.folder('aligned_images_full') || zip;

    for (let i = 0; i < images.length; i++) {
      currentStep++;
      const item = images[i];
      const indexStr = String(i + 1).padStart(2, '0');
      const isBase = item.id === baseItem.id;
      const filename = `${indexStr}_${isBase ? 'BASE_' : 'aligned_'}${item.name.replace(/\.[^/.]+$/, '')}_full.${ext}`;

      if (onProgress) {
        onProgress(
          currentStep,
          totalSteps,
          `Rendering aligned_images_full/${filename}...`
        );
      }

      const blob = await exportSingleImageBlob(
        baseItem,
        item,
        settings.format,
        settings.quality,
        100 // 100% full frame
      );
      fullFolder.file(filename, blob);

      manifestData.push({
        index: i + 1,
        fullFilename: `aligned_images_full/${filename}`,
        croppedFilename: includeCropped
          ? `cropped_images/${indexStr}_${isBase ? 'BASE_' : 'aligned_'}${item.name.replace(/\.[^/.]+$/, '')}_cropped_${effectiveFov}fov.${ext}`
          : undefined,
        originalName: item.name,
        isBaseReference: isBase,
        transform: isBase
          ? { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
          : item.transform,
        similarityScore: item.score || (isBase ? 100 : undefined),
      });
    }
  }

  // 3. Folder: video/ (Stabilized video)
  if (settings.includeVideo && images.length >= 2) {
    currentStep += 2;
    if (onProgress) {
      onProgress(currentStep, totalSteps, `Recording stabilized video (${effectiveFov}% FOV)...`);
    }

    const videoFolder = zip.folder('video') || zip;

    // Cropped stabilized video
    const videoBlobCropped = await recordSequenceVideo(
      images,
      baseItem,
      settings.videoFps || 6,
      settings.videoLoops || 3,
      effectiveFov,
      (pct, msg) => {
        if (onProgress) onProgress(currentStep, totalSteps, msg);
      }
    );
    videoFolder.file(`aligned_sequence_cropped_${effectiveFov}fov.webm`, videoBlobCropped);
  }

  // 4. Manifest JSON
  if (settings.includeManifest) {
    const cropW = Math.round(baseItem.width * (effectiveFov / 100));
    const cropH = Math.round(baseItem.height * (effectiveFov / 100));

    const manifestJson = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        software: 'AlignForge Image Registration Studio',
        fieldOfViewCrop: {
          percentage: effectiveFov,
          originalDimensions: { width: baseItem.width, height: baseItem.height },
          croppedDimensions: { width: cropW, height: cropH },
          description: `Cropped to center ${effectiveFov}% field of view to eliminate rotation/translation boundary artifacts.`,
        },
        folders: {
          croppedImages: includeCropped ? 'cropped_images/' : null,
          fullImages: includeFull ? 'aligned_images_full/' : null,
          video: settings.includeVideo ? 'video/' : null,
        },
        baseImage: {
          name: baseItem.name,
          width: baseItem.width,
          height: baseItem.height,
        },
        images: manifestData,
      },
      null,
      2
    );
    zip.file('alignment_manifest.json', manifestJson);
  }

  currentStep++;
  if (onProgress) {
    onProgress(totalSteps, totalSteps, 'Compressing archive with images & video folders...');
  }

  const zipContent = await zip.generateAsync({ type: 'blob' }, (metadata) => {
    if (onProgress) {
      onProgress(
        totalSteps,
        totalSteps,
        `Packaging ZIP (${Math.round(metadata.percent)}%)...`
      );
    }
  });

  const url = URL.createObjectURL(zipContent);
  const a = document.createElement('a');
  a.href = url;
  a.download = `alignforge_bundle_${effectiveFov}fov_${Date.now()}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Saves images and video directly into a real folder on the user's computer
 * using the HTML5 File System Access API (showDirectoryPicker).
 */
export async function exportDirectlyToFolder(
  images: ImageItem[],
  baseItem: ImageItem,
  settings: ExportSettings,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<boolean> {
  if (typeof (window as any).showDirectoryPicker !== 'function') {
    throw new Error('DIRECT_FOLDER_NOT_SUPPORTED');
  }

  const effectiveFov = settings.enableFovCrop ? settings.cropFov : 80;
  const rootDirHandle = await (window as any).showDirectoryPicker({
    mode: 'readwrite',
  });

  const extMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
  };
  const ext = extMap[settings.format] || 'png';
  const manifestData: Record<string, unknown>[] = [];

  const includeCropped = settings.includeCroppedImages !== false;
  const includeFull = settings.includeFullImages !== false;
  const stepsPerImage = (includeCropped ? 1 : 0) + (includeFull ? 1 : 0);
  const totalSteps = images.length * stepsPerImage + (settings.includeVideo ? 5 : 0) + 1;
  let currentStep = 0;

  // 1. Write cropped images into 'cropped_images' folder
  if (includeCropped) {
    const croppedDirHandle = await rootDirHandle.getDirectoryHandle('cropped_images', { create: true });

    for (let i = 0; i < images.length; i++) {
      currentStep++;
      const item = images[i];
      const indexStr = String(i + 1).padStart(2, '0');
      const isBase = item.id === baseItem.id;
      const filename = `${indexStr}_${isBase ? 'BASE_' : 'aligned_'}${item.name.replace(/\.[^/.]+$/, '')}_cropped_${effectiveFov}fov.${ext}`;

      if (onProgress) {
        onProgress(currentStep, totalSteps, `Writing cropped_images/${filename}...`);
      }

      const blob = await exportSingleImageBlob(
        baseItem,
        item,
        settings.format,
        settings.quality,
        effectiveFov
      );

      const fileHandle = await croppedDirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    }
  }

  // 2. Write full intact images into 'aligned_images_full' folder
  if (includeFull) {
    const fullDirHandle = await rootDirHandle.getDirectoryHandle('aligned_images_full', { create: true });

    for (let i = 0; i < images.length; i++) {
      currentStep++;
      const item = images[i];
      const indexStr = String(i + 1).padStart(2, '0');
      const isBase = item.id === baseItem.id;
      const filename = `${indexStr}_${isBase ? 'BASE_' : 'aligned_'}${item.name.replace(/\.[^/.]+$/, '')}_full.${ext}`;

      if (onProgress) {
        onProgress(currentStep, totalSteps, `Writing aligned_images_full/${filename}...`);
      }

      const blob = await exportSingleImageBlob(
        baseItem,
        item,
        settings.format,
        settings.quality,
        100
      );

      const fileHandle = await fullDirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      manifestData.push({
        index: i + 1,
        fullFilename: `aligned_images_full/${filename}`,
        croppedFilename: includeCropped
          ? `cropped_images/${indexStr}_${isBase ? 'BASE_' : 'aligned_'}${item.name.replace(/\.[^/.]+$/, '')}_cropped_${effectiveFov}fov.${ext}`
          : undefined,
        originalName: item.name,
        isBaseReference: isBase,
        transform: isBase
          ? { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
          : item.transform,
        similarityScore: item.score || (isBase ? 100 : undefined),
      });
    }
  }

  // 3. Write video into 'video' folder
  if (settings.includeVideo && images.length >= 2) {
    currentStep += 2;
    if (onProgress) {
      onProgress(currentStep, totalSteps, `Encoding stabilized video (${effectiveFov}% FOV)...`);
    }

    const videoDirHandle = await rootDirHandle.getDirectoryHandle('video', { create: true });
    const videoBlob = await recordSequenceVideo(
      images,
      baseItem,
      settings.videoFps || 6,
      settings.videoLoops || 3,
      effectiveFov,
      (pct, msg) => {
        if (onProgress) onProgress(currentStep, totalSteps, msg);
      }
    );

    const videoFilename = `aligned_sequence_cropped_${effectiveFov}fov.webm`;
    const videoFileHandle = await videoDirHandle.getFileHandle(videoFilename, { create: true });
    const videoWritable = await videoFileHandle.createWritable();
    await videoWritable.write(videoBlob);
    await videoWritable.close();
  }

  // 4. Write alignment_manifest.json
  if (settings.includeManifest) {
    const cropW = Math.round(baseItem.width * (effectiveFov / 100));
    const cropH = Math.round(baseItem.height * (effectiveFov / 100));

    const manifestContent = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        software: 'AlignForge Image Registration Studio',
        fieldOfViewCrop: {
          percentage: effectiveFov,
          originalDimensions: { width: baseItem.width, height: baseItem.height },
          croppedDimensions: { width: cropW, height: cropH },
        },
        folders: {
          croppedImages: includeCropped ? 'cropped_images/' : null,
          fullImages: includeFull ? 'aligned_images_full/' : null,
          video: settings.includeVideo ? 'video/' : null,
        },
        baseImage: {
          name: baseItem.name,
          width: baseItem.width,
          height: baseItem.height,
        },
        images: manifestData,
      },
      null,
      2
    );

    const manifestFileHandle = await rootDirHandle.getFileHandle('alignment_manifest.json', { create: true });
    const manifestWritable = await manifestFileHandle.createWritable();
    await manifestWritable.write(manifestContent);
    await manifestWritable.close();
  }

  if (onProgress) {
    onProgress(totalSteps, totalSteps, 'All files saved successfully to your folder!');
  }

  return true;
}
