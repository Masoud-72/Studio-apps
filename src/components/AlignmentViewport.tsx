import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Eye,
  Sliders,
  SplitSquareVertical,
  Activity,
  Layers,
  Crosshair,
  Move,
  RotateCw,
  MapPin,
  RefreshCw,
  Columns,
  Crop,
  Download,
} from 'lucide-react';
import { ImageItem, ViewMode, ToolMode, Point2D } from '../types/alignment';
import { downloadSingleImage } from '../utils/exportUtils';

interface AlignmentViewportProps {
  baseImage: ImageItem | null;
  targetImage: ImageItem | null;
  currentIndex: number;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  toolMode: ToolMode;
  onChangeToolMode: (mode: ToolMode) => void;
  onUpdateTransform: (partial: Partial<ImageItem['transform']>) => void;
  onUpdateLandmark: (pointIndex: number, point: Point2D, isBase: boolean) => void;
  onAutoAlignCurrent: () => void;
  isAutoAligning: boolean;
}

export const AlignmentViewport: React.FC<AlignmentViewportProps> = ({
  baseImage,
  targetImage,
  currentIndex,
  viewMode,
  onChangeViewMode,
  toolMode,
  onChangeToolMode,
  onUpdateTransform,
  onUpdateLandmark,
  onAutoAlignCurrent,
  isAutoAligning,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport Zoom & Pan
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Onion skin opacity (0 = base only, 1 = target only)
  const [onionOpacity, setOnionOpacity] = useState<number>(0.5);

  // Split wiper curtain position (0 - 100%)
  const [splitPos, setSplitPos] = useState<number>(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  // Flicker / Blink comparator state
  const [flickerIndex, setFlickerIndex] = useState<0 | 1>(0);
  const [flickerActive, setFlickerActive] = useState<boolean>(false);
  const [flickerSpeedHz, setFlickerSpeedHz] = useState<number>(2);

  // Grid & Crosshair overlay
  const [showGrid, setShowGrid] = useState<boolean>(false);

  // 80% Field of View (FOV) crop guide overlay
  const [showFovCropGuide, setShowFovCropGuide] = useState<boolean>(true);

  // Direct transform dragging
  const [isDraggingTarget, setIsDraggingTarget] = useState(false);
  const [dragStartTransform, setDragStartTransform] = useState<{
    mouseX: number;
    mouseY: number;
    initialX: number;
    initialY: number;
  }>({ mouseX: 0, mouseY: 0, initialX: 0, initialY: 0 });

  // Landmark placement
  const [activeLandmarkIndex, setActiveLandmarkIndex] = useState<number>(0);
  const [landmarkTargetSelect, setLandmarkTargetSelect] = useState<'base' | 'target'>('target');

  const isCurrentBase = targetImage?.isBase || (baseImage && targetImage && baseImage.id === targetImage.id);

  // Fit to screen on initial image load
  useEffect(() => {
    if (!baseImage || !containerRef.current) return;
    const container = containerRef.current;
    const padding = 60;
    const availableW = container.clientWidth - padding;
    const availableH = container.clientHeight - padding;
    if (availableW > 0 && availableH > 0) {
      const fitZoom = Math.min(availableW / baseImage.width, availableH / baseImage.height, 1);
      setZoom(Math.max(0.1, Math.round(fitZoom * 100) / 100));
      setPan({ x: 0, y: 0 });
    }
  }, [baseImage?.id]);

  // Flicker timer effect
  useEffect(() => {
    if (viewMode !== 'flicker' || !flickerActive) return;
    const intervalMs = 1000 / flickerSpeedHz;
    const timer = setInterval(() => {
      setFlickerIndex((prev) => (prev === 0 ? 1 : 0));
    }, intervalMs);
    return () => clearInterval(timer);
  }, [viewMode, flickerActive, flickerSpeedHz]);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((prev) => Math.min(8, Math.max(0.1, Math.round(prev * zoomFactor * 100) / 100)));
  };

  // Canvas Mouse Down
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.altKey || toolMode === 'move' && e.shiftKey) {
      // Middle click or Alt+Drag = Pan Viewport
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (toolMode === 'landmarks' && baseImage && targetImage) {
      // Set landmark point
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left - rect.width / 2 - pan.x;
      const mouseY = e.clientY - rect.top - rect.height / 2 - pan.y;

      const imgX = mouseX / zoom + baseImage.width / 2;
      const imgY = mouseY / zoom + baseImage.height / 2;

      onUpdateLandmark(activeLandmarkIndex, { x: Math.round(imgX), y: Math.round(imgY) }, landmarkTargetSelect === 'base');
      // Alternate landmark point index 0 -> 1
      setActiveLandmarkIndex((prev) => (prev === 0 ? 1 : 0));
      return;
    }

    if (!isCurrentBase && targetImage && toolMode === 'move') {
      // Start dragging target image
      setIsDraggingTarget(true);
      setDragStartTransform({
        mouseX: e.clientX,
        mouseY: e.clientY,
        initialX: targetImage.transform.x,
        initialY: targetImage.transform.y,
      });
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (isDraggingTarget && targetImage && !isCurrentBase) {
      const deltaX = (e.clientX - dragStartTransform.mouseX) / zoom;
      const deltaY = (e.clientY - dragStartTransform.mouseY) / zoom;
      onUpdateTransform({
        x: Math.round((dragStartTransform.initialX + deltaX) * 10) / 10,
        y: Math.round((dragStartTransform.initialY + deltaY) * 10) / 10,
      });
    }

    if (isDraggingSplit && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const pos = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPos(Math.max(0, Math.min(100, pos)));
    }
  }, [isPanning, panStart, isDraggingTarget, targetImage, isCurrentBase, dragStartTransform, zoom, onUpdateTransform, isDraggingSplit]);

  const handleMouseUp = () => {
    setIsPanning(false);
    setIsDraggingTarget(false);
    setIsDraggingSplit(false);
  };

  const handleResetZoom = () => {
    if (!baseImage || !containerRef.current) return;
    const container = containerRef.current;
    const fitZoom = Math.min(
      (container.clientWidth - 40) / baseImage.width,
      (container.clientHeight - 40) / baseImage.height,
      1
    );
    setZoom(Math.max(0.1, Math.round(fitZoom * 100) / 100));
    setPan({ x: 0, y: 0 });
  };

  if (!baseImage || !targetImage) {
    return (
      <div className="flex-1 bg-neutral-950 flex flex-col items-center justify-center text-neutral-400 p-8">
        <Layers className="w-12 h-12 text-neutral-600 mb-3" />
        <h3 className="text-base font-semibold text-neutral-200">No Images Loaded</h3>
        <p className="text-xs text-neutral-400 mt-1 max-w-sm text-center">
          Upload 2 or more images or load a sample dataset to begin aligning them one by one.
        </p>
      </div>
    );
  }

  const transform = targetImage.transform;
  const targetTransformStyle = {
    transform: `translate(${transform.x * zoom}px, ${transform.y * zoom}px) rotate(${transform.rotation}deg) scale(${transform.scaleX * (transform.flipH ? -1 : 1)}, ${transform.scaleY * (transform.flipV ? -1 : 1)})`,
    transformOrigin: 'center center',
  };

  return (
    <div className="flex-1 flex flex-col bg-neutral-950 overflow-hidden relative select-none">
      {/* Viewport Top Toolbar: Mode Switcher & Tools */}
      <div className="h-12 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur px-4 flex items-center justify-between z-20 shrink-0">
        {/* View Modes */}
        <div className="flex items-center gap-1 bg-neutral-950/60 p-1 rounded border border-neutral-800">
          <button
            onClick={() => onChangeViewMode('onion')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              viewMode === 'onion'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
            title="Onion Skin: Adjustable transparency blend"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Onion Skin</span>
          </button>

          <button
            onClick={() => onChangeViewMode('difference')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              viewMode === 'difference'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
            title="Difference Mode: Identical aligned pixels turn black"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Difference</span>
          </button>

          <button
            onClick={() => onChangeViewMode('split')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              viewMode === 'split'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
            title="Split Wiper: Side-by-side curtain slider"
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
            <span>Split Wiper</span>
          </button>

          <button
            onClick={() => onChangeViewMode('flicker')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              viewMode === 'flicker'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
            title="Blink Comparator: Strobe toggle between base and target"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Flicker</span>
          </button>

          <button
            onClick={() => onChangeViewMode('side_by_side')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              viewMode === 'side_by_side'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
            title="Dual Viewport: Synchronized comparison"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Side-by-Side</span>
          </button>
        </div>

        {/* View Mode Contextual Controls */}
        <div className="flex items-center gap-3">
          {viewMode === 'onion' && (
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span className="text-[11px]">Base</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={onionOpacity}
                onChange={(e) => setOnionOpacity(parseFloat(e.target.value))}
                className="w-28 h-1.5 bg-neutral-800 rounded appearance-none cursor-pointer"
              />
              <span className="text-[11px] text-neutral-200 font-mono tabular-nums w-8">
                {Math.round(onionOpacity * 100)}%
              </span>
              <div className="flex items-center gap-1 ml-1">
                {[0.25, 0.5, 0.75].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setOnionOpacity(preset)}
                    className={`px-1.5 py-0.5 text-[10px] rounded border ${
                      Math.abs(onionOpacity - preset) < 0.02
                        ? 'bg-neutral-700 text-white border-neutral-600'
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200'
                    }`}
                  >
                    {preset * 100}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'flicker' && (
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <button
                onClick={() => setFlickerActive(!flickerActive)}
                className={`px-2 py-1 rounded text-xs font-medium border ${
                  flickerActive
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-neutral-800 text-neutral-200 border-neutral-700'
                }`}
              >
                {flickerActive ? 'Pause Strobe' : 'Start Strobe'}
              </button>
              <span className="text-[11px] ml-1">Speed:</span>
              {[1, 2, 4].map((hz) => (
                <button
                  key={hz}
                  onClick={() => setFlickerSpeedHz(hz)}
                  className={`px-1.5 py-0.5 text-[10px] rounded border ${
                    flickerSpeedHz === hz
                      ? 'bg-neutral-700 text-white border-neutral-600'
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                  }`}
                >
                  {hz}Hz
                </button>
              ))}
              <button
                onMouseDown={() => setFlickerIndex(1)}
                onMouseUp={() => setFlickerIndex(0)}
                className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-[11px] text-neutral-300 rounded border border-neutral-700 ml-2"
                title="Hold mouse down to peek target image, release to view base"
              >
                Hold to Peek
              </button>
            </div>
          )}

          {viewMode === 'split' && (
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span className="text-[11px]">Wiper Position:</span>
              <input
                type="range"
                min="0"
                max="100"
                value={splitPos}
                onChange={(e) => setSplitPos(parseFloat(e.target.value))}
                className="w-24 h-1.5 bg-neutral-800 rounded appearance-none cursor-pointer"
              />
              <span className="text-[11px] font-mono tabular-nums text-neutral-300 w-8">
                {Math.round(splitPos)}%
              </span>
            </div>
          )}

          {/* Grid, Crop Guide & Zoom Controls */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-neutral-800">
            <button
              onClick={() => setShowFovCropGuide(!showFovCropGuide)}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors text-xs border ${
                showFovCropGuide
                  ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50'
                  : 'text-neutral-400 hover:text-neutral-200 bg-neutral-800/60 border-neutral-700/60'
              }`}
              title="Toggle 80% Field of View (FOV) Crop Guide"
            >
              <Crop className="w-3.5 h-3.5" />
              <span className="text-[10px] font-mono font-medium">80% FOV</span>
            </button>

            <button
              onClick={() => {
                if (baseImage && targetImage) {
                  downloadSingleImage(baseImage, targetImage, true, 80);
                }
              }}
              className="flex items-center gap-1 px-2 py-1 rounded transition-colors text-xs bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-700/60 shadow-xs"
              title="Download this image cropped to 80% Field of View"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-medium hidden sm:inline">Download Cropped</span>
            </button>

            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-1.5 rounded transition-colors ${
                showGrid
                  ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/40'
                  : 'text-neutral-400 hover:text-neutral-200 bg-neutral-800/60'
              }`}
              title="Toggle pixel alignment grid and crosshairs"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setZoom((prev) => Math.max(0.1, Math.round(prev * 0.8 * 100) / 100))}
              className="p-1.5 rounded text-neutral-400 hover:text-neutral-200 bg-neutral-800/60"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <span className="text-[11px] font-mono tabular-nums text-neutral-300 w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>

            <button
              onClick={() => setZoom((prev) => Math.min(8, Math.round(prev * 1.25 * 100) / 100))}
              className="p-1.5 rounded text-neutral-400 hover:text-neutral-200 bg-neutral-800/60"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleResetZoom}
              className="p-1.5 rounded text-neutral-400 hover:text-neutral-200 bg-neutral-800/60"
              title="Fit to screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas Viewport Area */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`flex-1 relative overflow-hidden bg-checkerboard flex items-center justify-center ${
          isPanning ? 'cursor-grabbing' : toolMode === 'move' ? 'cursor-grab' : 'cursor-crosshair'
        }`}
      >
        {/* Base Stage Center Position */}
        <div
          className="absolute transition-transform duration-75 ease-out"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px)`,
          }}
        >
          {/* Synchronized Side-by-Side Dual View */}
          {viewMode === 'side_by_side' ? (
            <div className="flex items-center gap-6">
              {/* Left: Master Base */}
              <div
                className="relative border border-indigo-500/50 shadow-2xl bg-neutral-900 rounded overflow-hidden"
                style={{
                  width: `${baseImage.width * zoom}px`,
                  height: `${baseImage.height * zoom}px`,
                }}
              >
                <img
                  src={baseImage.src}
                  alt="Base reference"
                  className="w-full h-full object-contain pointer-events-none"
                />
                <div className="absolute top-2 left-2 bg-indigo-600/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow">
                  Reference Master Frame
                </div>
              </div>

              {/* Right: Current Target with Transform */}
              <div
                className="relative border border-emerald-500/50 shadow-2xl bg-neutral-900 rounded overflow-hidden"
                style={{
                  width: `${baseImage.width * zoom}px`,
                  height: `${baseImage.height * zoom}px`,
                }}
              >
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={targetTransformStyle}
                >
                  <img
                    src={targetImage.src}
                    alt={targetImage.name}
                    style={{
                      width: `${targetImage.width * zoom}px`,
                      height: `${targetImage.height * zoom}px`,
                    }}
                    className="max-w-none pointer-events-none"
                  />
                </div>
                <div className="absolute top-2 left-2 bg-emerald-600/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow">
                  Current Target #{currentIndex + 1}
                </div>
              </div>
            </div>
          ) : (
            /* Single Registered Stage Container (Width & Height set to Base Dimensions) */
            <div
              className="relative shadow-2xl bg-black/40 overflow-visible"
              style={{
                width: `${baseImage.width * zoom}px`,
                height: `${baseImage.height * zoom}px`,
              }}
            >
              {/* Layer 1: Master Base Image */}
              <div
                className="absolute inset-0 select-none pointer-events-none"
                style={{
                  display:
                    viewMode === 'flicker' && flickerIndex === 1
                      ? 'none'
                      : 'block',
                  opacity: viewMode === 'onion' ? 1 - onionOpacity : 1,
                }}
              >
                <img
                  src={baseImage.src}
                  alt={baseImage.name}
                  className="w-full h-full object-contain select-none"
                />
              </div>

              {/* Layer 2: Transformed Target Image */}
              {!isCurrentBase && (
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  style={{
                    ...targetTransformStyle,
                    display:
                      viewMode === 'flicker' && flickerIndex === 0
                        ? 'none'
                        : 'flex',
                    mixBlendMode: viewMode === 'difference' ? 'difference' : 'normal',
                    opacity: viewMode === 'onion' ? onionOpacity : 1,
                    clipPath:
                      viewMode === 'split'
                        ? `polygon(${splitPos}% 0%, 100% 0%, 100% 100%, ${splitPos}% 100%)`
                        : undefined,
                  }}
                >
                  <img
                    src={targetImage.src}
                    alt={targetImage.name}
                    style={{
                      width: `${targetImage.width * zoom}px`,
                      height: `${targetImage.height * zoom}px`,
                    }}
                    className="max-w-none select-none"
                  />
                </div>
              )}

              {/* Split Wiper Line & Handle */}
              {viewMode === 'split' && !isCurrentBase && (
                <div
                  className="absolute top-0 bottom-0 z-30 cursor-ew-resize select-none"
                  style={{ left: `${splitPos}%` }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setIsDraggingSplit(true);
                  }}
                >
                  <div className="w-0.5 h-full bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                  <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-indigo-600 border-2 border-white shadow flex items-center justify-center text-white text-[10px]">
                    ↔
                  </div>
                </div>
              )}

              {/* Grid & Center Crosshairs Overlay */}
              {showGrid && (
                <div className="absolute inset-0 pointer-events-none z-20">
                  {/* Subtle 50px Grid Lines */}
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundImage: `linear-gradient(to right, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
                                        linear-gradient(to bottom, rgba(255, 255, 255, 0.08) 1px, transparent 1px)`,
                      backgroundSize: `${50 * zoom}px ${50 * zoom}px`,
                    }}
                  />
                  {/* Center Center Crosshairs */}
                  <div className="absolute inset-x-0 top-1/2 h-px bg-indigo-400/40" />
                  <div className="absolute inset-y-0 left-1/2 w-px bg-indigo-400/40" />
                </div>
              )}

              {/* 80% Field of View (FOV) Crop Guide Overlay */}
              {showFovCropGuide && (
                <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
                  <div
                    className="absolute border-2 border-dashed border-indigo-400/80 transition-all"
                    style={{
                      left: '10%',
                      top: '10%',
                      width: '80%',
                      height: '80%',
                      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.40)',
                    }}
                  >
                    <div className="absolute -top-6 left-0 bg-indigo-950/90 border border-indigo-700/80 text-[10px] font-mono text-indigo-200 px-2 py-0.5 rounded shadow-sm whitespace-nowrap">
                      80% Field of View Crop ({Math.round(baseImage.width * 0.8)} × {Math.round(baseImage.height * 0.8)}px)
                    </div>
                    {/* Corner Reticle Accents */}
                    <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-indigo-300" />
                    <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-indigo-300" />
                    <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-indigo-300" />
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-indigo-300" />
                  </div>
                </div>
              )}

              {/* Landmark Pins Mode */}
              {toolMode === 'landmarks' && (
                <div className="absolute inset-0 z-30 pointer-events-none">
                  {/* Base Landmark Points */}
                  {baseImage.landmarks?.map((pt, i) => (
                    <div
                      key={`base-pt-${i}`}
                      className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto flex items-center gap-1"
                      style={{
                        left: `${(pt.x / baseImage.width) * 100}%`,
                        top: `${(pt.y / baseImage.height) * 100}%`,
                      }}
                    >
                      <div className="w-5 h-5 rounded-full bg-cyan-500 border-2 border-white shadow-lg flex items-center justify-center text-neutral-950 text-[10px] font-bold">
                        {i === 0 ? 'A' : 'B'}
                      </div>
                      <span className="bg-neutral-900/90 text-cyan-300 text-[9px] px-1 rounded border border-cyan-700/50">
                        Base
                      </span>
                    </div>
                  ))}

                  {/* Target Landmark Points */}
                  {!isCurrentBase &&
                    targetImage.landmarks?.map((pt, i) => (
                      <div
                        key={`target-pt-${i}`}
                        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto flex items-center gap-1"
                        style={{
                          left: `${(pt.x / baseImage.width) * 100}%`,
                          top: `${(pt.y / baseImage.height) * 100}%`,
                        }}
                      >
                        <div className="w-5 h-5 rounded-full bg-fuchsia-500 border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-bold">
                          {i === 0 ? 'A' : 'B'}
                        </div>
                        <span className="bg-neutral-900/90 text-fuchsia-300 text-[9px] px-1 rounded border border-fuchsia-700/50">
                          Target
                        </span>
                      </div>
                    ))}
                </div>
              )}

              {/* Bounding Transform Wireframe for Target Image */}
              {!isCurrentBase && (
                <div
                  className="absolute inset-0 pointer-events-none border border-dashed border-indigo-400/40"
                  style={targetTransformStyle}
                >
                  <div className="absolute top-1 right-1 text-[9px] font-mono text-indigo-300 bg-neutral-950/70 px-1 py-0.5 rounded">
                    Target Frame
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Viewport Info Overlay (Zero-Pill, unboxed metadata) */}
        <div className="absolute bottom-3 left-4 text-xs text-neutral-400 bg-neutral-950/80 backdrop-blur px-3 py-1.5 rounded border border-neutral-800 flex items-center gap-2 pointer-events-none">
          <span className="text-neutral-200">
            {baseImage.width} × {baseImage.height}px
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">Zoom: {Math.round(zoom * 100)}%</span>
          {!isCurrentBase && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-indigo-300">
                ΔX: {transform.x > 0 ? `+${transform.x}` : transform.x}px, ΔY:{' '}
                {transform.y > 0 ? `+${transform.y}` : transform.y}px
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-neutral-300">
                {transform.rotation}°
              </span>
            </>
          )}
        </div>

        {/* Mode Guidance Tip */}
        <div className="absolute top-3 right-4 text-[11px] text-neutral-400 bg-neutral-950/80 backdrop-blur px-2.5 py-1 rounded border border-neutral-800 flex items-center gap-1.5 pointer-events-none">
          {viewMode === 'difference' ? (
            <span>Difference mode: Align features until they turn completely black.</span>
          ) : viewMode === 'split' ? (
            <span>Drag the vertical line to compare Base vs Target alignment.</span>
          ) : viewMode === 'flicker' ? (
            <span>Strobe mode: Misaligned structures will vibrate or jump.</span>
          ) : isCurrentBase ? (
            <span>This is the Master Base Reference. Select other images below to align.</span>
          ) : (
            <span>Drag target directly or use fine-tune nudge on the right panel.</span>
          )}
        </div>
      </div>
    </div>
  );
};
