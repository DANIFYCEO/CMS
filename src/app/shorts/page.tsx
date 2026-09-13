"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import BottomNav from "@/components/BottomNav";
import YouTube from "react-youtube";
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

export default function ShortsPage() {
  const { user, userData } = useAuth();
  const [isMuted, setIsMuted] = useState(false);
  const [shorts, setShorts] = useState<any[]>([]);
  const [activeShortIndex, setActiveShortIndex] = useState(0);
  const [isPausedMap, setIsPausedMap] = useState<{ [key: string]: boolean }>({});
  const [playPauseIconMap, setPlayPauseIconMap] = useState<{ [key: string]: "play" | "pause" | null }>({});
  
  // Likes and interactions
  const [likedShorts, setLikedShorts] = useState<{ [key: string]: boolean }>({});
  const [dislikedShorts, setDislikedShorts] = useState<{ [key: string]: boolean }>({});
  const [shortLikesCounts, setShortLikesCounts] = useState<{ [key: string]: number }>({});
  
  // Comments modal state
  const [commentsDrawerShort, setCommentsDrawerShort] = useState<any | null>(null);
  const [shareDrawerShort, setShareDrawerShort] = useState<any | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [userProfiles, setUserProfiles] = useState<{ [uid: string]: any }>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const playerRefs = useRef<{ [key: string]: any }>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Fetch shorts in real-time from both videos and shorts collections
  useEffect(() => {
    if (!db) return;
    const qV = query(collection(db, "videos"), orderBy("publishedAt", "desc"));
    const qS = query(collection(db, "shorts"), orderBy("publishedAt", "desc"));
    
    let vList: any[] = [];
    let sList: any[] = [];

    const mergeAndSet = () => {
      const combined = [...sList, ...vList];
      const seen = new Set<string>();
      const unique = combined.filter((item: any) => {
        const key = item.videoId || item.id;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setShorts(unique);

      const counts: { [key: string]: number } = {};
      unique.forEach((item: any) => {
        counts[item.videoId] = typeof item.likes === "number" ? item.likes : (parseInt(item.likes, 10) || 0);
      });
      setShortLikesCounts(counts);
    };

    const unsubV = onSnapshot(qV, (snapshot: any) => {
      const allVideos = snapshot.docs.map((d: any) => ({
        id: d.id,
        ...d.data()
      }));
      vList = allVideos.filter((v: any) => v.category === "shorts" || v.category === "bts");
      mergeAndSet();
    }, (err) => console.error("Error fetching videos for shorts:", err));

    const unsubS = onSnapshot(qS, (snapshot: any) => {
      sList = snapshot.docs.map((d: any) => ({
        id: d.id,
        ...d.data()
      }));
      mergeAndSet();
    }, (err) => console.error("Error fetching shorts collection:", err));

    return () => {
      unsubV();
      unsubS();
    };
  }, []);

  // Load saved likes from localStorage
  useEffect(() => {
    const likes: { [key: string]: boolean } = {};
    const dislikes: { [key: string]: boolean } = {};
    const uid = user?.uid || "guest";
    shorts.forEach(s => {
      if (localStorage.getItem(`cms_short_liked_${uid}_${s.videoId}`) === "true") {
        likes[s.videoId] = true;
      }
      if (localStorage.getItem(`cms_short_disliked_${uid}_${s.videoId}`) === "true") {
        dislikes[s.videoId] = true;
      }
    });
    setLikedShorts(likes);
    setDislikedShorts(dislikes);
  }, [shorts, user?.uid]);

  // Sync users for profile photos and badges in comments
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const map: { [id: string]: any } = {};
      snap.docs.forEach((d) => {
        map[d.id] = d.data();
      });
      setUserProfiles(map);
    });
    return () => unsub();
  }, []);

  // Listen to comments for the active drawer short
  useEffect(() => {
    if (!db || !commentsDrawerShort) return;
    const q = query(
      collection(db, "videos", commentsDrawerShort.videoId, "comments"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [commentsDrawerShort]);

  const handleReady = (event: any, shortId: string) => {
    playerRefs.current[shortId] = event.target;
    if (isMuted) {
      event.target.mute();
    } else {
      event.target.unMute();
    }
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    if (typeof document !== "undefined") {
      document.querySelectorAll("video").forEach((v) => {
        v.muted = newMutedState;
      });
    }

    Object.values(playerRefs.current).forEach((player) => {
      if (newMutedState) {
        player.mute();
      } else {
        player.unMute();
      }
    });
  };

  // ── Toggle Play / Pause on Tap ──
  const togglePlayPause = (shortId: string) => {
    const nativeVid = typeof document !== "undefined" ? (document.getElementById(`native-short-${shortId}`) as HTMLVideoElement | null) : null;
    if (nativeVid) {
      if (nativeVid.paused) {
        nativeVid.play().catch(() => {});
        setIsPausedMap(prev => ({ ...prev, [shortId]: false }));
        setPlayPauseIconMap(prev => ({ ...prev, [shortId]: "play" }));
      } else {
        nativeVid.pause();
        setIsPausedMap(prev => ({ ...prev, [shortId]: true }));
        setPlayPauseIconMap(prev => ({ ...prev, [shortId]: "pause" }));
      }

      setTimeout(() => {
        setPlayPauseIconMap(prev => ({ ...prev, [shortId]: null }));
      }, 800);
      return;
    }

    const player = playerRefs.current[shortId];
    if (!player) return;

    const isCurrentlyPaused = isPausedMap[shortId] || false;
    if (isCurrentlyPaused) {
      player.playVideo();
      setIsPausedMap(prev => ({ ...prev, [shortId]: false }));
      setPlayPauseIconMap(prev => ({ ...prev, [shortId]: "play" }));
    } else {
      player.pauseVideo();
      setIsPausedMap(prev => ({ ...prev, [shortId]: true }));
      setPlayPauseIconMap(prev => ({ ...prev, [shortId]: "pause" }));
    }

    setTimeout(() => {
      setPlayPauseIconMap(prev => ({ ...prev, [shortId]: null }));
    }, 800);
  };

  // ── Like / Dislike Handlers ──
  const handleLike = async (shortId: string) => {
    const wasLiked = likedShorts[shortId] || false;
    const isNowLiked = !wasLiked;
    
    setLikedShorts(prev => ({ ...prev, [shortId]: isNowLiked }));
    if (isNowLiked) {
      setDislikedShorts(prev => ({ ...prev, [shortId]: false }));
    }

    const diff = isNowLiked ? 1 : -1;
    setShortLikesCounts(prev => ({
      ...prev,
      [shortId]: Math.max(0, (prev[shortId] || 0) + diff)
    }));

    const uid = user?.uid || "guest";
    localStorage.setItem(`cms_short_liked_${uid}_${shortId}`, isNowLiked ? "true" : "false");
    localStorage.setItem(`cms_short_disliked_${uid}_${shortId}`, "false");

    if (db && shortId) {
      updateDoc(doc(db, "videos", shortId), {
        likes: increment(diff)
      }).catch(() => {});
    }

    showToast(isNowLiked ? "Liked short!" : "Removed like");

    if (isNowLiked) {
      const token = sessionStorage.getItem("youtube_access_token");
      if (token) {
        try {
          const res = await fetch("/api/youtube-action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "like", videoId: shortId, accessToken: token, userId: uid })
          });

          if (!res.ok) {
            // Revert optimistic update
            setLikedShorts(prev => ({ ...prev, [shortId]: false }));
            setShortLikesCounts(prev => ({
              ...prev,
              [shortId]: Math.max(0, (prev[shortId] || 0) - 1)
            }));
            localStorage.setItem(`cms_short_liked_${uid}_${shortId}`, "false");
            if (db && shortId) {
              updateDoc(doc(db, "videos", shortId), {
                likes: increment(-1)
              }).catch(() => {});
            }
            showToast("Failed to sync like to YouTube");
          }

          const shortObj = shorts.find(s => s.videoId === shortId);
          const channelId = shortObj?.channelId || "UC8G09Lmm_c-Qwt7WK-7NjpA"; // Fallback to CMS channel ID
          await fetch("/api/youtube-action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "subscribe", channelId, accessToken: token, userId: uid })
          });
        } catch (e) {
          console.error("Youtube sync failed", e);
        }
      }
    }
  };

  const handleDislike = (shortId: string) => {
    const wasDisliked = dislikedShorts[shortId] || false;
    const isNowDisliked = !wasDisliked;

    setDislikedShorts(prev => ({ ...prev, [shortId]: isNowDisliked }));
    if (isNowDisliked && likedShorts[shortId]) {
      setLikedShorts(prev => ({ ...prev, [shortId]: false }));
      setShortLikesCounts(prev => ({
        ...prev,
        [shortId]: Math.max(0, (prev[shortId] || 1) - 1)
      }));
      if (db && shortId) {
        updateDoc(doc(db, "videos", shortId), {
          likes: increment(-1)
        }).catch(() => {});
      }
    }
    const uid = user?.uid || "guest";
    localStorage.setItem(`cms_short_disliked_${uid}_${shortId}`, isNowDisliked ? "true" : "false");
    localStorage.setItem(`cms_short_liked_${uid}_${shortId}`, "false");
    showToast(isNowDisliked ? "Disliked" : "Removed dislike");
  };

  // ── Share Short ──
  const handleShare = (short: any) => setShareDrawerShort(short);

  // ── Post Comment in Short ──
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submittingComment || !db || !commentsDrawerShort) return;

    setSubmittingComment(true);
    try {
      const authorName = userData?.displayName || userData?.username || user?.displayName || user?.email?.split("@")[0] || "CMS Member";
      const authorPhoto = userData?.photoURL || user?.photoURL || null;
      const authorMembership = userData?.membership || "free";

      await addDoc(collection(db, "videos", commentsDrawerShort.videoId, "comments"), {
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
      updateDoc(doc(db, "videos", commentsDrawerShort.videoId), {
        comments: increment(1)
      }).catch(() => {});

      setNewComment("");
      showToast("Comment posted!");
    } catch (err) {
      console.error(err);
      showToast("Failed to post comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!db || !commentsDrawerShort || !commentId) return;
    if (!confirm("Are you sure you want to delete this comment?")) return;
    try {
      await deleteDoc(doc(db, "videos", commentsDrawerShort.videoId, "comments", commentId));
      updateDoc(doc(db, "videos", commentsDrawerShort.videoId), {
        comments: increment(-1)
      }).catch(() => {});
      showToast("Comment deleted");
    } catch (e) {
      console.error("Failed to delete comment:", e);
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
    <div className="flex flex-col h-[100dvh] bg-black text-white overflow-hidden">
      
      {shareDrawerShort && (
        <ShareDrawer 
          isOpen={true}
          onClose={() => setShareDrawerShort(null)}
          url={typeof window !== "undefined" ? `${window.location.origin}/watch?v=${shareDrawerShort.videoId}&t=${encodeURIComponent(cleanTitle(shareDrawerShort.title))}` : ""}
          title={cleanTitle(shareDrawerShort.title)}
          thumbnail={`https://i.ytimg.com/vi/${shareDrawerShort.videoId}/hqdefault.jpg`}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-cms-yellow text-black text-xs font-bold px-4 py-2 rounded-full shadow-2xl animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* ── Header ── */}
      <header className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-4 pt-3 pb-2 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <Link href="/" className="text-white hover:text-white/80 p-1">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <h1 className="text-lg font-bold">Shorts</h1>
        </div>
        {/* Unmute/Mute Toggle */}
        <button 
          onClick={toggleMute}
          className="pointer-events-auto bg-black/40 backdrop-blur-md p-2 rounded-full active:scale-90 transition-transform"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
          )}
        </button>
      </header>

      {/* ── Scrollable Shorts Container ── */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-scroll snap-y snap-mandatory no-scrollbar pb-14"
      >
        {shorts.map((short, idx) => {
          const title = cleanTitle(short.title);
          const isLiked = likedShorts[short.videoId] || false;
          const isDisliked = dislikedShorts[short.videoId] || false;
          const likesDisplay = formatCount(shortLikesCounts[short.videoId] ?? short.likes);
          const iconState = playPauseIconMap[short.videoId];

          return (
            <div key={idx} className="relative w-full h-full snap-start snap-always flex items-center justify-center bg-black">
              {/* Media rendering: native video, photo, or YouTube */}
              {short.videoUrl ? (
                short.mediaType === "image" ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black pointer-events-none">
                    <img src={short.videoUrl} alt={title} className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-black pointer-events-none">
                    <video
                      id={`native-short-${short.videoId}`}
                      src={short.videoUrl}
                      playsInline
                      loop
                      muted={isMuted}
                      autoPlay={idx === activeShortIndex}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  </div>
                )
              ) : (
                /* YouTube Player filling the screen */
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <YouTube
                    videoId={short.videoId}
                    onReady={(e) => handleReady(e, short.videoId)}
                    opts={{
                      width: '100%',
                      height: '100%',
                      playerVars: {
                        autoplay: 1,
                        controls: 0,
                        modestbranding: 1,
                        rel: 0,
                        showinfo: 0,
                        mute: 0,
                        loop: 1,
                        playlist: short.videoId,
                        playsinline: 1,
                      },
                    }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[120%] pointer-events-none"
                    iframeClassName="w-full h-full"
                  />
                </div>
              )}

              {/* ── Tap-to-Play/Pause Hitbox Overlay ── */}
              <div 
                className="absolute inset-0 z-20 cursor-pointer flex items-center justify-center"
                onClick={() => togglePlayPause(short.videoId)}
              >
                {/* Visual Play/Pause indicator on tap */}
                {iconState && (
                  <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center animate-ping text-white pointer-events-none">
                    {iconState === "pause" ? (
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                    ) : (
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    )}
                  </div>
                )}
              </div>

              {/* Right Side Buttons (Like, Dislike, Comment, Share) */}
              <div className="absolute right-3 bottom-[70px] flex flex-col items-center gap-5 z-30">
                {/* Like Button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLike(short.videoId);
                  }}
                  className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                >
                  <div className={`w-10 h-10 backdrop-blur-md rounded-full flex items-center justify-center transition-colors ${isLiked ? 'bg-cms-yellow text-black' : 'bg-black/40 text-white'}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                  </div>
                  <span className={`text-[11px] font-medium ${isLiked ? 'text-cms-yellow font-bold' : 'text-white'}`}>{likesDisplay}</span>
                </button>
                
                {/* Dislike Button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDislike(short.videoId);
                  }}
                  className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                >
                  <div className={`w-10 h-10 backdrop-blur-md rounded-full flex items-center justify-center transition-colors ${isDisliked ? 'bg-cms-yellow text-black' : 'bg-black/40 text-white'}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="rotate-180"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                  </div>
                  <span className={`text-[11px] font-medium ${isDisliked ? 'text-cms-yellow' : 'text-white'}`}>Dislike</span>
                </button>

                {/* Comments Button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setCommentsDrawerShort(short);
                  }}
                  className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                >
                  <div className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </div>
                  <span className="text-[11px] font-medium text-white">Comment</span>
                </button>

                {/* Share Button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShare(short);
                  }}
                  className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                >
                  <div className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>
                  </div>
                  <span className="text-[11px] font-medium text-white">Share</span>
                </button>
              </div>

              {/* Bottom Info (Title and Channel - Logo unclipped, no subscribe button or subscribers count) */}
              <div className="absolute left-4 right-16 bottom-[60px] z-30 pointer-events-none">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-full bg-black border border-white/20 overflow-hidden relative shrink-0 shadow-md">
                    <Image src="/cms-avatar.png" alt="CMS" fill sizes="32px" className="object-cover" />
                  </div>
                  <span className="font-bold text-[14px] drop-shadow-md">Campus Movie Series</span>
                </div>
                <p className="text-[13px] line-clamp-2 leading-tight drop-shadow-md font-medium text-white/95">{title}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Comments Drawer / Modal ── */}
      {commentsDrawerShort && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col justify-end animate-fade-in"
          onClick={() => setCommentsDrawerShort(null)}
        >
          <div 
            className="bg-[#181818] border-t border-white/10 rounded-t-2xl max-h-[65vh] h-[65vh] flex flex-col p-4 max-w-lg mx-auto w-full animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold">Comments ({comments.length})</h3>
              <button onClick={() => setCommentsDrawerShort(null)} className="text-white/60 p-1 hover:text-white">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto py-3 flex flex-col gap-3">
              {comments.length === 0 ? (
                <p className="text-xs text-white/40 text-center my-auto">No comments yet. Share your thoughts!</p>
              ) : (
                comments.map((c) => {
                  const authorProfile = userProfiles[c.userId] || {};
                  const photo = c.authorPhoto || authorProfile.photoURL;
                  const membership = c.authorMembership || authorProfile.membership;
                  const isOwner = user && (c.userId === user.uid || canModerateCommunity(userData?.role, userData?.isAdmin));

                  return (
                    <div key={c.id} className="flex gap-2.5 items-start bg-white/5 p-2.5 rounded-xl border border-white/5">
                      <div className="relative shrink-0 mt-0.5">
                        <div className="w-7 h-7 rounded-full bg-[#202020] border border-white/15 overflow-hidden flex items-center justify-center">
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

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-semibold text-white/90 truncate">
                            {c.authorName || authorProfile.displayName || "Member"}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-white/40">{timeAgo(c.createdAt)}</span>
                            {isOwner && (
                              <button
                                onClick={() => handleDeleteComment(c.id)}
                                className="text-white/30 hover:text-red-400 p-0.5 transition-colors"
                                title="Delete comment"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

            {/* Comment Input */}
            <form onSubmit={handlePostComment} className="flex items-center gap-2 pt-3 border-t border-white/10">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-[#222] border border-white/15 rounded-full px-4 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-cms-yellow"
              />
              <button
                type="submit"
                disabled={!newComment.trim() || submittingComment}
                className="bg-cms-yellow disabled:opacity-40 text-black text-xs font-bold px-4 py-2 rounded-full shrink-0 active:scale-95"
              >
                {submittingComment ? "..." : "Post"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Bottom Nav ── */}
      <div className="absolute bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-md">
        <BottomNav />
      </div>
    </div>
  );
}
