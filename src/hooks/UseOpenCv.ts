// src/hooks/useOpenCv.ts
import { useEffect, useState } from 'react';

export const useOpenCv = () => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Check if OpenCV is already attached to the window object
    // @ts-ignore
    if (window.cvReady || (window.cv && window.cv.Mat)) {
      setLoaded(true);
      return;
    }

    // If not, wait for the script to call this function (from index.html)
    // @ts-ignore
  const onReady = () => setLoaded(true);
    window.addEventListener('opencv-ready', onReady);

    // Cleanup function
    return () => {
      // @ts-ignore
    window.removeEventListener('opencv-ready', onReady);
    };
  }, []);

  return loaded;
};