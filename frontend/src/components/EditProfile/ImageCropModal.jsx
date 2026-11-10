import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

const CROP_SIZE = 280; // Size of the interactive crop box in pixels
const OUTPUT_SIZE = 512; // High-resolution output canvas size

export default function ImageCropModal({
    isOpen,
    imageSrc,
    onClose,
    onCropComplete,
}) {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ mouseX: 0, mouseY: 0, startOffsetX: 0, startOffsetY: 0 });
    const imageRef = useRef(null);
    const [previewUrl, setPreviewUrl] = useState('');

    // Reset settings when a new image source is opened
    useEffect(() => {
        if (isOpen && imageSrc) {
            setZoom(1);
            setRotation(0);
            setOffset({ x: 0, y: 0 });
            setImageLoaded(false);

            const img = new Image();
            img.onload = () => {
                setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
                setImageLoaded(true);
            };
            img.src = imageSrc;
        }
    }, [isOpen, imageSrc]);

    // Effective dimensions based on 90deg / 270deg rotation
    const isSideways = rotation === 90 || rotation === 270;
    const effWidth = isSideways ? naturalSize.height : naturalSize.width;
    const effHeight = isSideways ? naturalSize.width : naturalSize.height;

    // Calculate scale to ensure the image always covers the CROP_SIZE box
    const baseScale = effWidth > 0 && effHeight > 0
        ? Math.max(CROP_SIZE / effWidth, CROP_SIZE / effHeight)
        : 1;
    const totalScale = baseScale * zoom;

    const renderedW = effWidth * totalScale;
    const renderedH = effHeight * totalScale;

    // Clamped offsets to prevent dragging outside of crop boundary
    const maxOffsetX = Math.max(0, (renderedW - CROP_SIZE) / 2);
    const maxOffsetY = Math.max(0, (renderedH - CROP_SIZE) / 2);
    const clampedX = Math.max(-maxOffsetX, Math.min(maxOffsetX, offset.x));
    const clampedY = Math.max(-maxOffsetY, Math.min(maxOffsetY, offset.y));

    // Mouse drag handlers
    const handleMouseDown = (e) => {
        e.preventDefault();
        setIsDragging(true);
        dragStartRef.current = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            startOffsetX: clampedX,
            startOffsetY: clampedY,
        };
    };

    const handleMouseMove = useCallback((e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartRef.current.mouseX;
        const dy = e.clientY - dragStartRef.current.mouseY;
        setOffset({
            x: dragStartRef.current.startOffsetX + dx,
            y: dragStartRef.current.startOffsetY + dy,
        });
    }, [isDragging]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Touch drag handlers
    const handleTouchStart = (e) => {
        if (e.touches.length === 1) {
            setIsDragging(true);
            dragStartRef.current = {
                mouseX: e.touches[0].clientX,
                mouseY: e.touches[0].clientY,
                startOffsetX: clampedX,
                startOffsetY: clampedY,
            };
        }
    };

    const handleTouchMove = useCallback((e) => {
        if (!isDragging || e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - dragStartRef.current.mouseX;
        const dy = e.touches[0].clientY - dragStartRef.current.mouseY;
        setOffset({
            x: dragStartRef.current.startOffsetX + dx,
            y: dragStartRef.current.startOffsetY + dy,
        });
    }, [isDragging]);

    const handleTouchEnd = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Wheel zoom
    const handleWheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY * -0.002;
        setZoom((prev) => Math.min(3, Math.max(1, +(prev + delta).toFixed(2))));
    };

    // Attach global mouseup/mousemove listeners while dragging
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchmove', handleTouchMove);
            window.addEventListener('touchend', handleTouchEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

    // Live preview generator
    useEffect(() => {
        if (!imageLoaded || !imageSrc) return;

        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');

        const ratio = 120 / CROP_SIZE;
        ctx.save();
        ctx.beginPath();
        ctx.arc(60, 60, 60, 0, Math.PI * 2);
        ctx.clip();

        ctx.translate(60, 60);
        ctx.translate(clampedX * ratio, clampedY * ratio);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(totalScale * ratio, totalScale * ratio);

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            ctx.drawImage(img, -naturalSize.width / 2, -naturalSize.height / 2, naturalSize.width, naturalSize.height);
            ctx.restore();
            setPreviewUrl(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = imageSrc;
    }, [imageLoaded, imageSrc, zoom, rotation, clampedX, clampedY, totalScale, naturalSize]);

    // Generate final crop blob and return File
    const handleApply = async () => {
        if (!imageLoaded || !imageSrc) return;

        const canvas = document.createElement('canvas');
        canvas.width = OUTPUT_SIZE;
        canvas.height = OUTPUT_SIZE;
        const ctx = canvas.getContext('2d');

        const ratio = OUTPUT_SIZE / CROP_SIZE;

        ctx.save();
        // Optional circular clip if preferred, but standard is high-res square crop so circular CSS renders cleanly
        ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);
        ctx.translate(clampedX * ratio, clampedY * ratio);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(totalScale * ratio, totalScale * ratio);

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            ctx.drawImage(img, -naturalSize.width / 2, -naturalSize.height / 2, naturalSize.width, naturalSize.height);
            ctx.restore();

            canvas.toBlob((blob) => {
                if (!blob) return;
                const croppedFile = new File([blob], 'cropped-profile.jpg', { type: 'image/jpeg' });
                const finalPreview = URL.createObjectURL(blob);
                onCropComplete?.(croppedFile, finalPreview);
                onClose?.();
            }, 'image/jpeg', 0.92);
        };
        img.src = imageSrc;
    };

    if (!isOpen || !imageSrc) return null;

    return createPortal(
        <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
            <div 
                className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div>
                        <h3 className="text-base font-bold text-slate-900">Crop Profile Picture</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Drag to reposition, use slider to zoom</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                        aria-label="Close"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 flex flex-col items-center">
                    {/* Interactive Crop Viewport */}
                    <div
                        className="relative overflow-hidden rounded-2xl bg-slate-900 cursor-grab active:cursor-grabbing flex items-center justify-center touch-none shadow-inner"
                        style={{ width: `${CROP_SIZE}px`, height: `${CROP_SIZE}px` }}
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleTouchStart}
                        onWheel={handleWheel}
                    >
                        {imageLoaded && (
                            <img
                                ref={imageRef}
                                src={imageSrc}
                                alt="To crop"
                                draggable={false}
                                style={{
                                    width: `${naturalSize.width}px`,
                                    height: `${naturalSize.height}px`,
                                    maxWidth: 'none',
                                    position: 'absolute',
                                    left: '50%',
                                    top: '50%',
                                    transform: `translate(-50%, -50%) translate(${clampedX}px, ${clampedY}px) rotate(${rotation}deg) scale(${totalScale})`,
                                    transformOrigin: 'center center',
                                    transition: isDragging ? 'none' : 'transform 100ms ease-out',
                                }}
                                className="pointer-events-none select-none"
                            />
                        )}

                        {/* Circular Mask with Outer Vignette */}
                        <div 
                            className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.65)]"
                        />

                        {/* Rule of Thirds Guide Lines inside circle */}
                        <div className="pointer-events-none absolute inset-0 rounded-full overflow-hidden opacity-30">
                            <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                                <div className="border-r border-b border-white" />
                                <div className="border-r border-b border-white" />
                                <div className="border-b border-white" />
                                <div className="border-r border-b border-white" />
                                <div className="border-r border-b border-white" />
                                <div className="border-b border-white" />
                                <div className="border-r border-white" />
                                <div className="border-r border-white" />
                                <div />
                            </div>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="w-full max-w-[320px] mt-5 space-y-4">
                        {/* Zoom Slider */}
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setZoom((prev) => Math.max(1, +(prev - 0.1).toFixed(2)))}
                                className="p-1 rounded-md text-slate-500 hover:bg-slate-100 transition"
                                title="Zoom out"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                            </button>

                            <input
                                type="range"
                                min={1}
                                max={3}
                                step={0.01}
                                value={zoom}
                                onChange={(e) => setZoom(parseFloat(e.target.value))}
                                className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />

                            <button
                                type="button"
                                onClick={() => setZoom((prev) => Math.min(3, +(prev + 0.1).toFixed(2)))}
                                className="p-1 rounded-md text-slate-500 hover:bg-slate-100 transition"
                                title="Zoom in"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                            </button>
                        </div>

                        {/* Bottom Actions: Rotate & Reset & Live Preview */}
                        <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setRotation((prev) => (prev + 90) % 360)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition active:scale-95"
                                >
                                    <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    <span>Rotate</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setZoom(1);
                                        setRotation(0);
                                        setOffset({ x: 0, y: 0 });
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                                >
                                    Reset
                                </button>
                            </div>

                            {/* Circular Live Preview */}
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-medium text-slate-400">Preview:</span>
                                <div className="h-9 w-9 rounded-full overflow-hidden border-2 border-blue-500 shadow-2xs bg-slate-100">
                                    {previewUrl && (
                                        <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 transition"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleApply}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 transition active:scale-95"
                    >
                        Save & Apply Crop
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
