import React, { useState, useRef, useEffect } from 'react';
import type { Point } from '../utils/scannerUtils';

interface ManualCropEditorProps {
  imageSrc: string;
  initialCorners: Point[];
  onSave: (corners: Point[]) => void;
  onCancel: () => void;
}

export const ManualCropEditor: React.FC<ManualCropEditorProps> = ({
  imageSrc,
  initialCorners,
  onSave,
  onCancel,
}) => {
  const [corners, setCorners] = useState<Point[]>(initialCorners);
  const [selectedCorner, setSelectedCorner] = useState<number | null>(null);
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0 });
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.onload = () => {
      const container = canvas.parentElement;
      const maxWidth = container ? container.clientWidth * 0.85 : 900;
      const maxHeight = window.innerHeight * 0.65;

      let scale = 1;
      if (img.width > maxWidth) scale = maxWidth / img.width;
      if (img.height * scale > maxHeight) scale = maxHeight / img.height;

      const canvasWidth = Math.round(img.width * scale);
      const canvasHeight = Math.round(img.height * scale);

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      setImgDimensions({ width: img.width, height: img.height });
      setCanvasDimensions({ width: canvasWidth, height: canvasHeight });

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
        redraw(ctx, canvasWidth, canvasHeight, img.width, img.height);
      }
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const redraw = (
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    imgW: number,
    imgH: number
  ) => {
    if (corners.length !== 4) return;

    const scaleX = canvasW / imgW;
    const scaleY = canvasH / imgH;

    const scaledCorners = corners.map((p) => ({
      x: p.x * scaleX,
      y: p.y * scaleY,
    }));

    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scaledCorners[0].x, scaledCorners[0].y);
    for (let i = 1; i < 4; i++) {
      ctx.lineTo(scaledCorners[i].x, scaledCorners[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    scaledCorners.forEach((corner, index) => {
      ctx.fillStyle = selectedCorner === index ? '#EF4444' : '#2563EB';
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  };

  const getCanvasPosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasPosition(e);
    if (imgDimensions.width === 0) return;

    const scaleX = canvasDimensions.width / imgDimensions.width;
    const scaleY = canvasDimensions.height / imgDimensions.height;

    const hitRadius = 12;
    for (let i = 0; i < corners.length; i++) {
      const cornerX = corners[i].x * scaleX;
      const cornerY = corners[i].y * scaleY;
      const distance = Math.hypot(x - cornerX, y - cornerY);

      if (distance < hitRadius) {
        setSelectedCorner(i);
        return;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedCorner === null || imgDimensions.width === 0) return;

    const { x, y } = getCanvasPosition(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const boundX = Math.max(0, Math.min(canvas.width, x));
    const boundY = Math.max(0, Math.min(canvas.height, y));

    const scaleX = imgDimensions.width / canvasDimensions.width;
    const scaleY = imgDimensions.height / canvasDimensions.height;

    const newCorners = [...corners];
    newCorners[selectedCorner] = {
      x: Math.round(boundX * scaleX),
      y: Math.round(boundY * scaleY),
    };
    setCorners(newCorners);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(
          img,
          0,
          0,
          canvas.width,
          canvas.height
        );
        redraw(ctx, canvas.width, canvas.height, imgDimensions.width, imgDimensions.height);
      };
      img.src = imageSrc;
    }
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
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div
        style={{
          background: '#1a1a1a',
          padding: '20px',
          borderRadius: '12px',
          maxWidth: '90vw',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h3 style={{ color: '#fff', marginBottom: '10px', fontSize: '18px' }}>Adjust Corners</h3>
        <p style={{ color: '#888', fontSize: '13px', marginBottom: '20px', margin: '0 0 20px 0' }}>
          Drag the blue dots to adjust crop area
        </p>

        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
            overflow: 'auto',
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
              border: '1px solid #444',
              borderRadius: '8px',
              cursor: selectedCorner !== null ? 'grabbing' : 'grab',
              maxWidth: '100%',
              maxHeight: '100%',
              display: 'block',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 24px',
              background: '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#444')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#333')}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(corners)}
            style={{
              padding: '10px 24px',
              background: '#2563EB',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#1d4ed8')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#2563EB')}
          >
            Save Crop
          </button>
        </div>
      </div>
    </div>
  );
};
