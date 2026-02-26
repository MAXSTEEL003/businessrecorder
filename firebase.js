/**
 * firebase.js — Firebase SDK (npm, via Vite)
 *
 * Project: tejasbusinessrecord
 *
 * ── FIRESTORE SECURITY RULES ─────────────────────────────────
 *  Paste these into Firebase Console → Firestore → Rules:
 *
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /users/{userId}/{document=**} {
 *         allow read, write: if request.auth != null
 *                            && request.auth.uid == userId;
 *       }
 *     }
 *   }
 * ─────────────────────────────────────────────────────────────
 */

import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import {
    getAuth, onAuthStateChanged,
    signInWithEmailAndPassword, signOut
} from 'firebase/auth';
import {
    getFirestore,
    collection, doc,
    addDoc, setDoc, updateDoc, deleteDoc,
    getDocs, onSnapshot,
    query, orderBy
} from 'firebase/firestore';

// Firebase config from environment variables (Vite exposes VITE_* vars automatically from .env.local)
const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

/* ── Singleton init ── */
let _app, _auth, _db, _analytics;

export async function initFirebase() {
    if (_app) return { auth: _auth, db: _db, analytics: _analytics };
    
    // Check if Firebase is configured
    if (!config.apiKey) {
        const setupGuide = `
╔════════════════════════════════════════════════════════════════╗
║           Firebase Configuration Required                      ║
╚════════════════════════════════════════════════════════════════╝

📍 FOR LOCAL DEVELOPMENT:
   1. Create a .env.local file in the project root
   2. Copy from .env.example:
      cp .env.example .env.local
   3. Fill in your Firebase credentials from:
      Firebase Console → Project Settings → Your Apps
   4. Restart your development server (npm run dev)

📍 FOR VERCEL DEPLOYMENT:
   1. Go to https://vercel.com/dashboard
   2. Select your project → Settings → Environment Variables
   3. Add these 7 variables:
      VITE_FIREBASE_API_KEY          (from Firebase Project Settings)
      VITE_FIREBASE_AUTH_DOMAIN      (e.g., your-project.firebaseapp.com)
      VITE_FIREBASE_PROJECT_ID       (from Firebase Project Settings)
      VITE_FIREBASE_STORAGE_BUCKET   (from Firebase Project Settings)
      VITE_FIREBASE_MESSAGING_SENDER_ID
      VITE_FIREBASE_APP_ID
      VITE_FIREBASE_MEASUREMENT_ID   (optional - Analytics ID)
   4. Click "Save" then "Redeploy"

📍 HOW TO GET FIREBASE CREDENTIALS:
   1. Go to https://console.firebase.google.com
   2. Select your project
   3. Click ⚙️ (Settings) → Project Settings
   4. Scroll to "Your Apps" section
   5. Copy the config object

🔗 Need help? See README.md for detailed setup instructions
`;
        
        console.error(setupGuide);
        console.warn('⚠️ Firebase is not configured. App will not work until configured.');
        
        // Return empty object so app doesn't crash, but features will fail gracefully
        return { auth: null, db: null, analytics: null };
    }

    _app = initializeApp(config);
    _auth = getAuth(_app);
    _db = getFirestore(_app);

    try {
        if (config.measurementId) _analytics = getAnalytics(_app);
    } catch (_) { /* non-blocking */ }

    return { auth: _auth, db: _db, analytics: _analytics };
}

/* ── Re-export Firebase helpers ── */
export {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    collection, doc,
    addDoc, setDoc, updateDoc, deleteDoc,
    getDocs, onSnapshot,
    query, orderBy
};

/* ── Firestore path helpers (data scoped per authenticated user) ── */
export const recordsCol = (db, uid) =>
    collection(db, 'users', uid, 'records');

export const recordDoc = (db, uid, id) =>
    doc(db, 'users', uid, 'records', id);

export const ratesDoc = (db, uid) =>
    doc(db, 'users', uid, 'meta', 'brokerageRates');
