import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

// Handle YouTube WebSub subscription verification
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && challenge) {
    // Respond with the challenge to verify the webhook
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Not Found", { status: 404 });
}

// Handle incoming notifications when a new video is uploaded
export async function POST(request: NextRequest) {
  try {
    const text = await request.text();

    // Extract the <entry> block from the XML payload
    const entryMatch = text.match(/<entry>([\s\S]*?)<\/entry>/);
    if (entryMatch) {
      const entryText = entryMatch[1];
      
      const vIdMatch = entryText.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
      const titleMatch = entryText.match(/<title>(.*?)<\/title>/);
      const publishedMatch = entryText.match(/<published>(.*?)<\/published>/);

      const vId = vIdMatch ? vIdMatch[1] : null;
      const title = titleMatch ? titleMatch[1] : null;
      const published = publishedMatch ? publishedMatch[1] : new Date().toISOString();

      if (vId && title) {
        // Auto-categorize based on title
        const titleLower = title.toLowerCase();
        // Default fallback
        let category = "movies"; 

        // Check if it's a Short via YouTube's URL behavior
        try {
          const res = await fetch(`https://www.youtube.com/shorts/${vId}`, { method: 'HEAD', redirect: 'manual' });
          if (res.status === 200) {
            category = "shorts";
          }
        } catch (e) {
          console.error("Error checking shorts status", e);
        }

        // Apply keyword overrides for BTS/Trailers if it's not a short (or even if it is, maybe prefer the keyword)
        if (category !== "shorts") {
          if (titleLower.includes("trailer")) {
            category = "trailers";
          } else if (titleLower.includes("bts") || titleLower.includes("behind the scene")) {
            category = "bts";
          } else if (titleLower.includes("music")) {
            category = "music";
          } else if (titleLower.includes("post")) {
            category = "posts";
          }
        }

        if (category === "shorts") {
          console.log(`Skipped YouTube Short from 'videos' collection: ${vId} ("${title}")`);
          // Ensure it is not in the videos collection
          await adminDb.collection("videos").doc(vId).delete().catch(() => {});
        } else {
          // Save to Firestore under the 'videos' collection
          await adminDb.collection("videos").doc(vId).set({
            videoId: vId,
            title,
            category,
            publishedAt: published,
            createdAt: new Date().toISOString(),
            likes: "0",
            comments: "0"
          }, { merge: true });

          console.log(`Saved new YouTube channel video ${vId} in category: ${category}`);
        }
      }
    }
    
    // Always return 200 to acknowledge receipt and stop YouTube from retrying
    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("Error processing YouTube webhook:", error);
    // Still return 200 so YouTube doesn't repeatedly retry failing requests
    return new NextResponse("OK", { status: 200 });
  }
}
