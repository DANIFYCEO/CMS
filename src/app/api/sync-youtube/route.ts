import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;

interface YouTubeVideo {
  id: { videoId?: string; kind: string };
  snippet: {
    title: string;
    publishedAt: string;
    description: string;
  };
}

async function categorizeVideo(videoId: string, title: string): Promise<string> {
  const titleLower = title.toLowerCase();

  // Check if it's a YouTube Short using the Data API duration
  let isShort = false;
  try {
    const key = process.env.YOUTUBE_API_KEY;
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${key}`);
    const ytData = await res.json();
    if (ytData.items && ytData.items.length > 0) {
      const duration = ytData.items[0].contentDetails.duration;
      // Shorts are typically under 61 seconds (e.g. PT1M or PT59S)
      if ((duration.includes("PT") && !duration.includes("M") && !duration.includes("H")) || duration.match(/PT1M0?[0-9]S/) || duration === "PT1M") {
        isShort = true;
      }
    }
  } catch (err) {
    console.error(`Failed to get duration for ${videoId}`, err);
  }

  if (isShort) return "shorts";

  // Keyword-based categorization for long-form videos
  if (titleLower.includes("trailer")) return "trailers";
  if (titleLower.includes("bts") || titleLower.includes("behind the scene")) return "bts";
  if (titleLower.includes("music")) return "music";
  if (titleLower.includes("post")) return "posts";

  // Default: movies
  return "movies";
}

export async function GET(request: NextRequest) {

  // Optional: protect with a secret query param
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
    // Fetch latest 15 videos from the channel
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${CHANNEL_ID}&maxResults=15&order=date&type=video&key=${YOUTUBE_API_KEY}`;
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("YouTube API error:", errorText);
      return NextResponse.json(
        { error: "YouTube API request failed", details: errorText },
        { status: res.status }
      );
    }

    const data = await res.json();
    const videos: YouTubeVideo[] = data.items || [];

    let newCount = 0;
    let updatedCount = 0;

    for (const video of videos) {
      const videoId = video.id.videoId;
      const title = video.snippet.title;
      const publishedAt = video.snippet.publishedAt;

      if (!videoId || !title) continue;

      const docRef = adminDb.collection("videos").doc(videoId);
      const existingDoc = await docRef.get();

      if (!existingDoc.exists) {
        // New video - categorize and save
        const category = await categorizeVideo(videoId, title);

        if (category === "shorts") {
          console.log(`[SYNC] Skipped short: ${videoId}: ${title}`);
          continue;
        }

        await adminDb.collection("videos").doc(videoId).set({
          videoId,
          title,
          category,
          publishedAt,
          createdAt: new Date().toISOString(),
          likes: "0",
          comments: "0",
        });

        console.log(`[SYNC] New video: ${videoId} => ${category}: ${title}`);
        newCount++;
      } else {
        // Already exists - optionally update title if it changed
        const existingData = existingDoc.data();
        if (existingData && existingData.title !== title) {
          await adminDb.collection("videos").doc(videoId).update({ title });
          updatedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${videos.length} videos. ${newCount} new, ${updatedCount} updated.`,
      totalFetched: videos.length,
      newVideos: newCount,
      updatedVideos: updatedCount,
    });
  } catch (error) {
    console.error("YouTube sync error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
