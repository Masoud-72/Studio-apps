import React, { useState } from 'react';
import {
  X,
  Download,
  FolderArchive,
  Folder,
  FileImage,
  Video,
  FileCode,
  Check,
  Sparkles,
  Crop,
  Layers,
  HelpCircle,
  Film,
  Package,
} from 'lucide-react';
import { ImageItem, ExportSettings } from '../types/alignment';
import {
  exportAllImagesAsZip,
  exportDirectlyToFolder,
  exportSingleImageBlob,
  recordSequenceVideo,
  downloadSingleImage,
} from '../utils/exportUtils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: ImageItem[];
  baseImage: ImageItem | null;
  currentImage: ImageItem | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  images,
  baseImage,
  currentImage,
}) => {
  const [settings, setSettings] = useState<ExportSettings>({
    format: 'image/png',
    quality: 0.95,
    cropToBase: true,
    enableFovCrop: true,
    cropFov: 80, // Default 80% Field of View as requested
    includeCroppedImages: true, // Include cropped_images/ folder
    includeFullImages: true,    // Include aligned_images_full/ folder to keep full frames intact
    includeImages: true,
    includeVideo: true,         // Include video/ folder
    videoFps: 6,
    videoLoops: 3,
    includeManifest: true,
  });

  const [isExporting, setIsExporting] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [copiedManifest, setCopiedManifest] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !baseImage) return null;

  const effectiveFov = settings.enableFovCrop ? settings.cropFov : 80;
  const croppedWidth = Math.round(baseImage.width * (effectiveFov / 100));
  const croppedHeight = Math.round(baseImage.height * (effectiveFov / 100));

  const hasDirectoryPicker = typeof (window as any).showDirectoryPicker === 'function';

  // Download complete ZIP package with cropped_images/, aligned_images_full/, and video/ folders
  const handleExportZip = async () => {
    setIsExporting(true);
    setErrorMessage(null);
    setProgressMsg('Initializing export pipeline...');
    setProgressPercent(0);

    try {
      await exportAllImagesAsZip(images, baseImage, settings, (curr, total, msg) => {
        setProgressMsg(msg);
        setProgressPercent(Math.min(100, Math.round((curr / total) * 100)));
      });
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('ZIP Export error:', err);
      setIsExporting(false);
      setErrorMessage(err?.message || 'Export failed. Please check browser permissions.');
    }
  };

  // Save directly into a selected folder on user's local disk
  const handleSaveToLocalFolder = async () => {
    setIsExporting(true);
    setErrorMessage(null);
    setProgressMsg('Please select a target folder...');
    setProgressPercent(0);

    try {
      await exportDirectlyToFolder(images, baseImage, settings, (curr, total, msg) => {
        setProgressMsg(msg);
        setProgressPercent(Math.min(100, Math.round((curr / total) * 100)));
      });
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 900);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User canceled folder selection
        setIsExporting(false);
        setProgressMsg('');
        return;
      }
      console.warn('Direct folder save unsupported or denied, falling back to ZIP download:', err);
      handleExportZip();
    }
  };

  // Quick download cropped image for current frame
  const handleDownloadCroppedCurrent = async () => {
    if (!currentImage) return;
    try {
      await downloadSingleImage(
        baseImage,
        currentImage,
        true, // Cropped
        effectiveFov,
        settings.format,
        settings.quality
      );
    } catch (err) {
      console.error('Cropped single download failed:', err);
    }
  };

  // Quick download full frame aligned image for current frame
  const handleDownloadFullCurrent = async () => {
    if (!currentImage) return;
    try {
      await downloadSingleImage(
        baseImage,
        currentImage,
        false, // Full uncropped
        100,
        settings.format,
        settings.quality
      );
    } catch (err) {
      console.error('Full frame single download failed:', err);
    }
  };

  // Quick export video only
  const handleExportVideoOnly = async () => {
    setIsExporting(true);
    setErrorMessage(null);
    setProgressMsg(`Encoding ${effectiveFov}% FOV stabilized video...`);
    setProgressPercent(10);

    try {
      const blob = await recordSequenceVideo(
        images,
        baseImage,
        settings.videoFps,
        settings.videoLoops,
        effectiveFov,
        (pct, msg) => {
          setProgressPercent(pct);
          setProgressMsg(msg);
        }
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fovTag = effectiveFov < 100 ? `_${effectiveFov}fov` : '';
      a.download = `aligned_sequence_cropped${fovTag}_${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsExporting(false);
    } catch (err: any) {
      console.error('Video export failed:', err);
      setIsExporting(false);
      setErrorMessage(err?.message || 'Video recording failed.');
    }
  };

  const handleCopyManifest = () => {
    const manifest = {
      software: 'AlignForge Image Registration Studio',
      fieldOfViewCrop: {
        enabled: settings.enableFovCrop,
        percentage: effectiveFov,
        originalDimensions: { width: baseImage.width, height: baseImage.height },
        croppedDimensions: { width: croppedWidth, height: croppedHeight },
      },
      baseReference: {
        name: baseImage.name,
        width: baseImage.width,
        height: baseImage.height,
      },
      registeredImages: images.map((img, i) => ({
        index: i + 1,
        name: img.name,
        isBase: img.isBase,
        transform: img.transform,
        score: img.score,
      })),
    };

    navigator.clipboard.writeText(JSON.stringify(manifest, null, 2));
    setCopiedManifest(true);
    setTimeout(() => setCopiedManifest(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-100">
                Export Aligned Images & Stabilized Video
              </h3>
              <p className="text-xs text-neutral-400">
                Download cropped images, full frames, and stabilized video bundle
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body Settings */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto">
          {/* QUICK DIRECT ACTIONS FOR CURRENT IMAGE */}
          {currentImage && (
            <div className="p-3 rounded-lg bg-neutral-950/80 border border-neutral-800 flex items-center justify-between gap-3">
              <div>
                <span className="font-semibold text-neutral-200 block text-xs">
                  Active Frame: <span className="text-neutral-100 font-mono">{currentImage.name}</span>
                </span>
                <span className="text-[11px] text-neutral-400">
                  Directly download this single image cropped or full frame
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleDownloadCroppedCurrent}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-xs transition-colors"
                  title={`Download current image cropped to ${effectiveFov}% Field of View`}
                >
                  <Crop className="w-3.5 h-3.5" />
                  <span>Download Cropped Image ({effectiveFov}% FOV)</span>
                </button>
                <button
                  onClick={handleDownloadFullCurrent}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 text-xs transition-colors"
                  title="Download current image full frame uncropped"
                >
                  <FileImage className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Full Frame</span>
                </button>
              </div>
            </div>
          )}

          {/* SECTION 1: 80% FIELD OF VIEW (FOV) CROP OPTION */}
          <div className="p-3.5 rounded-lg bg-indigo-950/30 border border-indigo-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crop className="w-4 h-4 text-indigo-400" />
                <span className="font-semibold text-neutral-100 text-xs">
                  Field of View (FOV) Crop Setting
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableFovCrop}
                  onChange={(e) => setSettings({ ...settings, enableFovCrop: e.target.checked })}
                  className="w-4 h-4 rounded bg-neutral-800 border-neutral-700 text-indigo-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-xs font-medium text-indigo-200">
                  Enable FOV Crop
                </span>
              </label>
            </div>

            <p className="text-[11px] text-neutral-300 leading-relaxed">
              Trims edge shift voids and rotation borders resulting from alignment. You can download both the cropped images and intact full frames together.
            </p>

            {settings.enableFovCrop && (
              <div className="space-y-2.5 pt-1">
                {/* Preset Buttons */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { val: 80, label: '80% FOV', tag: 'Standard' },
                    { val: 90, label: '90% FOV', tag: 'Light' },
                    { val: 75, label: '75% FOV', tag: 'Tight' },
                    { val: 100, label: '100% Full', tag: 'No Crop' },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      onClick={() =>
                        setSettings({
                          ...settings,
                          cropFov: preset.val,
                          enableFovCrop: preset.val < 100,
                        })
                      }
                      className={`p-2 rounded border text-center transition-all ${
                        settings.cropFov === preset.val && settings.enableFovCrop
                          ? 'bg-indigo-600 text-white border-indigo-500 font-semibold shadow-xs'
                          : 'bg-neutral-800/60 text-neutral-300 border-neutral-700 hover:bg-neutral-800'
                      }`}
                    >
                      <span className="block text-[11px] font-mono">{preset.label}</span>
                      <span className="block text-[9px] opacity-75">{preset.tag}</span>
                    </button>
                  ))}
                </div>

                {/* Fine-tune Slider */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400">Crop Ratio:</span>
                    <span className="font-mono font-bold text-indigo-300">
                      {settings.cropFov}% Field of View
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    step="1"
                    value={settings.cropFov}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        cropFov: parseInt(e.target.value, 10),
                        enableFovCrop: true,
                      })
                    }
                    className="w-full h-1.5 bg-neutral-800 rounded appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                {/* Dimension Comparison Readout */}
                <div className="flex items-center justify-between p-2 rounded bg-neutral-950/80 border border-neutral-800/80 text-[11px] font-mono">
                  <span className="text-neutral-400">
                    Full Frame: {baseImage.width} × {baseImage.height} px
                  </span>
                  <span className="text-emerald-400 font-semibold">
                    → Cropped: {croppedWidth} × {croppedHeight} px ({effectiveFov}% FOV)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: BUNDLE FOLDER CONTENTS (CROPPED + FULL + VIDEO) */}
          <div className="p-3.5 rounded-lg bg-neutral-800/30 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-200 block text-xs">
                Package Folders to Include in Download
              </span>
              <span className="text-[10px] text-neutral-400">
                Both cropped & full frames included
              </span>
            </div>

            {/* Checkbox 1: Cropped Images Folder */}
            <div className="space-y-1.5 p-2.5 rounded bg-neutral-900/60 border border-emerald-900/40">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.includeCroppedImages}
                    onChange={(e) => setSettings({ ...settings, includeCroppedImages: e.target.checked })}
                    className="w-4 h-4 rounded bg-neutral-800 border-neutral-700 text-emerald-600 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <span className="font-medium text-emerald-200 block">
                      📁 Cropped Images Folder (<code className="text-emerald-300 font-mono">cropped_images/</code>)
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      Clean {effectiveFov}% FOV trimmed frames without edge voids
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                  {images.length} files
                </span>
              </label>
            </div>

            {/* Checkbox 2: Full Aligned Images Folder (intact frames) */}
            <div className="space-y-1.5 p-2.5 rounded bg-neutral-900/60 border border-neutral-800">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.includeFullImages}
                    onChange={(e) => setSettings({ ...settings, includeFullImages: e.target.checked })}
                    className="w-4 h-4 rounded bg-neutral-800 border-neutral-700 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <span className="font-medium text-neutral-200 block">
                      📁 Full Aligned Images Folder (<code className="text-indigo-300 font-mono">aligned_images_full/</code>)
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      Original full dimensions preserved intact
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-neutral-400">
                  {images.length} files
                </span>
              </label>
            </div>

            {/* Format Selection */}
            {(settings.includeCroppedImages || settings.includeFullImages) && (
              <div className="pt-1">
                <span className="text-[11px] text-neutral-400 block mb-1.5">Image Format:</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'image/png', label: 'PNG Lossless', desc: 'Highest clarity' },
                    { id: 'image/jpeg', label: 'JPEG', desc: 'Compact file size' },
                    { id: 'image/webp', label: 'WebP', desc: 'Modern web format' },
                  ].map((fmt) => (
                    <button
                      key={fmt.id}
                      onClick={() => setSettings({ ...settings, format: fmt.id as any })}
                      className={`py-1.5 px-2 rounded border text-left transition-colors ${
                        settings.format === fmt.id
                          ? 'bg-neutral-700/80 border-indigo-500 text-white font-medium'
                          : 'bg-neutral-800/40 border-neutral-750 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <span className="block text-[11px]">{fmt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Checkbox 3: Stabilized Video Folder */}
            <div className="space-y-2 p-2.5 rounded bg-neutral-900/60 border border-neutral-800">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.includeVideo}
                    onChange={(e) => setSettings({ ...settings, includeVideo: e.target.checked })}
                    className="w-4 h-4 rounded bg-neutral-800 border-neutral-700 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <span className="font-medium text-neutral-200 block">
                      📁 Stabilized Video Folder (<code className="text-cyan-300 font-mono">video/</code>)
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      Smooth loop animation with {effectiveFov}% FOV crop applied
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
                  Stabilized
                </span>
              </label>

              {settings.includeVideo && (
                <div className="flex items-center justify-between gap-3 pt-1 text-[11px] text-neutral-400">
                  <div className="flex items-center gap-2">
                    <span>Framerate:</span>
                    <select
                      value={settings.videoFps}
                      onChange={(e) =>
                        setSettings({ ...settings, videoFps: parseInt(e.target.value, 10) })
                      }
                      className="bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 text-neutral-200 font-mono text-xs"
                    >
                      <option value={2}>2 fps (Timelapse)</option>
                      <option value={4}>4 fps</option>
                      <option value={6}>6 fps (Standard)</option>
                      <option value={12}>12 fps (Smooth)</option>
                      <option value={24}>24 fps (Cinematic)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span>Loops:</span>
                    <select
                      value={settings.videoLoops}
                      onChange={(e) =>
                        setSettings({ ...settings, videoLoops: parseInt(e.target.value, 10) })
                      }
                      className="bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 text-neutral-200 font-mono text-xs"
                    >
                      <option value={2}>2 loops</option>
                      <option value={3}>3 loops</option>
                      <option value={5}>5 loops</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Checkbox 4: Coordinates Manifest */}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={settings.includeManifest}
                onChange={(e) => setSettings({ ...settings, includeManifest: e.target.checked })}
                className="w-4 h-4 rounded bg-neutral-800 border-neutral-700 text-indigo-600 focus:ring-0 cursor-pointer"
              />
              <span className="text-neutral-300 text-[11px]">
                Include JSON coordinates manifest (<code className="text-neutral-400 font-mono">alignment_manifest.json</code>)
              </span>
            </label>
          </div>

          {/* Progress Display when exporting */}
          {isExporting && (
            <div className="p-3 bg-indigo-950/60 border border-indigo-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-xs text-indigo-200">
                <span className="truncate font-medium">{progressMsg}</span>
                <span className="font-mono tabular-nums text-emerald-400 font-bold ml-2">
                  {progressPercent}%
                </span>
              </div>
              <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-150 animate-pulse"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-2.5 bg-rose-950/60 border border-rose-800 rounded text-rose-300 text-xs">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-900/90 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopyManifest}
              className="px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 text-xs flex items-center gap-1.5 transition-colors"
              title="Copy alignment coordinates as JSON"
            >
              <FileCode className="w-3.5 h-3.5 text-neutral-400" />
              <span>{copiedManifest ? 'Copied!' : 'JSON'}</span>
            </button>

            <button
              onClick={handleExportVideoOnly}
              disabled={isExporting}
              className="px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Download stabilized animation video only"
            >
              <Film className="w-3.5 h-3.5 text-cyan-400" />
              <span>Video Only</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* Native Folder Picker Button (where supported) */}
            {hasDirectoryPicker && (
              <button
                onClick={handleSaveToLocalFolder}
                disabled={isExporting}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium text-xs rounded border border-neutral-700 transition-colors disabled:opacity-50"
                title="Select a local folder on your computer to save cropped_images/, aligned_images_full/, and video/ directly"
              >
                <Folder className="w-4 h-4 text-amber-400" />
                <span>Save to Folder...</span>
              </button>
            )}

            {/* Main ZIP Bundle Button */}
            <button
              onClick={handleExportZip}
              disabled={isExporting}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-md transition-all shadow-md shadow-indigo-950 disabled:opacity-50 cursor-pointer"
            >
              <FolderArchive className="w-4 h-4" />
              <span>Download Bundle (Cropped & Full Images + Video)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
