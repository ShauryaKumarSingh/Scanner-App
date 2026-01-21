// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";



const firebaseConfig = {
 apiKey: "AIzaSyBXXXMPyTpyZWP7LsHIBb9Eo_qe1A1ATgQ",
  authDomain: "scanner-intern-project.firebaseapp.com",
  projectId: "scanner-intern-project",
  storageBucket: "scanner-intern-project.firebasestorage.app",
  messagingSenderId: "246661110525",
  appId: "1:246661110525:web:20ddb84aac62b066687c94"
};

// Initialize services
const app = initializeApp(firebaseConfig);

// Export instances to use elsewhere
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
