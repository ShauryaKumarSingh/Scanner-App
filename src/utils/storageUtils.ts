// src/utils/storageUtils.ts
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

// Helper: Convert Blob/File to Base64 string
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const saveScanRecord = async (
  userId: string,
  originalFile: File,
  processedBlob: Blob
) => {
  try {
    // 1. Convert images to Text Strings (Base64)
    // Note: In a production app with billing, we would upload these to Firebase Storage.
    // Due to current billing constraints, we store them as Base64 in Firestore (max 1MB).
    const originalUrl = await blobToBase64(originalFile);
    const processedUrl = await blobToBase64(processedBlob);

    // 2. Save Metadata + Image Data to Firestore
    await addDoc(collection(db, "scans"), {
      userId,
      originalUrl,   // Saving the actual image data here!
      processedUrl,
      createdAt: serverTimestamp(),
      status: "success",
      filename: originalFile.name
    });

    return true;
  } catch (error) {
    console.error("Error saving scan:", error);
    throw error;
  }
};