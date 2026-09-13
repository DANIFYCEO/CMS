import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { action, videoId, channelId, accessToken, userId } = await req.json();

    if (!accessToken) {
      return NextResponse.json({ error: "No YouTube access token provided. User must log in with Google." }, { status: 401 });
    }

    if (action === "like" && videoId) {
      // https://developers.google.com/youtube/v3/docs/videos/rate
      const response = await fetch(`https://www.googleapis.com/youtube/v3/videos/rate?id=${videoId}&rating=like`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("YouTube API Like Error:", errorData);
        
        if (userId) {
          await adminDb.collection("users").doc(userId).collection("youtube_likes").doc(videoId).set({
            youtube_like: false,
            error: errorData,
            timestamp: new Date().toISOString()
          }, { merge: true });
        }
        
        return NextResponse.json({ error: "Failed to like video on YouTube", details: errorData }, { status: response.status });
      }

      if (userId) {
        await adminDb.collection("users").doc(userId).collection("youtube_likes").doc(videoId).set({
          youtube_like: true,
          timestamp: new Date().toISOString()
        }, { merge: true });
      }

      return NextResponse.json({ success: true, message: "Liked on YouTube" });
    }

    if (action === "subscribe" && channelId) {
      // https://developers.google.com/youtube/v3/docs/subscriptions/insert
      const response = await fetch(`https://www.googleapis.com/youtube/v3/subscriptions?part=snippet`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippet: {
            resourceId: {
              kind: "youtube#channel",
              channelId: channelId,
            },
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("YouTube API Subscribe Error:", errorData);
        return NextResponse.json({ error: "Failed to subscribe on YouTube", details: errorData }, { status: response.status });
      }

      return NextResponse.json({ success: true, message: "Subscribed on YouTube" });
    }

    return NextResponse.json({ error: "Invalid action or missing parameters" }, { status: 400 });

  } catch (error) {
    console.error("youtube-action api error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
