import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Video,
  Check,
  Sparkles,
  Crop,
  Download,
} from 'lucide-react';
import { ImageItem } from '../types/alignment';
import { renderAlignedCanvas, recordSequenceVideo } from '../utils/exportUtils';

interface FlipbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: ImageItem[];
  baseImage: ImageItem | null;
}

export const FlipbookModal: React.FC<FlipbookModalProps> = ({
  isOpen,
  onClose,
  images,
  baseImage,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [fps, setFps] = useState(6);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [showAligned, setShowAligned] = useState(true);
  const [enableFovCrop, setEnableFovCrop] = useState<boolean>(true); // 80% FOV crop active by default
  const [cropFov, setCropFov] = useState<number>(80);
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [recordStatusMsg, setRecordStatusMsg] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderedFramesRef = useRef<{ aligned: HTMLCanvasElement[]; raw: HTMLCanvasElement[] }>({
    aligned: [],
    raw: [],
  });
  const [isPreloading, setIsPreloading] = useState(true);

  const effectiveFov = enableFovCrop ? cropFov : 100;

  // Preload and render frames onto offscreen canvases with FOV crop
  useEffect(() => {
    if (!isOpen || !baseImage || images.length === 0) return;

    let isCancelled = false;
    setIsPreloading(true);

    const loadFrames = async () => {
      try {
        const alignedList: HTMLCanvasElement[] = [];
        const rawList: HTMLCanvasElement[] = [];

        for (const item of images) {
          // Render aligned version with FOV crop
          const alignedCanvas = await renderAlignedCanvas(baseImage, item, effectiveFov);
          alignedList.push(alignedCanvas);

          // Render raw (untransformed) version
          const rawItem: ImageItem = {
            ...item,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, flipH: false, flipV: false },
          };
          const rawCanvas = await renderAlignedCanvas(baseImage, rawItem, effectiveFov);
          rawList.push(rawCanvas);
        }

        if (!isCancelled) {
          renderedFramesRef.current = { aligned: alignedList, raw: rawList };
          setIsPreloading(false);
          setCurrentFrameIndex(0);
        }
      } catch (err) {
        console.error('Failed to preload frames:', err);
      }
    };

    loadFrames();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, images, baseImage, effectiveFov]);

  // Animation Loop
  useEffect(() => {
    if (!isPlaying || isPreloading || images.length === 0) return;

    const intervalMs = 1000 / fps;
    const timer = setInterval(() => {
      setCurrentFrameIndex((prev) => (prev + 1) % images.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, fps, isPreloading, images.length]);

  // Draw current frame to screen canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isPreloading || !baseImage) return;

    const frames = showAligned
      ? renderedFramesRef.current.aligned
      : renderedFramesRef.current.raw;

    const currentFrameCanvas = frames[currentFrameIndex];
    if (!currentFrameCanvas) return;

    canvas.width = currentFrameCanvas.width;
    canvas.height = currentFrameCanvas.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(currentFrameCanvas, 0, 0);
    }
  }, [currentFrameIndex, showAligned, isPreloading, baseImage, effectiveFov]);

  if (!isOpen || !baseImage) return null;

  const currentItem = images[currentFrameIndex];

  const handleDownloadVideo = async () => {
    if (isRecording || !baseImage) return;
    setIsRecording(true);
    setRecordProgress(0);
    setRecordStatusMsg('Encoding video...');

    try {
      const videoBlob = await recordSequenceVideo(
        images,
        baseImage,
        fps,
        3,
        effectiveFov,
        (p, msg) => {
          setRecordProgress(p);
          setRecordStatusMsg(msg);
        }
      );

      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = url;
      const fovTag = effectiveFov < 100 ? `_${effectiveFov}fov` : '';
      a.download = `alignforge_stabilized${fovTag}_${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Recording failed:', err);
    } finally {
      setIsRecording(false);
      setRecordStatusMsg('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl max-w-4xl w-full flex flex-col max-h-[92vh] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-neutral-100">
              Flipbook Animation Preview
            </h3>
            <span className="text-xs text-neutral-400">
              {images.length} frames sequence
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* 80% FOV Crop Toggle */}
            <button
              onClick={() => setEnableFovCrop(!enableFovCrop)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition-colors ${
                enableFovCrop
                  ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700 font-medium'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200'
              }`}
              title="Toggle 80% Field of View Crop to eliminate rotation/shift border fringes"
            >
              <Crop className="w-3.5 h-3.5" />
              <span>{enableFovCrop ? `${cropFov}% FOV Crop` : 'Full Frame (No Crop)'}</span>
            </button>

            {/* Toggle Aligned vs Raw comparison */}
            <div className="flex items-center bg-neutral-950 p-0.5 rounded border border-neutral-800 text-xs">
              <button
                onClick={() => setShowAligned(true)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  showAligned
                    ? 'bg-indigo-600 text-white font-medium shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Stabilized
              </button>
              <button
                onClick={() => setShowAligned(false)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  !showAligned
                    ? 'bg-neutral-700 text-white font-medium shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Raw
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewport Canvas Stage */}
        <div className="flex-1 bg-neutral-950 flex items-center justify-center p-4 relative min-h-[360px] overflow-hidden">
          {isPreloading ? (
            <div className="text-xs text-neutral-400 flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span>Rendering sequence frames ({effectiveFov}% FOV)...</span>
            </div>
          ) : (
            <div className="relative max-h-[55vh] flex items-center justify-center">
              <canvas
                ref={canvasRef}
                className="max-h-[55vh] max-w-full object-contain rounded shadow-lg border border-neutral-800"
              />
              <div className="absolute top-2 left-2 bg-neutral-950/80 backdrop-blur px-2.5 py-1 rounded border border-neutral-800 text-xs text-neutral-300 font-mono">
                Frame {currentFrameIndex + 1} of {images.length} · {currentItem?.name}{' '}
                {enableFovCrop && `(${cropFov}% FOV)`}
              </div>
            </div>
          )}
        </div>

        {/* Playback Controls & Frame Scrubber */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-900/90 space-y-3">
          {/* Scrubber slider */}
          <div className="flex items-center gap-3">
            <span className="font-mono tabular-nums text-xs text-neutral-400 w-10">
              {currentFrameIndex + 1} / {images.length}
            </span>
            <input
              type="range"
              min="0"
              max={images.length - 1}
              value={currentFrameIndex}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentFrameIndex(parseInt(e.target.value, 10));
              }}
              className="flex-1 h-1.5 bg-neutral-800 rounded appearance-none cursor-pointer accent-indigo-500"
            />
            <span className="text-xs text-neutral-400 font-mono tabular-nums w-14 text-right">
              {fps} FPS
            </span>
          </div>

          {/* Buttons Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentFrameIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
                }}
                className="p-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700"
                title="Previous Frame"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              <button
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentFrameIndex((prev) => (prev + 1) % images.length);
                }}
                className="p-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700"
                title="Next Frame"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1 ml-4 text-xs text-neutral-400">
                <span>Speed:</span>
                {[2, 4, 6, 12, 24].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => setFps(rate)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono tabular-nums border ${
                      fps === rate
                        ? 'bg-indigo-600 text-white border-indigo-500 font-medium'
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                    }`}
                  >
                    {rate}fps
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleDownloadVideo}
              disabled={isRecording}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs font-medium text-neutral-200 transition-colors disabled:opacity-50"
              title={`Download stabilized video (${effectiveFov}% FOV)`}
            >
              <Video className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {isRecording
                  ? `Recording (${recordProgress}%)...`
                  : `Export Video (${effectiveFov}% FOV)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
