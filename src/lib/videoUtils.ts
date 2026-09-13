// Utility helpers for video title cleaning, formatting and interactions

export function cleanTitle(rawTitle?: string): string {
  if (!rawTitle) return "Campus Movie Series";
  
  // Remove hashtags like #movie #shorts #something
  let cleaned = rawTitle.replace(/#\S+/g, "").trim();
  
  // Remove @mentions like @GIANT_LENS_PICTURES
  cleaned = cleaned.replace(/@\S+/g, "").trim();
  
  // Clean multiple spaces and trailing hyphens/bars
  cleaned = cleaned.replace(/\s+/g, " ").replace(/[-|–—\s]+$/, "").trim();
  
  // If stripping left it empty, use raw without hash symbols
  if (!cleaned) {
    cleaned = rawTitle.replace(/#/g, "").trim();
  }
  
  return cleaned || "Untitled Video";
}

export function formatCount(count?: number | string): string {
  if (count === undefined || count === null) return "0";
  if (typeof count === "string") {
    // If it already has K/M format, return as is
    if (count.includes("K") || count.includes("M") || count.includes("k") || count.includes("m")) {
      return count.toUpperCase();
    }
    const num = parseInt(count.replace(/[^0-9]/g, ""), 10);
    if (isNaN(num)) return "0";
    count = num;
  }
  
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return count.toString();
}

export function timeAgo(dateString?: string): string {
  if (!dateString) return "Recently";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Recently";
  
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
