import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;

function getAdminApp(): App | null {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawKey ? rawKey.replace(/\\n/g, '\n') : undefined;

  if (projectId && clientEmail && privateKey) {
    try {
      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      return adminApp;
    } catch (e) {
      console.warn("Firebase Admin initializeApp failed:", e);
      return null;
    }
  }

  return null;
}

// Proxies to allow build-time imports without crashing when env vars are not set during static compilation
export const adminAuth = new Proxy({} as Auth, {
  get(_target, prop) {
    const app = getAdminApp();
    if (!app) {
      console.warn(`Firebase Admin not initialized. Skipping ${String(prop)}.`);
      return () => { throw new Error("Firebase Admin credentials not configured."); };
    }
    const auth = getAuth(app);
    const val = (auth as any)[prop];
    return typeof val === 'function' ? val.bind(auth) : val;
  }
});

export const adminDb = new Proxy({} as Firestore, {
  get(_target, prop) {
    const app = getAdminApp();
    if (!app) {
      console.warn(`Firebase Admin not initialized. Skipping ${String(prop)}.`);
      return () => { throw new Error("Firebase Admin credentials not configured."); };
    }
    const db = getFirestore(app);
    const val = (db as any)[prop];
    return typeof val === 'function' ? val.bind(db) : val;
  }
});
