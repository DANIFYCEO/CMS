import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const rawKey = process.env.FIREBASE_PRIVATE_KEY;
const privateKey = rawKey ? rawKey.replace(/\\n/g, '\n') : undefined;

const app = getApps().length === 0 
  ? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  : getApps()[0];

const db = getFirestore(app);

async function listAll() {
  console.log("=== ALL USERS IN FIRESTORE ===");
  const snap = await db.collection("users").get();
  snap.forEach(doc => {
    const d = doc.data();
    console.log(`UID: ${doc.id} | Email: ${d.email} | Name: ${d.displayName} | Role: ${d.role} | isAdmin: ${d.isAdmin} | Membership: ${d.membership}`);
  });
  process.exit(0);
}

listAll().catch(e => { console.error(e); process.exit(1); });
