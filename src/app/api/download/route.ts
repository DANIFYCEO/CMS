import { NextRequest, NextResponse } from "next/server";
import ytdl from "@distube/ytdl-core";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const videoId = searchParams.get("v");
  let title = searchParams.get("title") || "video";

  if (!videoId) {
    return NextResponse.json({ error: "Missing video ID" }, { status: 400 });
  }

  // Sanitize title for filename
  const cleanFilename = title.replace(/[^a-zA-Z0-9_ -]/g, "").substring(0, 50) + ".mp4";

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Create a readable stream from ytdl-core
    const ytdlStream = ytdl(videoUrl, { filter: "audioandvideo", quality: "highest" });
    
    // Convert Node.js Readable stream to Web ReadableStream
    const readableStream = new ReadableStream({
      start(controller) {
        ytdlStream.on("data", (chunk) => {
          controller.enqueue(chunk);
        });
        ytdlStream.on("end", () => {
          controller.close();
        });
        ytdlStream.on("error", (err) => {
          controller.error(err);
        });
      },
      cancel() {
        ytdlStream.destroy();
      }
    });

    return new NextResponse(readableStream, {
      headers: {
        "Content-Disposition": `attachment; filename="${cleanFilename}"`,
        "Content-Type": "video/mp4",
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json({ error: "Failed to download video" }, { status: 500 });
  }
}
