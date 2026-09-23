import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload,
  Layers,
  Sparkles,
  Crown,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  FolderOpen,
} from 'lucide-react';
import {
  ImageItem,
  ViewMode,
  ToolMode,
  Point2D,
  ImageTransform,
  AlignmentMode,
  OptimizationProgress,
  SimilarityMetrics,
} from './types/alignment';
import { Header } from './components/Header';
import { Filmstrip } from './components/Filmstrip';
import { AlignmentViewport } from './components/AlignmentViewport';
import { ControlPanel } from './components/ControlPanel';
import { FlipbookModal } from './components/FlipbookModal';
import { ExportModal } from './components/ExportModal';
import {
  calculate2PointTransform,
  autoAlignImages,
  calculateSimilarity,
  calculateDetailedMetrics,
  optimizeForHighestOverlapSimilarity,
  aiGeminiFeatureAlign,
} from './utils/alignmentAlgorithms';
import { loadImage } from './utils/exportUtils';

export default function App() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<ViewMode>('onion');
  const [toolMode, setToolMode] = useState<ToolMode>('move');

  // Highest Overlap Similarity state
  const [alignmentMode, setAlignmentMode] = useState<AlignmentMode>('ultra_max');
  const [optimizationProgress, setOptimizationProgress] = useState<OptimizationProgress | null>(null);
  const [similarityMetrics, setSimilarityMetrics] = useState<SimilarityMetrics | null>(null);

  const [isAutoAligningCurrent, setIsAutoAligningCurrent] = useState(false);
  const [isAutoAligningAll, setIsAutoAligningAll] = useState(false);
  const [isFlipbookOpen, setIsFlipbookOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Hidden file input ref for top-level uploads
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cache loaded HTMLImageElements for fast real-time metric computation
  const loadedImagesMap = useRef<Map<string, HTMLImageElement>>(new Map());

  // Current Base Reference Image is always image 0 or marked isBase
  const baseImage = images.length > 0 ? images.find((img) => img.isBase) || images[0] : null;
  const currentImage = images[currentIndex] || null;

  // Pre-cache HTMLImageElements
  useEffect(() => {
    images.forEach(async (img) => {
      if (!loadedImagesMap.current.has(img.id)) {
        try {
          const el = await loadImage(img.src);
          loadedImagesMap.current.set(img.id, el);
        } catch {
          // ignore
        }
      }
    });
  }, [images]);

  // Compute live detailed similarity metrics whenever active image or its transform changes
  useEffect(() => {
    if (!baseImage || !currentImage || currentImage.isBase) {
      setSimilarityMetrics(null);
      return;
    }

    const baseEl = loadedImagesMap.current.get(baseImage.id);
    const targetEl = loadedImagesMap.current.get(currentImage.id);

    if (baseEl && targetEl) {
      const metrics = calculateDetailedMetrics(baseEl, targetEl, currentImage.transform, 160);
      setSimilarityMetrics(metrics);
    }
  }, [baseImage, currentImage, currentImage?.transform]);

  // Upload handler for user files
  const handleUploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newItems: ImageItem[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      if (!file.type.startsWith('image/')) continue;

      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise((resolve) => {
        img.onload = resolve;
        img.src = url;
      });

      const isFirstEver = images.length === 0 && i === 0;

      newItems.push({
        id: `img_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
        name: file.name,
        src: url,
        width: img.naturalWidth || 1200,
        height: img.naturalHeight || 800,
        aspectRatio: (img.naturalWidth || 1200) / (img.naturalHeight || 800),
        fileSize: file.size,
        isBase: isFirstEver,
        transform: {
          x: 0,
          y: 0,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          flipH: false,
          flipV: false,
        },
        landmarks: [
          { id: 'p1', x: Math.round(img.naturalWidth * 0.35), y: Math.round(img.naturalHeight * 0.4), label: 'Point A' },
          { id: 'p2', x: Math.round(img.naturalWidth * 0.65), y: Math.round(img.naturalHeight * 0.6), label: 'Point B' },
        ],
        status: isFirstEver ? 'aligned' : 'pending',
      });
    }

    if (newItems.length > 0) {
      setImages((prev) => {
        const combined = [...prev, ...newItems];
        if (!combined.some((img) => img.isBase)) {
          combined[0].isBase = true;
          combined[0].status = 'aligned';
        }
        return combined;
      });

      if (images.length === 0) {
        setCurrentIndex(newItems.length > 1 ? 1 : 0);
      }
    }
  };

  // Set selected image as the new Master Base
  const handleSetAsBase = (index: number) => {
    setImages((prev) =>
      prev.map((img, i) => ({
        ...img,
        isBase: i === index,
        status: i === index ? 'aligned' : img.status,
        transform:
          i === index
            ? { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, flipH: false, flipV: false }
            : img.transform,
      }))
    );
  };

  // Delete image
  const handleDeleteImage = (index: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some((img) => img.isBase)) {
        next[0].isBase = true;
        next[0].status = 'aligned';
      }
      return next;
    });
    if (currentIndex >= images.length - 1) {
      setCurrentIndex(Math.max(0, images.length - 2));
    }
  };

  // Update transform for current target image
  const handleUpdateTransform = useCallback(
    (partial: Partial<ImageTransform>) => {
      if (!currentImage || currentImage.isBase) return;

      setImages((prev) => {
        const next = [...prev];
        const active = next[currentIndex];
        if (!active) return prev;

        const updatedTransform = { ...active.transform, ...partial };

        let score = active.score;
        const baseEl = baseImage ? loadedImagesMap.current.get(baseImage.id) : null;
        const targetEl = loadedImagesMap.current.get(active.id);
        if (baseEl && targetEl) {
          score = calculateSimilarity(baseEl, targetEl, updatedTransform);
        }

        next[currentIndex] = {
          ...active,
          transform: updatedTransform,
          score,
          status: 'aligned',
        };
        return next;
      });
    },
    [currentImage, currentIndex, baseImage]
  );

  // Reset transform
  const handleResetTransform = () => {
    handleUpdateTransform({
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      flipH: false,
      flipV: false,
    });
  };

  // Update landmark point
  const handleUpdateLandmark = (pointIndex: number, point: Point2D, isBase: boolean) => {
    setImages((prev) => {
      const next = [...prev];
      const targetItem = isBase ? baseImage : currentImage;
      if (!targetItem) return prev;

      const itemIndex = next.findIndex((img) => img.id === targetItem.id);
      if (itemIndex === -1) return prev;

      const landmarks = [...(targetItem.landmarks || [])];
      landmarks[pointIndex] = {
        id: `p${pointIndex + 1}`,
        x: point.x,
        y: point.y,
        label: pointIndex === 0 ? 'Point A' : 'Point B',
      };

      next[itemIndex] = { ...targetItem, landmarks };
      return next;
    });
  };

  // 2-Point Landmark Pinning: solve scale, rotation, translation
  const handleCalculateLandmarkTransform = () => {
    if (!baseImage || !currentImage || currentImage.isBase) return;
    const bPts = baseImage.landmarks;
    const tPts = currentImage.landmarks;
    if (!bPts || bPts.length < 2 || !tPts || tPts.length < 2) return;

    const solvedTransform = calculate2PointTransform(
      bPts[0],
      bPts[1],
      tPts[0],
      tPts[1],
      baseImage.width,
      baseImage.height,
      currentImage.width,
      currentImage.height
    );

    handleUpdateTransform(solvedTransform);
    setToolMode('move');
  };

  // HIGHEST OVERLAP SIMILARITY OPTIMIZER (Single Image)
  const handleOptimizeHighestOverlap = async (mode: AlignmentMode = alignmentMode) => {
    if (!baseImage || !currentImage || currentImage.isBase || isAutoAligningCurrent) return;

    setIsAutoAligningCurrent(true);
    try {
      let baseEl = loadedImagesMap.current.get(baseImage.id);
      if (!baseEl) {
        baseEl = await loadImage(baseImage.src);
        loadedImagesMap.current.set(baseImage.id, baseEl);
      }

      let targetEl = loadedImagesMap.current.get(currentImage.id);
      if (!targetEl) {
        targetEl = await loadImage(currentImage.src);
        loadedImagesMap.current.set(currentImage.id, targetEl);
      }

      const onProgress = (p: OptimizationProgress) => {
        setOptimizationProgress(p);
        // Real-time canvas transform update during optimization
        setImages((prev) => {
          const next = [...prev];
          if (next[currentIndex]) {
            next[currentIndex] = {
              ...next[currentIndex],
              transform: p.currentTransform,
              score: p.currentScore,
            };
          }
          return next;
        });
      };

      if (mode === 'ai_gemini') {
        const result = await aiGeminiFeatureAlign(baseEl, targetEl, onProgress);
        setImages((prev) => {
          const next = [...prev];
          if (next[currentIndex]) {
            next[currentIndex] = {
              ...next[currentIndex],
              transform: result.transform,
              score: result.metrics.overall,
              status: 'auto_aligned',
            };
          }
          return next;
        });
        setSimilarityMetrics(result.metrics);
      } else {
        const result = await optimizeForHighestOverlapSimilarity(
          baseEl,
          targetEl,
          currentImage.transform,
          { searchRotation: true, searchScale: true, maxIterations: mode === 'fast' ? 20 : 45 },
          onProgress
        );
        setImages((prev) => {
          const next = [...prev];
          if (next[currentIndex]) {
            next[currentIndex] = {
              ...next[currentIndex],
              transform: result.transform,
              score: result.metrics.overall,
              status: 'auto_aligned',
            };
          }
          return next;
        });
        setSimilarityMetrics(result.metrics);
      }
    } catch (err) {
      console.error('Optimization failed:', err);
    } finally {
      setIsAutoAligningCurrent(false);
      setOptimizationProgress(null);
    }
  };

  // HIGHEST OVERLAP SIMILARITY OPTIMIZER (All Remaining Images Sequentially)
  const handleAutoAlignAll = async () => {
    if (!baseImage || images.length <= 1 || isAutoAligningAll) return;

    setIsAutoAligningAll(true);
    try {
      let baseEl = loadedImagesMap.current.get(baseImage.id);
      if (!baseEl) {
        baseEl = await loadImage(baseImage.src);
        loadedImagesMap.current.set(baseImage.id, baseEl);
      }

      for (let i = 0; i < images.length; i++) {
        const item = images[i];
        if (item.isBase) continue;

        setCurrentIndex(i);

        let targetEl = loadedImagesMap.current.get(item.id);
        if (!targetEl) {
          targetEl = await loadImage(item.src);
          loadedImagesMap.current.set(item.id, targetEl);
        }

        const result = await optimizeForHighestOverlapSimilarity(
          baseEl,
          targetEl,
          item.transform,
          { searchRotation: true, searchScale: true, maxIterations: 35 },
          (p) => {
            setOptimizationProgress(p);
            setImages((prev) => {
              const next = [...prev];
              if (next[i]) {
                next[i] = {
                  ...next[i],
                  transform: p.currentTransform,
                  score: p.currentScore,
                };
              }
              return next;
            });
          }
        );

        setImages((prev) => {
          const next = [...prev];
          next[i] = {
            ...next[i],
            transform: result.transform,
            score: result.metrics.overall,
            status: 'auto_aligned',
          };
          return next;
        });
      }
    } catch (err) {
      console.error('Auto align all error:', err);
    } finally {
      setIsAutoAligningAll(false);
      setOptimizationProgress(null);
    }
  };

  // Confirm alignment and advance to next image in queue
  const handleConfirmAndNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setIsFlipbookOpen(true);
    }
  };

  // Copy current transform onto next image (useful for steady camera drift)
  const handleApplyToNext = () => {
    if (currentIndex < images.length - 1 && currentImage) {
      const nextIdx = currentIndex + 1;
      setImages((prev) => {
        const next = [...prev];
        next[nextIdx] = {
          ...next[nextIdx],
          transform: { ...currentImage.transform },
          status: 'aligned',
        };
        return next;
      });
      setCurrentIndex(nextIdx);
    }
  };

  // Drag & drop handlers on full viewport
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex flex-col h-screen w-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans select-none"
    >
      {/* Hidden file input for global upload triggers */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleUploadFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Top Bar Contract Header */}
      <Header
        images={images}
        currentIndex={currentIndex}
        onOpenFlipbook={() => setIsFlipbookOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onAutoAlignAll={handleAutoAlignAll}
        isAutoAligningAll={isAutoAligningAll}
        onUploadClick={() => fileInputRef.current?.click()}
      />

      {/* Sequential Image Queue Filmstrip */}
      <Filmstrip
        images={images}
        currentIndex={currentIndex}
        onSelectIndex={setCurrentIndex}
        onUploadFiles={handleUploadFiles}
        onSetAsBase={handleSetAsBase}
        onDeleteImage={handleDeleteImage}
        onClearAll={() => {
          setImages([]);
          setCurrentIndex(0);
        }}
      />

      {/* Main Workspace: Center Canvas Viewport + Right Control Panel */}
      <div className="flex-1 flex overflow-hidden relative">
        <AlignmentViewport
          baseImage={baseImage}
          targetImage={currentImage}
          currentIndex={currentIndex}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          toolMode={toolMode}
          onChangeToolMode={setToolMode}
          onUpdateTransform={handleUpdateTransform}
          onUpdateLandmark={handleUpdateLandmark}
          onAutoAlignCurrent={() => handleOptimizeHighestOverlap(alignmentMode)}
          isAutoAligning={isAutoAligningCurrent}
          onUploadClick={() => fileInputRef.current?.click()}
        />

        <ControlPanel
          baseImage={baseImage}
          targetImage={currentImage}
          currentIndex={currentIndex}
          totalImages={images.length}
          toolMode={toolMode}
          onChangeToolMode={setToolMode}
          onUpdateTransform={handleUpdateTransform}
          onResetTransform={handleResetTransform}
          onAutoAlign={() => handleOptimizeHighestOverlap(alignmentMode)}
          isAutoAligning={isAutoAligningCurrent}
          onConfirmAndNext={handleConfirmAndNext}
          onApplyToNext={handleApplyToNext}
          onCalculateLandmarkTransform={handleCalculateLandmarkTransform}
          alignmentMode={alignmentMode}
          onChangeAlignmentMode={setAlignmentMode}
          onOptimizeHighestOverlap={handleOptimizeHighestOverlap}
          isOptimizing={isAutoAligningCurrent}
          optimizationProgress={optimizationProgress}
          similarityMetrics={similarityMetrics}
        />

        {/* Drag & Drop Visual Overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-50 bg-indigo-950/80 backdrop-blur-xs border-2 border-dashed border-indigo-400 flex flex-col items-center justify-center pointer-events-none">
            <Upload className="w-12 h-12 text-indigo-300 animate-bounce mb-2" />
            <p className="text-base font-semibold text-neutral-100">
              Drop images to add to the alignment queue
            </p>
            <p className="text-xs text-indigo-300 mt-1">
              Supports JPG, PNG, WEBP multi-file uploads
            </p>
          </div>
        )}
      </div>

      {/* Flipbook Continuous Animation Preview Modal */}
      <FlipbookModal
        isOpen={isFlipbookOpen}
        onClose={() => setIsFlipbookOpen(false)}
        images={images}
        baseImage={baseImage}
      />

      {/* Export Modal (ZIP archive, formats, manifest) */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        images={images}
        baseImage={baseImage}
        currentImage={currentImage}
      />
    </div>
  );
}
