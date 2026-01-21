// src/components/Gallery.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, deleteDoc, doc, limit, startAfter, getDocs, type QueryDocumentSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

interface ScanData {
  id: string;
  originalUrl: string;
  processedUrl: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any; // Firestore Timestamp
  filename: string;
  confidence?: number; // Confidence score (0-100)
}

export const Gallery: React.FC = () => {
  const [scans, setScans] = useState<ScanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScan, setSelectedScan] = useState<ScanData | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastDocRef = useRef<QueryDocumentSnapshot | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  
  const ITEMS_PER_PAGE = 12;
  
  const loadMoreScans = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !lastDocRef.current || loadingMore) return;
    setLoadingMore(true);

    try {
      const q = query(
        collection(db, "scans"),
        where("userId", "==", currentUser.uid),
        orderBy("createdAt", "desc"),
        startAfter(lastDocRef.current),
        limit(ITEMS_PER_PAGE)
      );

      const snapshot = await getDocs(q);
      const newScans = snapshot.docs.map(document => ({
        id: document.id,
        ...document.data()
      })) as ScanData[];

      setScans(prev => [...prev, ...newScans]);
      setHasMore(snapshot.docs.length === ITEMS_PER_PAGE);
      lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
    } catch (error) {
      console.error('Error loading more scans:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore]); // Only depend on loadingMore, not auth.currentUser which is external

  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    if (loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        loadMoreScans();
      }
    });
    if (node) observerRef.current.observe(node);
  }, [hasMore, loadingMore, loadMoreScans]);

  // Initial load with pagination - FIXED: Wait for auth state
  useEffect(() => {
    // Listen for auth state change instead of checking currentUser directly
    const unsubscribe = onAuthStateChanged(auth, (currentUser: User | null) => {
      if (!currentUser) {
        setScans([]);
        setLoading(false);
        return;
      }

      loadInitialScans();

      // FIXED: Listen for save event from DebugScanner
      const handleScanSaved = () => {
        console.log('Scan saved event received, refreshing gallery...');
        loadInitialScans();
      };

      window.addEventListener('scanSaved', handleScanSaved);
      return () => window.removeEventListener('scanSaved', handleScanSaved);
    });

    return unsubscribe;
  }, []);

  const loadInitialScans = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const q = query(
        collection(db, "scans"),
        where("userId", "==", currentUser.uid),
        orderBy("createdAt", "desc"),
        limit(ITEMS_PER_PAGE)
      );

      const snapshot = await getDocs(q);
      const loadedScans = snapshot.docs.map(document => ({
        id: document.id,
        ...document.data()
      })) as ScanData[];

      setScans(loadedScans);
      setHasMore(snapshot.docs.length === ITEMS_PER_PAGE);
      lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
    } catch (error) {
      console.error('Error loading scans:', error);
    } finally {
      setLoading(false);
    }
  };


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
        
        {/* Storage Info Panel */}
        <div style={{
          background: 'rgba(37, 99, 235, 0.1)',
          border: '1px solid rgba(37, 99, 235, 0.3)',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px',
          fontSize: '12px',
          color: '#888'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <div style={{ color: '#2563EB', fontWeight: '600', marginBottom: '4px' }}>📍 Storage Location</div>
              <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#666', wordBreak: 'break-all' }}>
                Cloud Storage: scans/{auth.currentUser?.uid}/
              </div>
            </div>
            <div>
              <div style={{ color: '#2563EB', fontWeight: '600', marginBottom: '4px' }}>📦 Scans Saved</div>
              <div style={{ fontSize: '14px', color: '#fff', fontWeight: '600' }}>
                {scans.length} document{scans.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div>
              <div style={{ color: '#2563EB', fontWeight: '600', marginBottom: '4px' }}>🗄️ Database</div>
              <div style={{ fontSize: '11px', color: '#666' }}>
                Firestore: scans/{auth.currentUser?.uid || 'user-id'}
              </div>
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '10px', color: '#555', lineHeight: '1.5' }}>
            💡 Images stored in Firebase Cloud Storage (gs://bucket/scans/). Metadata in Firestore. Storage path automatically organized by user ID.
          </div>
        </div>
        
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
                {/* Show the processed version as thumbnail - Lazy loaded */}
                <img
                  src={scan.processedUrl}
                  alt="scan"
                  className="gallery-item-image"
                  loading="lazy"
                />
                
                <div className="gallery-item-content">
                  <div className="gallery-item-title">{scan.filename}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <div className="gallery-item-date">
                      {scan.createdAt?.toDate().toLocaleDateString()}
                    </div>
                    {scan.confidence !== undefined && (
                      <span style={{
                        background: scan.confidence >= 80 
                          ? 'rgba(16, 185, 129, 0.2)' 
                          : scan.confidence >= 50 
                          ? 'rgba(245, 158, 11, 0.2)' 
                          : 'rgba(239, 68, 68, 0.2)',
                        color: scan.confidence >= 80 
                          ? '#34D399' 
                          : scan.confidence >= 50 
                          ? '#FBBF24' 
                          : '#F87171',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        border: `1px solid ${scan.confidence >= 80 
                          ? 'rgba(16, 185, 129, 0.3)' 
                          : scan.confidence >= 50 
                          ? 'rgba(245, 158, 11, 0.3)' 
                          : 'rgba(239, 68, 68, 0.3)'}`
                      }}>
                        {scan.confidence}%
                      </span>
                    )}
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
        
        {/* Lazy loading trigger */}
        {hasMore && (
          <div ref={loadMoreRef} style={{ height: '20px', marginTop: '20px' }}>
            {loadingMore && <p style={{ textAlign: 'center', color: '#888' }}>Loading more...</p>}
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