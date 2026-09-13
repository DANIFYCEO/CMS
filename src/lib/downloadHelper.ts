/**
 * Initiates direct download of a video to the user's mobile device / browser
 */
export async function downloadVideo(videoId: string, title: string) {
  try {
    const filename = `${title.replace(/[^a-zA-Z0-9_ -]/g, "").substring(0, 40)}.mp4`;
    
    // Hit our own Next.js API route which pipes the video via ytdl-core
    const directUrl = `/api/download?v=${encodeURIComponent(videoId)}&title=${encodeURIComponent(title)}`;
    
    // Create an invisible anchor to trigger download
    const link = document.createElement("a");
    link.href = directUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return true;
  } catch (error) {
    console.error("Download failed:", error);
    return false;
  }
}
