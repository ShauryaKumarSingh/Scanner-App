// src/utils/scannerUtils.ts

export const scanDocument = (
  cv: any, 
  canvasId: string, 
  imageSrcUrl: string // 👈 CHANGED: We now pass the URL, not the HTML element
) => {
  return new Promise<void>((resolve, reject) => {
    // 1. Create a temporary image in memory (Not on screen)
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageSrcUrl;

    img.onload = () => {
      try {
        // 2. Read the image at FULL intrinsic resolution
        let src = cv.imread(img);
        let dst = new cv.Mat();
        let ksize = new cv.Size(5, 5);

        // 3. Create a small version for Detection Speed (800px width)
        let srcSmall = new cv.Mat();
        let scaleFactor = 1;
        
        if (src.cols > 800) {
            scaleFactor = src.cols / 800;
            let dsize = new cv.Size(800, src.rows / scaleFactor);
            cv.resize(src, srcSmall, dsize, 0, 0, cv.INTER_AREA);
        } else {
            src.copyTo(srcSmall);
        }

        // 4. Image Pre-processing (On Small Image)
        let gray = new cv.Mat();
        cv.cvtColor(srcSmall, gray, cv.COLOR_RGBA2GRAY, 0);
        cv.GaussianBlur(gray, gray, ksize, 0);
        cv.Canny(gray, gray, 75, 200);

        // 5. Contour Detection
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(gray, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        let maxArea = 0;
        let maxContour = null;

        for (let i = 0; i < contours.size(); ++i) {
            let cnt = contours.get(i);
            let area = cv.contourArea(cnt);
            if (area > 5000) { 
                let peri = cv.arcLength(cnt, true);
                let approx = new cv.Mat();
                cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
                
                if (approx.rows === 4 && area > maxArea) {
                    maxArea = area;
                    if (maxContour) maxContour.delete();
                    maxContour = approx;
                } else {
                    approx.delete();
                }
            }
            cnt.delete();
        }

        // --- 6. PERSPECTIVE WARP (HIGH RES) ---
        if (maxContour) {
            const foundPoints = [];
            for (let i = 0; i < 4; i++) {
                foundPoints.push({
                    x: maxContour.data32S[i * 2],
                    y: maxContour.data32S[i * 2 + 1]
                });
            }

            // SCALE UP POINTS to match Original Resolution
            const hdPoints = foundPoints.map(p => ({
                x: p.x * scaleFactor,
                y: p.y * scaleFactor
            }));

            const sortedPoints = sortPoints(hdPoints);

            // Calculate HD Dimensions
            const widthBottom = distance(sortedPoints[2], sortedPoints[3]);
            const widthTop = distance(sortedPoints[1], sortedPoints[0]);
            const maxWidth = Math.max(widthBottom, widthTop);

            const heightRight = distance(sortedPoints[1], sortedPoints[2]);
            const heightLeft = distance(sortedPoints[0], sortedPoints[3]);
            const maxHeight = Math.max(heightRight, heightLeft);

            const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
                sortedPoints[0].x, sortedPoints[0].y, 
                sortedPoints[1].x, sortedPoints[1].y, 
                sortedPoints[2].x, sortedPoints[2].y, 
                sortedPoints[3].x, sortedPoints[3].y  
            ]);

            const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
                0, 0,
                maxWidth, 0,
                maxWidth, maxHeight,
                0, maxHeight
            ]);

            // Warp the ORIGINAL High-Res Image
            const M = cv.getPerspectiveTransform(srcTri, dstTri);
            const dsize = new cv.Size(maxWidth, maxHeight);
            
            // Use INTER_CUBIC for sharper text
            cv.warpPerspective(src, dst, M, dsize, cv.INTER_CUBIC, cv.BORDER_CONSTANT, new cv.Scalar());

            cv.imshow(canvasId, dst);
            
            srcTri.delete(); dstTri.delete(); M.delete(); maxContour.delete();
        } else {
            // Fallback: Show original
            cv.imshow(canvasId, src);
        }

        // Cleanup
        src.delete(); srcSmall.delete(); dst.delete(); gray.delete(); 
        contours.delete(); hierarchy.delete(); img.remove();
        resolve();

      } catch (err) {
        console.error("Scanning failed:", err);
        reject(err);
      }
    };
    
    img.onerror = reject;
  });
};

// ... keep your helper functions (distance, sortPoints) below ...
const distance = (p1: any, p2: any) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

const sortPoints = (points: any[]) => {
    const sums = points.map(p => p.x + p.y);
    const diffs = points.map(p => p.x - p.y);
    return [
        points[sums.indexOf(Math.min(...sums))],
        points[diffs.indexOf(Math.max(...diffs))],
        points[sums.indexOf(Math.max(...sums))],
        points[diffs.indexOf(Math.min(...diffs))]
    ];
};