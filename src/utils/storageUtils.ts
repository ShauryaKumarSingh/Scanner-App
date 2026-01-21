// src/utils/storageUtils.ts
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";

/**
 * Upload image to Cloud Storage and get download URL
 * @param userId - Firebase user ID
 * @param dataUrl - Base64 data URL
 * @param fileType - 'original' or 'processed'
 * @returns Download URL (HTTPS)
 */
const uploadImageToCloudStorage = async (
  userId: string,
  dataUrl: string,
  fileType: 'original' | 'processed'
): Promise<string> => {
  try {
    // Create unique filename
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(7);
    const filename = `${fileType}-${timestamp}-${randomSuffix}.jpg`;
    
    // Create storage path: scans/{userId}/{fileType}/filename
    const filePath = `scans/${userId}/${fileType}/${filename}`;
    const fileRef = ref(storage, filePath);

    // Upload as string (base64 encoded)
    await uploadString(fileRef, dataUrl, 'data_url');
    
    // Get download URL
    const downloadUrl = await getDownloadURL(fileRef);
    console.log(`Uploaded ${fileType} image:`, downloadUrl);
    
    return downloadUrl;
  } catch (error) {
    console.error(`Error uploading ${fileType} image:`, error);
    throw new Error(`Failed to upload ${fileType} image: ${error}`);
  }
};

/**
 * Validates and saves a scanned document to Firestore with comprehensive error handling
 * Images are stored in Cloud Storage, URLs are saved in Firestore
 * @param userId - Firebase user ID
 * @param processedDataUrl - Data URL of the processed/scanned document
 * @param originalDataUrl - Data URL of the original image
 * @param confidence - Confidence score (0-100)
 * @throws Error if validation fails or save fails
 */
export const saveScanToFirestore = async (
  userId: string,
  processedDataUrl: string,
  originalDataUrl: string,
  confidence?: number
) => {
  try {
    // 1. Validate inputs
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!processedDataUrl) {
      throw new Error('Processed image data is required');
    }
    if (!originalDataUrl) {
      throw new Error('Original image data is required');
    }

    // 2. Check data URL format
    if (!processedDataUrl.startsWith('data:image/')) {
      throw new Error('Invalid processed image format: must be a valid image data URL');
    }
    if (!originalDataUrl.startsWith('data:image/')) {
      throw new Error('Invalid original image format: must be a valid image data URL');
    }

    // 3. Validate confidence score if provided
    if (confidence !== undefined && (confidence < 0 || confidence > 100)) {
      throw new Error('Confidence score must be between 0 and 100');
    }

    console.log('Starting image uploads to Cloud Storage...');
    
    // 4. Upload images to Cloud Storage (parallel for speed)
    const [originalUrl, processedUrl] = await Promise.all([
      uploadImageToCloudStorage(userId, originalDataUrl, 'original'),
      uploadImageToCloudStorage(userId, processedDataUrl, 'processed')
    ]);

    console.log('Images uploaded successfully, saving metadata to Firestore...');

    // 5. Save metadata to Firestore (URLS only, not base64)
    const docRef = await addDoc(collection(db, "scans"), {
      userId,
      originalUrl,      // ← Cloud Storage URL (not base64)
      processedUrl,     // ← Cloud Storage URL (not base64)
      createdAt: serverTimestamp(),
      status: "success",
      filename: `scan-${Date.now()}.jpg`,
      confidence: confidence ?? null,
      // Additional metadata for debugging
      uploadedAt: new Date().toISOString(),
      version: 2, // Incremented for new Cloud Storage schema
    });

    console.log('Document saved successfully:', docRef.id);
    return true;
  } catch (error) {
    console.error("Error saving scan:", error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to save document: ${message}`);
  }
};