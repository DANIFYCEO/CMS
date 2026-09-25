"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import YouTube, { YouTubeProps, YouTubePlayer } from "react-youtube";
import { 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  increment, 
  query, 
  orderBy, 
  serverTimestamp,
  setDoc,
  deleteDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { cleanTitle, formatCount, timeAgo } from "@/lib/videoUtils";
import ShareDrawer from "@/components/ShareDrawer";
import { canModerateCommunity } from "@/lib/adminRoles";

function WatchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const v = searchParams.get("v");
  const t = searchParams.get("t");
  const { user, userData } = useAuth();
  
  // Default to real video pCJLCP1jZfA
  const videoId = v || "pCJLCP1jZfA"; 
  const rawTitle = t || "Campus Movie Series";
  const videoTitle = cleanTitle(rawTitle);

  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isAutoplay, setIsAutoplay] = useState(true);
  
  // Interaction states — fixed initial states to prevent glitch flashing
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likesCount, setLikesCount] = useState<number | null>(null);
  const [viewsCount, setViewsCount] = useState<number | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [userProfiles, setUserProfiles] = useState<{ [uid: string]: any }>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Up Next & 3-dots sheet
  const [upNextVideos, setUpNextVideos] = useState<any[]>([]);
  const [activeMenuVideo, setActiveMenuVideo] = useState<any | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const playerRef = useRef<YouTubePlayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ── Auto-hide controls after 3 seconds ──
  const resetControlsTimer = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    setShowControls(true);

    if (isPlaying) {
      controlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      resetControlsTimer();
    } else {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      setShowControls(true);
    }
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [isPlaying, resetControlsTimer]);

  // ── Track Views Once & Sync Real-Time Video Data ──
  useEffect(() => {
    if (!db || !videoId) return;

    const videoRef = doc(db, "videos", videoId);
    
    // Increment view count strictly ONCE per browser session per video
    const sessionKey = `cms_viewed_${videoId}`;
    if (typeof window !== "undefined" && !sessionStorage.getItem(sessionKey)) {
      sessionStorage.setItem(sessionKey, "true");
      updateDoc(videoRef, {
        views: increment(1)
      }).catch(() => {
        setDoc(videoRef, {
          videoId,
          title: videoTitle,
          views: 1,
          likes: 0,
          createdAt: new Date().toISOString()
        }, { merge: true });
      });
    }

    // Listen to video doc for live counts
    const unsubVideo = onSnapshot(videoRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setLikesCount(typeof data.likes === "number" ? data.likes : (parseInt(data.likes, 10) || 0));
        setViewsCount(typeof data.views === "number" ? data.views : (parseInt(data.views, 10) || 1));
      } else {
        setLikesCount(0);
        setViewsCount(1);
      }
    });

    // Listen to comments subcollection in real-time
    const commentsQ = query(
      collection(db, "videos", videoId, "comments"), 
      orderBy("createdAt", "desc")
    );
    const unsubComments = onSnapshot(commentsQ, (snap) => {
      const allComments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setComments(allComments);
    });

    // Listen to Up Next videos
    const upNextQ = query(collection(db, "videos"), orderBy("publishedAt", "desc"));
    const unsubUpNext = onSnapshot(upNextQ, (snap) => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((item: any) => item.videoId !== videoId && item.category !== "shorts");
      setUpNextVideos(list);
    });

    // Load saved interactions for the specific user
    const uid = user?.uid || "guest";
    setIsLiked(localStorage.getItem(`cms_liked_${uid}_${videoId}`) === "true");
    setIsDisliked(localStorage.getItem(`cms_disliked_${uid}_${videoId}`) === "true");
    setIsSaved(localStorage.getItem(`cms_saved_${uid}_${videoId}`) === "true");

    // Listen to users for profile pictures and badges
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const map: { [id: string]: any } = {};
      snap.docs.forEach((d) => {
        map[d.id] = d.data();
      });
      setUserProfiles(map);
    });

    return () => {
      unsubVideo();
      unsubComments();
      unsubUpNext();
      unsubUsers();
    };
  }, [videoId, videoTitle, user?.uid]);

  const pendingPlayRef = useRef(false);

  const onPlayerReady: YouTubeProps['onReady'] = (event) => {
    playerRef.current = event.target;
    try {
      setDuration(event.target.getDuration());
    } catch (e) {}
    
    // Resume video progress
    const savedTime = localStorage.getItem(`cms_progress_${videoId}`);
    if (savedTime && parseFloat(savedTime) > 0) {
      try {
        event.target.seekTo(parseFloat(savedTime), true);
      } catch (e) {}
    }

    if (pendingPlayRef.current) {
      try {
        event.target.playVideo();
      } catch (e) {
        console.warn("Play error on ready:", e);
      }
      setIsPlaying(true);
      setHasStarted(true);
      pendingPlayRef.current = false;
    }
  };

  const onPlayerError: YouTubeProps['onError'] = (event) => {
    console.warn("YouTube Player error event:", event.data);
  };

  const onPlayerStateChange: YouTubeProps['onStateChange'] = (event) => {
    // 1 = playing, 2 = paused, 0 = ended, 3 = buffering
    if (event.data === 1) {
      setIsPlaying(true);
      setHasStarted(true);
    } else if (event.data === 2) {
      setIsPlaying(false);
    } else if (event.data === 3) {
      setHasStarted(true);
    }
    
    // Autoplay next video when ended
    if (event.data === 0 && isAutoplay && upNextVideos.length > 0) {
      const nextVid = upNextVideos[0];
      if (nextVid && nextVid.videoId) {
        showToast("Playing next video...");
        setTimeout(() => {
          router.push(`/watch?v=${nextVid.videoId}&t=${encodeURIComponent(cleanTitle(nextVid.title))}`);
        }, 1200);
      }
    }
  };

  // Progress tracker
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current && isPlaying && !isSeeking) {
        const currentTime = playerRef.current.getCurrentTime();
        setProgress(currentTime);
        // Save progress if valid
        if (currentTime > 5 && duration > 0) {
          localStorage.setItem(`cms_progress_${videoId}`, currentTime.toString());
        }
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isPlaying, isSeeking, videoId, duration]);

  const togglePlay = () => {
    if (playerRef.current) {
      if (isPlaying) {
        try {
          playerRef.current.pauseVideo();
        } catch (e) {}
        setIsPlaying(false);
      } else {
        try {
          playerRef.current.playVideo();
        } catch (e) {
          console.warn("togglePlay playVideo error:", e);
        }
        setIsPlaying(true);
        setHasStarted(true);
      }
    } else {
      pendingPlayRef.current = true;
      setIsPlaying(true);
      setHasStarted(true);
    }
    resetControlsTimer();
  };

  const skip = (seconds: number) => {
    if (playerRef.current) {
      const current = playerRef.current.getCurrentTime();
      const newTime = Math.max(0, Math.min(current + seconds, duration));
      playerRef.current.seekTo(newTime, true);
      setProgress(newTime);
      resetControlsTimer();
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // ── Fullscreen Toggle ──
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
        if (screen.orientation && (screen.orientation as any).lock) {
          (screen.orientation as any).lock('landscape').catch(() => {});
        }
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
        if (screen.orientation && (screen.orientation as any).unlock) {
          (screen.orientation as any).unlock();
        }
      }).catch(() => {});
    }
  };

  useEffect(() => {
    const handler = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      if (!isFs && screen.orientation && (screen.orientation as any).unlock) {
        (screen.orientation as any).unlock();
      }
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const opts: YouTubeProps['opts'] = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0,
      controls: 0,
      modestbranding: 1,
      rel: 0,
      showinfo: 0,
      fs: 0,
      iv_load_policy: 3,
      disablekb: 1,
      playsinline: 1,
      enablejsapi: 1,
      origin: typeof window !== "undefined" ? window.location.origin : undefined,
    },
  };

  const handleContainerTap = () => {
    if (!hasStarted) {
      togglePlay();
      return;
    }
    if (showControls && isPlaying) {
      setShowControls(false);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    } else {
      resetControlsTimer();
    }
  };

  // ── Like / Dislike Handlers ──
  const handleLike = async () => {
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    if (newLiked && isDisliked) setIsDisliked(false);

    const diff = newLiked ? 1 : -1;
    setLikesCount(prev => Math.max(0, (prev || 0) + diff));

    const uid = user?.uid || "guest";
    localStorage.setItem(`cms_liked_${uid}_${videoId}`, newLiked ? "true" : "false");
    localStorage.setItem(`cms_disliked_${uid}_${videoId}`, "false");

    if (db && videoId) {
      updateDoc(doc(db, "videos", videoId), {
        likes: increment(diff)
      }).catch(() => {});
    }
    
    showToast(newLiked ? "Liked!" : "Removed like");

    // Sync to real Youtube channel if user is authenticated with Google
    if (newLiked) {
      const token = sessionStorage.getItem("youtube_access_token");
      if (token) {
        try {
          // Like video
          const res = await fetch("/api/youtube-action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "like", videoId, accessToken: token, userId: uid })
          });
          
          if (!res.ok) {
            // Revert optimistic update
            setIsLiked(false);
            setLikesCount(prev => Math.max(0, (prev || 0) - 1));
            localStorage.setItem(`cms_liked_${uid}_${videoId}`, "false");
            if (db && videoId) {
              updateDoc(doc(db, "videos", videoId), {
                likes: increment(-1)
              }).catch(() => {});
            }
            showToast("Failed to sync like to YouTube");
          }
          
          // Also subscribe to the channel
          const channelId = "UC8G09Lmm_c-Qwt7WK-7NjpA"; // Fallback to CMS channel ID
          await fetch("/api/youtube-action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "subscribe", channelId, accessToken: token, userId: uid })
          });
        } catch (e) {
          console.error("Youtube sync failed", e);
        }
      } else {
        // Just note that it's local
        console.log("Local like only, no Youtube token found.");
      }
    }
  };

  const handleDislike = async () => {
    const newDisliked = !isDisliked;
    setIsDisliked(newDisliked);
    if (newDisliked && isLiked) {
      setIsLiked(false);
      setLikesCount(prev => Math.max(0, (prev || 1) - 1));
      if (db && videoId) {
        updateDoc(doc(db, "videos", videoId), {
          likes: increment(-1)
        }).catch(() => {});
      }
    }
    const uid = user?.uid || "guest";
    localStorage.setItem(`cms_disliked_${uid}_${videoId}`, newDisliked ? "true" : "false");
    localStorage.setItem(`cms_liked_${uid}_${videoId}`, "false");
    showToast(newDisliked ? "Feedback received" : "Removed dislike");
  };

  // ── Share Handler ──
  const handleShare = () => setIsShareOpen(true);

  // ── Download Handler ──
  const handleDownload = () => {
    showToast("Downloads coming soon!");
  };

  // ── Save to Watchlist ──
  const handleSave = async () => {
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);
    const uid = user?.uid || "guest";
    localStorage.setItem(`cms_saved_${uid}_${videoId}`, nextSaved ? "true" : "false");
    
    if (user && db) {
      const docRef = doc(db, "users", user.uid, "savedVideos", videoId);
      try {
        if (nextSaved) {
          await setDoc(docRef, { videoId, title: videoTitle, savedAt: serverTimestamp(), category: "movies" });
        } else {
          await deleteDoc(docRef);
        }
      } catch (err) {
        console.error("Failed to save to Firestore", err);
      }
    }
    
    showToast(nextSaved ? "Saved to Watchlist!" : "Removed from Watchlist");
  };

  // ── Comments Scroll & Submit ──
  const handleOpenCommentInput = () => {
    setShowCommentInput(true);
    setTimeout(() => {
      commentInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      commentInputRef.current?.focus();
    }, 100);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submittingComment || !db) return;

    setSubmittingComment(true);
    try {
      const authorName = userData?.displayName || userData?.username || user?.displayName || user?.email?.split("@")[0] || "CMS Member";
      const authorPhoto = userData?.photoURL || user?.photoURL || null;
      const authorMembership = userData?.membership || "free";

      await addDoc(collection(db, "videos", videoId, "comments"), {
        content: newComment.trim(),
        authorName,
        authorPhoto,
        authorMembership,
        username: userData?.username || "",
        userId: user?.uid || "guest",
        createdAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
      });

      // Keep video doc comments count synchronized
      updateDoc(doc(db, "videos", videoId), {
        comments: increment(1)
      }).catch(() => {});

      setNewComment("");
      setShowCommentInput(false);
      showToast("Comment posted!");
    } catch (err) {
      console.error(err);
      showToast("Failed to post comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!db || !videoId || !commentId) return;
    if (!confirm("Are you sure you want to delete this comment?")) return;
    try {
      await deleteDoc(doc(db, "videos", videoId, "comments", commentId));
      updateDoc(doc(db, "videos", videoId), {
        comments: increment(-1)
      }).catch(() => {});
      showToast("Comment deleted");
    } catch (err) {
      console.error("Failed to delete comment:", err);
      showToast("Failed to delete comment");
    }
  };

  // Badge renderer for official memberships
  const renderBadge = (tierId?: string, size: "sm" | "md" | "lg" = "sm") => {
    if (!tierId) return null;
    const isElite = tierId === "elite-member";
    const isPremium = tierId === "premium-member";
    const isMember = tierId === "cms-member" || tierId === "CMS Member";

    if (!isElite && !isPremium && !isMember) return null;

    let iconSize = size === "sm" ? 7 : 9;
    let containerClass = "absolute -top-1 -right-1 bg-black rounded-full p-0.5 border z-10 flex items-center justify-center shadow-md pointer-events-none";
    let borderClass = "border-cms-yellow text-cms-yellow";

    let icon = (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 4h20M2 20h20M9 4v16M15 4v16"/><path d="M2 16l4-12 6 8 6-8 4 12z"/>
      </svg>
    );

    if (isElite) {
      borderClass = "border-purple-400 text-purple-400";
      icon = (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>
        </svg>
      );
    } else if (isPremium) {
      borderClass = "border-blue-400 text-blue-400";
      icon = (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
        </svg>
      );
    }

    return (
      <div className={`${containerClass} ${borderClass}`}>
        {icon}
      </div>
    );
  };

  return (
    <div className={`flex flex-col ${isFullscreen ? 'h-screen' : 'min-h-[100dvh]'} bg-black text-white pb-safe`}>
      
      <ShareDrawer 
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        url={typeof window !== "undefined" ? window.location.href : ""}
        title={videoTitle}
        thumbnail={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-cms-yellow text-black text-xs font-bold px-4 py-2 rounded-full shadow-2xl animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* ── Navbar (Clean: Only Back button) ── */}
      {!isFullscreen && (
        <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-50 bg-black/80 backdrop-blur-md">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">CMS Player</span>
          <div className="w-8"></div>
        </header>
      )}

      {/* ── Custom Video Player ── */}
      <div 
        ref={containerRef}
        className={`relative w-full bg-black ${isFullscreen ? 'h-full' : 'aspect-video'}`}
        onClick={handleContainerTap}
      >
        {/* YouTube iframe — original 16:9 natural size */}
        <div className="absolute inset-0 pointer-events-none select-none">
          <YouTube 
            videoId={videoId} 
            opts={opts} 
            onReady={onPlayerReady} 
            onStateChange={onPlayerStateChange}
            onError={onPlayerError}
            className="w-full h-full pointer-events-none select-none"
            iframeClassName="w-full h-full pointer-events-none select-none"
          />
        </div>

        {/* Poster overlay — hides initial loading */}
        {!hasStarted && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            <Image 
              src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} 
              alt={videoTitle} 
              fill 
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/40"></div>
          </div>
        )}

        {/* Big Center Play Button when video hasn't started yet */}
        {!hasStarted && (
          <div 
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="absolute inset-0 z-40 flex items-center justify-center cursor-pointer group"
          >
            <button
              type="button"
              className="w-20 h-20 rounded-full bg-cms-yellow hover:bg-yellow-400 text-black flex items-center justify-center shadow-2xl group-hover:scale-110 active:scale-95 transition-all"
              aria-label="Play video"
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" className="ml-1">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </button>
          </div>
        )}

        {/* ── Custom Overlay Controls ── */}
        <div 
          className={`absolute inset-0 z-30 flex flex-col justify-between transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          {/* Top gradient + fullscreen title */}
          <div className="h-14 bg-gradient-to-b from-black/80 to-transparent flex items-center px-4">
            {isFullscreen && (
              <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="text-white mr-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
            )}
            {isFullscreen && <span className="text-sm font-semibold truncate">{videoTitle}</span>}
          </div>

          {/* Center Play/Pause & Skip — 10 second icons */}
          <div className="flex items-center justify-center gap-12">
            {/* Rewind 10s */}
            <button onClick={(e) => { e.stopPropagation(); skip(-10); }} className="text-white active:scale-90 transition-transform relative">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 1-7.07 2.93"/>
                <path d="M2 2v6h6"/>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold mt-[1px]">10</span>
            </button>
            
            {/* Play / Pause */}
            <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="w-16 h-16 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-full text-white active:scale-90 transition-transform">
              {isPlaying ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              )}
            </button>

            {/* Forward 10s */}
            <button onClick={(e) => { e.stopPropagation(); skip(10); }} className="text-white active:scale-90 transition-transform relative">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 7.07 2.93"/>
                <path d="M22 2v6h-6"/>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold mt-[1px]">10</span>
            </button>
          </div>

          {/* Bottom Progress Bar, Time & Fullscreen */}
          <div className="px-4 pb-3 pt-8 bg-gradient-to-t from-black/80 to-transparent flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            {/* Scrubber */}
            <div className="relative w-full h-4 flex items-center group cursor-pointer">
              {/* Visual Track */}
              <div className="absolute w-full h-1.5 bg-white/30 rounded-full pointer-events-none">
                <div 
                  className="absolute top-0 left-0 h-full bg-cms-yellow rounded-full"
                  style={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-cms-yellow rounded-full shadow-lg translate-x-1/2 border-2 border-white scale-0 group-hover:scale-100 transition-transform"></div>
                </div>
              </div>
              
              {/* Invisible Native Input for smooth dragging */}
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={progress}
                onMouseDown={() => setIsSeeking(true)}
                onTouchStart={() => setIsSeeking(true)}
                onMouseUp={() => setIsSeeking(false)}
                onTouchEnd={() => setIsSeeking(false)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setProgress(val);
                  if (playerRef.current) {
                    playerRef.current.seekTo(val, true);
                  }
                  resetControlsTimer();
                }}
                className="absolute w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            {/* Time + Fullscreen row */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-white/90">{formatTime(progress)} / {formatTime(duration)}</span>
              <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="text-white p-1 active:scale-90 transition-transform">
                {isFullscreen ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content below player (hidden in fullscreen) ── */}
      {!isFullscreen && (
        <div className="flex-1 overflow-y-auto pb-8">
          {/* ── Metadata ── */}
          <div className="px-4 pt-4">
            <h1 className="text-[20px] font-bold leading-tight">{videoTitle}</h1>
            <p className="text-white/60 text-[12px] mt-1.5 flex items-center gap-2">
              <span>{viewsCount !== null ? `${formatCount(viewsCount)} views` : "Loading views..."}</span>
              <span className="w-1 h-1 bg-white/40 rounded-full"></span>
              <span>CMS Original</span>
            </p>
          </div>

          {/* ── Actions Row (Interactive) ── */}
          <div className="flex items-center justify-between px-4 mt-5">
            {/* Like */}
            <button 
              onClick={handleLike} 
              className={`flex flex-col items-center gap-1.5 transition-colors ${isLiked ? 'text-cms-yellow font-semibold' : 'text-white/80 hover:text-white'}`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
              </svg>
              <span className="text-[11px]">{likesCount !== null ? formatCount(likesCount) : "0"}</span>
            </button>

            {/* Dislike */}
            <button 
              onClick={handleDislike} 
              className={`flex flex-col items-center gap-1.5 transition-colors ${isDisliked ? 'text-cms-yellow font-semibold' : 'text-white/80 hover:text-white'}`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill={isDisliked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/>
              </svg>
              <span className="text-[11px]">Dislike</span>
            </button>

            {/* Share */}
            <button onClick={handleShare} className="flex flex-col items-center gap-1.5 text-white/80 hover:text-white active:scale-90 transition-transform">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              <span className="text-[11px]">Share</span>
            </button>

            {/* Download */}
            <button onClick={handleDownload} className="flex flex-col items-center gap-1.5 text-white/80 hover:text-white active:scale-90 transition-transform">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span className="text-[11px]">Download</span>
            </button>

            {/* Save */}
            <button 
              onClick={handleSave} 
              className={`flex flex-col items-center gap-1.5 transition-colors ${isSaved ? 'text-cms-yellow font-semibold' : 'text-white/80 hover:text-white'}`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
              </svg>
              <span className="text-[11px]">{isSaved ? "Saved" : "Save"}</span>
            </button>
          </div>

          <div className="px-4 mt-5 mb-5">
            <div className="h-[1px] w-full bg-white/10"></div>
          </div>

          {/* ── Channel Info (Clean Logo + Comment Button) ── */}
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              {/* Channel avatar with perfectly fitted circular CMS logo */}
              <div className="w-10 h-10 rounded-full bg-black border border-white/15 overflow-hidden relative shrink-0 shadow-md">
                <Image src="/cms-avatar.png" alt="CMS Logo" fill sizes="40px" className="object-cover" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[15px] leading-tight">Campus Movie Series</span>
                <span className="text-cms-yellow text-[11px] font-medium">Official Channel</span>
              </div>
            </div>
            
            {/* Replaced Subscribe with Comment button */}
            <button 
              onClick={handleOpenCommentInput}
              className="bg-cms-yellow text-black font-bold text-[12px] px-4 py-2 rounded-full shrink-0 active:scale-95 transition-transform flex items-center gap-1.5 shadow-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Comment
            </button>
          </div>

          {/* ── Comments Section ── */}
          <div className="px-4 mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-bold">Comments ({comments.length})</h3>
            </div>

            {/* Comment input form — ONLY shows when user clicks Comment, disappears when posted */}
            {showCommentInput && (
              <form onSubmit={handlePostComment} className="flex flex-col gap-2.5 mb-5 bg-[#141416] p-3.5 rounded-2xl border border-white/10 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-start gap-2.5">
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-full bg-[#202020] border border-white/15 overflow-hidden flex items-center justify-center">
                      {userData?.photoURL || user?.photoURL ? (
                        <img src={userData?.photoURL || user?.photoURL || ""} alt="You" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-cms-yellow/20 text-cms-yellow font-bold text-xs">
                          {(userData?.displayName || user?.displayName || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    {renderBadge(userData?.membership, "sm")}
                  </div>

                  <textarea
                    ref={commentInputRef}
                    rows={2}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={user ? `Add a comment as ${userData?.displayName || userData?.username || "Member"}...` : "Add a comment..."}
                    className="flex-1 bg-[#1c1c1f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-cms-yellow resize-none transition-colors"
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCommentInput(false);
                      setNewComment("");
                    }}
                    className="px-3.5 py-1.5 text-xs text-white/60 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newComment.trim() || submittingComment}
                    className="bg-cms-yellow disabled:opacity-40 text-black text-xs font-bold px-4 py-1.5 rounded-full active:scale-95 transition-all shadow-md shadow-cms-yellow/15"
                  >
                    {submittingComment ? "Posting..." : "Post"}
                  </button>
                </div>
              </form>
            )}

            {/* Comments list — shows all real-time comments with photo, badge, and delete */}
            <div className="flex flex-col gap-3">
              {comments.length === 0 ? (
                <p className="text-xs text-white/40 italic py-2">No comments yet. Be the first to comment!</p>
              ) : (
                comments.map((c) => {
                  const authorProfile = userProfiles[c.userId] || {};
                  const photo = c.authorPhoto || authorProfile.photoURL;
                  const membership = c.authorMembership || authorProfile.membership;
                  const isOwner = user && (c.userId === user.uid || canModerateCommunity(userData?.role, userData?.isAdmin));

                  return (
                    <div key={c.id} className="flex gap-3 items-start bg-white/5 p-3 rounded-2xl border border-white/5 group">
                      {/* Avatar with Membership Badge */}
                      <div className="relative shrink-0 mt-0.5">
                        <div className="w-8 h-8 rounded-full bg-[#181818] border border-white/15 overflow-hidden flex items-center justify-center">
                          {photo ? (
                            <img src={photo} alt={c.authorName || "User"} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-cms-yellow/20 text-cms-yellow font-bold text-xs">
                              {c.authorName ? c.authorName.charAt(0).toUpperCase() : "U"}
                            </div>
                          )}
                        </div>
                        {renderBadge(membership, "sm")}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white/90 truncate">
                            {c.authorName || authorProfile.displayName || "Member"}
                            {(c.username || authorProfile.username) && (
                              <span className="text-white/40 font-normal ml-1">@{c.username || authorProfile.username}</span>
                            )}
                          </span>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-white/40">{timeAgo(c.createdAt)}</span>
                            {/* Delete Button for Comment Owner */}
                            {isOwner && (
                              <button
                                onClick={() => handleDeleteComment(c.id)}
                                className="text-white/30 hover:text-red-400 p-0.5 transition-colors"
                                title="Delete comment"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-white/80 mt-1 leading-snug break-words">{c.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Up Next ── */}
          <div className="px-4 mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold">Up Next</h3>
              
              {/* Working Autoplay Toggle */}
              <div 
                className="flex items-center gap-2 cursor-pointer select-none"
                onClick={() => {
                  const nextVal = !isAutoplay;
                  setIsAutoplay(nextVal);
                  showToast(nextVal ? "Autoplay turned on" : "Autoplay turned off");
                }}
              >
                <span className="text-[12px] text-white/60">Autoplay</span>
                <div className={`w-9 h-5 rounded-full relative transition-colors duration-300 ${isAutoplay ? 'bg-cms-yellow/30' : 'bg-white/20'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform duration-300 ${isAutoplay ? 'bg-cms-yellow translate-x-4' : 'bg-white/60 translate-x-0.5'}`}></div>
                </div>
              </div>
            </div>

            {/* Dynamic Up Next List */}
            <div className="flex flex-col gap-3">
              {upNextVideos.map((item, i) => {
                const title = cleanTitle(item.title);
                return (
                  <div key={i} className="flex gap-3 items-center group">
                    <Link 
                      href={`/watch?v=${item.videoId}&t=${encodeURIComponent(title)}`}
                      className="flex gap-3 active:opacity-70 transition-opacity cursor-pointer flex-1"
                    >
                      <div className="relative w-32 aspect-video bg-[#1A1A1A] rounded-lg overflow-hidden shrink-0">
                        <Image src={`https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`} alt={title} fill className="object-cover" />
                        <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] font-medium px-1.5 py-0.5 rounded text-white/90">
                          {item.category || "video"}
                        </span>
                      </div>
                      <div className="flex flex-col justify-center flex-1 pr-2">
                        <h4 className="text-[13px] font-semibold leading-tight line-clamp-2">{title}</h4>
                        <p className="text-[11px] text-white/50 mt-1">Campus Movie Series</p>
                      </div>
                    </Link>

                    {/* Functional 3-dots button */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuVideo(item);
                      }}
                      className="text-white/40 hover:text-white p-2 shrink-0 active:scale-90 transition-transform"
                      aria-label="More options"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── 3-Dots Action Bottom Sheet / Menu ── */}
      {activeMenuVideo && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col justify-end animate-fade-in"
          onClick={() => setActiveMenuVideo(null)}
        >
          <div 
            className="bg-[#181818] border-t border-white/10 rounded-t-2xl p-5 flex flex-col gap-4 max-w-lg mx-auto w-full animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header info */}
            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <div className="relative w-14 aspect-video rounded-md overflow-hidden bg-black shrink-0">
                <Image src={`https://i.ytimg.com/vi/${activeMenuVideo.videoId}/hqdefault.jpg`} alt={cleanTitle(activeMenuVideo.title)} fill className="object-cover" />
              </div>
              <div className="flex-1 truncate">
                <h4 className="text-sm font-bold truncate">{cleanTitle(activeMenuVideo.title)}</h4>
                <p className="text-xs text-white/50 capitalize">{activeMenuVideo.category || "Video"}</p>
              </div>
              <button onClick={() => setActiveMenuVideo(null)} className="text-white/60 p-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Actions */}
            <button 
              onClick={() => {
                const target = activeMenuVideo;
                setActiveMenuVideo(null);
                router.push(`/watch?v=${target.videoId}&t=${encodeURIComponent(cleanTitle(target.title))}`);
              }}
              className="flex items-center gap-3 text-sm font-medium text-white/90 hover:text-cms-yellow py-1.5"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Play Video Now
            </button>

            <button 
              onClick={() => {
                const target = activeMenuVideo;
                const uid = user?.uid || "guest";
                setActiveMenuVideo(null);
                localStorage.setItem(`cms_saved_${uid}_${target.videoId}`, "true");
                showToast("Added to Watchlist!");
              }}
              className="flex items-center gap-3 text-sm font-medium text-white/90 hover:text-cms-yellow py-1.5"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
              Save to Watchlist
            </button>

            <button 
              onClick={async () => {
                const target = activeMenuVideo;
                setActiveMenuVideo(null);
                const url = `${window.location.origin}/watch?v=${target.videoId}&t=${encodeURIComponent(cleanTitle(target.title))}`;
                if (navigator.share) {
                  try {
                    await navigator.share({ title: cleanTitle(target.title), url });
                  } catch (e) {}
                } else {
                  navigator.clipboard.writeText(url);
                  showToast("Link copied to clipboard!");
                }
              }}
              className="flex items-center gap-3 text-sm font-medium text-white/90 hover:text-cms-yellow py-1.5"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              Share Video
            </button>

            <button 
              onClick={() => {
                setActiveMenuVideo(null);
                showToast("Downloads coming soon!");
              }}
              className="flex items-center gap-3 text-sm font-medium text-white/90 hover:text-cms-yellow py-1.5"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download Video
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col min-h-[100dvh] bg-black text-white pb-safe justify-center items-center">
        <div className="w-8 h-8 border-4 border-cms-yellow border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <WatchPageContent />
    </Suspense>
  );
}
