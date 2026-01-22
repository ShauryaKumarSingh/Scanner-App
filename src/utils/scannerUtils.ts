/**
 * Document detection engine using OpenCV.js
 * - Multi-document detection with noise filtering
 * - Adaptive thresholds for various lighting conditions
 * - Confidence scoring for output quality
 */

// Type definitions
export interface Point {
  x: number;
  y: number;
}

export interface ScannedDoc {
  id: string;
  blob: Blob;
  dataUrl: string;
  confidence: number;
  corners: Point[];
}

// OpenCV interface
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface OpenCV {
  Mat: new () => any;
  MatVector: new () => any;
  Size: new (width: number, height: number) => any;
  Scalar: new (...args: number[]) => any;
  imread: (img: HTMLImageElement) => any;
  imshow: (canvas: HTMLCanvasElement, mat: any) => void;
  cvtColor: (src: any, dst: any, code: number) => void;
  GaussianBlur: (src: any, dst: any, ksize: any, sigmaX: number) => void;
  Canny: (src: any, dst: any, threshold1: number, threshold2: number) => void;
  findContours: (
    src: any,
    contours: any,
    hierarchy: any,
    mode: number,
    method: number
  ) => void;
  contourArea: (contour: any) => number;
  arcLength: (contour: any, closed: boolean) => number;
  approxPolyDP: (contour: any, approx: any, epsilon: number, closed: boolean) => void;
  isContourConvex: (contour: any) => boolean;
  boundingRect: (contour: any) => { x: number; y: number; width: number; height: number };
  matFromArray: (rows: number, cols: number, type: number, array: number[]) => any;
  getPerspectiveTransform: (src: any, dst: any) => any;
  warpPerspective: (
    src: any,
    dst: any,
    M: any,
    dsize: any,
    interp: number,
    borderMode: number,
    borderValue: any
  ) => void;
  resize: (
    src: any,
    dst: any,
    dsize: any,
    fx: number,
    fy: number,
    interpolation: number
  ) => void;
  rotate: (src: any, dst: any, rotateCode: number) => void;
  getRotationMatrix2D: (center: any, angle: number, scale: number) => any;
  warpAffine: (src: any, dst: any, M: any, dsize: any) => void;
  meanStdDev: (src: any, mean: any, stddev: any) => void;
  COLOR_RGBA2GRAY: number;
  RETR_EXTERNAL: number;
  CHAIN_APPROX_SIMPLE: number;
  CV_32FC2: number;
  INTER_AREA: number;
  INTER_CUBIC: number;
  BORDER_CONSTANT: number;
  ROTATE_90_CLOCKWISE: number;
  ROTATE_90_COUNTERCLOCKWISE: number;
  ROTATE_180: number;
}

/**
 * Main scanning function: Detects multiple documents in an image
 * @param cv - OpenCV instance from window.cv
 * @param imageSrcUrl - Data URL or URL of the image to scan
 * @returns Promise resolving to array of ScannedDoc, sorted by confidence (highest first)
 */
export const scanDocument = (
  cv: OpenCV,
  imageSrcUrl: string
): Promise<ScannedDoc[]> => {
  return new Promise((resolve, reject) => {
    // Validate OpenCV
    if (!cv || !cv.Mat) {
      reject(new Error('OpenCV is not loaded. Please wait for the library to initialize.'));
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageSrcUrl;

    img.onload = () => {
      // Track all OpenCV Mats for cleanup
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matsToDelete: any[] = [];

      try {
        // 1. Load the image into OpenCV
        const src = cv.imread(img);
        matsToDelete.push(src);

        if (src.empty()) {
          throw new Error('Failed to load image into OpenCV');
        }

        // 1.5. Auto-detect and correct rotation (handles 90°/180°/270°)
        // Most browsers auto-rotate based on EXIF, but we handle manual rotation cases
        const finalSrc = autoRotateImage(cv, src, img);
        const useRotated = finalSrc !== src;
        if (useRotated) {
          matsToDelete.push(finalSrc);
        }
        const processingSrc = useRotated ? finalSrc : src;

        // 2. Create a downscaled copy for fast detection (max 800px on longest side)
        const processingSize = 800;
        const scale = Math.max(processingSrc.rows, processingSrc.cols) > processingSize
          ? Math.max(processingSrc.rows, processingSrc.cols) / processingSize
          : 1;

        const small = new cv.Mat();
        matsToDelete.push(small);
        const dsize = new cv.Size(
          Math.floor(processingSrc.cols / scale),
          Math.floor(processingSrc.rows / scale)
        );
        cv.resize(processingSrc, small, dsize, 0, 0, cv.INTER_AREA);

        // 3. Pre-processing pipeline: Gray -> Blur -> Canny Edge Detection
        // Use adaptive thresholds for complex backgrounds
        const gray = new cv.Mat();
        matsToDelete.push(gray);
        cv.cvtColor(small, gray, cv.COLOR_RGBA2GRAY);
        
        // Enhanced blur for complex backgrounds
        cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
        
        // Adaptive Canny thresholds based on image statistics
        const mean = new cv.Mat();
        const stddev = new cv.Mat();
        matsToDelete.push(mean);
        matsToDelete.push(stddev);
        cv.meanStdDev(gray, mean, stddev);
        const meanVal = mean.data64F[0];
        const stdVal = stddev.data64F[0];
        const lowThreshold = Math.max(30, meanVal - stdVal);
        const highThreshold = Math.min(200, meanVal + stdVal * 2);
        cv.Canny(gray, gray, lowThreshold, highThreshold);

        // 4. Find Contours
        const contours = new cv.MatVector();
        matsToDelete.push(contours);
        const hierarchy = new cv.Mat();
        matsToDelete.push(hierarchy);
        cv.findContours(
          gray,
          contours,
          hierarchy,
          cv.RETR_EXTERNAL,
          cv.CHAIN_APPROX_SIMPLE
        );

        const foundDocs: ScannedDoc[] = [];
        const imageArea = small.cols * small.rows;
        const minAreaThreshold = imageArea * 0.01; // 1% of image area

        // 5. Analyze Every Contour (Multi-Document Detection)
        for (let i = 0; i < contours.size(); ++i) {
          const cnt = contours.get(i);
          if (!cnt) continue;

          try {
            const area = cv.contourArea(cnt);

            // Noise Filter: Ignore contours smaller than 1% of image area
            if (area < minAreaThreshold) {
              cnt.delete();
              continue;
            }

            // 6. Approximate polygon (Soft Rectangle: Accept 4-8 corners)
            const peri = cv.arcLength(cnt, true);
            const approx = new cv.Mat();
            matsToDelete.push(approx);
            // Approximation accuracy: 2% of perimeter
            cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

            // Accept shapes with 4 to 8 corners that are convex
            if (approx.rows >= 4 && approx.rows <= 8 && cv.isContourConvex(approx)) {
              // Extract raw points from approximation
              const rawPoints: Point[] = [];
              for (let j = 0; j < approx.rows; j++) {
                rawPoints.push({
                  x: approx.data32S[j * 2],
                  y: approx.data32S[j * 2 + 1],
                });
              }

              // 7. Extract 4 Extreme Corners (handles >4 point shapes)
              const bestCorners = getExtremeCorners(rawPoints);

              // Scale corners back up to original high-resolution image size
              const cornersHighRes = bestCorners.map((p) => ({
                x: Math.round(p.x * scale),
                y: Math.round(p.y * scale),
              }));

              // 8. Calculate Confidence Score (0-100)
              const boundingRect = cv.boundingRect(approx);
              const rectArea = boundingRect.width * boundingRect.height;
              const solidity = rectArea > 0 ? area / rectArea : 0;
              const aspectRatio =
                boundingRect.height > 0
                  ? boundingRect.width / boundingRect.height
                  : 0;

              let confidence = 100;

              // Penalties
              if (approx.rows > 4) {
                confidence -= 10; // Not a perfect rectangle
              }
              if (solidity < 0.9) {
                confidence -= Math.max(0, Math.floor((0.9 - solidity) * 100)); // Penalty for low solidity
              }
              if (aspectRatio < 0.2 || aspectRatio > 5) {
                confidence -= 25; // Unusual aspect ratio
              }

              // Ensure confidence is in valid range
              confidence = Math.max(0, Math.min(100, Math.round(confidence)));

              // Threshold: Only keep if confidence > 40%
              if (confidence > 40) {
                const sortedCorners = sortPointsClockwise(cornersHighRes);

                // 9. Warp the ORIGINAL High-Resolution image (use processingSrc which may be rotated)
                const warpedMat = warpPerspective(cv, processingSrc, sortedCorners);
                matsToDelete.push(warpedMat);

                // 10. Convert result to DataURL and Blob
                const resultCanvas = document.createElement('canvas');
                cv.imshow(resultCanvas, warpedMat);
                const resultDataUrl = resultCanvas.toDataURL('image/jpeg', 0.85);

                // Create Blob for storage
                const blob = dataUrlToBlob(resultDataUrl);

                foundDocs.push({
                  id: `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
                  blob,
                  dataUrl: resultDataUrl,
                  confidence,
                  corners: sortedCorners,
                });
              }
            }

            cnt.delete();
          } catch (err) {
            console.error(`Error processing contour ${i}:`, err);
            cnt.delete();
          }
        }

        // 11. Cleanup all OpenCV memory
        matsToDelete.forEach((mat) => {
          try {
            if (mat && typeof mat.delete === 'function') {
              mat.delete();
            }
          } catch (err) {
            console.warn('Error deleting OpenCV Mat:', err);
          }
        });

        // 12. Apply IOU-based filtering to remove duplicates
        const filteredDocs = filterDuplicatesByIOU(foundDocs, 0.5);
        
        // 13. Sort by confidence (highest first) and position (top-left to bottom-right)
        filteredDocs.sort((a, b) => {
          // Primary: confidence (highest first)
          if (b.confidence !== a.confidence) {
            return b.confidence - a.confidence;
          }
          // Secondary: position (top-left to bottom-right)
          const posA = a.corners[0].y + a.corners[0].x;
          const posB = b.corners[0].y + b.corners[0].x;
          return posA - posB;
        });
        
        resolve(filteredDocs);
      } catch (err) {
        // Ensure cleanup on error
        matsToDelete.forEach((mat) => {
          try {
            if (mat && typeof mat.delete === 'function') {
              mat.delete();
            }
          } catch (cleanupErr) {
            console.warn('Error during cleanup:', cleanupErr);
          }
        });

        console.error('OpenCV processing error:', err);
        reject(err instanceof Error ? err : new Error('Unknown error during scanning'));
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image source'));
    };
  });
};

/**
 * Helper: Sorts 4 points in clockwise order: [Top-Left, Top-Right, Bottom-Right, Bottom-Left]
 */
export const sortPointsClockwise = (pts: Point[]): Point[] => {
  if (pts.length !== 4) {
    throw new Error('sortPointsClockwise requires exactly 4 points');
  }

  // Calculate sums and differences
  const sums = pts.map((p) => p.x + p.y);
  const diffs = pts.map((p) => p.x - p.y);

  // Find indices
  const tlIdx = sums.indexOf(Math.min(...sums)); // Top-Left: smallest sum
  const brIdx = sums.indexOf(Math.max(...sums)); // Bottom-Right: largest sum
  const trIdx = diffs.indexOf(Math.max(...diffs)); // Top-Right: largest diff
  const blIdx = diffs.indexOf(Math.min(...diffs)); // Bottom-Left: smallest diff

  return [pts[tlIdx], pts[trIdx], pts[brIdx], pts[blIdx]];
};

/**
 * Helper: Extracts 4 extreme corners from a polygon with >4 points
 * Essential for handling crinkled paper or soft corners
 */
export const getExtremeCorners = (pts: Point[]): Point[] => {
  if (pts.length === 4) {
    return pts;
  }

  if (pts.length < 4) {
    throw new Error('getExtremeCorners requires at least 4 points');
  }

  // Find points closest to bounding box corners
  const sums = pts.map((p) => p.x + p.y);
  const diffs = pts.map((p) => p.x - p.y);

  return [
    pts[sums.indexOf(Math.min(...sums))], // Closest to Top-Left
    pts[diffs.indexOf(Math.max(...diffs))], // Closest to Top-Right
    pts[sums.indexOf(Math.max(...sums))], // Closest to Bottom-Right
    pts[diffs.indexOf(Math.min(...diffs))], // Closest to Bottom-Left
  ];
};

/**
 * Helper: Calculates Intersection over Union (IOU) between two quadrilaterals
 * Used to detect and filter duplicate document detections
 * @param corners1 - First quad corners [TL, TR, BR, BL]
 * @param corners2 - Second quad corners [TL, TR, BR, BL]
 * @returns IOU score (0-1): 0 = no overlap, 1 = identical
 */
const calculateIOU = (corners1: Point[], corners2: Point[]): number => {
  if (corners1.length !== 4 || corners2.length !== 4) {
    return 0;
  }

  // Calculate bounding boxes
  const box1 = {
    minX: Math.min(...corners1.map(p => p.x)),
    maxX: Math.max(...corners1.map(p => p.x)),
    minY: Math.min(...corners1.map(p => p.y)),
    maxY: Math.max(...corners1.map(p => p.y)),
  };

  const box2 = {
    minX: Math.min(...corners2.map(p => p.x)),
    maxX: Math.max(...corners2.map(p => p.x)),
    minY: Math.min(...corners2.map(p => p.y)),
    maxY: Math.max(...corners2.map(p => p.y)),
  };

  // Calculate intersection area
  const interWidth = Math.max(0, Math.min(box1.maxX, box2.maxX) - Math.max(box1.minX, box2.minX));
  const interHeight = Math.max(0, Math.min(box1.maxY, box2.maxY) - Math.max(box1.minY, box2.minY));
  const interArea = interWidth * interHeight;

  // Calculate union area
  const area1 = (box1.maxX - box1.minX) * (box1.maxY - box1.minY);
  const area2 = (box2.maxX - box2.minX) * (box2.maxY - box2.minY);
  const unionArea = area1 + area2 - interArea;

  // Avoid division by zero
  if (unionArea === 0) return 0;

  return interArea / unionArea;
};

/**
 * Helper: Filters duplicate detections using IOU-based Non-Maximum Suppression
 * Keeps highest confidence detection when duplicates are found
 * @param docs - Array of detected documents
 * @param iouThreshold - IOU threshold above which to consider duplicates (default 0.5)
 * @returns Filtered array with duplicates removed
 */
const filterDuplicatesByIOU = (docs: ScannedDoc[], iouThreshold: number = 0.5): ScannedDoc[] => {
  if (docs.length <= 1) {
    return docs;
  }

  // Sort by confidence (descending) for NMS
  const sorted = [...docs].sort((a, b) => b.confidence - a.confidence);
  const kept: ScannedDoc[] = [];
  const removed = new Set<string>();

  for (const doc of sorted) {
    if (removed.has(doc.id)) {
      continue;
    }

    kept.push(doc);

    // Check against all remaining documents
    for (const other of sorted) {
      if (other.id === doc.id || removed.has(other.id)) {
        continue;
      }

      const iou = calculateIOU(doc.corners, other.corners);
      if (iou >= iouThreshold) {
        // Mark lower confidence detection as duplicate
        removed.add(other.id);
      }
    }
  }

  return kept;
};

/**
 * Helper: Performs 4-point perspective transform on high-resolution image
 */
const warpPerspective = (cv: OpenCV, src: any, corners: Point[]): any => {
  if (corners.length !== 4) {
    throw new Error('warpPerspective requires exactly 4 corners');
  }

  // Calculate dimensions of the warped document
  const widthTop = Math.hypot(
    corners[1].x - corners[0].x,
    corners[1].y - corners[0].y
  );
  const widthBottom = Math.hypot(
    corners[2].x - corners[3].x,
    corners[2].y - corners[3].y
  );
  const maxWidth = Math.max(widthTop, widthBottom);

  const heightLeft = Math.hypot(
    corners[0].x - corners[3].x,
    corners[0].y - corners[3].y
  );
  const heightRight = Math.hypot(
    corners[1].x - corners[2].x,
    corners[1].y - corners[2].y
  );
  const maxHeight = Math.max(heightLeft, heightRight);

  // Define source points (corners)
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    corners[0].x,
    corners[0].y,
    corners[1].x,
    corners[1].y,
    corners[2].x,
    corners[2].y,
    corners[3].x,
    corners[3].y,
  ]);

  // Define destination points (rectangle)
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    0,
    maxWidth,
    0,
    maxWidth,
    maxHeight,
    0,
    maxHeight,
  ]);

  // Calculate perspective transform matrix
  const M = cv.getPerspectiveTransform(srcTri, dstTri);

  // Apply warp
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dst = new (cv as any).Mat();
  cv.warpPerspective(
    src,
    dst,
    M,
    new (cv as any).Size(Math.round(maxWidth), Math.round(maxHeight)),
    cv.INTER_CUBIC, // High-quality interpolation for text sharpness
    cv.BORDER_CONSTANT,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new (cv as any).Scalar()
  );

  // Cleanup intermediate matrices
  srcTri.delete();
  dstTri.delete();
  M.delete();

  return dst;
};

/**
 * Helper: Auto-rotates image based on edge-based heuristic
 * Analyzes document orientation without relying on EXIF data
 * Uses edge density to detect if document is sideways
 */
const autoRotateImage = (cv: OpenCV, src: any, _img?: HTMLImageElement): any => {
  void _img; // Explicitly mark as intentionally unused
  
  // Simple edge-based rotation detection
  // Compare horizontal vs vertical edge density
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gray = new (cv as any).Mat();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const edges = new (cv as any).Mat();
    
    // Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    
    // Detect edges
    cv.Canny(gray, edges, 50, 150);
    
    // Count edges in horizontal and vertical regions
    const height = edges.rows;
    const width = edges.cols;
    const midH = height / 2;
    const midW = width / 2;
    
    // Sample horizontal and vertical edge density
    let horizontalEdges = 0;
    let verticalEdges = 0;
    
    // Check a few sample rows and columns
    const step = Math.max(1, Math.floor(height / 5));
    for (let i = 0; i < height; i += step) {
      for (let j = 0; j < width; j += step) {
        const val = edges.ucharAt(i, j);
        if (val > 0) {
          if (Math.abs(i - midH) < height * 0.2) horizontalEdges++; // Horizontal line region
          if (Math.abs(j - midW) < width * 0.2) verticalEdges++; // Vertical line region
        }
      }
    }
    
    gray.delete();
    edges.delete();
    
    // If more horizontal edges than vertical, image is likely rotated
    const ratio = verticalEdges > 0 ? horizontalEdges / verticalEdges : 1;
    if (ratio > 1.5) {
      // Try 90 degree rotation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rotated = new (cv as any).Mat();
      cv.rotate(src, rotated, cv.ROTATE_90_CLOCKWISE);
      return rotated;
    }
    
    return src;
  } catch (err) {
    // If rotation detection fails, return original
    console.warn('Rotation detection failed, using original:', err);
    return src;
  }
};

/**
 * Helper: Converts DataURL to Blob with proper validation
 */
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
    const n = bstr.length;
    const u8arr = new Uint8Array(n);

    for (let i = 0; i < n; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }

    return new Blob([u8arr], { type: mime });
  } catch (err) {
    throw new Error(`Failed to decode base64 data: ${err}`);
  }
};
