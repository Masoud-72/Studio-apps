import React, { useRef } from 'react';
import {
  Upload,
  Plus,
  Crown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  FolderPlus,
} from 'lucide-react';
import { ImageItem } from '../types/alignment';

interface FilmstripProps {
  images: ImageItem[];
  currentIndex: number;
  onSelectIndex: (index: number) => void;
  onUploadFiles: (files: FileList | File[]) => void;
  onSetAsBase: (index: number) => void;
  onDeleteImage: (index: number) => void;
  onLoadSample: (type: 'botanical' | 'architecture') => void;
  onClearAll: () => void;
}

export const Filmstrip: React.FC<FilmstripProps> = ({
  images,
  currentIndex,
  onSelectIndex,
  onUploadFiles,
  onSetAsBase,
  onDeleteImage,
  onLoadSample,
  onClearAll,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      onSelectIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      onSelectIndex(currentIndex + 1);
    }
  };

  return (
    <div className="h-28 border-b border-neutral-800 bg-neutral-900/60 flex items-center px-4 gap-3 shrink-0 select-none overflow-x-auto">
      {/* Upload button & Quick Queue Nav */}
      <div className="flex items-center gap-2 shrink-0 pr-3 border-r border-neutral-800">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleFileInput}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="h-20 w-24 rounded border border-dashed border-neutral-700 hover:border-indigo-500 bg-neutral-800/40 hover:bg-neutral-800 flex flex-col items-center justify-center gap-1.5 text-neutral-400 hover:text-indigo-300 transition-colors text-xs font-medium cursor-pointer"
          title="Add images to alignment queue"
        >
          <Upload className="w-4 h-4" />
          <span>Upload</span>
        </button>

        {images.length > 0 && (
          <div className="flex flex-col gap-1">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 disabled:opacity-30 transition-colors"
              title="Previous image (Arrow Left)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex >= images.length - 1}
              className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 disabled:opacity-30 transition-colors"
              title="Next image (Arrow Right)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Thumbnails Queue */}
      {images.length === 0 ? (
        <div className="flex-1 flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span>No images in queue. Drag & drop images here or load a sample dataset:</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onLoadSample('botanical')}
              className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors"
            >
              Load Botanical Series
            </button>
            <button
              onClick={() => onLoadSample('architecture')}
              className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors"
            >
              Load Architecture Series
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 overflow-x-auto py-1 flex-1">
          {images.map((img, idx) => {
            const isSelected = idx === currentIndex;
            const isBase = img.isBase || idx === 0;
            const isShifted =
              img.transform.x !== 0 ||
              img.transform.y !== 0 ||
              img.transform.rotation !== 0 ||
              img.transform.scaleX !== 1 ||
              img.transform.scaleY !== 1;

            return (
              <div
                key={img.id}
                onClick={() => onSelectIndex(idx)}
                className={`group relative h-20 w-32 shrink-0 rounded overflow-hidden cursor-pointer transition-all border ${
                  isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                    : isBase
                    ? 'border-indigo-800/80 bg-neutral-800/80'
                    : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900'
                }`}
              >
                {/* Thumbnail Image */}
                <img
                  src={img.src}
                  alt={img.name}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />

                {/* Base / Index Tag */}
                <div className="absolute top-1 left-1 flex items-center gap-1 z-10">
                  {isBase ? (
                    <span className="flex items-center gap-1 bg-indigo-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded shadow">
                      <Crown className="w-2.5 h-2.5" />
                      BASE
                    </span>
                  ) : (
                    <span className="bg-black/70 backdrop-blur-xs text-neutral-300 text-[10px] font-mono px-1.5 py-0.5 rounded">
                      #{idx + 1}
                    </span>
                  )}
                </div>

                {/* Status indicator on right */}
                <div className="absolute top-1 right-1 z-10">
                  {isBase ? (
                    <span className="w-2 h-2 rounded-full bg-indigo-400 block" title="Reference Base Image" />
                  ) : img.status === 'aligned' || img.status === 'auto_aligned' || isShifted ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 block" title="Aligned" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-amber-400 block" title="Pending Alignment" />
                  )}
                </div>

                {/* Bottom Overlay with stats */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent p-1 pt-3 text-[10px] text-neutral-300 flex items-center justify-between">
                  <span className="truncate max-w-[70px]" title={img.name}>
                    {img.name}
                  </span>
                  {!isBase && (
                    <span className="font-mono text-[9px] text-neutral-400 tabular-nums">
                      {isShifted ? `Δ${Math.round(img.transform.x)},${Math.round(img.transform.y)}` : '0,0'}
                    </span>
                  )}
                </div>

                {/* Hover Quick Actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 z-20">
                  {!isBase && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetAsBase(idx);
                      }}
                      className="px-1.5 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-medium rounded shadow flex items-center gap-1"
                      title="Make this the reference Base image for all other frames"
                    >
                      <Crown className="w-2.5 h-2.5" />
                      Set Base
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteImage(idx);
                    }}
                    className="p-1 bg-red-950 hover:bg-red-800 text-red-300 rounded"
                    title="Remove from queue"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Clear All option */}
      {images.length > 0 && (
        <div className="shrink-0 pl-2 border-l border-neutral-800">
          <button
            onClick={onClearAll}
            className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors whitespace-nowrap"
            title="Clear all uploaded images"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
};
