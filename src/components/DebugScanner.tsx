import React, { useState, useRef } from 'react';
import { useOpenCv } from '../hooks/UseOpenCv';
import { scanDocument, type ScannedDoc, type Point } from '../utils/scannerUtils';
import { auth } from '../firebase';
import { saveScanToFirestore } from '../utils/storageUtils';
import { convertPdfToImage } from '../utils/pdfUtils';
import { ManualCropEditor } from './ManualCropEditor';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

const DebugScanner: React.FC = () => {
  const cvLoaded = useOpenCv();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [scannedDocs, setScannedDocs] = useState<ScannedDoc[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [editingDoc, setEditingDoc] = useState<ScannedDoc | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ScannedDoc | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trigger gallery refresh when a scan is saved
  const triggerGalleryRefresh = () => {
    window.dispatchEvent(new CustomEvent('scanSaved'));
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    try {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading image:', error);
      alert('Failed to download image');
    }
  };

  const processFile = async (file: File) => {
    try {
      let url = '';

      if (file.type === 'application/pdf') {
        url = await convertPdfToImage(file);
      } else if (file.type.startsWith('image/')) {
        url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              resolve(event.target.result as string);
            } else {
              reject(new Error('Failed to read file'));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else {
        throw new Error('Unsupported file type. Please upload an image or PDF.');
      }

      setImageSrc(url);
      setScannedDocs([]);
    } catch (err) {
      console.error('Error processing file:', err);
      alert(err instanceof Error ? err.message : 'Failed to load file. Please try a valid image or PDF.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
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
    } else {
      alert('Please drop an image or PDF file.');
    }
  };

  // 2. Trigger the Advanced Scan
  const handleScan = async (): Promise<void> => {
    if (!imageSrc || !cvLoaded) return;
    
    setIsProcessing(true);
    setScannedDocs([]); // Reset UI

    try {
      // 🧠 Call the new Multi-Doc Engine
      // Note: We cast window to access cv since it's loaded globally via script tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cv = (window as any).cv;
      if (!cv) {
        throw new Error('OpenCV is not loaded. Please wait for the library to initialize.');
      }
      
      const docs = await scanDocument(cv, imageSrc);
      
      if (docs.length > 0) {
        setScannedDocs(docs);
        console.log(`✅ Success: Found ${docs.length} document(s).`);
      } else {
        // Provide helpful suggestions to user
        const suggestions = [
          "📷 Ensure the document edges are clearly visible",
          "💡 Check your lighting - avoid shadows on the document",
          "🎯 Ensure the entire document is in frame",
          "📄 For best results, place the document on a contrasting background",
          "🔄 Try rotating your device or camera",
          "✨ Make sure the document is not too small or crumpled"
        ];
        const randomSuggestions = suggestions.sort(() => Math.random() - 0.5).slice(0, 2).join("\n");
        
        alert(
          `❌ No clear document found.\n\nTry these tips:\n${randomSuggestions}`
        );
      }
    } catch (err) {
      console.error("Scan failed:", err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      alert(`❌ Error processing image:\n${errorMsg}\n\nMake sure:\n- Image format is supported\n- File size is reasonable\n- Document has clear edges`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Save a Specific Document
  const handleSave = async (doc: ScannedDoc) => {
    if (!auth.currentUser) {
      alert("Please login to save scans.");
      return;
    }

    try {
      const user = auth.currentUser;
      
      // Validate document data
      if (!doc.dataUrl) {
        throw new Error('Document image data is missing');
      }
      if (!imageSrc) {
        throw new Error('Original image data is missing');
      }

      // Save with confidence score
      await saveScanToFirestore(
        user.uid,
        doc.dataUrl,
        imageSrc,
        doc.confidence
      );
      
      // FIXED: Trigger gallery refresh after successful save
      triggerGalleryRefresh();
      
      alert("✅ Document saved to Gallery!");
    } catch (error) {
      console.error("Save error:", error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`❌ Failed to save document: ${errorMsg}`);
    }
  };

  return (
    <div className="scanner-container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '30px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#fff' }}>New Scan</h2>
        <p style={{ color: '#888' }}>Upload a document to auto-detect and crop.</p>
      </div>

      {/* Upload Area */}
      <div 
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isDragOver ? '#2563EB' : '#444'}`,
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          cursor: 'pointer',
          background: isDragOver ? '#1a1a2e' : '#111',
          marginBottom: '30px',
          transition: 'all 0.2s ease'
        }}
      >
        <input 
          type="file" 
          accept="image/*,application/pdf" 
          onChange={handleFileUpload} 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
        />
        {!imageSrc ? (
          <div style={{ color: '#666' }}>
            <span style={{ fontSize: '32px', display: 'block', marginBottom: '10px' }}>📂</span>
            <p>Click to Upload or Drag & Drop</p>
            <p style={{ fontSize: '12px', marginTop: '8px', color: '#555' }}>Supports images and PDF files</p>
          </div>
        ) : (
          <div style={{ position: 'relative', height: '300px' }}>
            <img 
              src={imageSrc} 
              alt="Preview" 
              style={{ maxHeight: '100%', maxWidth: '100%', borderRadius: '8px', objectFit: 'contain' }} 
            />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '40px' }}>
        <button 
          onClick={handleScan}
          disabled={!imageSrc || !cvLoaded || isProcessing}
          className="btn-primary"
          style={{
            padding: '12px 30px',
            borderRadius: '8px',
            background: isProcessing ? '#444' : '#2563EB',
            color: 'white',
            border: 'none',
            fontSize: '16px',
            fontWeight: '600',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            opacity: (!imageSrc || !cvLoaded) ? 0.5 : 1
          }}
        >
          {isProcessing ? 'Processing...' : '✨ Detect & Scan'}
        </button>
      </div>

      {/* RESULTS CAROUSEL (The New Part) */}
      {scannedDocs.length > 0 && (
        <div className="results-area" style={{ borderTop: '1px solid #333', paddingTop: '30px' }}>
          <h3 style={{ color: '#fff', marginBottom: '20px', fontSize: '18px' }}>
            Detected {scannedDocs.length} Document{scannedDocs.length > 1 ? 's' : ''}
          </h3>
          
          <div style={{ 
            display: 'flex', 
            gap: '20px', 
            overflowX: 'auto', 
            paddingBottom: '20px' 
          }}>
            {scannedDocs.map((doc, index) => (
              <div key={doc.id} style={{ 
                minWidth: '280px', 
                maxWidth: '320px',
                background: '#1a1a1a', 
                borderRadius: '12px', 
                padding: '15px',
                border: '1px solid #333',
                flexShrink: 0
              }}>
                {/* Confidence Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'center' }}>
                  <span style={{ color: '#888', fontSize: '12px', fontWeight: '500' }}>RESULT #{index + 1}</span>
                  <span style={{ 
                    background: doc.confidence >= 80 
                      ? 'rgba(16, 185, 129, 0.2)' 
                      : doc.confidence >= 50 
                      ? 'rgba(245, 158, 11, 0.2)' 
                      : 'rgba(239, 68, 68, 0.2)', 
                    color: doc.confidence >= 80 
                      ? '#34D399' 
                      : doc.confidence >= 50 
                      ? '#FBBF24' 
                      : '#F87171', 
                    padding: '4px 8px', 
                    borderRadius: '6px', 
                    fontSize: '11px', 
                    fontWeight: 'bold',
                    border: `1px solid ${doc.confidence >= 80 
                      ? 'rgba(16, 185, 129, 0.3)' 
                      : doc.confidence >= 50 
                      ? 'rgba(245, 158, 11, 0.3)' 
                      : 'rgba(239, 68, 68, 0.3)'}`
                  }}>
                    {doc.confidence}% CONFIDENCE
                  </span>
                </div>

                {/* The Crop */}
                <div 
                onClick={() => setPreviewDoc(doc)}
                style={{ 
                  height: '200px', 
                  background: '#000', 
                  borderRadius: '8px', 
                  overflow: 'hidden', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginBottom: '15px',
                  border: '1px solid #333',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s'
                }}>
                  <img 
                    src={doc.dataUrl} 
                    alt={`Scan ${index}`} 
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} 
                  />
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setEditingDoc(doc)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: '#333',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '12px',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#444'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#333'}
                  >
                    ✏️ Adjust
                  </button>
                  <button
                    onClick={() => downloadImage(doc.dataUrl, `scan-${Date.now()}.jpg`)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: '#16a34a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '12px',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#15803d'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#16a34a'}
                  >
                    ⬇️ Download
                  </button>
                  <button
                    onClick={() => handleSave(doc)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: '#fff',
                      color: '#000',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '12px',
                      transition: 'opacity 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                    onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    ☁️ Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PREVIEW MODAL WITH ZOOM & DOWNLOAD */}
      {previewDoc && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '20px'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            maxWidth: '1000px',
            marginBottom: '16px',
            color: '#fff'
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px' }}>Scan Preview</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#888' }}>
                Use mouse wheel or pinch to zoom | Pan with click & drag
              </p>
            </div>
            <button
              onClick={() => setPreviewDoc(null)}
              style={{
                background: '#333',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px'
              }}
            >
              ✕ Close
            </button>
          </div>

          {/* Zoomable Image Container */}
          <div style={{
            width: '100%',
            maxWidth: '1000px',
            height: '80vh',
            background: '#000',
            borderRadius: '12px',
            border: '1px solid #333',
            overflow: 'hidden'
          }}>
            <TransformWrapper initialScale={1} minScale={0.5} maxScale={5}>
              <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
                <img
                  src={previewDoc.dataUrl}
                  alt="preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                  }}
                />
              </TransformComponent>
            </TransformWrapper>
          </div>

          {/* Footer with Actions */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '16px',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => downloadImage(previewDoc.dataUrl, `scan-${Date.now()}.jpg`)}
              style={{
                padding: '12px 24px',
                background: '#16a34a',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#15803d'}
              onMouseOut={(e) => e.currentTarget.style.background = '#16a34a'}
            >
              ⬇️ Download to PC
            </button>
            <button
              onClick={() => handleSave(previewDoc)}
              style={{
                padding: '12px 24px',
                background: '#2563EB',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#1d4ed8'}
              onMouseOut={(e) => e.currentTarget.style.background = '#2563EB'}
            >
              ☁️ Save to Gallery
            </button>
            <button
              onClick={() => setEditingDoc(previewDoc)}
              style={{
                padding: '12px 24px',
                background: '#ea580c',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#c2410c'}
              onMouseOut={(e) => e.currentTarget.style.background = '#ea580c'}
            >
              ✏️ Adjust & Crop
            </button>
          </div>
        </div>
      )}

      {/* Manual Crop Editor Modal */}
      {editingDoc && imageSrc && (
        <ManualCropEditor
          imageSrc={imageSrc}
          initialCorners={editingDoc.corners}
          onSave={async (newCorners: Point[]): Promise<void> => {
            // Re-warp the image with new corners
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const cv = (window as any).cv;
              if (!cv) {
                alert('OpenCV not loaded');
                return;
              }

              // Create new warped image with adjusted corners
              const img = new Image();
              img.src = imageSrc;
              await new Promise<void>((resolve) => {
                img.onload = () => resolve();
              });

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const src = cv.imread(img);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const warpedMat = warpPerspective(cv, src, newCorners);
              
              const resultCanvas = document.createElement('canvas');
              cv.imshow(resultCanvas, warpedMat);
              const resultDataUrl = resultCanvas.toDataURL('image/jpeg', 0.85);
              const blob = dataUrlToBlob(resultDataUrl);

              // Update the document
              const updatedDoc: ScannedDoc = {
                ...editingDoc,
                dataUrl: resultDataUrl,
                blob,
                corners: newCorners,
              };

              setScannedDocs(prev => prev.map(d => d.id === editingDoc.id ? updatedDoc : d));
              setEditingDoc(null);

              src.delete();
              warpedMat.delete();
            } catch (error) {
              console.error('Error adjusting crop:', error);
              alert('Failed to adjust crop');
            }
          }}
          onCancel={() => setEditingDoc(null)}
        />
      )}
    </div>
  );
};

// Helper functions for manual crop (duplicated from scannerUtils for component use)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const warpPerspective = (cv: any, src: any, corners: Point[]): any => {
  const widthTop = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
  const widthBottom = Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y);
  const maxWidth = Math.max(widthTop, widthBottom);
  const heightLeft = Math.hypot(corners[0].x - corners[3].x, corners[0].y - corners[3].y);
  const heightRight = Math.hypot(corners[1].x - corners[2].x, corners[1].y - corners[2].y);
  const maxHeight = Math.max(heightLeft, heightRight);

  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    corners[0].x, corners[0].y, corners[1].x, corners[1].y,
    corners[2].x, corners[2].y, corners[3].x, corners[3].y
  ]);
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0, maxWidth, 0, maxWidth, maxHeight, 0, maxHeight
  ]);

  const M = cv.getPerspectiveTransform(srcTri, dstTri);
  const dst = new cv.Mat();
  cv.warpPerspective(src, dst, M, new cv.Size(Math.round(maxWidth), Math.round(maxHeight)), cv.INTER_CUBIC, cv.BORDER_CONSTANT, new cv.Scalar());
  
  srcTri.delete();
  dstTri.delete();
  M.delete();
  return dst;
};

const dataUrlToBlob = (dataUrl: string): Blob => {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    throw new Error('Invalid data URL format: must start with "data:"');
  }

  const arr = dataUrl.split(',');
  if (arr.length < 2) {
    throw new Error('Invalid data URL format: missing comma separator');
  }

  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  
  if (!mime.startsWith('image/')) {
    throw new Error(`Invalid MIME type: ${mime}. Expected image/*`);
  }

  try {
    const bstr = atob(arr[1]);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
    return new Blob([u8arr], { type: mime });
  } catch (err) {
    throw new Error(`Failed to decode base64 data: ${err}`);
  }
};

export default DebugScanner;