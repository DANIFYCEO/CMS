"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import Registration from "./Registration";
import Login from "./Login";
import SetupUsername from "./SetupUsername";
import BottomNav from "@/components/BottomNav";
import CMSLogo from "@/components/CMSLogo";
import { useAuth } from "@/context/AuthContext";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

import { cleanTitle } from "@/lib/videoUtils";

export default function Home() {
  const { user, userData, loading } = useAuth();
  
  const [mounted, setMounted] = useState(false);
  const [viewState, setViewState] = useState<"SPLASH" | "REGISTER" | "LOGIN" | "SETUP_USERNAME" | "HOME">("SPLASH");
  const [heroIndex, setHeroIndex] = useState(0);
  const [splashFinished, setSplashFinished] = useState(false);
  
  const [allVideos, setAllVideos] = useState<any[]>([]);
  const [galleryPhotos, setGalleryPhotos] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);

  // Fetch videos in real-time
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "videos"), orderBy("publishedAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const list = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      setAllVideos(list);
    }, (err) => {
      console.error("Videos query error:", err);
    });
    
    return () => unsubscribe();
  }, []);

  // Fetch gallery photos in real-time
  useEffect(() => {
    if (!db) return;
    const qG = query(collection(db, "gallery_photos"), orderBy("createdAt", "desc"));
    const unsubG = onSnapshot(qG, (snapshot: any) => {
      const list = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      setGalleryPhotos(list);
    }, (err) => {
      console.error("Gallery query error:", err);
    });
    return () => unsubG();
  }, []);

  const fallbackGallery = [
    { id: "fb-1", imageUrl: "https://i.ytimg.com/vi/pCJLCP1jZfA/hqdefault.jpg", title: "THE EMPIRE Thriller", category: "Set Photos" },
    { id: "fb-2", imageUrl: "https://i.ytimg.com/vi/POJBYGUdppw/hqdefault.jpg", title: "THE CALL", category: "Behind the Scenes" },
    { id: "fb-3", imageUrl: "https://i.ytimg.com/vi/MTFuMGGtXdc/hqdefault.jpg", title: "THE EMPIRE | Teaser", category: "Production Stills" },
    { id: "fb-4", imageUrl: "https://i.ytimg.com/vi/BQHCvfLKI-4/hqdefault.jpg", title: "On Set Camera Setup", category: "Set Photos" },
    { id: "fb-5", imageUrl: "https://i.ytimg.com/vi/3MENAZMh1rk/hqdefault.jpg", title: "Cast Rehearsal", category: "Cast & Crew" },
    { id: "fb-6", imageUrl: "https://i.ytimg.com/vi/QST9pdVfMxA/hqdefault.jpg", title: "Director In Action", category: "Behind the Scenes" },
  ];
  const displayGallery = galleryPhotos.length > 0 ? galleryPhotos : fallbackGallery;

  const movies = useMemo(() => {
    return allVideos.filter((v: any) => v.category === "movies" || !v.category);
  }, [allVideos]);

  const trailers = useMemo(() => {
    return allVideos.filter((v: any) => 
      v.category === "trailers" || 
      (v.title && v.title.toLowerCase().includes("trailer"))
    );
  }, [allVideos]);

  const shortsData = useMemo(() => {
    return allVideos.filter((v: any) => v.category === "shorts");
  }, [allVideos]);

  const bts = useMemo(() => {
    return allVideos.filter((v: any) => v.category === "bts");
  }, [allVideos]);

  const musicVideos = useMemo(() => {
    return allVideos.filter((v: any) => v.category === "music");
  }, [allVideos]);

  const categories = [
    { id: "all", label: "All" },
    { id: "movies", label: "Movies" },
    { id: "trailers", label: "Trailers" },
    { id: "shorts", label: "Shorts" },
    { id: "gallery", label: "Gallery" },
    { id: "bts", label: "BTS" },
    { id: "music", label: "Music" },
  ];

  const heroSlides = useMemo(() => {
    const list = (movies.length > 0 ? movies.slice(0, 4) : []).map((m: any) => ({
      id: m.videoId,
      title: cleanTitle(m.title),
      img: `https://i.ytimg.com/vi/${m.videoId}/hqdefault.jpg`,
      subtitle: m.category === "trailers" ? "Trending Trailer" : "Now Showing"
    }));
    if (list.length === 0) {
      list.push({ id: "pCJLCP1jZfA", title: "THE EMPIRE", img: "https://i.ytimg.com/vi/pCJLCP1jZfA/hqdefault.jpg", subtitle: "Campus Movie Series" });
    }
    return list;
  }, [movies]);

  useEffect(() => {
    setMounted(true);
    // Start splash timer
    const timer = setTimeout(() => {
      setSplashFinished(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Persist onboarded state
  useEffect(() => {
    if (viewState === "HOME") {
      sessionStorage.setItem("cms_onboarded", "true");
    }
  }, [viewState]);

  // Main Flow Controller
  useEffect(() => {
    // If Firebase is still loading its initial auth state, we wait.
    if (loading) return;

    if (viewState === "SPLASH") {
      const isLoginFlow = window.location.search.includes("login=true");
      const hasOnboarded = sessionStorage.getItem("cms_onboarded") === "true";

      // If they're already logged in, fast track to HOME (or SETUP_USERNAME) if splash is done (or immediately if onboarded)
      if (user) {
        if (userData && (!userData.username || !userData.university)) {
          if (hasOnboarded || splashFinished) setViewState("SETUP_USERNAME");
        } else {
          if (hasOnboarded || splashFinished) setViewState("HOME");
        }
        return;
      }

      // If not logged in but they have onboarded, fast track to LOGIN
      if (hasOnboarded || isLoginFlow) {
        setViewState("LOGIN");
        return;
      }

      // If they haven't onboarded and aren't logged in, wait for splash to finish then go to REGISTER
      if (splashFinished) {
        setViewState("REGISTER");
      }
      return;
    }

    // If user is logged in but not on HOME or SETUP, force them
    if (user && viewState !== "HOME" && viewState !== "SETUP_USERNAME") {
      if (userData && (!userData.username || !userData.university)) {
        setViewState("SETUP_USERNAME");
      } else {
        setViewState("HOME");
      }
    }

    // If user is NOT logged in but they are trying to view restricted views, kick them to Auth
    if (!user && (viewState === "HOME" || viewState === "SETUP_USERNAME")) {
      setViewState("LOGIN");
    }
  }, [user, userData, loading, viewState, splashFinished]);

  // Hero carousel timer
  useEffect(() => {
    if (viewState !== "HOME") return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroSlides.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [viewState, heroSlides.length]);

  if (!mounted) return null;

  /* ─── SPLASH SCREEN ─── */
  if (viewState === "SPLASH") {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-between py-16">
        {/* Generated Cinematic Background */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-bottom opacity-80"
          style={{ backgroundImage: 'url("/splash_bg_new.jpg")' }}
        ></div>
        
        {/* Bottom Fade */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-black/60 to-transparent z-0"></div>
        
        {/* Logo Area */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-start w-full px-10 pt-16">
          <Image
            src="/logo_original.jpg"
            alt="CMS Logo"
            width={300}
            height={150}
            priority
            className="w-[85%] max-w-[300px] h-auto drop-shadow-2xl mix-blend-screen animate-splash-logo"
          />
        </div>

        {/* Tagline */}
        <div className="relative z-10 mb-2 animate-splash-logo" style={{ animationDelay: '0.5s' }}>
          <p className="text-[11px] tracking-[0.25em] text-white/90 font-medium">
            CREATE. INSPIRE. CONNECT.
          </p>
        </div>
      </div>
    );
  }

  /* ─── REGISTRATION ─── */
  if (viewState === "REGISTER") {
    return <Registration onGoLogin={() => setViewState("LOGIN")} />;
  }

  /* ─── LOGIN ─── */
  if (viewState === "LOGIN") {
    return <Login onLogin={() => setViewState("HOME")} onGoRegister={() => setViewState("REGISTER")} />;
  }

  /* ─── SETUP USERNAME ─── */
  if (viewState === "SETUP_USERNAME") {
    return <SetupUsername onComplete={() => setViewState("HOME")} />;
  }

  /* ─── HOME SCREEN ─── */
  return (
    <div className="flex flex-col min-h-[100dvh] bg-black text-white overflow-x-hidden pb-16">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="w-24">
          <Image 
            src="/logo_original.jpg" 
            alt="CMS Logo" 
            width={120} 
            height={60}
            priority
            className="w-full h-auto object-contain mix-blend-screen"
          />
        </div>
        <div className="flex items-center gap-4">
          {/* Search button */}
          <Link href="/search" className="relative p-1 text-white hover:text-cms-yellow transition-colors" aria-label="Search">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.3-4.3"/>
            </svg>
          </Link>
          {/* Profile avatar */}
          <Link href="/profile" className="relative shrink-0 block">
            <div className="w-9 h-9 rounded-full bg-[#1A1A1A] border-2 border-white/20 overflow-hidden relative flex items-center justify-center">
              {userData?.photoURL ? (
                <img src={userData.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/40"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              )}
            </div>
            {userData?.membership && userData.membership !== "free" && (
              <div className="absolute -top-1 -right-1 bg-black rounded-full p-[2px] border border-cms-yellow z-10 text-cms-yellow flex items-center justify-center shadow-lg">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {userData.membership === 'elite-member' ? (
                    <><path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></>
                  ) : userData.membership === 'premium-member' ? (
                    <><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></>
                  ) : (
                    <><path d="M2 4h20M2 20h20M9 4v16M15 4v16"/><path d="M2 16l4-12 6 8 6-8 4 12z"/></>
                  )}
                </svg>
              </div>
            )}
          </Link>
        </div>
      </header>

      {/* ── Category Tabs (Consistent Across All Selections) ── */}
      <nav className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto no-scrollbar sticky top-0 bg-black/95 backdrop-blur-md z-30 border-b border-white/5">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
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

      {/* ── ALL VIEW ── */}
      {selectedCategory === "all" && (
        <>
          {/* ── Hero Carousel ── */}
          <section className="relative mx-4 mt-2 rounded-xl overflow-hidden aspect-video">
            {heroSlides.map((slide, idx) => (
              <Link 
                key={idx}
                href={`/watch?v=${slide.id}&t=${encodeURIComponent(slide.title)}`}
                className={`absolute inset-0 transition-opacity duration-1000 block ${idx === heroIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
              >
                <Image src={slide.img} alt={slide.title} fill className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                
                <div className="absolute bottom-5 left-0 right-0 flex flex-col items-center px-4">
                  <h2 className="text-[22px] md:text-[28px] font-extrabold tracking-wide text-white leading-tight drop-shadow-md text-center line-clamp-2">{slide.title}</h2>
                  <p className="text-[11px] text-white/80 tracking-[0.15em] uppercase mt-1 drop-shadow-sm">{slide.subtitle}</p>
                </div>
              </Link>
            ))}
            
            {/* Dots */}
            <div className="absolute bottom-3 left-0 right-0 z-20 flex justify-center gap-1.5">
              {heroSlides.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`w-2 h-2 rounded-full transition-colors duration-500 ${idx === heroIndex ? 'bg-cms-yellow' : 'bg-white/30'}`}
                ></div>
              ))}
            </div>
          </section>

          {/* ── Movies & Shows ── */}
          <section className="mt-6 px-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-semibold">Movies & Shows</h3>
              <button 
                onClick={() => setSelectedCategory("movies")} 
                className="text-cms-yellow text-xs font-medium hover:underline cursor-pointer"
              >
                See All
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {movies.map((item, i) => {
                const title = cleanTitle(item.title);
                return (
                  <Link href={`/watch?v=${item.videoId}&t=${encodeURIComponent(title)}`} key={i} className="min-w-[150px] w-[150px] shrink-0 block">
                    <div className="relative w-full aspect-[16/10] bg-[#1A1A1A] rounded-xl overflow-hidden">
                      <Image src={`https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`} alt={title} fill className="object-cover opacity-80 hover:opacity-100 transition-opacity" />
                      {/* Play button */}
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="w-9 h-9 rounded-full border-2 border-white/80 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                        </div>
                      </div>
                    </div>
                    <h4 className="text-[13px] font-medium mt-2 leading-tight truncate">{title}</h4>
                    <p className="text-[11px] text-white/40 capitalize">{item.category || "Movie"}</p>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* ── Shorts & BTS ── */}
          <section className="mt-6 px-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-semibold">Shorts & BTS</h3>
              <button 
                onClick={() => setSelectedCategory("shorts")} 
                className="text-cms-yellow text-xs font-medium hover:underline cursor-pointer"
              >
                See All
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {[...shortsData, ...bts].map((item, i) => {
                const title = cleanTitle(item.title);
                const isShort = item.category === "shorts";
                return (
                  <Link href={isShort ? "/shorts" : `/watch?v=${item.videoId}&t=${encodeURIComponent(title)}`} key={i} className="min-w-[120px] w-[120px] shrink-0 block">
                    <div className="relative w-full aspect-[3/4] bg-[#1A1A1A] rounded-xl overflow-hidden">
                      <Image src={item.thumbnailUrl || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`} alt={title} fill className="object-cover" />
                    </div>
                    <h4 className="text-[13px] font-medium mt-2 leading-tight truncate">{title}</h4>
                    <p className="text-[11px] text-cms-yellow uppercase">{item.category || "Short"}</p>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* ── Community & Production Gallery ── */}
          <section className="mt-8 px-4 pb-24">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-semibold">Production Gallery</h3>
              <button 
                onClick={() => setSelectedCategory("gallery")} 
                className="text-cms-yellow text-xs font-medium hover:underline cursor-pointer"
              >
                See All
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {displayGallery.slice(0, 6).map((photo, i) => (
                <div 
                  key={photo.id || i} 
                  onClick={() => setSelectedPhoto(photo)}
                  className="min-w-[200px] w-[200px] shrink-0 bg-[#1A1A1A] rounded-xl overflow-hidden border border-white/5 flex flex-col cursor-pointer group hover:border-white/20 transition-all"
                >
                  <div className="relative w-full h-[120px]">
                    <Image src={photo.imageUrl} alt={photo.title || "Gallery"} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                  <div className="p-2.5">
                    <p className="text-[12px] font-medium text-white/90 truncate">{photo.title}</p>
                    <p className="text-[10px] text-cms-yellow mt-0.5">{photo.category || "Official Still"}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* ── MOVIES VIEW ── */}
      {selectedCategory === "movies" && (
        <section className="mt-4 px-4 pb-24">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold">Featured Movies & Series</h3>
              <p className="text-[11px] text-white/50">Full-length student films and cinematic productions</p>
            </div>
            <span className="text-xs bg-cms-yellow/10 text-cms-yellow border border-cms-yellow/30 px-2.5 py-0.5 rounded-full font-bold">
              {movies.length} Releases
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {movies.map((item, i) => {
              const title = cleanTitle(item.title);
              return (
                <div key={item.videoId || i} className="bg-[#121214] border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all group flex flex-col">
                  <Link href={`/watch?v=${item.videoId}&t=${encodeURIComponent(title)}`} className="relative w-full aspect-video bg-[#1a1a1a] block overflow-hidden">
                    <Image 
                      src={`https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`} 
                      alt={title} 
                      fill 
                      className="object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <div className="w-11 h-11 rounded-full bg-cms-yellow/90 text-black flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                      </div>
                    </div>
                    <div className="absolute bottom-2.5 right-2.5 bg-black/85 text-white text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">
                      {item.duration || "HD"}
                    </div>
                  </Link>
                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-white line-clamp-2 leading-snug group-hover:text-cms-yellow transition-colors">
                        {title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-white/50">
                        <span>Campus Movie Series</span>
                        <span>•</span>
                        <span>{item.views ? `${item.views} views` : "Official Movie"}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5">
                      <span className="text-[10px] uppercase font-bold text-cms-yellow bg-cms-yellow/10 px-2 py-0.5 rounded">Feature Film</span>
                      <Link href={`/watch?v=${item.videoId}&t=${encodeURIComponent(title)}`} className="text-xs text-white font-bold hover:text-cms-yellow flex items-center gap-1">
                        <span>Watch Now</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── TRAILERS VIEW ── */}
      {selectedCategory === "trailers" && (
        <section className="mt-4 px-4 pb-24">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold">Official Teasers & Trailers</h3>
              <p className="text-[11px] text-white/50">Sneak peeks and premiere trailers for upcoming releases</p>
            </div>
            <span className="text-xs bg-cms-yellow/10 text-cms-yellow border border-cms-yellow/30 px-2.5 py-0.5 rounded-full font-bold">
              {trailers.length} Trailers
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {trailers.map((item, i) => {
              const title = cleanTitle(item.title);
              return (
                <div key={item.videoId || i} className="bg-[#121214] border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all group flex flex-col">
                  <Link href={`/watch?v=${item.videoId}&t=${encodeURIComponent(title)}`} className="relative w-full aspect-video bg-[#1a1a1a] block overflow-hidden">
                    <Image 
                      src={`https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`} 
                      alt={title} 
                      fill 
                      className="object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <div className="w-11 h-11 rounded-full bg-cms-yellow/90 text-black flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                      </div>
                    </div>
                    <div className="absolute top-2.5 left-2.5 bg-cms-yellow text-black text-[10px] font-black uppercase px-2 py-0.5 rounded shadow">
                      Trailer
                    </div>
                  </Link>
                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-white line-clamp-2 leading-snug group-hover:text-cms-yellow transition-colors">
                        {title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-white/50">
                        <span>Campus Movie Series</span>
                        <span>•</span>
                        <span>{item.views ? `${item.views} views` : "Official"}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5">
                      <span className="text-[10px] uppercase font-bold text-white/40">Teaser / Preview</span>
                      <Link href={`/watch?v=${item.videoId}&t=${encodeURIComponent(title)}`} className="text-xs text-cms-yellow font-bold hover:underline flex items-center gap-1">
                        <span>Play Trailer</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── SHORTS VIEW ── */}
      {selectedCategory === "shorts" && (
        <section className="mt-4 px-4 pb-24">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold">Shorts & Quick Clips</h3>
              <p className="text-[11px] text-white/50">Vertical stories, reels, and highlights</p>
            </div>
            <Link 
              href="/shorts" 
              className="text-xs bg-cms-yellow text-black font-bold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
            >
              <span>Full Screen Player</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {shortsData.map((item, i) => {
              const title = cleanTitle(item.title);
              return (
                <div key={item.videoId || item.id || i} className="bg-[#121214] border border-white/10 rounded-2xl overflow-hidden group flex flex-col relative aspect-[9/16]">
                  <Link href="/shorts" className="absolute inset-0 block overflow-hidden">
                    <Image 
                      src={item.thumbnailUrl || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`} 
                      alt={title} 
                      fill 
                      className="object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-between p-3">
                      <div className="flex justify-between items-start">
                        <span className="bg-red-600/90 text-white text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded shadow">
                          Short
                        </span>
                        <div className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white line-clamp-2 leading-tight drop-shadow-md">
                          {title}
                        </h4>
                        <p className="text-[10px] text-white/70 mt-1">{item.views ? `${item.views} views` : "Watch"}</p>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── GALLERY VIEW ── */}
      {selectedCategory === "gallery" && (
        <section className="mt-4 px-4 pb-24">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold">Official Production Gallery</h3>
              <p className="text-[11px] text-white/50">Exclusive set photography and official movie stills</p>
            </div>
            <Link 
              href="/gallery" 
              className="text-xs bg-cms-yellow/10 text-cms-yellow border border-cms-yellow/30 font-bold px-3 py-1 rounded-full flex items-center gap-1 hover:bg-cms-yellow hover:text-black transition-colors"
            >
              <span>View Full Gallery</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {displayGallery.map((photo, i) => (
              <div 
                key={photo.id || i}
                onClick={() => setSelectedPhoto(photo)}
                className="bg-[#121214] border border-white/10 rounded-2xl overflow-hidden cursor-pointer group hover:border-cms-yellow/50 transition-all relative aspect-[4/3]"
              >
                <Image 
                  src={photo.imageUrl} 
                  alt={photo.title || "Gallery"} 
                  fill 
                  className="object-cover group-hover:scale-105 transition-transform duration-500" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2.5">
                  <p className="text-xs font-bold text-white truncate drop-shadow-md">{photo.title}</p>
                  {photo.category && (
                    <span className="text-[9px] text-cms-yellow font-medium mt-0.5">{photo.category}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── BTS VIEW ── */}
      {selectedCategory === "bts" && (
        <section className="mt-4 px-4 pb-24">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold">Behind The Scenes</h3>
              <p className="text-[11px] text-white/50">On-set making, director action, and cast moments</p>
            </div>
            <span className="text-xs bg-cms-yellow/10 text-cms-yellow border border-cms-yellow/30 px-2.5 py-0.5 rounded-full font-bold">
              {bts.length} Footage
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {bts.map((item, i) => {
              const title = cleanTitle(item.title);
              return (
                <div key={item.videoId || i} className="bg-[#121214] border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all group flex flex-col">
                  <Link href={`/watch?v=${item.videoId}&t=${encodeURIComponent(title)}`} className="relative w-full aspect-video bg-[#1a1a1a] block overflow-hidden">
                    <Image 
                      src={`https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`} 
                      alt={title} 
                      fill 
                      className="object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <div className="w-11 h-11 rounded-full bg-cms-yellow/90 text-black flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                      </div>
                    </div>
                    <div className="absolute top-2.5 left-2.5 bg-amber-500/90 text-black text-[10px] font-black uppercase px-2 py-0.5 rounded shadow">
                      Behind The Scenes
                    </div>
                  </Link>
                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-white line-clamp-2 leading-snug group-hover:text-cms-yellow transition-colors">
                        {title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-white/50">
                        <span>Production Exclusive</span>
                        <span>•</span>
                        <span>{item.views ? `${item.views} views` : "Behind The Scenes"}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5">
                      <span className="text-[10px] uppercase font-bold text-cms-yellow">Rehearsals & Set</span>
                      <Link href={`/watch?v=${item.videoId}&t=${encodeURIComponent(title)}`} className="text-xs text-cms-yellow font-bold hover:underline flex items-center gap-1">
                        <span>Watch BTS</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── MUSIC VIEW ── */}
      {selectedCategory === "music" && (
        <section className="mt-4 px-4 pb-24">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold">Soundtracks & Original Scores</h3>
              <p className="text-[11px] text-white/50">Official musical scores and songs produced for CMS films</p>
            </div>
          </div>

          {musicVideos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {musicVideos.map((item, i) => {
                const title = cleanTitle(item.title);
                return (
                  <div key={item.videoId || i} className="bg-[#121214] border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all group flex flex-col">
                    <Link href={`/watch?v=${item.videoId}&t=${encodeURIComponent(title)}`} className="relative w-full aspect-video bg-[#1a1a1a] block overflow-hidden">
                      <Image 
                        src={`https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`} 
                        alt={title} 
                        fill 
                        className="object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                    </Link>
                    <div className="p-3.5 flex-1 flex flex-col justify-between">
                      <h4 className="font-bold text-sm text-white line-clamp-2">{title}</h4>
                      <Link href={`/watch?v=${item.videoId}&t=${encodeURIComponent(title)}`} className="text-xs text-cms-yellow font-bold hover:underline mt-2">
                        Listen
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-[#121214] border border-white/10 rounded-2xl p-8 text-center my-6">
              <div className="w-14 h-14 rounded-full bg-cms-yellow/10 border border-cms-yellow/20 flex items-center justify-center mx-auto mb-3 text-cms-yellow">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Soundtracks Coming Soon</h4>
              <p className="text-xs text-white/50 max-w-sm mx-auto mb-4">
                Official musical scores and themes will drop here alongside upcoming releases.
              </p>
              <button 
                onClick={() => setSelectedCategory("all")}
                className="bg-cms-yellow text-black text-xs font-bold px-4 py-2 rounded-full cursor-pointer hover:brightness-110 active:scale-95 transition-all"
              >
                Explore All Releases
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── Fullscreen Photo Modal ── */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="flex items-center justify-between w-full pt-2">
            <div>
              <h3 className="text-sm font-bold text-white">{selectedPhoto.title || "Gallery Photo"}</h3>
              {selectedPhoto.category && (
                <p className="text-[11px] text-cms-yellow">{selectedPhoto.category}</p>
              )}
            </div>
            <button 
              onClick={() => setSelectedPhoto(null)}
              className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
            >
              ✕
            </button>
          </div>
          
          <div className="relative flex-1 w-full max-h-[75vh] my-auto">
            <Image 
              src={selectedPhoto.imageUrl} 
              alt={selectedPhoto.title || "Photo"} 
              fill 
              className="object-contain" 
            />
          </div>

          <div className="text-center pb-4">
            <p className="text-xs text-white/50">Campus Movie Series — Official Production Stills</p>
          </div>
        </div>
      )}

      {/* ── Bottom Nav ── */}
      <BottomNav />
    </div>
  );
}
