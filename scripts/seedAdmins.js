const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx !== -1) {
    const key = line.substring(0, idx).trim();
    let val = line.substring(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[key] = val;
  }
});

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

const seedAdmins = [
  {
    email: 'azoguakachukwu@gmail.com',
    displayName: 'Lead Developer',
    role: 'super_admin',
    adminTitle: 'Super Admin / Lead Developer',
    isAdmin: true,
  },
  {
    email: 'giantlenspictures@gmail.com',
    displayName: 'GIANT LENS PICTURES',
    role: 'super_admin',
    adminTitle: 'President / Super Admin',
    isAdmin: true,
  },
  {
    email: 'lilangelisaac@gmail.com',
    displayName: 'Isaac Blessing Chinecherem Angel (ANGEL_SPEAKS)',
    role: 'vice_president',
    adminTitle: 'CMS Vice President',
    isAdmin: true,
  },
  {
    email: 'osicharmaine@gmail.com',
    displayName: 'Osinachi Charmaine Okechukwu',
    cmsId: 'CMS/2026/004',
    role: 'secretary',
    adminTitle: 'CMS Financial Secretary',
    isAdmin: true,
  },
  {
    email: 'favourevans699@gmail.com',
    displayName: 'Evans Chidera',
    cmsId: 'CMS/2026/006',
    role: 'content_admin',
    adminTitle: 'Social Media Manager / Content Admin',
    isAdmin: true,
  }
];

async function run() {
  for (const adm of seedAdmins) {
    const snap = await db.collection('users').where('email', '==', adm.email).get();
    if (snap.empty) {
      const ref = db.collection('users').doc();
      await ref.set({
        ...adm,
        createdAt: new Date(),
        seededAt: new Date()
      });
      console.log('Created user record for:', adm.email);
    } else {
      for (const d of snap.docs) {
        await d.ref.update({
          isAdmin: true,
          role: adm.role,
          adminTitle: adm.adminTitle,
          ...(adm.cmsId ? { cmsId: adm.cmsId } : {})
        });
        console.log('Updated existing user record for:', adm.email);
      }
    }
  }
  console.log('Seeding complete successfully!');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
