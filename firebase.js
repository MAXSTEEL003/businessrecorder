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

// Firebase config from environment variables (Vite exposes VITE_* vars)
// For local development, create firebase-config.json or .env.local with:
// VITE_FIREBASE_API_KEY=...
// VITE_FIREBASE_AUTH_DOMAIN=...
// VITE_FIREBASE_PROJECT_ID=...
// VITE_FIREBASE_STORAGE_BUCKET=...
// VITE_FIREBASE_MESSAGING_SENDER_ID=...
// VITE_FIREBASE_APP_ID=...
// VITE_FIREBASE_MEASUREMENT_ID=... (optional)

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

export function initFirebase() {
    if (_app) return { auth: _auth, db: _db, analytics: _analytics };
    
    if (!config.apiKey) {
        console.error('Firebase config missing! Set environment variables VITE_FIREBASE_*');
        throw new Error('Firebase configuration not found');
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
