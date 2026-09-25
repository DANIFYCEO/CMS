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

async function testQuery() {
  console.log("Testing query: collection('videos').orderBy('publishedAt', 'desc')...");
  try {
    const snap = await db.collection("videos").orderBy("publishedAt", "desc").get();
    console.log(`Success! Found ${snap.size} documents:`);
    snap.forEach(d => {
      const data = d.data();
      console.log(`- ${d.id}: category="${data.category}", publishedAt="${data.publishedAt}", title="${data.title}"`);
    });
  } catch (err) {
    console.error("Query failed:", err);
  }
  process.exit(0);
}

testQuery();
