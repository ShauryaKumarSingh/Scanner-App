// src/components/DebugScanner.tsx
import React, { useRef, useState } from 'react';
import { useOpenCv } from '../hooks/UseOpenCv';
import { scanDocument } from '../utils/scannerUtils';
import { auth } from '../firebase'; 
import { saveScanRecord } from '../utils/storageUtils';
import { convertPdfToImage } from '../utils/pdfUtils';

const DebugScanner: React.FC = () => {
  // 1. Use our hook to listen for OpenCV
  const cvLoaded = useOpenCv();
  
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper: Process file (extracted for reuse)
  const processFile = async (file: File) => {
    try {
      let url = "";

      // Check if it's a PDF
      if (file.type === 'application/pdf') {
        // Convert first page to image
        url = await convertPdfToImage(file);
      } else {
        // It's already an image, just create URL
        url = URL.createObjectURL(file);
      }

      setImageSrc(url);
      
      // Reset the canvas when a new file is loaded
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && canvasRef.current) {
         ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    } catch (err) {
      console.error("Error processing file:", err);
      alert("Failed to load file. Please try a valid Image or PDF.");
    }
  };

  // Helper: Handle file selection
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      await processFile(file);
    }
  };

  const handleDropZoneClick = () => {
    fileInputRef.current?.click();
  };

  // Helper: Run the computer vision logic
//   const processImage = () => {
//     if (!cvLoaded || !imageSrc || !canvasRef.current) return;

//     const img = new Image();
//     img.src = imageSrc;
//     img.onload = () => {
//       // @ts-ignore
//       const cv = window.cv;
      
//       try {
//         // Read image from the DOM <img /> element
//         const src = cv.imread('uploaded-image'); // 'uploaded-image' is the ID we gave the img tag below
//         const dst = new cv.Mat();

//         // Convert to Grayscale (simplifies data for edge detection)
//         cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);

//         // Detect Edges (Canny algorithm)
//         cv.Canny(src, dst, 50, 100, 3, false);

//         // Show result on the canvas
//         cv.imshow(canvasRef.current, dst);

//         // CLEANUP MEMORY (Very important in WebAssembly)
//         src.delete();
//         dst.delete();
//       } catch (err) {
//         console.error("OpenCV Error:", err);
//       }
//     };
//   };
// src/components/DebugScanner.tsx

// 1. Import the new function


// ... inside the component ...

  const processImage = () => {
    if (!cvLoaded || !imageSrc || !canvasRef.current) return;

    setTimeout(() => {
        // SAFETY CHECK: Ensure the canvas still exists when the timer fires
const imgElement = document.getElementById('uploaded-image') as HTMLImageElement;

// 👇 Fix: Cast window to 'any' to stop the TypeScript error
if (imgElement && (window as any).cv) {
    scanDocument((window as any).cv, 'processed-canvas', imgElement);
} else {
    console.error("Image element not found or OpenCV not ready");
}
    }, 100);
};

  // IMPORTANT: Ensure your canvas has an ID
  // Update your JSX:
  // <canvas id="processed-canvas" ref={canvasRef} ... />
const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!canvasRef.current || !imageSrc || !auth.currentUser) return;
    setIsSaving(true);

    try {
      // 1. Resize/Compress Original Image (New Step)
      // We draw the original to a small canvas to force compression
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      const img = document.getElementById('uploaded-image') as HTMLImageElement;
      
      // Limit max width to 800px to keep file size under 1MB
      const scale = 800 / img.naturalWidth;
      tempCanvas.width = 800;
      tempCanvas.height = img.naturalHeight * scale;
      
      if (tempCtx) {
          tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
      }

      // Convert to small Blob
      const originalBlob = await new Promise<Blob | null>(resolve => 
          tempCanvas.toBlob(resolve, 'image/jpeg', 0.7) // 70% quality
      );
      
      if (!originalBlob) throw new Error("Could not compress original");
      const originalFile = new File([originalBlob], "scan.jpg", { type: "image/jpeg" });

      // 2. Convert Processed Canvas to Blob
      const processedBlob = await new Promise<Blob | null>(resolve => 
          canvasRef.current!.toBlob(resolve, 'image/jpeg', 0.7)
      );

      if (!processedBlob) throw new Error("Could not compress processed");

      // 3. Save
      await saveScanRecord(auth.currentUser.uid, originalFile, processedBlob);
      alert("✅ Scan saved successfully!");

    } catch (error) {
      console.error(error);
      alert("❌ Error saving scan (File might be too big).");
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <div className="scanner-container">
      <div className="scanner-section">
        <h2 className="scanner-title">Document Scanner</h2>
        
        {/* Status Indicator */}
        <div className={`status-indicator ${cvLoaded ? 'ready' : 'loading'}`}>
          {cvLoaded ? 'OpenCV Ready' : 'Loading Library...'}
        </div>

        {/* Drag & Drop Zone */}
        <div
          className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleDropZoneClick}
        >
          <div className="drop-zone-icon">📄</div>
          <div className="drop-zone-text">Drop file here or click to browse</div>
          <div className="drop-zone-hint">Supports images and PDF files</div>
          <input
            ref={fileInputRef}
            type="file"
            className="file-input"
            onChange={handleUpload}
            accept="image/*,application/pdf"
          />
        </div>

        {/* Canvas Preview Container */}
        {imageSrc && (
          <div className="canvas-container">
            {/* Original Image */}
            <div className="image-preview-card">
              <div className="preview-label">Original</div>
              <img
                id="uploaded-image"
                src={imageSrc}
                alt="upload"
                className="preview-image"
              />
            </div>

            {/* Processed Canvas */}
            <div className="image-preview-card">
              <div className="preview-label">Processed</div>
              <canvas
                id="processed-canvas"
                ref={canvasRef}
                width="300"
                height="400"
                className="preview-canvas"
              />
            </div>
          </div>
        )}

        {/* Action Bar */}
        {imageSrc && (
          <div className="action-bar">
            <button
              className="btn"
              onClick={processImage}
              disabled={!cvLoaded || !imageSrc}
            >
              Detect Edges
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={isSaving || !imageSrc}
            >
              {isSaving ? 'Saving...' : 'Save to Cloud'}
            </button>
          </div>
        )}

        {/* Metadata */}
        <div className="metadata">
          <div>User: {auth.currentUser?.email || 'Not authenticated'}</div>
          <div>Status: {imageSrc ? 'Ready to Process' : 'Waiting for file'}</div>
        </div>
      </div>
    </div>
  );
};

export default DebugScanner;
