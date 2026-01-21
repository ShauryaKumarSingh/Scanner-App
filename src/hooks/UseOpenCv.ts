// src/hooks/useOpenCv.ts
import { useEffect, useState } from 'react';

/**
 * Hook to detect when OpenCV.js is loaded globally
 * Returns true when cv library is ready for use
 */
export const useOpenCv = (): boolean => {
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    // Check if OpenCV is already attached to the window object
    // @ts-expect-error - OpenCV is loaded via external script, not TypeScript
    const isAlreadyLoaded = window.cvReady || (window.cv && window.cv.Mat);
    
    if (isAlreadyLoaded) {
      setLoaded(true);
      return;
    }

    // If not, wait for the script to call this function (from index.html)
    const onReady = (): void => setLoaded(true);
    window.addEventListener('opencv-ready', onReady);

    // Cleanup function
    return () => {
      window.removeEventListener('opencv-ready', onReady);
    };
  }, []);

  return loaded;
};