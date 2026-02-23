/**
 * firebase.js  — Firebase SDK (CDN ESM, no bundler needed)
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

import { initializeApp }
    from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAnalytics }
    from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js';
import {
    getAuth, onAuthStateChanged,
    signInWithEmailAndPassword, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
    getFirestore,
    collection, doc,
    addDoc, setDoc, updateDoc, deleteDoc,
    getDocs, onSnapshot,
    query, orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/* ── Config (loaded from git-ignored firebase-config.json) ── */
let _app, _auth, _db, _analytics;

export async function initFirebase() {
    if (_app) return { auth: _auth, db: _db, analytics: _analytics };

    let config;
    try {
        const resp = await fetch('./firebase-config.json');
        if (!resp.ok) throw new Error('firebase-config.json not found.');
        config = await resp.json();
    } catch (e) {
        throw new Error('Could not load Firebase config: ' + e.message);
    }

    _app = initializeApp(config);
    _auth = getAuth(_app);
    _db = getFirestore(_app);

    // Analytics (only in browser with measurementId)
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
