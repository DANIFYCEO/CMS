"use client";

import BottomNav from "@/components/BottomNav";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { cleanTitle, formatCount, timeAgo } from "@/lib/videoUtils";
import ShareDrawer from "@/components/ShareDrawer";

export default function VideosPage() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<string>("all");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const f = params.get("filter");
      if (f) setActiveFilter(f.toLowerCase());
    }
  }, []);

  const categories = [
    { id: "all", label: "All" },
    { id: "movies", label: "Movies" },
    { id: "trailers", label: "Trailers" },
    { id: "shorts", label: "Shorts" },
    { id: "gallery", label: "Gallery" },
    { id: "bts", label: "BTS" },
    { id: "music", label: "Music" },
  ];

  // 3-dots menu & action states
  const [selectedMenuVideo, setSelectedMenuVideo] = useState<any | null>(null);
  const [shareVideo, setShareVideo] = useState<any | null>(null);
  const [downloadModalVideo, setDownloadModalVideo] = useState<any | null>(null);
  const [savedMap, setSavedMap] = useState<{ [videoId: string]: boolean }>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((curr) => (curr === msg ? null : curr)), 3000);
  };

  // Sync saved status from localStorage
  useEffect(() => {
    const uid = user?.uid || "guest";
    const map: { [id: string]: boolean } = {};
    videos.forEach((v) => {
      if (v.videoId) {
        map[v.videoId] = localStorage.getItem(`cms_saved_${uid}_${v.videoId}`) === "true";
      }
    });
    setSavedMap(map);
  }, [videos, user]);

  // Handle Save / Watchlist
  const handleToggleSave = async (item: any) => {
    const videoId = item.videoId || item.id;
    const uid = user?.uid || "guest";
    const isCurrentlySaved = !!savedMap[videoId];
    const nextSaved = !isCurrentlySaved;

    setSavedMap((prev) => ({ ...prev, [videoId]: nextSaved }));
    localStorage.setItem(`cms_saved_${uid}_${videoId}`, nextSaved ? "true" : "false");

    if (user && db) {
      try {
        const docRef = doc(db, "users", user.uid, "savedVideos", videoId);
        if (nextSaved) {
          await setDoc(docRef, {
            videoId,
            title: item.title,
            savedAt: serverTimestamp(),
            category: item.category || "videos",
          });
        } else {
          await deleteDoc(docRef);
        }
      } catch (err) {
        console.error("Error toggling saved video:", err);
      }
    }

    showToast(nextSaved ? "Saved to Watchlist!" : "Removed from Watchlist");
    setSelectedMenuVideo(null);
  };

  // Handle Share
  const handleOpenShare = (item: any) => {
    setSelectedMenuVideo(null);
    setShareVideo(item);
  };

  // Handle Download (Opens Coming Soon Screen)
  const handleOpenDownload = (item: any) => {
    setSelectedMenuVideo(null);
    setDownloadModalVideo(item);
    showToast("Downloads coming soon!");
  };

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "videos"), orderBy("publishedAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setVideos(all);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching videos:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredVideos = videos.filter((v: any) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "movies") return v.category === "movies" || !v.category;
    if (activeFilter === "trailers") return v.category === "trailers" || (v.title && v.title.toLowerCase().includes("trailer"));
    if (activeFilter === "shorts") return v.category === "shorts";
    if (activeFilter === "bts") return v.category === "bts";
    if (activeFilter === "music") return v.category === "music";
    return true;
  });

  return (
    <div className="flex flex-col min-h-[100dvh] bg-black text-white pb-24 overflow-x-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3.5 bg-black/90 backdrop-blur-md sticky top-0 z-40 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-1 -ml-1 text-white/80 hover:text-white transition-colors">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <h1 className="text-lg font-bold tracking-tight text-white">Videos</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/search" className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </Link>
        </div>
      </header>

      {/* ── Category Tabs (Consistent Across All Selections) ── */}
      <nav className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto no-scrollbar sticky top-[57px] bg-black/95 backdrop-blur-md z-30 border-b border-white/5">
        {categories.map((cat) => {
          const isActive = activeFilter === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                if (cat.id === "shorts") {
                  router.push("/shorts");
                  return;
                }
                if (cat.id === "gallery") {
                  router.push("/gallery");
                  return;
                }
                setActiveFilter(cat.id);
              }}
              className={`text-xs px-4 py-1.5 rounded-full whitespace-nowrap shrink-0 transition-all font-semibold cursor-pointer ${
                isActive
                  ? "bg-cms-yellow text-black font-bold shadow-md shadow-cms-yellow/20 scale-[1.02]"
                  : "bg-white/5 text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </nav>

      {/* Video Feed - YouTube Home Style */}
      <section className="flex flex-col">
        {loading ? (
          <div className="flex flex-col gap-6 p-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex flex-col gap-3 animate-pulse">
                <div className="w-full aspect-video bg-[#1a1a1a] rounded-2xl"></div>
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#222] shrink-0"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[#222] rounded w-5/6"></div>
                    <div className="h-3 bg-[#1e1e1e] rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center text-white/50 px-4">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-40">
                <rect width="20" height="15" x="2" y="7" rx="2" ry="2"/>
                <polyline points="17 2 12 7 7 2"/>
              </svg>
            </div>
            <h3 className="text-base font-bold text-white mb-1">No videos found</h3>
            <p className="text-xs text-white/40 mb-4">No content available in this category yet.</p>
            <button
              onClick={() => setActiveFilter("all")}
              className="bg-cms-yellow text-black text-xs font-bold px-4 py-2 rounded-full cursor-pointer hover:brightness-110 transition-all"
            >
              View All Videos
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredVideos.map((item, i) => {
              const displayTitle = cleanTitle(item.title);
              const targetUrl =
                item.category === "shorts"
                  ? "/shorts"
                  : `/watch?v=${item.videoId}&t=${encodeURIComponent(displayTitle)}`;

              return (
                <div 
                  key={item.id || item.videoId || i} 
                  className="flex flex-col pb-5 mb-2 border-b border-white/5 last:border-b-0"
                >
                  {/* Video 16:9 Thumbnail */}
                  <Link href={targetUrl} className="relative w-full aspect-video bg-[#141414] overflow-hidden group block sm:rounded-2xl sm:mx-4 sm:w-auto">
                    <Image
                      src={`https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`}
                      alt={displayTitle}
                      fill
                      priority={i < 2}
                      sizes="(max-width: 768px) 100vw, 800px"
                      className="object-cover group-hover:scale-102 transition-transform duration-300"
                    />
                    
                    {/* Dark gradient overlay on hover */}
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <div className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 group-active:scale-95 transition-all">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                      </div>
                    </div>

                    {/* HD / Duration Badge in bottom-right */}
                    <div className="absolute bottom-2.5 right-2.5 bg-black/85 text-white text-[11px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm tracking-wide">
                      {item.duration || "HD"}
                    </div>
                  </Link>

                  {/* Video Information Row */}
                  <div className="flex gap-3 px-4 pt-3 items-start">
                    {/* Channel / Brand Avatar */}
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-black border border-white/15 mt-0.5 relative shadow-md">
                      <Image
                        src="/cms-avatar.png"
                        alt="Campus Movie Series"
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    </div>

                    {/* Title & Metadata */}
                    <div className="flex-1 min-w-0">
                      <Link href={targetUrl} className="block group">
                        <h3 className="text-[14px] sm:text-[15px] font-semibold text-white leading-snug line-clamp-2 group-hover:text-cms-yellow transition-colors">
                          {displayTitle}
                        </h3>
                      </Link>
                      
                      <div className="text-[12px] text-white/55 mt-1 flex items-center gap-1.5 flex-wrap leading-tight">
                        <span className="font-medium text-white/75">Campus Movie Series</span>
                        <span>•</span>
                        <span>{item.views ? `${formatCount(item.views)} views` : "Official"}</span>
                        <span>•</span>
                        <span>{timeAgo(item.publishedAt)}</span>
                      </div>
                    </div>

                    {/* 3-dots Options Menu: Download, Save, Share */}
                    <button 
                      onClick={() => setSelectedMenuVideo(item)}
                      className="text-white/50 hover:text-white p-1.5 -mr-1.5 shrink-0 rounded-full hover:bg-white/10 active:scale-90 transition-all"
                      title="More options"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.75"/>
                        <circle cx="12" cy="12" r="1.75"/>
                        <circle cx="12" cy="19" r="1.75"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 3-Dots Video Options Bottom Sheet ── */}
      {selectedMenuVideo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={() => setSelectedMenuVideo(null)}
          />

          {/* Drawer Sheet */}
          <div className="relative w-full max-w-lg bg-[#18181a] border-t border-white/10 rounded-t-3xl p-5 pb-8 shadow-2xl z-10 animate-in slide-in-from-bottom duration-300">
            {/* Grab Handle */}
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

            {/* Video Preview Header */}
            <div className="flex items-center gap-3 pb-4 mb-3 border-b border-white/10">
              <div className="relative w-16 aspect-video rounded-lg overflow-hidden shrink-0 bg-[#121212]">
                <Image
                  src={`https://i.ytimg.com/vi/${selectedMenuVideo.videoId}/hqdefault.jpg`}
                  alt={cleanTitle(selectedMenuVideo.title)}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <h4 className="text-sm font-semibold text-white line-clamp-1 leading-snug">
                  {cleanTitle(selectedMenuVideo.title)}
                </h4>
                <p className="text-xs text-white/50 mt-0.5">Campus Movie Series</p>
              </div>
              <button
                onClick={() => setSelectedMenuVideo(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>

            {/* Action Buttons: Download, Save, Share */}
            <div className="flex flex-col gap-1.5">
              {/* 1. Download Video (Coming Soon) */}
              <button
                onClick={() => handleOpenDownload(selectedMenuVideo)}
                className="w-full flex items-center gap-4 px-3 py-3 rounded-2xl hover:bg-white/5 active:bg-white/10 transition-colors text-left group"
              >
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/90 group-hover:text-cms-yellow group-hover:bg-cms-yellow/10 transition-colors shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">Download Video</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cms-yellow/15 text-cms-yellow border border-cms-yellow/30">
                      Coming Soon
                    </span>
                  </div>
                  <p className="text-xs text-white/45 mt-0.5">Save offline to watch anytime</p>
                </div>
              </button>

              {/* 2. Save / Watchlist */}
              <button
                onClick={() => handleToggleSave(selectedMenuVideo)}
                className="w-full flex items-center gap-4 px-3 py-3 rounded-2xl hover:bg-white/5 active:bg-white/10 transition-colors text-left group"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  savedMap[selectedMenuVideo.videoId || selectedMenuVideo.id]
                    ? "bg-cms-yellow text-black"
                    : "bg-white/5 text-white/90 group-hover:text-cms-yellow group-hover:bg-cms-yellow/10"
                }`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={savedMap[selectedMenuVideo.videoId || selectedMenuVideo.id] ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-white">
                    {savedMap[selectedMenuVideo.videoId || selectedMenuVideo.id] ? "Remove from Watchlist" : "Save to Watchlist"}
                  </span>
                  <p className="text-xs text-white/45 mt-0.5">
                    {savedMap[selectedMenuVideo.videoId || selectedMenuVideo.id] ? "Saved in your library" : "Add to your personal watch later list"}
                  </p>
                </div>
              </button>

              {/* 3. Share Video */}
              <button
                onClick={() => handleOpenShare(selectedMenuVideo)}
                className="w-full flex items-center gap-4 px-3 py-3 rounded-2xl hover:bg-white/5 active:bg-white/10 transition-colors text-left group"
              >
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/90 group-hover:text-cms-yellow group-hover:bg-cms-yellow/10 transition-colors shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3"/>
                    <circle cx="6" cy="12" r="3"/>
                    <circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-white">Share Video</span>
                  <p className="text-xs text-white/45 mt-0.5">Share via WhatsApp, Twitter, or copy link</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── "Downloads Coming Soon" Screen / Modal ── */}
      {downloadModalVideo && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => setDownloadModalVideo(null)}
          />

          <div className="relative w-full max-w-sm bg-[#161618] border border-white/10 rounded-3xl p-6 text-center shadow-2xl z-10 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Ambient gold glow */}
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-44 h-44 bg-cms-yellow/15 rounded-full blur-3xl pointer-events-none" />

            {/* Close icon */}
            <button
              onClick={() => setDownloadModalVideo(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>

            {/* Icon Graphic */}
            <div className="w-16 h-16 rounded-2xl bg-cms-yellow/10 border border-cms-yellow/30 text-cms-yellow flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cms-yellow/10">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>

            {/* Pill Tag */}
            <div className="inline-flex items-center gap-1.5 bg-cms-yellow/15 text-cms-yellow border border-cms-yellow/30 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cms-yellow animate-ping" />
              In Development
            </div>

            <h3 className="text-xl font-bold text-white mb-2">Downloads Coming Soon</h3>
            
            <p className="text-xs text-white/60 leading-relaxed mb-4 px-2">
              Offline video downloading is currently in active development. You will soon be able to download your favorite CMS movies and episodes directly to your device for smooth offline viewing!
            </p>

            {/* Video Context Chip */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 mb-5 flex items-center gap-2.5 text-left">
              <div className="relative w-12 aspect-video rounded overflow-hidden shrink-0 bg-black">
                <Image
                  src={`https://i.ytimg.com/vi/${downloadModalVideo.videoId}/hqdefault.jpg`}
                  alt="Video"
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
              <p className="text-xs font-semibold text-white/90 line-clamp-1 flex-1">
                {cleanTitle(downloadModalVideo.title)}
              </p>
            </div>

            {/* Action Button */}
            <button
              onClick={() => setDownloadModalVideo(null)}
              className="w-full bg-cms-yellow text-black font-bold py-3 rounded-full hover:bg-yellow-400 active:scale-98 transition-all shadow-md shadow-cms-yellow/20 text-sm"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* ── Share Drawer ── */}
      {shareVideo && (
        <ShareDrawer
          isOpen={!!shareVideo}
          onClose={() => setShareVideo(null)}
          url={`${typeof window !== "undefined" ? window.location.origin : ""}/watch?v=${shareVideo.videoId}&t=${encodeURIComponent(cleanTitle(shareVideo.title))}`}
          title={cleanTitle(shareVideo.title)}
          thumbnail={`https://i.ytimg.com/vi/${shareVideo.videoId}/hqdefault.jpg`}
        />
      )}

      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[120] bg-[#222]/95 border border-white/15 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
          {toastMessage}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
