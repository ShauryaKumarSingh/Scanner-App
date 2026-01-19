// src/components/Gallery.tsx
import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
interface ScanData {
  id: string;
  originalUrl: string;
  processedUrl: string;
  createdAt: any;
  filename: string;
}

export const Gallery: React.FC = () => {
  const [scans, setScans] = useState<ScanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScan, setSelectedScan] = useState<ScanData | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    // 1. Query: Get scans for THIS user, ordered by newest first
    const q = query(
      collection(db, "scans"),
      where("userId", "==", auth.currentUser.uid),
      orderBy("createdAt", "desc")
    );

    // 2. Real-time Listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedScans = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScanData[];
      
      setScans(loadedScans);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent opening the modal when clicking delete
    if (confirm("Delete this scan record?")) {
      await deleteDoc(doc(db, "scans", id));
      // Note: In a production app, you'd also delete the files from Storage
      if (selectedScan?.id === id) setSelectedScan(null);
    }
  };

  if (loading) return <p className="loading-text">Loading history...</p>;

  return (
    <div className="scanner-container">
      <div className="gallery-section">
        <h3 className="gallery-title">Scan History</h3>
        
        {/* Grid of Thumbnails */}
        {scans.length === 0 ? (
          <p className="empty-state">No scans yet. Try scanning a document above!</p>
        ) : (
          <div className="gallery-grid">
            {scans.map((scan) => (
              <div
                key={scan.id}
                className="gallery-item"
                onClick={() => setSelectedScan(scan)}
              >
                {/* Show the processed version as thumbnail */}
                <img
                  src={scan.processedUrl}
                  alt="scan"
                  className="gallery-item-image"
                />
                
                <div className="gallery-item-content">
                  <div className="gallery-item-title">{scan.filename}</div>
                  <div className="gallery-item-date">
                    {scan.createdAt?.toDate().toLocaleDateString()}
                  </div>
                </div>

                {/* Delete Button - Hidden until hover */}
                <button
                  className="btn btn-danger btn-icon gallery-delete-btn"
                  onClick={(e) => handleDelete(e, scan.id)}
                  title="Delete scan"
                >
                  &#215;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal / Detail View */}
      {selectedScan && (
        <div className="modal-overlay" onClick={() => setSelectedScan(null)}>
          {/* Close Button at Top Right */}
          <button
            className="btn modal-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedScan(null);
            }}
          >
            Close
          </button>

          {/* Image Container */}
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {/* LEFT: Original Image with Zoom */}
            <div className="modal-image-container">
              <div className="modal-image-label">Original</div>
              <div className="modal-image-wrapper">
                <TransformWrapper initialScale={1} minScale={0.5} maxScale={4}>
                  <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
                    <img
                      src={selectedScan.originalUrl}
                      alt="original"
                      className="modal-image"
                    />
                  </TransformComponent>
                </TransformWrapper>
              </div>
            </div>

            {/* RIGHT: Processed Image with Zoom */}
            <div className="modal-image-container">
              <div className="modal-image-label">Processed</div>
              <div className="modal-image-wrapper processed">
                <TransformWrapper initialScale={1} minScale={0.5} maxScale={4}>
                  <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
                    <img
                      src={selectedScan.processedUrl}
                      alt="processed"
                      className="modal-image"
                    />
                  </TransformComponent>
                </TransformWrapper>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};