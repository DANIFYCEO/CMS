"use client";

import { useEffect } from "react";

export default function YouTubeAutoSync() {
  useEffect(() => {
    const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes check
    const LAST_SYNC_KEY = "cms_last_youtube_sync";

    let lastSync = null;
    try {
      lastSync = localStorage.getItem(LAST_SYNC_KEY);
    } catch (e) {
      // Ignore if localStorage is blocked (e.g. private browsing)
    }

    const now = Date.now();

    // Only sync if 5+ minutes have passed since last sync
    if (lastSync && now - parseInt(lastSync) < SYNC_INTERVAL_MS) {
      return;
    }

    // Fire and forget — don't block the UI
    fetch("/api/sync-youtube")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          console.log(`[YouTube Sync] ${data.message}`);
          try {
            localStorage.setItem(LAST_SYNC_KEY, now.toString());
          } catch (e) {}
        }
      })
      .catch(() => {
        // Silently fail — this is a background enhancement
      });
  }, []);

  return null; // This component renders nothing
}
