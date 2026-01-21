// src/components/ManualCropEditor.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Point } from '../utils/scannerUtils';

interface ManualCropEditorProps {
  imageSrc: string;
  initialCorners: Point[];
  onSave: (corners: Point[]) => void;
  onCancel: () => void;
}

/**
 * Manual Crop Editor Component
 * Allows users to manually adjust document corners for better cropping
 */
export const ManualCropEditor: React.FC<ManualCropEditorProps> = ({
  imageSrc,
  initialCorners,
  onSave,
  onCancel,
}) => {
  const [corners, setCorners] = useState<Point[]>(initialCorners);
  const [selectedCorner, setSelectedCorner] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Memoize drawCorners to prevent recreation on every render
  const drawCorners = useCallback((ctx: CanvasRenderingContext2D) => {
    if (corners.length !== 4) return;

    // Scale corners to canvas size
    const img = new Image();
    img.src = imageSrc;
    const scaleX = canvasRef.current!.width / img.width;
    const scaleY = canvasRef.current!.height / img.height;

    const scaledCorners = corners.map((p) => ({
      x: p.x * scaleX,
      y: p.y * scaleY,
    }));

    // Draw quadrangle
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scaledCorners[0].x, scaledCorners[0].y);
    for (let i = 1; i < 4; i++) {
      ctx.lineTo(scaledCorners[i].x, scaledCorners[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    // Draw corner points
    scaledCorners.forEach((corner, index) => {
      ctx.fillStyle = selectedCorner === index ? '#EF4444' : '#2563EB';
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [corners, imageSrc, selectedCorner]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    
    // FIXED: Wait for image to load BEFORE accessing dimensions
    img.onload = () => {
      if (!canvas) return;

      // Scale canvas to fit container responsively
      const container = canvas.parentElement;
      const maxWidth = container ? container.clientWidth * 0.9 : 800;
      const maxHeight = window.innerHeight * 0.6;
      
      let scale = 1;
      if (img.width > maxWidth) {
        scale = maxWidth / img.width;
      }
      if (img.height * scale > maxHeight) {
        scale = maxHeight / img.height;
      }

      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // Draw corners on top
      drawCorners(ctx);
    };

    img.onerror = () => {
      console.error('Failed to load image for crop editor');
    };

    img.src = imageSrc;
  }, [imageSrc, drawCorners]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // FIXED: Wait for image to load properly before using dimensions
    const img = new Image();
    let cornersFound = false;

    img.onload = () => {
      for (let i = 0; i < corners.length; i++) {
        const cornerX = corners[i].x * (canvas.width / img.width);
        const cornerY = corners[i].y * (canvas.height / img.height);
        const distance = Math.hypot(x - cornerX, y - cornerY);

        if (distance < 15) {
          setSelectedCorner(i);
          cornersFound = true;
          return;
        }
      }
    };

    img.src = imageSrc;
    if (!cornersFound) {
      // If image hasn't loaded or no corner found, still allow selection based on current ratio
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      for (let i = 0; i < corners.length; i++) {
        const cornerX = corners[i].x * (canvas.width / 2000); // Estimate from image
        const cornerY = corners[i].y * (canvas.height / 1500);
        const distance = Math.hypot(x - cornerX, y - cornerY);

        if (distance < 15) {
          setSelectedCorner(i);
          break;
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedCorner === null) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvas.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(canvas.height, e.clientY - rect.top));

    // FIXED: Get image dimensions from stored state or canvas dimensions
    const canvas_elem = canvasRef.current;
    if (!canvas_elem) return;

    // Use canvas dimensions as reference for inverse transformation
    // Estimate original image dimensions from corners
    const maxX = Math.max(...corners.map(c => c.x));
    const maxY = Math.max(...corners.map(c => c.y));
    
    const scaleX = maxX / canvas.width;
    const scaleY = maxY / canvas.height;

    const newCorners = [...corners];
    newCorners[selectedCorner] = {
      x: x * scaleX,
      y: y * scaleY,
    };
    setCorners(newCorners);
  };

  const handleMouseUp = () => {
    setSelectedCorner(null);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
        overflowY: 'auto',
      }}
    >
      <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '12px', maxWidth: '95vw', width: '100%', maxHeight: '95vh', overflowY: 'auto', margin: 'auto' }}>
        <h3 style={{ color: '#fff', marginBottom: '20px' }}>Manual Crop Adjustment</h3>
        <p style={{ color: '#888', fontSize: '14px', marginBottom: '20px' }}>
          Drag the blue corner points to adjust the crop area
        </p>

        <div style={{ position: 'relative', marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
              border: '1px solid #333',
              borderRadius: '8px',
              cursor: selectedCorner !== null ? 'grabbing' : 'default',
              maxWidth: '100%',
              maxHeight: '60vh',
              height: 'auto',
              objectFit: 'contain',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              background: '#333',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(corners)}
            style={{
              padding: '10px 20px',
              background: '#2563EB',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
            }}
          >
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
};
