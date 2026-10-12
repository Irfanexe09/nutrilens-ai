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
  uploadBytesResumable,
  getDownloadURL,
  FirebaseStorage,
} from 'firebase/storage';

// Firebase configuration using project credentials from nutrilens-dc1f9
// All sensitive keys must be provided via VITE_FIREBASE_* environment variables.
const rawApiKey = (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined)?.trim() || '';

export const isFirebaseConfigured = Boolean(
  rawApiKey &&
  !rawApiKey.includes('placeholder') &&
  !rawApiKey.includes('your_')
);

const cleanEnv = (val?: string) => (val || '').trim().replace(/^["']|["']$/g, '');
const cleanBucket = (val?: string) => {
  let b = cleanEnv(val);
  if (b.startsWith('gs://')) b = b.slice(5);
  return b.replace(/\/+$/, '');
};

const firebaseConfig = {
  apiKey: cleanEnv(import.meta.env.VITE_FIREBASE_API_KEY) || 'unconfigured_placeholder_key',
  authDomain: cleanEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) || 'nutrilens-dc1f9.firebaseapp.com',
  projectId: cleanEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID) || 'nutrilens-dc1f9',
  storageBucket: cleanBucket(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) || 'nutrilens-dc1f9.firebasestorage.app',
  messagingSenderId: cleanEnv(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) || '28214591441',
  appId: cleanEnv(import.meta.env.VITE_FIREBASE_APP_ID) || '1:28214591441:web:9162450f2b28d5ca162af0',
  measurementId: cleanEnv(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) || 'G-TGCVBTNMQK',
};

// Initialize Firebase singleton
export const firebaseApp: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth: Auth = getAuth(firebaseApp);
export const storage: FirebaseStorage = getStorage(firebaseApp);

// Bound retry intervals to prevent 10-minute hangs on network stalls or CORS blocks
storage.maxUploadRetryTime = 10000; // 10 seconds max retry
storage.maxOperationRetryTime = 10000; // 10 seconds max operation

export const googleAuthProvider = new GoogleAuthProvider();

export interface UploadProgressInfo {
  bytesTransferred: number;
  totalBytes: number;
  progressPercent: number;
  state: string;
}

export interface UploadOptions {
  fileName?: string;
  onProgress?: (progress: UploadProgressInfo) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Check if Firebase is configured and a user is currently signed in to Firebase.
 */
export function isFirebaseAuthenticated(): boolean {
  return Boolean(isFirebaseConfigured && auth.currentUser);
}

/**
 * Sign in with Google Popup
 */
export async function signInWithGoogle(): Promise<FirebaseUser> {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase Authentication is not configured. Please set VITE_FIREBASE_API_KEY in your environment.');
  }
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
  if (!isFirebaseConfigured) {
    throw new Error('Firebase Authentication is not configured. Missing VITE_FIREBASE_API_KEY.');
  }
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
  if (!isFirebaseConfigured) {
    throw new Error('Firebase Authentication is not configured. Missing VITE_FIREBASE_API_KEY.');
  }
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  return result.user;
}

/**
 * Sign out from Firebase
 */
export async function logOutFirebase(): Promise<void> {
  if (!isFirebaseConfigured) return;
  await signOut(auth);
}

/**
 * Upload a food photograph to Firebase Cloud Storage.
 *
 * Security & Ownership:
 * - Scoped under users/{userId}/food-scans/ to preserve strict user-ownership access controls.
 * - Requires an authenticated Firebase user; fails fast with a clean error if unauthenticated.
 * - Enforces MIME type (JPEG, PNG, WEBP) and file size (max 10MB) limits.
 *
 * Reliability & Responsiveness:
 * - Uses uploadBytesResumable with granular progress reporting.
 * - Enforces an explicit timeout (default 15s) and AbortSignal support so uploads never hang.
 * - Cleans up all listeners and timers on completion, failure, or cancellation.
 */
export async function uploadFoodImageToStorage(
  file: File | Blob,
  options?: UploadOptions | string
): Promise<string> {
  const opts: UploadOptions = typeof options === 'string' ? { fileName: options } : (options || {});
  const timeoutMs = opts.timeoutMs ?? 15000;

  if (!isFirebaseConfigured) {
    const err = new Error('Firebase Storage is not configured. Missing VITE_FIREBASE_API_KEY.');
    (err as any).code = 'storage/not-configured';
    throw err;
  }

  // Verify Firebase user authentication to preserve user-scoped security rules
  const currentUser = auth.currentUser;
  if (!currentUser) {
    const err = new Error('Authentication required: Sign in to save meal photos to Firebase Cloud Storage.');
    (err as any).code = 'storage/unauthenticated';
    throw err;
  }

  // Validate file size (10 MB maximum)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    const err = new Error(`Image size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the 10MB upload limit.`);
    (err as any).code = 'storage/file-too-large';
    throw err;
  }

  // Validate image MIME type
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const rawType = (file instanceof File && file.type) ? file.type.toLowerCase() : 'image/jpeg';
  if (rawType && !allowedMimeTypes.includes(rawType)) {
    const err = new Error(`Unsupported image format (${rawType}). Please upload a JPEG, PNG, or WEBP image.`);
    (err as any).code = 'storage/invalid-format';
    throw err;
  }

  // User-scoped storage path ensuring data isolation
  const timestamp = Date.now();
  const rawName = opts.fileName || (file instanceof File ? file.name : 'scan.jpg');
  const safeName = rawName.replace(/[^a-zA-Z0-9.-]/g, '_').slice(-64);
  const storagePath = `users/${currentUser.uid}/food-scans/${timestamp}_${safeName}`;
  const fileRef = ref(storage, storagePath);

  const contentType = rawType || 'image/jpeg';
  const uploadTask = uploadBytesResumable(fileRef, file, {
    contentType,
    customMetadata: {
      ownerUid: currentUser.uid,
      uploadedAt: new Date().toISOString(),
    },
  });

  return new Promise<string>((resolve, reject) => {
    let isSettled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      isSettled = true;
      if (timer) clearTimeout(timer);
      if (opts.signal) {
        opts.signal.removeEventListener('abort', onAbort);
      }
    };

    const onAbort = () => {
      if (isSettled) return;
      cleanup();
      try {
        uploadTask.cancel();
      } catch {
        // Task may have already finalized
      }
      const abortErr = new Error('Firebase Cloud Storage upload was canceled.');
      (abortErr as any).code = 'storage/canceled';
      reject(abortErr);
    };

    if (opts.signal) {
      if (opts.signal.aborted) {
        uploadTask.cancel();
        const abortErr = new Error('Firebase Cloud Storage upload was canceled.');
        (abortErr as any).code = 'storage/canceled';
        reject(abortErr);
        return;
      }
      opts.signal.addEventListener('abort', onAbort, { once: true });
    }

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        if (isSettled) return;
        cleanup();
        try {
          uploadTask.cancel();
        } catch {
          // Task may have already finalized
        }
        const timeoutErr = new Error(
          `Firebase Cloud Storage upload timed out after ${Math.round(timeoutMs / 1000)} seconds.`
        );
        (timeoutErr as any).code = 'storage/timeout';
        reject(timeoutErr);
      }, timeoutMs);
    }

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (isSettled) return;
        const total = snapshot.totalBytes;
        const transferred = snapshot.bytesTransferred;
        const progressPercent = total > 0 ? Math.round((transferred / total) * 100) : 0;
        opts.onProgress?.({
          bytesTransferred: transferred,
          totalBytes: total,
          progressPercent,
          state: snapshot.state,
        });
      },
      (error) => {
        if (isSettled) return;
        cleanup();
        // Safe diagnostic logging: error code and name only, never credentials
        console.warn('[FirebaseStorage] Upload task rejected:', {
          code: (error as any).code || 'unknown',
          name: error.name,
        });
        reject(error);
      },
      async () => {
        if (isSettled) return;
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          cleanup();
          resolve(downloadUrl);
        } catch (urlErr) {
          cleanup();
          reject(urlErr);
        }
      }
    );
  });
}

export { onAuthStateChanged };
export type { FirebaseUser };
