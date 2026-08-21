import { initializeApp } from 'firebase/app';
import { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

// Your web app's Firebase configuration
// These will be securely loaded from Replit Secrets (Environment Variables)
const configuredAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const authDomain =
    typeof window !== 'undefined' && window.location.hostname === 'app.lekhacaptions.com'
        ? window.location.hostname
        : configuredAuthDomain;

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app;
let auth;
let db;
let googleProvider;
let appCheck;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
    const appCheckSiteKey = String(import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY || '').trim();
    if (appCheckSiteKey) {
        appCheck = initializeAppCheck(app, {
            provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
            isTokenAutoRefreshEnabled: true,
        });
    } else if (import.meta.env.PROD) {
        throw new Error('VITE_FIREBASE_APP_CHECK_SITE_KEY is required in production.');
    }
} catch (error) {
    console.warn("Firebase failed to initialize. Running in local dev mode without Firebase.", error.message);
}

export async function getFirebaseAppCheckToken(forceRefresh = false) {
    if (!appCheck) return '';
    const result = await getToken(appCheck, forceRefresh);
    return String(result?.token || '');
}

export { auth, db, googleProvider, appCheck, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, doc, setDoc, getDoc, updateDoc };
