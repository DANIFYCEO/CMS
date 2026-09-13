"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  doc, 
  deleteDoc 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { canModerateCommunity, normalizeAdminRole } from "@/lib/adminRoles";
import { cleanTitle } from "@/lib/videoUtils";

export default function AdminMetricsPage() {
  const { user, userData } = useAuth();
  const [videos, setVideos] = useState<any[]>([]);
  const [shorts, setShorts] = useState<any[]>([]);
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [recentComments, setRecentComments] = useState<any[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const currentRole = normalizeAdminRole(userData?.role, userData?.isAdmin);
  const canModerate = canModerateCommunity(userData?.role, userData?.isAdmin);

  useEffect(() => {
    if (!db) return;

    // 1. Members count
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      setTotalMembers(snap.size);
    });

    // 2. Pre-existing & Synced Videos (Movies, Trailers, BTS, Shows)
    const qVideos = query(collection(db, "videos"), orderBy("publishedAt", "desc"));
    const unsubVideos = onSnapshot(qVideos, (snap) => {
      setVideos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Videos query error:", err);
      setLoading(false);
    });

    // 3. Shorts & Media Feed
    const qShorts = query(collection(db, "shorts"), orderBy("createdAt", "desc"));
    const unsubShorts = onSnapshot(qShorts, (snap) => {
      setShorts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Shorts query error:", err);
    });

    // 4. Community Posts (with likes and comments)
    const qPosts = query(collection(db, "community_posts"), orderBy("createdAt", "desc"), limit(20));
    const unsubPosts = onSnapshot(qPosts, (snap) => {
      setRecentPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Community posts query error:", err);
    });

    // 5. Recent General Chat messages
    const qChat = query(collection(db, "general_chat"), orderBy("createdAt", "desc"), limit(20));
    const unsubChat = onSnapshot(qChat, (snap) => {
      setRecentComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("General chat query error:", err);
    });

    return () => {
      unsubUsers();
      unsubVideos();
      unsubShorts();
      unsubPosts();
      unsubChat();
    };
  }, []);

  // Deduplicate and combine all videos and shorts
  const allMedia = useMemo(() => {
    const combined = [...videos, ...shorts];
    const seen = new Set<string>();
    return combined.filter((m: any) => {
      const key = m.videoId || m.id;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [videos, shorts]);

  // Aggregate Total Views across videos and shorts
  const totalViews = useMemo(() => {
    return allMedia.reduce((sum, m) => sum + (Number(m.views) || 0), 0);
  }, [allMedia]);

  // Aggregate Total Likes (Videos + Shorts + Community Posts)
  const totalLikes = useMemo(() => {
    const mediaLikes = allMedia.reduce((sum, m) => sum + (Number(m.likes) || 0), 0);
    const postLikes = recentPosts.reduce((sum, p) => {
      if (Array.isArray(p.likes)) return sum + p.likes.length;
      return sum + (Number(p.likes) || 0);
    }, 0);
    return mediaLikes + postLikes;
  }, [allMedia, recentPosts]);

  // Aggregate Total Comments (Videos comments + Shorts comments + Community Post comments)
  const totalCommentsCount = useMemo(() => {
    const mediaComments = allMedia.reduce((sum, m) => sum + (Number(m.comments) || 0), 0);
    const postComments = recentPosts.reduce((sum, p) => {
      if (Array.isArray(p.comments)) return sum + p.comments.length;
      return sum + (Number(p.comments) || 0);
    }, 0);
    return mediaComments + postComments;
  }, [allMedia, recentPosts]);

  // Filter media for the directory view
  const filteredMedia = useMemo(() => {
    if (selectedCategory === "all") return allMedia;
    return allMedia.filter((m: any) => (m.category || "movies").toLowerCase() === selectedCategory.toLowerCase());
  }, [allMedia, selectedCategory]);

  const handleDeletePost = async (postId: string) => {
    if (!canModerate) {
      alert("You do not have permission to delete community posts.");
      return;
    }
    if (!confirm("Are you sure you want to delete this community post?")) return;

    try {
      await deleteDoc(doc(db, "community_posts", postId));
    } catch (err) {
      console.error("Error deleting post:", err);
      alert("Failed to delete post.");
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!canModerate) {
      alert("You do not have permission to delete community messages.");
      return;
    }
    if (!confirm("Are you sure you want to delete this message?")) return;

    try {
      await deleteDoc(doc(db, "general_chat", msgId));
    } catch (err) {
      console.error("Error deleting message:", err);
      alert("Failed to delete message.");
    }
  };

  return (
    <div className="p-4 max-w-5xl mx-auto pb-20">
      {/* ── Header ── */}
      <div className="mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <span>Platform Metrics & Analytics</span>
          <span className="text-xs bg-cms-yellow/10 text-cms-yellow border border-cms-yellow/30 px-2 py-0.5 rounded-full font-bold">
            Live Stream
          </span>
        </h2>
        <p className="text-xs text-white/60 mt-0.5">
          Real-time aggregated engagement across movies, trailers, shorts, and community discussions.
        </p>
      </div>

      {/* ── KPI Metrics Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div className="bg-[#121214] border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-white/40 mb-2">
            <span className="text-[11px] uppercase font-bold tracking-wider">Total Views</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cms-yellow"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <h3 className="text-2xl font-black text-white">{totalViews.toLocaleString()}</h3>
          <p className="text-[10px] text-white/40 mt-1">Movies, trailers & shorts</p>
        </div>

        <div className="bg-[#121214] border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-white/40 mb-2">
            <span className="text-[11px] uppercase font-bold tracking-wider">Total Likes</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-rose-400"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </div>
          <h3 className="text-2xl font-black text-white">{totalLikes.toLocaleString()}</h3>
          <p className="text-[10px] text-white/40 mt-1">Videos & community posts</p>
        </div>

        <div className="bg-[#121214] border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-white/40 mb-2">
            <span className="text-[11px] uppercase font-bold tracking-wider">Total Comments</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
          </div>
          <h3 className="text-2xl font-black text-white">{totalCommentsCount.toLocaleString()}</h3>
          <p className="text-[10px] text-white/40 mt-1">Video & post discussions</p>
        </div>

        <div className="bg-[#121214] border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-white/40 mb-2">
            <span className="text-[11px] uppercase font-bold tracking-wider">Total Members</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
          <h3 className="text-2xl font-black text-white">{totalMembers.toLocaleString()}</h3>
          <p className="text-[10px] text-white/40 mt-1">Registered creatives</p>
        </div>
      </div>

      {/* ── Individual Media Performance Section ── */}
      <div className="bg-[#121214] border border-white/10 rounded-2xl p-5 mb-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cms-yellow"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              <span>Media Library Engagement</span>
            </h3>
            <p className="text-xs text-white/50 mt-0.5">Pre-existing and new video metrics (views, likes, comments).</p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-[#1A1A1A] p-1 rounded-xl border border-white/10 shrink-0">
            {[
              { id: "all", label: `All (${allMedia.length})` },
              { id: "movies", label: "Movies" },
              { id: "trailers", label: "Trailers" },
              { id: "shorts", label: "Shorts" },
              { id: "bts", label: "BTS" },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  selectedCategory === tab.id 
                    ? "bg-cms-yellow text-black shadow-sm" 
                    : "text-white/60 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="w-8 h-8 border-3 border-cms-yellow border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredMedia.length === 0 ? (
          <p className="text-xs text-white/40 py-8 text-center">No media found in this category.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto no-scrollbar">
            {filteredMedia.map((item) => {
              const title = cleanTitle(item.title || "CMS Video");
              const thumbUrl = item.thumbnailUrl || (item.videoId ? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` : "");
              const watchLink = item.category === "shorts" ? "/shorts" : `/watch?v=${item.videoId}&t=${encodeURIComponent(title)}`;
              const viewsCount = Number(item.views) || 0;
              const likesCount = Number(item.likes) || 0;
              const commentsCount = Number(item.comments) || 0;

              return (
                <div 
                  key={item.id || item.videoId} 
                  className="bg-black/50 border border-white/5 hover:border-white/15 rounded-xl p-3 flex gap-3 items-center transition-colors group"
                >
                  <div className="w-20 h-14 rounded-lg bg-black border border-white/10 overflow-hidden shrink-0 relative flex items-center justify-center">
                    {thumbUrl ? (
                      <img src={thumbUrl} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : item.videoUrl ? (
                      <video src={item.videoUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-white/30 text-xs font-bold">CMS</div>
                    )}
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                        {item.category || "Video"}
                      </span>
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-cms-yellow transition-colors">
                        {title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-bold text-white/60 mt-1.5">
                      <span className="flex items-center gap-1 text-cms-yellow">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        {viewsCount}
                      </span>
                      <span className="flex items-center gap-1 text-rose-400">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        {likesCount}
                      </span>
                      <span className="flex items-center gap-1 text-blue-400">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                        {commentsCount}
                      </span>
                    </div>
                  </div>

                  <Link 
                    href={watchLink}
                    target="_blank"
                    className="text-white/30 hover:text-cms-yellow p-2 transition-colors shrink-0 rounded-lg hover:bg-white/5"
                    title="Watch / View"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Community Posts & Messages Moderation Stream ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Recent Community Posts with Moderation */}
        <div className="bg-[#121214] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cms-yellow"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>Recent Community Posts</span>
            </h3>
            <span className="text-[10px] text-white/40 font-mono">{recentPosts.length} posts</span>
          </div>

          {recentPosts.length === 0 ? (
            <p className="text-xs text-white/40 py-6 text-center">No community posts yet.</p>
          ) : (
            <div className="space-y-3 max-h-[450px] overflow-y-auto no-scrollbar">
              {recentPosts.map((p) => {
                const postLikes = Array.isArray(p.likes) ? p.likes.length : (Number(p.likes) || 0);
                const postComments = Array.isArray(p.comments) ? p.comments.length : (Number(p.comments) || 0);

                return (
                  <div key={p.id} className="bg-black/40 border border-white/5 rounded-xl p-3 flex flex-col justify-between gap-2 group hover:border-white/15 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white truncate">{p.senderName || "Member"}</span>
                          {p.department && (
                            <span className="text-[9px] bg-white/10 text-white/70 px-2 py-0.5 rounded-md uppercase font-bold">
                              {p.department}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/75 mt-1 leading-snug line-clamp-2">{p.text}</p>
                      </div>

                      {canModerate && (
                        <button
                          onClick={() => handleDeletePost(p.id)}
                          className="text-white/30 hover:text-rose-400 p-1.5 transition-colors shrink-0 rounded-lg hover:bg-rose-500/10"
                          title="Delete post as admin"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-white/40 pt-1 border-t border-white/5">
                      <span>❤️ {postLikes} likes • 💬 {postComments} comments</span>
                      <span>{p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString() : "Recent"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: General Chat Messages with Moderation */}
        <div className="bg-[#121214] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cms-yellow"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
              <span>Recent Community Messages</span>
            </h3>
            <span className="text-[10px] text-white/40 font-mono">{recentComments.length} messages</span>
          </div>

          {recentComments.length === 0 ? (
            <p className="text-xs text-white/40 py-6 text-center">No community messages yet.</p>
          ) : (
            <div className="space-y-3 max-h-[450px] overflow-y-auto no-scrollbar">
              {recentComments.map((msg) => (
                <div key={msg.id} className="bg-black/40 border border-white/5 rounded-xl p-3 flex items-start justify-between gap-3 group hover:border-white/15 transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white truncate">{msg.senderName || "User"}</span>
                      {msg.senderTier && msg.senderTier !== "free" && (
                        <span className="text-[9px] bg-cms-yellow/10 text-cms-yellow border border-cms-yellow/20 px-1.5 py-0.5 rounded font-bold uppercase">
                          {msg.senderTier}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/70 mt-1 leading-snug break-words">{msg.text}</p>
                    <span className="text-[9px] text-white/30 mt-1 block">
                      {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Recent"}
                    </span>
                  </div>

                  {canModerate && (
                    <button
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="text-white/30 hover:text-rose-400 p-1.5 transition-colors shrink-0 rounded-lg hover:bg-rose-500/10"
                      title="Delete message as admin"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
