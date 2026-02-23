/**
 * firebase.js  — Firebase SDK init (CDN ESM, no build step needed)
 *
 * HOW TO USE:
 *  1. Fill in your values in firebase-config.json
 *  2. In Firebase Console → Authentication → Sign-in method → enable "Email/Password"
 *  3. In Firebase Console → Firestore → Create database (start in production mode)
 *  4. Paste the Firestore Security Rules below into the Rules tab
 *
 * FIRESTORE SECURITY RULES (paste into Firebase Console):
 * ─────────────────────────────────────────────────────────
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /users/{userId}/{document=**} {
 *         allow read, write: if request.auth != null && request.auth.uid == userId;
 *       }
 *     }
 *   }
 * ─────────────────────────────────────────────────────────
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
    getAuth, onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
    getFirestore,
    collection, doc,
    addDoc, setDoc, updateDoc, deleteDoc,
    getDocs, onSnapshot,
    query, orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/* ── Load config from firebase-config.json (git-ignored) ── */
async function loadConfig() {
    const resp = await fetch('./firebase-config.json');
    if (!resp.ok) throw new Error('firebase-config.json not found. Please fill it in.');
    return resp.json();
}

/* ── Initialise Firebase ── */
let _app, _auth, _db;

export async function initFirebase() {
    if (_app) return { auth: _auth, db: _db };
    const config = await loadConfig();
    _app = initializeApp(config);
    _auth = getAuth(_app);
    _db = getFirestore(_app);
    return { auth: _auth, db: _db };
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

/* ── Firestore path helpers (records scoped per user) ── */
export function recordsCol(db, uid) {
    return collection(db, 'users', uid, 'records');
}
export function recordDoc(db, uid, id) {
    return doc(db, 'users', uid, 'records', id);
}
export function ratesDoc(db, uid) {
    return doc(db, 'users', uid, 'meta', 'brokerageRates');
}
