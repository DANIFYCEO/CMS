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
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || "UC8G09Lmm_c-Qwt7WK-7NjpA";
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

async function fetchTabVideoIds(tab) {
  const url = `https://www.youtube.com/channel/${CHANNEL_ID}/${tab}`;
  console.log(`Fetching ${url}...`);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const html = await res.text();
    const matches = [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map(m => m[1]);
    return [...new Set(matches)];
  } catch (err) {
    console.error(`Failed to fetch channel ${tab}:`, err);
    return [];
  }
}

function categorize(title) {
  const t = (title || "").toLowerCase();
  if (t.includes("trailer") || t.includes("teaser") || t.includes("loading") || t.includes("thriller")) {
    return "trailers";
  }
  if (t.includes("bts") || t.includes("behind the scene")) {
    return "bts";
  }
  if (t.includes("music") || t.includes("soundtrack")) {
    return "music";
  }
  return "movies";
}

async function sync() {
  console.log("Starting YouTube Channel sync...");
  const channelVideosTabIds = await fetchTabVideoIds("videos");
  const channelShortsTabIds = await fetchTabVideoIds("shorts");

  console.log(`Found ${channelVideosTabIds.length} videos on channel 'Videos' tab:`, channelVideosTabIds);
  console.log(`Found ${channelShortsTabIds.length} shorts on channel 'Shorts' tab:`, channelShortsTabIds);

  // 1. Remove any shorts that are currently in the 'videos' collection
  const videosSnap = await db.collection("videos").get();
  console.log(`\nChecking ${videosSnap.size} existing documents in 'videos' collection...`);

  for (const doc of videosSnap.docs) {
    const data = doc.data();
    const vId = doc.id;
    const isShort = channelShortsTabIds.includes(vId) || data.category === "shorts";

    if (isShort) {
      console.log(`❌ Removing Short from 'videos' collection: [${vId}] "${data.title}"`);
      await doc.ref.delete();
    }
  }

  // 2. Fetch video details from YouTube Data API for all videos on the 'Videos' tab
  if (channelVideosTabIds.length > 0 && YOUTUBE_API_KEY) {
    const idsParam = channelVideosTabIds.join(",");
    const ytUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${idsParam}&key=${YOUTUBE_API_KEY}`;
    const ytRes = await fetch(ytUrl);
    const ytData = await ytRes.json();
    const items = ytData.items || [];

    console.log(`\nProcessing ${items.length} long-form channel videos into 'videos' collection...`);

    for (const item of items) {
      const vId = item.id;
      const title = item.snippet.title;
      const publishedAt = item.snippet.publishedAt;
      const cat = categorize(title);
      const thumbnail = item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`;
      const views = item.statistics?.viewCount || "0";
      const likes = item.statistics?.likeCount || "0";
      const comments = item.statistics?.commentCount || "0";

      const docRef = db.collection("videos").doc(vId);
      const existing = await docRef.get();

      if (!existing.exists) {
        await docRef.set({
          videoId: vId,
          title,
          category: cat,
          publishedAt,
          createdAt: new Date().toISOString(),
          thumbnailUrl: thumbnail,
          views: parseInt(views, 10) || 0,
          likes: likes.toString(),
          comments: comments.toString()
        });
        console.log(`✓ Added new video: [${vId}] (${cat}) "${title}"`);
      } else {
        // Update category & title if needed
        await docRef.update({
          title,
          category: cat,
          thumbnailUrl: thumbnail
        });
        console.log(`✓ Updated existing video: [${vId}] (${cat}) "${title}"`);
      }
    }
  }

  console.log("\nSync completed successfully!");
  process.exit(0);
}

sync().catch(err => {
  console.error("Sync error:", err);
  process.exit(1);
});
