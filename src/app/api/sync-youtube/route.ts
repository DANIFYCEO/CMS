import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || "UC8G09Lmm_c-Qwt7WK-7NjpA";

async function fetchTabVideoIds(tab: "videos" | "shorts"): Promise<string[]> {
  const url = `https://www.youtube.com/channel/${CHANNEL_ID}/${tab}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      next: { revalidate: 0 }
    });
    const html = await res.text();
    const matches = [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map(m => m[1]);
    return [...new Set(matches)];
  } catch (err) {
    console.error(`Failed to fetch channel ${tab}:`, err);
    return [];
  }
}

function categorizeVideo(title: string): string {
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

export async function GET(request: NextRequest) {
  // Optional key check
  const authHeader = request.nextUrl.searchParams.get("key");
  if (authHeader && authHeader !== process.env.YOUTUBE_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!YOUTUBE_API_KEY || !CHANNEL_ID) {
    return NextResponse.json(
      { error: "Missing YOUTUBE_API_KEY or YOUTUBE_CHANNEL_ID env vars" },
      { status: 500 }
    );
  }

  try {
    const [channelVideosTabIds, channelShortsTabIds] = await Promise.all([
      fetchTabVideoIds("videos"),
      fetchTabVideoIds("shorts")
    ]);

    // 1. Remove any shorts from the 'videos' collection
    let removedShortsCount = 0;
    const videosSnap = await adminDb.collection("videos").get();

    for (const doc of videosSnap.docs) {
      const data = doc.data();
      const vId = doc.id;
      const isShort = channelShortsTabIds.includes(vId) || data.category === "shorts";

      if (isShort) {
        console.log(`[SYNC] Removing Short from 'videos' collection: ${vId}`);
        await doc.ref.delete();
        removedShortsCount++;
      }
    }

    // 2. Fetch video metadata from YouTube Data API for all videos in the channel's Videos section
    let newCount = 0;
    let updatedCount = 0;

    if (channelVideosTabIds.length > 0) {
      const idsParam = channelVideosTabIds.join(",");
      const ytUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${idsParam}&key=${YOUTUBE_API_KEY}`;
      const ytRes = await fetch(ytUrl, { cache: "no-store" });

      if (ytRes.ok) {
        const ytData = await ytRes.json();
        const items = ytData.items || [];

        for (const item of items) {
          const vId = item.id;
          const title = item.snippet.title;
          const publishedAt = item.snippet.publishedAt;
          const cat = categorizeVideo(title);
          const thumbnail = item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`;
          const views = parseInt(item.statistics?.viewCount || "0", 10) || 0;
          const likes = (item.statistics?.likeCount || "0").toString();
          const comments = (item.statistics?.commentCount || "0").toString();

          const docRef = adminDb.collection("videos").doc(vId);
          const existing = await docRef.get();

          if (!existing.exists) {
            await docRef.set({
              videoId: vId,
              title,
              category: cat,
              publishedAt,
              createdAt: new Date().toISOString(),
              thumbnailUrl: thumbnail,
              views,
              likes,
              comments
            });
            newCount++;
            console.log(`[SYNC] Added channel video: ${vId} => ${cat}: ${title}`);
          } else {
            await docRef.update({
              title,
              category: cat,
              thumbnailUrl: thumbnail
            });
            updatedCount++;
          }
        }
      }
    }

    // 3. Fetch and sync shorts into Firestore 'shorts' collection
    let newShortsCount = 0;
    let updatedShortsCount = 0;

    if (channelShortsTabIds.length > 0) {
      const shortsParam = channelShortsTabIds.join(",");
      const ytShortsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${shortsParam}&key=${YOUTUBE_API_KEY}`;
      const ytShortsRes = await fetch(ytShortsUrl, { cache: "no-store" });

      if (ytShortsRes.ok) {
        const ytShortsData = await ytShortsRes.json();
        const shortItems = ytShortsData.items || [];

        for (const item of shortItems) {
          const vId = item.id;
          const title = item.snippet.title;
          const publishedAt = item.snippet.publishedAt;
          const thumbnail = item.snippet.thumbnails?.maxres?.url || item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`;
          const views = parseInt(item.statistics?.viewCount || "0", 10) || 0;
          const likes = parseInt(item.statistics?.likeCount || "0", 10) || 0;
          const comments = parseInt(item.statistics?.commentCount || "0", 10) || 0;

          const docRef = adminDb.collection("shorts").doc(vId);
          const existing = await docRef.get();

          if (!existing.exists) {
            await docRef.set({
              videoId: vId,
              title,
              category: "shorts",
              publishedAt,
              createdAt: new Date().toISOString(),
              thumbnailUrl: thumbnail,
              views,
              likes,
              comments
            });
            newShortsCount++;
            console.log(`[SYNC] Added channel short: ${vId} => ${title}`);
          } else {
            await docRef.update({
              title,
              category: "shorts",
              thumbnailUrl: thumbnail,
              views
            });
            updatedShortsCount++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sync complete. ${channelVideosTabIds.length} channel videos and ${channelShortsTabIds.length} shorts active.`,
      channelVideosCount: channelVideosTabIds.length,
      channelShortsCount: channelShortsTabIds.length,
      newVideos: newCount,
      updatedVideos: updatedCount,
      newShorts: newShortsCount,
      updatedShorts: updatedShortsCount,
      removedShorts: removedShortsCount
    });
  } catch (error: any) {
    console.error("YouTube sync error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
