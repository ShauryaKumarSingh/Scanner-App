// src/utils/scannerUtils.ts

// Helper: distance between two points


// 1. Sort Corners (The Trickiest Math Part)
// We need to know which corner is Top-Left, Top-Right, etc.
// Logic:
// - Top-Left: smallest (x + y) sum
// - Bottom-Right: largest (x + y) sum
// - Top-Right: smallest (x - y) difference
// - Bottom-Left: largest (x - y) difference



export const scanDocument = (cv: any, canvasId: string, imageSource: HTMLImageElement) => {
  try {
    // 1. Read the image at FULL resolution (High Quality)
    let src = cv.imread(imageSource);
    let dst = new cv.Mat();
    let ksize = new cv.Size(5, 5);
    
    // 2. Create a small version for Detection (Speed)
    // We resize to width=800px for fast edge detection
    let srcSmall = new cv.Mat();
    let scaleFactor = 1;
    
    // Only resize if the image is huge
    if (src.cols > 800) {
        scaleFactor = src.cols / 800;
        let dsize = new cv.Size(800, src.rows / scaleFactor);
        cv.resize(src, srcSmall, dsize, 0, 0, cv.INTER_AREA);
    } else {
        src.copyTo(srcSmall);
    }

    // 3. Image Pre-processing (On the SMALL image)
    let gray = new cv.Mat();
    cv.cvtColor(srcSmall, gray, cv.COLOR_RGBA2GRAY, 0);
    cv.GaussianBlur(gray, gray, ksize, 0);
    cv.Canny(gray, gray, 75, 200);

    // 4. Find Contours
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(gray, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // 5. Find the best rectangle
    let maxArea = 0;
    let maxContour = null;

    for (let i = 0; i < contours.size(); ++i) {
        let cnt = contours.get(i);
        let area = cv.contourArea(cnt);
        if (area > 5000) { // Noise filter
            let peri = cv.arcLength(cnt, true);
            let approx = new cv.Mat();
            cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
            
            if (approx.rows === 4 && area > maxArea) {
                maxArea = area;
                if (maxContour) maxContour.delete();
                maxContour = approx; // Keep this contour
            } else {
                approx.delete();
            }
        }
        cnt.delete(); // Cleanup loop var
    }

    // --- PERSPECTIVE WARP (THE FIX) ---
    if (maxContour) {
        // A. Extract points from the SMALL image
        const foundPoints = [];
        for (let i = 0; i < 4; i++) {
            foundPoints.push({
                x: maxContour.data32S[i * 2],
                y: maxContour.data32S[i * 2 + 1]
            });
        }

        // B. Scale points UP to match the Original High-Res Image
        const hdPoints = foundPoints.map(p => ({
            x: p.x * scaleFactor,
            y: p.y * scaleFactor
        }));

        // C. Sort the HD points
        const sortedPoints = sortPoints(hdPoints);

        // D. Calculate HD Width/Height
        const widthBottom = distance(sortedPoints[2], sortedPoints[3]);
        const widthTop = distance(sortedPoints[1], sortedPoints[0]);
        const maxWidth = Math.max(widthBottom, widthTop);

        const heightRight = distance(sortedPoints[1], sortedPoints[2]);
        const heightLeft = distance(sortedPoints[0], sortedPoints[3]);
        const maxHeight = Math.max(heightRight, heightLeft);

        // E. Create Matrices
        // Use the HD Points (srcTri) and HD Dimensions (dstTri)
        const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
            sortedPoints[0].x, sortedPoints[0].y, // TL
            sortedPoints[1].x, sortedPoints[1].y, // TR
            sortedPoints[2].x, sortedPoints[2].y, // BR
            sortedPoints[3].x, sortedPoints[3].y  // BL
        ]);

        const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
            0, 0,
            maxWidth, 0,
            maxWidth, maxHeight,
            0, maxHeight
        ]);

        // F. Warp the ORIGINAL (src), not srcSmall
        const M = cv.getPerspectiveTransform(srcTri, dstTri);
        const dsize = new cv.Size(maxWidth, maxHeight);
        
        cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

        // Draw High-Res result
        cv.imshow(canvasId, dst);
        
        srcTri.delete(); dstTri.delete(); M.delete(); maxContour.delete();
    } else {
        console.warn("No document detected.");
        cv.imshow(canvasId, src);
    }

    // Cleanup
    src.delete(); srcSmall.delete(); dst.delete(); 
    gray.delete(); contours.delete(); hierarchy.delete();

  } catch (err) {
      console.error("Scanning failed:", err);
  }
};

// Helper: Distance formula
const distance = (p1: any, p2: any) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

// Helper: Sort corners (Top-Left, Top-Right, Bottom-Right, Bottom-Left)
const sortPoints = (points: any[]) => {
    const sums = points.map(p => p.x + p.y);
    const diffs = points.map(p => p.x - p.y);

    const tl = points[sums.indexOf(Math.min(...sums))];
    const br = points[sums.indexOf(Math.max(...sums))];
    const tr = points[diffs.indexOf(Math.max(...diffs))];
    const bl = points[diffs.indexOf(Math.min(...diffs))];

    return [tl, tr, br, bl];
};
