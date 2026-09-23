import React from 'react';
import { Layers, Play, Download, Sparkles, Upload, Gauge } from 'lucide-react';
import { ImageItem } from '../types/alignment';

interface HeaderProps {
  images: ImageItem[];
  currentIndex: number;
  onOpenFlipbook: () => void;
  onOpenExport: () => void;
  onAutoAlignAll: () => void;
  isAutoAligningAll: boolean;
  onUploadClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  images,
  currentIndex,
  onOpenFlipbook,
  onOpenExport,
  onAutoAlignAll,
  isAutoAligningAll,
  onUploadClick,
}) => {
  const currentImage = images[currentIndex];
  const nonBaseImages = images.filter((img) => !img.isBase);
  const alignedCount = images.filter((img) => img.isBase || img.status === 'aligned' || img.status === 'auto_aligned').length;

  // Compute sequence average overlap similarity
  const totalScore = nonBaseImages.reduce((sum, img) => sum + (img.score || 85), 0);
  const avgSimilarity = nonBaseImages.length > 0 ? totalScore / nonBaseImages.length : 100;

  return (
    <header className="h-14 border-b border-neutral-800 bg-neutral-900/90 backdrop-blur px-4 flex items-center justify-between shrink-0 select-none z-30">
      {/* Zone 1: Brand title wordmark */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
          <Layers className="w-4 h-4" />
        </div>
        <div>
          <span className="text-base font-semibold tracking-tight text-neutral-100">
            AlignForge
          </span>
          <span className="hidden sm:inline-block ml-2 text-xs text-neutral-400">
            Image Registration Studio
          </span>
        </div>
      </div>

      {/* Zone 2: Step & Pipeline Context (No pills, unboxed typography) */}
      <div className="hidden md:flex items-center gap-3 text-xs text-neutral-400">
        {images.length > 0 ? (
          <>
            <span className="text-neutral-200 font-medium">
              Image {currentIndex + 1} of {images.length}
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate max-w-[160px] text-neutral-300">
              {currentImage?.name || 'No selection'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-neutral-400">
              {alignedCount}/{images.length} aligned
            </span>
            {nonBaseImages.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1 font-mono tabular-nums text-emerald-400 font-medium">
                  <Gauge className="w-3 h-3 text-emerald-400" />
                  Avg Overlap: {avgSimilarity.toFixed(1)}%
                </span>
              </>
            )}
          </>
        ) : (
          <span>Upload images to begin one-by-one alignment</span>
        )}
      </div>

      {/* Zone 3: Primary Actions */}
      <div className="flex items-center gap-2">
        {images.length === 0 ? (
          <button
            onClick={onUploadClick}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded transition-colors shadow-sm cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Images</span>
          </button>
        ) : (
          <>
            <button
              onClick={onAutoAlignAll}
              disabled={isAutoAligningAll || images.length <= 1}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-indigo-200 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/80 rounded transition-colors disabled:opacity-40 whitespace-nowrap shadow-xs"
              title="Optimize all remaining images in queue for highest overlap similarity"
            >
              <Sparkles className={`w-3.5 h-3.5 text-indigo-400 ${isAutoAligningAll ? 'animate-spin' : ''}`} />
              <span>{isAutoAligningAll ? 'Maximizing Overlap...' : 'Maximize Overlap (All)'}</span>
            </button>

            <button
              onClick={onOpenFlipbook}
              disabled={images.length < 2}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded transition-colors disabled:opacity-40 whitespace-nowrap"
              title="Preview continuous flipbook animation to test stability"
            >
              <Play className="w-3.5 h-3.5 text-emerald-400" />
              <span>Flipbook</span>
            </button>

            <button
              onClick={onOpenExport}
              disabled={images.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded transition-colors disabled:opacity-40 whitespace-nowrap shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Series</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
};
