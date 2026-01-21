// src/utils/pdfUtils.ts
import * as pdfjsLib from 'pdfjs-dist';

// 👇 FIX: Import the worker script URL explicitly from node_modules
// This tells Vite: "Find this file, bundle it, and give me the URL"
import pdfWorker from 'pdfjs-dist/build/pdf.worker?url';

// Set the worker source to the local file, not a CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export const convertPdfToImage = async (file: File): Promise<string> => {
  // 1. Read the file
  const arrayBuffer = await file.arrayBuffer();

  // 2. Load the PDF
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // 3. Get First Page
  const page = await pdf.getPage(1);

  // 4. Create Viewport (High-res scale)
  const viewport = page.getViewport({ scale: 2.0 });

  // 5. Setup Canvas
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  if (!context) throw new Error("Could not create canvas context");

  // 6. Render
  // We cast to 'any' to avoid strict TypeScript type mismatch with pdf.js typings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({
    canvasContext: context,
    viewport: viewport
  } as any).promise;

  // 7. Return as Image
  return canvas.toDataURL('image/jpeg');
};