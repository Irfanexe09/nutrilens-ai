import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  Auth,
} from 'firebase/auth';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  FirebaseStorage,
} from 'firebase/storage';

// Firebase configuration using project credentials from nutrilens-dc1f9
// Values default to user's registered web app credentials and can be overridden via VITE_FIREBASE_* env vars
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyC_nKfh6OLtUUgSfjJCGKIAWBo0YVwBny8',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'nutrilens-dc1f9.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'nutrilens-dc1f9',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'nutrilens-dc1f9.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '28214591441',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:28214591441:web:9162450f2b28d5ca162af0',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-TGCVBTNMQK',
};

// Initialize Firebase singleton
export const firebaseApp: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth: Auth = getAuth(firebaseApp);
export const storage: FirebaseStorage = getStorage(firebaseApp);
export const googleAuthProvider = new GoogleAuthProvider();

/**
 * Sign in with Google Popup
 */
export async function signInWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, googleAuthProvider);
  return result.user;
}

/**
 * Sign in with Email and Password
 */
export async function signInWithFirebaseEmail(
  email: string,
  pass: string
): Promise<FirebaseUser> {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  return result.user;
}

/**
 * Create a new account with Email and Password
 */
export async function registerWithFirebaseEmail(
  email: string,
  pass: string
): Promise<FirebaseUser> {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  return result.user;
}

/**
 * Sign out from Firebase
 */
export async function logOutFirebase(): Promise<void> {
  await signOut(auth);
}

/**
 * Upload a food photograph to Firebase Cloud Storage.
 * Generates a unique timestamped path in 'food-scans/' and returns the permanent download URL.
 * If upload fails or is blocked by rules, gracefully throws so caller can fallback to local preview.
 */
export async function uploadFoodImageToStorage(
  file: File | Blob,
  fileName?: string
): Promise<string> {
  const timestamp = Date.now();
  const safeName = (fileName || (file instanceof File ? file.name : 'scan.jpg'))
    .replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `food-scans/${timestamp}_${safeName}`;
  const fileRef = ref(storage, storagePath);

  const contentType = (file instanceof File && file.type) ? file.type : 'image/jpeg';
  const snapshot = await uploadBytes(fileRef, file, { contentType });
  const downloadUrl = await getDownloadURL(snapshot.ref);
  return downloadUrl;
}

export { onAuthStateChanged };
export type { FirebaseUser };
