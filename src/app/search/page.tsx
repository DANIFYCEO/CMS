"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { cleanTitle, formatCount, timeAgo } from "@/lib/videoUtils";

export default function SearchPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"videos" | "users">("videos");
  
  const [allVideos, setAllVideos] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cms_recent_searches");
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      } else {
        setRecentSearches(["Campus Movie Series", "Shorts", "Trailer"]);
      }
    } catch (e) {
      setRecentSearches(["Campus Movie Series", "Shorts", "Trailer"]);
    }
  }, []);

  // Real-time listener for videos and users
  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    const unsubVideos = onSnapshot(
      collection(db, "videos"),
      (snapshot) => {
        const vids = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAllVideos(vids);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching videos:", err);
        setLoading(false);
      }
    );

    const unsubUsers = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const users = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAllUsers(users);
      },
      (err) => {
        console.error("Error fetching users:", err);
      }
    );

    return () => {
      unsubVideos();
      unsubUsers();
    };
  }, []);

  const saveSearchTerm = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const updated = [trimmed, ...prev.filter((t) => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
      try {
        localStorage.setItem("cms_recent_searches", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const removeRecentSearch = (e: React.MouseEvent, termToRemove: string) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((t) => t !== termToRemove);
      try {
        localStorage.setItem("cms_recent_searches", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const clearAllRecent = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem("cms_recent_searches");
    } catch (e) {}
  };

  const handleSelectSearch = (term: string) => {
    setQuery(term);
    saveSearchTerm(term);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      saveSearchTerm(query.trim());
      inputRef.current?.blur();
    }
  };

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/videos");
    }
  };

  // Robust tokenized search
  const searchWords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);

  const filteredVideos = searchWords.length === 0 ? [] : allVideos.filter((v) => {
    const rawTitle = (v.title || "").toLowerCase();
    const cleaned = cleanTitle(v.title).toLowerCase();
    const desc = (v.description || "").toLowerCase();
    const cat = (v.category || "").toLowerCase();
    const tags = Array.isArray(v.tags) ? v.tags.join(" ").toLowerCase() : (v.tags || "").toLowerCase();
    const combined = `${rawTitle} ${cleaned} ${desc} ${cat} ${tags}`;
    return searchWords.every((word) => combined.includes(word));
  });

  const filteredUsers = searchWords.length === 0 ? [] : allUsers.filter((u) => {
    const un = (u.username || "").toLowerCase();
    const dn = (u.displayName || "").toLowerCase();
    const id = (u.cmsId || "").toLowerCase();
    const bio = (u.bio || "").toLowerCase();
    const email = (u.email || "").toLowerCase();
    const combined = `${un} ${dn} ${id} ${bio} ${email}`;
    return searchWords.every((word) => combined.includes(word));
  });

  const popularSearches = ["Campus Movie Series", "Shorts", "Behind the Scenes", "Audition", "Trailer"];

  return (
    <div className="flex flex-col min-h-[100dvh] bg-black text-white pb-safe overflow-x-hidden">
      {/* Header with Search Input & Navigation */}
      <header className="flex flex-col gap-3 px-4 pt-4 pb-2 border-b border-white/10 sticky top-0 bg-black/95 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={handleBack} 
            className="p-2 -ml-1 text-white/80 hover:text-white active:scale-95 transition-colors rounded-full hover:bg-white/10"
            title="Go back"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>

          <form onSubmit={handleSubmit} className="flex-1 relative">
            <svg 
              width="18" 
              height="18" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
            >
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>

            <input 
              ref={inputRef}
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search videos, genres, or people..."
              autoFocus
              className="w-full bg-[#181818] border border-white/15 rounded-full pl-10 pr-10 py-2.5 text-sm text-white outline-none focus:border-cms-yellow focus:bg-[#202020] transition-colors placeholder:text-white/40"
            />

            {query && (
              <button 
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-1 rounded-full"
                title="Clear search"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            )}
          </form>
        </div>
        
        {/* Category Tabs with dynamic match counters */}
        <div className="flex gap-6 px-1 pt-1">
          <button 
            type="button"
            onClick={() => setTab("videos")} 
            className={`pb-2.5 text-sm font-semibold transition-colors border-b-2 flex items-center gap-1.5 ${
              tab === "videos" 
                ? "border-cms-yellow text-cms-yellow" 
                : "border-transparent text-white/55 hover:text-white"
            }`}
          >
            <span>Videos</span>
            {query.trim() && (
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                tab === "videos" ? "bg-cms-yellow/20 text-cms-yellow" : "bg-white/10 text-white/50"
              }`}>
                {filteredVideos.length}
              </span>
            )}
          </button>

          <button 
            type="button"
            onClick={() => setTab("users")} 
            className={`pb-2.5 text-sm font-semibold transition-colors border-b-2 flex items-center gap-1.5 ${
              tab === "users" 
                ? "border-cms-yellow text-cms-yellow" 
                : "border-transparent text-white/55 hover:text-white"
            }`}
          >
            <span>People</span>
            {query.trim() && (
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                tab === "users" ? "bg-cms-yellow/20 text-cms-yellow" : "bg-white/10 text-white/50"
              }`}>
                {filteredUsers.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="px-4 py-5 flex-1">
        {loading ? (
          <div className="flex flex-col gap-4 py-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="flex gap-3 animate-pulse">
                <div className="w-32 aspect-video bg-[#181818] rounded-xl shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-[#202020] rounded w-5/6" />
                  <div className="h-3 bg-[#181818] rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : !query.trim() ? (
          /* Search Suggestions & History */
          <div className="flex flex-col gap-6">
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[12px] font-bold text-white/50 uppercase tracking-wider">
                    Recent Searches
                  </h3>
                  <button 
                    onClick={clearAllRecent}
                    className="text-[11px] text-white/40 hover:text-cms-yellow font-medium transition-colors"
                  >
                    Clear All
                  </button>
                </div>
                <div className="flex flex-col divide-y divide-white/5">
                  {recentSearches.map((term, i) => (
                    <div 
                      key={i} 
                      className="flex items-center justify-between py-3 cursor-pointer group hover:bg-white/5 px-2 -mx-2 rounded-xl transition-colors"
                      onClick={() => handleSelectSearch(term)}
                    >
                      <div className="flex items-center gap-3 text-sm text-white/80 group-hover:text-white">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40 group-hover:text-cms-yellow transition-colors"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span>{term}</span>
                      </div>
                      <button 
                        onClick={(e) => removeRecentSearch(e, term)}
                        className="text-white/30 hover:text-white p-1 transition-colors"
                        title="Remove search"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Popular Searches */}
            <div>
              <h3 className="text-[12px] font-bold text-white/50 uppercase tracking-wider mb-3">
                Popular on CMS
              </h3>
              <div className="flex flex-wrap gap-2">
                {popularSearches.map((term, i) => (
                  <button 
                    key={i} 
                    onClick={() => handleSelectSearch(term)} 
                    className="bg-[#181818] border border-white/10 rounded-full px-3.5 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-cms-yellow hover:border-cms-yellow/40 active:scale-95 transition-all"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Live Search Results */
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-bold text-white/60 uppercase tracking-wider">
                Results for "{query}"
              </h3>
              <span className="text-xs text-white/40">
                {tab === "videos" ? `${filteredVideos.length} found` : `${filteredUsers.length} found`}
              </span>
            </div>
            
            {/* Videos Tab */}
            {tab === "videos" && (
              <div className="flex flex-col gap-3.5">
                {filteredVideos.length === 0 ? (
                  <div className="py-16 text-center text-white/45">
                    <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-50"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    </div>
                    <p className="text-sm font-semibold text-white/80">No videos found</p>
                    <p className="text-xs text-white/40 mt-1">Try checking your spelling or search for broader keywords like "shorts" or "drama".</p>
                  </div>
                ) : (
                  filteredVideos.map((item) => {
                    const displayTitle = cleanTitle(item.title);
                    const targetUrl = item.category === "shorts" 
                      ? "/shorts" 
                      : `/watch?v=${item.videoId}&t=${encodeURIComponent(displayTitle)}`;

                    return (
                      <Link 
                        key={item.id || item.videoId} 
                        href={targetUrl}
                        onClick={() => saveSearchTerm(query)}
                        className="flex gap-3.5 p-2 -mx-2 rounded-2xl hover:bg-white/5 active:bg-white/10 transition-colors group"
                      >
                        {/* 16:9 Thumbnail with Duration */}
                        <div className="relative w-36 aspect-video bg-[#141414] rounded-xl overflow-hidden shrink-0 border border-white/10">
                          <Image 
                            src={`https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`} 
                            alt={displayTitle} 
                            fill 
                            sizes="144px"
                            className="object-cover group-hover:scale-105 transition-transform duration-300" 
                          />
                          <div className="absolute bottom-1.5 right-1.5 bg-black/85 text-white text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">
                            {item.duration || "HD"}
                          </div>
                        </div>

                        {/* Video Metadata */}
                        <div className="flex flex-col justify-center flex-1 min-w-0 pr-1">
                          <h4 className="text-[13px] sm:text-sm font-semibold text-white line-clamp-2 leading-snug group-hover:text-cms-yellow transition-colors">
                            {displayTitle}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[11px] text-white/50 mt-1.5 flex-wrap leading-none">
                            <span className="capitalize font-medium text-cms-yellow/90">
                              {item.category || "Video"}
                            </span>
                            <span>•</span>
                            <span>{item.views ? `${formatCount(item.views)} views` : "CMS Official"}</span>
                            <span>•</span>
                            <span>{timeAgo(item.publishedAt)}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            )}

            {/* People Tab */}
            {tab === "users" && (
              <div className="flex flex-col gap-3">
                {filteredUsers.length === 0 ? (
                  <div className="py-16 text-center text-white/45">
                    <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-50"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <p className="text-sm font-semibold text-white/80">No people found</p>
                    <p className="text-xs text-white/40 mt-1">Try searching by full name, @username, or CMS ID.</p>
                  </div>
                ) : (
                  filteredUsers.map((u) => (
                    <div 
                      key={u.id} 
                      className="flex items-center justify-between gap-3 bg-[#121214] p-3 rounded-2xl border border-white/5 hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {/* User Avatar */}
                        <div className="w-11 h-11 rounded-full bg-[#202020] border border-white/15 relative shrink-0 overflow-hidden flex items-center justify-center">
                          {u.photoURL ? (
                            <img src={u.photoURL} alt={u.displayName || "User"} className="w-full h-full object-cover" />
                          ) : (
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          )}
                        </div>

                        {/* User Names and Badges */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-white truncate">{u.displayName || "CMS Member"}</p>
                            {u.cmsId && (
                              <span className="text-[10px] bg-cms-yellow/15 text-cms-yellow font-bold px-1.5 py-0.5 rounded border border-cms-yellow/30 shrink-0">
                                #{u.cmsId}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-white/45 truncate mt-0.5">
                            {u.username ? `@${u.username}` : u.email ? u.email : "Member"}
                          </p>
                        </div>
                      </div>

                      {/* Message Action Button */}
                      <Link
                        href={`/chat/${u.id}`}
                        onClick={() => saveSearchTerm(query)}
                        className="bg-white/10 hover:bg-cms-yellow hover:text-black text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-all active:scale-95 shrink-0 flex items-center gap-1.5"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        Message
                      </Link>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
