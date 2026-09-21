import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const rawKey = process.env.FIREBASE_PRIVATE_KEY;
const privateKey = rawKey ? rawKey.replace(/\\n/g, '\n') : undefined;

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin credentials in .env.local");
  process.exit(1);
}

const app = getApps().length === 0 
  ? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  : getApps()[0];

const db = getFirestore(app);

const INITIAL_ADMINS = {
  "azoguakachukwu@gmail.com": {
    role: "super_admin",
    title: "Super Admin / Lead Developer",
    name: "Lead Developer"
  },
  "giantlenspictures@gmail.com": {
    role: "super_admin",
    title: "President / Super Admin",
    name: "GIANT LENS PICTURES"
  },
  "lilangelisaac@gmail.com": {
    role: "vice_president",
    title: "CMS Vice President",
    name: "Isaac Blessing Chinecherem Angel (ANGEL_SPEAKS)"
  },
  "osicharmaine@gmail.com": {
    role: "secretary",
    title: "CMS Financial Secretary",
    name: "Osinachi Charmaine Okechukwu",
    cmsId: "CMS/2026/004"
  },
  "favourevans699@gmail.com": {
    role: "content_admin",
    title: "Social Media Manager / Content Admin",
    name: "Evans Chidera",
    cmsId: "CMS/2026/006"
  }
};

async function sync() {
  console.log("Fetching all users from Firestore...");
  const usersSnap = await db.collection("users").get();
  console.log(`Found ${usersSnap.size} users.`);

  for (const docSnap of usersSnap.docs) {
    const data = docSnap.data();
    const emailLower = (data.email || "").toLowerCase().trim();
    const adminConfig = INITIAL_ADMINS[emailLower];

    if (adminConfig) {
      console.log(`Updating admin: ${emailLower} (${docSnap.id})...`);
      await docSnap.ref.update({
        isAdmin: true,
        role: adminConfig.role,
        adminTitle: adminConfig.title,
        membership: "elite-member",
        ...(adminConfig.cmsId ? { cmsId: adminConfig.cmsId } : {})
      });
      console.log(`✓ Updated ${emailLower} to ${adminConfig.title} and elite-member.`);
    } else if (data.isAdmin || (data.role && data.role !== "member")) {
      if (data.membership === "free" || !data.membership || data.membership === "CMS Member") {
        console.log(`Upgrading membership for promoted admin: ${emailLower || docSnap.id}...`);
        await docSnap.ref.update({ membership: "elite-member" });
      }
    }
  }

  console.log("All admins synced successfully!");
  process.exit(0);
}

sync().catch((err) => {
  console.error("Sync error:", err);
  process.exit(1);
});
