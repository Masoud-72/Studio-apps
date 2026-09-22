import React, { useState } from 'react';
import {
  Sparkles,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  RotateCw,
  Sliders,
  MapPin,
  CheckCircle,
  Copy,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FlipHorizontal,
  FlipVertical,
  Link,
  Unlink,
  Crown,
  Info,
  Zap,
  Bot,
  Gauge,
  Check,
  Crop,
  Download,
} from 'lucide-react';
import {
  ImageItem,
  ToolMode,
  Point2D,
  AlignmentMode,
  OptimizationProgress,
  SimilarityMetrics,
} from '../types/alignment';
import { downloadSingleImage } from '../utils/exportUtils';

interface ControlPanelProps {
  baseImage: ImageItem | null;
  targetImage: ImageItem | null;
  currentIndex: number;
  totalImages: number;
  toolMode: ToolMode;
  onChangeToolMode: (mode: ToolMode) => void;
  onUpdateTransform: (partial: Partial<ImageItem['transform']>) => void;
  onResetTransform: () => void;
  onAutoAlign: () => void;
  isAutoAligning: boolean;
  onConfirmAndNext: () => void;
  onApplyToNext: () => void;
  onCalculateLandmarkTransform: () => void;
  // Highest Overlap Similarity features
  alignmentMode: AlignmentMode;
  onChangeAlignmentMode: (mode: AlignmentMode) => void;
  onOptimizeHighestOverlap: (mode: AlignmentMode) => void;
  isOptimizing: boolean;
  optimizationProgress: OptimizationProgress | null;
  similarityMetrics: SimilarityMetrics | null;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  baseImage,
  targetImage,
  currentIndex,
  totalImages,
  toolMode,
  onChangeToolMode,
  onUpdateTransform,
  onResetTransform,
  onAutoAlign,
  isAutoAligning,
  onConfirmAndNext,
  onApplyToNext,
  onCalculateLandmarkTransform,
  alignmentMode,
  onChangeAlignmentMode,
  onOptimizeHighestOverlap,
  isOptimizing,
  optimizationProgress,
  similarityMetrics,
}) => {
  const [nudgeStep, setNudgeStep] = useState<number>(1);
  const [lockAspect, setLockAspect] = useState<boolean>(true);
  const [showMetricsBreakdown, setShowMetricsBreakdown] = useState<boolean>(false);

  if (!targetImage || !baseImage) {
    return (
      <aside className="w-84 border-l border-neutral-800 bg-neutral-900/40 p-4 text-xs text-neutral-500">
        Select an image from the queue to adjust alignment.
      </aside>
    );
  }

  const isCurrentBase = targetImage.isBase || baseImage.id === targetImage.id;
  const transform = targetImage.transform;
  const score = similarityMetrics?.overall ?? targetImage.score ?? 88.0;

  const handleNudge = (dx: number, dy: number) => {
    onUpdateTransform({
      x: Math.round((transform.x + dx) * 10) / 10,
      y: Math.round((transform.y + dy) * 10) / 10,
    });
  };

  const handleRotateNudge = (deg: number) => {
    onUpdateTransform({
      rotation: Math.round((transform.rotation + deg) * 100) / 100,
    });
  };

  const handleScaleChange = (val: number, isX: boolean) => {
    if (lockAspect) {
      onUpdateTransform({
        scaleX: Math.round(val * 1000) / 1000,
        scaleY: Math.round(val * 1000) / 1000,
      });
    } else {
      onUpdateTransform(
        isX
          ? { scaleX: Math.round(val * 1000) / 1000 }
          : { scaleY: Math.round(val * 1000) / 1000 }
      );
    }
  };

  // Metric color helper
  const getScoreColor = (val: number) => {
    if (val >= 95) return 'text-emerald-400';
    if (val >= 88) return 'text-cyan-400';
    if (val >= 75) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getScoreBarColor = (val: number) => {
    if (val >= 95) return 'bg-emerald-500';
    if (val >= 88) return 'bg-cyan-500';
    if (val >= 75) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <aside className="w-84 border-l border-neutral-800 bg-neutral-900/50 flex flex-col shrink-0 select-none overflow-y-auto z-20">
      {/* Top Header: Target Card & Status */}
      <div className="p-4 border-b border-neutral-800">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            {isCurrentBase ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-indigo-400">
                <Crown className="w-3.5 h-3.5" />
                Master Reference
              </span>
            ) : (
              <span className="text-xs font-semibold text-neutral-200">
                Target Image #{currentIndex + 1}
              </span>
            )}
          </div>
          <span className="text-[11px] text-neutral-400 font-mono tabular-nums">
            {currentIndex + 1} / {totalImages}
          </span>
        </div>

        <p className="text-xs text-neutral-300 font-medium truncate" title={targetImage.name}>
          {targetImage.name}
        </p>

        <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-400">
          <span>{targetImage.width} × {targetImage.height}</span>
          <span aria-hidden="true">·</span>
          <span>
            {isCurrentBase
              ? 'Anchor frame'
              : targetImage.status === 'aligned' || targetImage.status === 'auto_aligned'
              ? 'Aligned'
              : 'Pending alignment'}
          </span>
        </div>

        {/* Alignment Quality Score Indicator */}
        {!isCurrentBase && (
          <div className="mt-3 pt-3 border-t border-neutral-800/80">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-neutral-400 flex items-center gap-1.5 font-medium">
                <Gauge className="w-3.5 h-3.5 text-indigo-400" />
                Overlap Similarity
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`font-mono tabular-nums font-bold ${getScoreColor(score)}`}>
                  {score.toFixed(1)}%
                </span>
                <button
                  onClick={() => setShowMetricsBreakdown(!showMetricsBreakdown)}
                  className="text-neutral-400 hover:text-neutral-200 p-0.5"
                  title="Toggle metric breakdown"
                >
                  {showMetricsBreakdown ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>

            <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${getScoreBarColor(score)} rounded-full transition-all duration-300`}
                style={{ width: `${Math.min(100, Math.max(5, score))}%` }}
              />
            </div>

            {/* Metric Detailed Breakdown (SSIM, ZNCC, Area) */}
            {showMetricsBreakdown && similarityMetrics && (
              <div className="mt-2.5 p-2 bg-neutral-950/70 border border-neutral-800 rounded text-[11px] space-y-1.5 font-mono">
                <div className="flex justify-between text-neutral-400">
                  <span>ZNCC Cross-Correlation:</span>
                  <span className="text-neutral-200">{similarityMetrics.zncc.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>SSIM Structural Index:</span>
                  <span className="text-neutral-200">{similarityMetrics.ssim.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Overlapping Frame Area:</span>
                  <span className="text-neutral-200">{similarityMetrics.overlapAreaRatio.toFixed(1)}%</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isCurrentBase ? (
        <div className="p-4 text-xs text-neutral-400 flex flex-col gap-3">
          <div className="p-3 rounded bg-neutral-800/40 border border-neutral-800 text-neutral-300 space-y-2">
            <p className="font-medium text-neutral-200">This is Image #1 (Base Reference)</p>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              All subsequent images are registered against this anchor frame. Its coordinates and dimensions define the standard output boundary.
            </p>
          </div>
          {totalImages > 1 && (
            <button
              onClick={onConfirmAndNext}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Begin Aligning Image #2</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="p-4 space-y-5">
          {/* AI MAX OVERLAP SIMILARITY SECTION */}
          <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                AI Overlap Maximizer
              </span>
              <span className="text-[10px] font-mono text-indigo-300 bg-indigo-900/60 px-1.5 py-0.5 rounded border border-indigo-700/50">
                Peak % Target
              </span>
            </div>

            {/* Optimizer Engine Selector */}
            <div className="grid grid-cols-2 gap-1.5 bg-neutral-950/80 p-1 rounded border border-neutral-800 text-[11px]">
              <button
                onClick={() => onChangeAlignmentMode('ultra_max')}
                className={`py-1 px-1.5 rounded text-left transition-colors ${
                  alignmentMode === 'ultra_max'
                    ? 'bg-indigo-600 text-white font-medium shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
                title="Pyramidal Grid Sweep + Continuous Nelder-Mead Simplex local ascent"
              >
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  <span className="truncate">Peak Simplex</span>
                </div>
              </button>

              <button
                onClick={() => onChangeAlignmentMode('ai_gemini')}
                className={`py-1 px-1.5 rounded text-left transition-colors ${
                  alignmentMode === 'ai_gemini'
                    ? 'bg-indigo-600 text-white font-medium shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
                title="Gemini 3.8 Flash Vision semantic keypoint match + Simplex Polish"
              >
                <div className="flex items-center gap-1">
                  <Bot className="w-3 h-3" />
                  <span className="truncate">Gemini Vision AI</span>
                </div>
              </button>
            </div>

            {/* Active Optimization Progress Display */}
            {isOptimizing && optimizationProgress ? (
              <div className="p-2.5 bg-indigo-900/40 border border-indigo-700/60 rounded space-y-2">
                <div className="flex items-center justify-between text-[11px] text-indigo-200">
                  <span className="truncate font-medium">{optimizationProgress.stage}</span>
                  <span className="font-mono tabular-nums text-emerald-400 font-bold ml-2 shrink-0">
                    {optimizationProgress.currentScore.toFixed(1)}%
                  </span>
                </div>

                <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-400 rounded-full transition-all duration-150 animate-pulse"
                    style={{
                      width: `${Math.min(
                        100,
                        (optimizationProgress.iteration / optimizationProgress.maxIterations) * 100
                      )}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-indigo-300 font-mono">
                  <span>ΔX: {optimizationProgress.currentTransform.x}px</span>
                  <span>ΔY: {optimizationProgress.currentTransform.y}px</span>
                  <span>{optimizationProgress.currentTransform.rotation}°</span>
                  <span>{(optimizationProgress.currentTransform.scaleX * 100).toFixed(1)}%</span>
                </div>
              </div>
            ) : (
              /* Trigger Button */
              <button
                onClick={() => onOptimizeHighestOverlap(alignmentMode)}
                disabled={isOptimizing}
                className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-950 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-indigo-200" />
                <span>Optimize for Highest Overlap</span>
              </button>
            )}

            <button
              onClick={onConfirmAndNext}
              className="w-full py-2 px-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-100 font-medium text-xs rounded transition-colors flex items-center justify-center gap-1.5"
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {currentIndex < totalImages - 1 ? 'Accept & Next Image →' : 'Accept & Finish'}
              </span>
            </button>
          </div>

          {/* 2-Point Landmark Pinning Section */}
          <div className="pt-2 border-t border-neutral-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                2-Point Pinning
              </span>
              <button
                onClick={() => onChangeToolMode(toolMode === 'landmarks' ? 'move' : 'landmarks')}
                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                  toolMode === 'landmarks'
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200'
                }`}
              >
                {toolMode === 'landmarks' ? 'Active' : 'Place Pins'}
              </button>
            </div>

            {toolMode === 'landmarks' && (
              <div className="p-2.5 bg-neutral-800/50 rounded border border-neutral-800 space-y-2 text-[11px]">
                <p className="text-neutral-300 leading-tight">
                  Click two shared points (e.g. corners, features) on both images to calculate transform.
                </p>
                <div className="flex items-center justify-between text-neutral-400">
                  <span>Pin A: Cyan</span>
                  <span>Pin B: Magenta</span>
                </div>
                <button
                  onClick={onCalculateLandmarkTransform}
                  className="w-full py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs rounded transition-colors"
                >
                  Snap from 2 Points
                </button>
              </div>
            )}
          </div>

          {/* Directional Nudge Pad */}
          <div className="pt-2 border-t border-neutral-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-200">
                Precision Nudge
              </span>
              <div className="flex items-center gap-1">
                {[0.2, 1, 5, 10].map((step) => (
                  <button
                    key={step}
                    onClick={() => setNudgeStep(step)}
                    className={`px-1.5 py-0.5 text-[10px] rounded font-mono tabular-nums border transition-colors ${
                      nudgeStep === step
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200'
                    }`}
                  >
                    {step}px
                  </button>
                ))}
              </div>
            </div>

            {/* D-Pad Layout */}
            <div className="flex flex-col items-center gap-1 my-1">
              <button
                onClick={() => handleNudge(0, -nudgeStep)}
                className="w-10 h-7 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 flex items-center justify-center text-neutral-300 active:scale-95 transition"
                title="Nudge Up"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleNudge(-nudgeStep, 0)}
                  className="w-10 h-7 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 flex items-center justify-center text-neutral-300 active:scale-95 transition"
                  title="Nudge Left"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>

                <div className="w-10 h-7 rounded bg-neutral-900 border border-neutral-800 flex items-center justify-center text-[10px] font-mono text-neutral-400 tabular-nums">
                  {nudgeStep}
                </div>

                <button
                  onClick={() => handleNudge(nudgeStep, 0)}
                  className="w-10 h-7 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 flex items-center justify-center text-neutral-300 active:scale-95 transition"
                  title="Nudge Right"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => handleNudge(0, nudgeStep)}
                className="w-10 h-7 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 flex items-center justify-center text-neutral-300 active:scale-95 transition"
                title="Nudge Down"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Coordinate Sliders & Numeric Inputs */}
          <div className="pt-2 border-t border-neutral-800 space-y-3">
            <span className="text-xs font-semibold text-neutral-200">
              Transform Coordinates
            </span>

            {/* Offset X */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Position X (px)</span>
                <input
                  type="number"
                  step="0.5"
                  value={transform.x}
                  onChange={(e) => onUpdateTransform({ x: parseFloat(e.target.value) || 0 })}
                  className="w-16 px-1.5 py-0.5 text-right font-mono tabular-nums text-xs bg-neutral-800 border border-neutral-700 rounded text-neutral-200"
                />
              </div>
              <input
                type="range"
                min="-150"
                max="150"
                step="0.5"
                value={transform.x}
                onChange={(e) => onUpdateTransform({ x: parseFloat(e.target.value) })}
                className="w-full h-1 bg-neutral-800 rounded appearance-none cursor-pointer"
              />
            </div>

            {/* Offset Y */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Position Y (px)</span>
                <input
                  type="number"
                  step="0.5"
                  value={transform.y}
                  onChange={(e) => onUpdateTransform({ y: parseFloat(e.target.value) || 0 })}
                  className="w-16 px-1.5 py-0.5 text-right font-mono tabular-nums text-xs bg-neutral-800 border border-neutral-700 rounded text-neutral-200"
                />
              </div>
              <input
                type="range"
                min="-150"
                max="150"
                step="0.5"
                value={transform.y}
                onChange={(e) => onUpdateTransform({ y: parseFloat(e.target.value) })}
                className="w-full h-1 bg-neutral-800 rounded appearance-none cursor-pointer"
              />
            </div>

            {/* Rotation */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Rotation (deg)</span>
                <input
                  type="number"
                  step="0.1"
                  value={transform.rotation}
                  onChange={(e) => onUpdateTransform({ rotation: parseFloat(e.target.value) || 0 })}
                  className="w-16 px-1.5 py-0.5 text-right font-mono tabular-nums text-xs bg-neutral-800 border border-neutral-700 rounded text-neutral-200"
                />
              </div>
              <input
                type="range"
                min="-30"
                max="30"
                step="0.05"
                value={transform.rotation}
                onChange={(e) => onUpdateTransform({ rotation: parseFloat(e.target.value) })}
                className="w-full h-1 bg-neutral-800 rounded appearance-none cursor-pointer"
              />
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleRotateNudge(-1)}
                    className="px-1.5 py-0.5 text-[10px] rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700"
                  >
                    -1°
                  </button>
                  <button
                    onClick={() => handleRotateNudge(-0.1)}
                    className="px-1.5 py-0.5 text-[10px] rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700"
                  >
                    -0.1°
                  </button>
                </div>
                <button
                  onClick={() => onUpdateTransform({ rotation: 0 })}
                  className="text-[10px] text-neutral-500 hover:text-neutral-300"
                >
                  0° Reset
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleRotateNudge(0.1)}
                    className="px-1.5 py-0.5 text-[10px] rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700"
                  >
                    +0.1°
                  </button>
                  <button
                    onClick={() => handleRotateNudge(1)}
                    className="px-1.5 py-0.5 text-[10px] rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700"
                  >
                    +1°
                  </button>
                </div>
              </div>
            </div>

            {/* Scale */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-neutral-400">Scale</span>
                  <button
                    onClick={() => setLockAspect(!lockAspect)}
                    className="text-neutral-400 hover:text-neutral-200"
                    title={lockAspect ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
                  >
                    {lockAspect ? <Link className="w-3 h-3 text-indigo-400" /> : <Unlink className="w-3 h-3" />}
                  </button>
                </div>
                <span className="font-mono tabular-nums text-xs text-neutral-300">
                  {Math.round(transform.scaleX * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.2"
                step="0.005"
                value={transform.scaleX}
                onChange={(e) => handleScaleChange(parseFloat(e.target.value), true)}
                className="w-full h-1 bg-neutral-800 rounded appearance-none cursor-pointer"
              />
            </div>

            {/* Flips & Reset */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onUpdateTransform({ flipH: !transform.flipH })}
                  className={`p-1.5 rounded border ${
                    transform.flipH
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                  }`}
                  title="Flip Horizontal"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onUpdateTransform({ flipV: !transform.flipV })}
                  className={`p-1.5 rounded border ${
                    transform.flipV
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                  }`}
                  title="Flip Vertical"
                >
                  <FlipVertical className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={onResetTransform}
                className="px-2 py-1 text-[11px] rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 border border-neutral-700"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Sequential Productivity: Apply to Next */}
          {currentIndex < totalImages - 1 && (
            <div className="pt-2 border-t border-neutral-800">
              <button
                onClick={onApplyToNext}
                className="w-full py-1.5 px-2.5 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-xs flex items-center justify-center gap-1.5 transition-colors"
                title="Copy current translation and rotation onto the next image in the queue"
              >
                <Copy className="w-3 h-3 text-neutral-400" />
                <span>Apply Transform to Next Image</span>
              </button>
            </div>
          )}

          {/* Quick Single-Frame Download */}
          <div className="pt-2 border-t border-neutral-800 space-y-1.5">
            <span className="text-[10px] text-neutral-400 block font-medium">Quick Export Frame</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  if (baseImage && targetImage) {
                    downloadSingleImage(baseImage, targetImage, true, 80);
                  }
                }}
                className="flex-1 py-1.5 px-2.5 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/70 text-emerald-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                title="Download this registered image with 80% FOV crop applied"
              >
                <Crop className="w-3.5 h-3.5 text-emerald-400" />
                <span>Download Cropped (80% FOV)</span>
              </button>

              <button
                onClick={() => {
                  if (baseImage && targetImage) {
                    downloadSingleImage(baseImage, targetImage, false, 100);
                  }
                }}
                className="py-1.5 px-2.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 text-xs transition-colors"
                title="Download full frame intact without crop"
              >
                Full
              </button>
            </div>
          </div>
        </div>
      )}

    </aside>
  );
};
