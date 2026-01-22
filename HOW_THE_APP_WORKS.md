# Document Scanner App - How It Works

## Overview
This is a web-based document scanner that uses your device's camera or uploaded images to detect documents, let you adjust them manually, and save them to cloud storage.

## Key Features
1. **Document Detection** - Automatically finds documents in images using computer vision
2. **Manual Adjustment** - Fine-tune document corners if detection isn't perfect
3. **User Authentication** - Secure login/signup with Firebase
4. **Cloud Storage** - Store scanned documents in Firebase Cloud Storage
5. **Gallery View** - Browse all your previously scanned documents

## How to Use

### Step 1: Login or Sign Up
- Open the app and create an account or log in with your email and password
- Your credentials are securely stored with Firebase Authentication

### Step 2: Scan a Document
- Click "Upload Image" to select a photo from your device, or use your camera
- The app automatically detects the document and highlights its corners

### Step 3: Adjust Corners (if needed)
- If the detection isn't perfect, you can manually drag the corner points
- The app shows the document within the blue rectangle preview
- Click "Save Corners" to confirm or "Cancel" to try again

### Step 4: View & Download
- Your scanned document is saved to the cloud automatically
- Go to the "Gallery" tab to see all your scans
- Download any scanned document to your device

## How the Scanner Works - Simple Explanation

### Step 1: Prepare the Image
The app takes your uploaded image and prepares it for analysis:
- Converts it to grayscale (removes colors)
- Blurs it slightly to reduce noise
- Creates two versions - one small (fast processing) and one full-size (quality output)

### Step 2: Find the Document Edges
Using a technique called "Canny Edge Detection":
- The app finds all sharp lines in the image (edges)
- It adapts the sensitivity based on the image brightness
- Bright images get stricter settings, dim images get looser settings
- This finds the document's outline

### Step 3: Strengthen the Edges
The app applies "morphological dilation" - a technique that:
- Thickens the detected edges
- Fills small gaps to make the document outline more solid
- Makes it easier to identify the document shape

### Step 4: Find Document Boundaries
The app looks for closed shapes (contours):
- Scans for 4-sided shapes (rectangles/quadrilaterals)
- Filters out tiny shapes and noise (less than 1% of image area)
- Checks if the shape is convex (no dents or curves)
- Ranks documents by confidence score

### Step 5: Confidence Scoring
Each detected document gets a score (0-100) based on:
- **Solidity** - How rectangular it looks (40% of score)
- **Aspect Ratio** - Is it the right proportions for a document? (40% of score)  
- **Corner Count** - Does it have exactly 4 corners? (20% of score)

Documents with scores above 30 are shown as potential scans.

### Step 6: Prepare the Output
Once you confirm the corners:
- The app extracts the exact document region
- Applies perspective correction (fixes angle distortion)
- Converts to PNG format
- Saves to cloud storage with your account

## Technical Details

### Technologies Used
- **React + TypeScript** - User interface and logic
- **OpenCV.js** - Computer vision (edge detection, contour finding)
- **Firebase Authentication** - User login and account management
- **Firebase Cloud Storage** - Secure document storage
- **Canvas API** - Image display and manual editing
- **Vite** - Fast build and development tool

### Algorithm Highlights
- **Adaptive Thresholds**: Detection adapts to image lighting conditions
- **Multi-Document Support**: Finds all documents in one image, not just one
- **Soft Rectangle Handling**: Works with wrinkled or slightly curved paper
- **Memory Efficient**: Properly cleans up computer vision objects
- **High Quality**: Processes at high resolution for crisp outputs

## Troubleshooting

### "No clear document found"
- The image is too dark or too bright
- The document isn't clearly visible in the image
- Try taking a clearer photo with better lighting

### Corner adjustment isn't working
- Make sure you're clicking near a corner point (blue dot)
- The app needs a 12-pixel click radius to grab a corner
- Drag to adjust, then click Save

### Scan isn't saving
- Check your internet connection
- Make sure you're logged in to your account
- Your browser storage quota might be full

## Tips for Best Results
1. **Good lighting** - Scan in bright, natural light
2. **Straight angle** - Take photos with the camera perpendicular to the document
3. **Clean edges** - Make sure the document edges are visible and not cut off
4. **Solid background** - A plain background helps detection
5. **Whole document** - Include the entire document in the frame
