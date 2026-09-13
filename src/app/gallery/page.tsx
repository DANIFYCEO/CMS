"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { canUploadGallery } from "@/lib/adminRoles";

export default function GalleryPage() {
  const { userData } = useAuth();
  const [uploadedPhotos, setUploadedPhotos] = useState<any[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const fallbackImages = [
    { id: "fb-1", imageUrl: "https://i.ytimg.com/vi/pCJLCP1jZfA/hqdefault.jpg", title: "THE EMPIRE Thriller", category: "Set Photos" },
    { id: "fb-2", imageUrl: "https://i.ytimg.com/vi/POJBYGUdppw/hqdefault.jpg", title: "THE CALL", category: "Behind the Scenes" },
    { id: "fb-3", imageUrl: "https://i.ytimg.com/vi/MTFuMGGtXdc/hqdefault.jpg", title: "THE EMPIRE | Teaser", category: "Production Stills" },
    { id: "fb-4", imageUrl: "https://i.ytimg.com/vi/BQHCvfLKI-4/hqdefault.jpg", title: "On Set Camera Setup", category: "Set Photos" },
    { id: "fb-5", imageUrl: "https://i.ytimg.com/vi/3MENAZMh1rk/hqdefault.jpg", title: "Cast Rehearsal", category: "Cast & Crew" },
    { id: "fb-6", imageUrl: "https://i.ytimg.com/vi/QST9pdVfMxA/hqdefault.jpg", title: "Director In Action", category: "Behind the Scenes" },
  ];

  const canUpload = canUploadGallery(userData?.role, userData?.isAdmin);

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "gallery_photos"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setUploadedPhotos(docs);
    }, (err) => {
      console.error("Error loading gallery:", err);
    });

    return () => unsub();
  }, []);

  const displayPhotos = uploadedPhotos.length > 0 ? uploadedPhotos : fallbackImages;

  const categories = ["All", "Set Photos", "Behind the Scenes", "Production Stills", "Cast & Crew", "Events & Premieres"];

  const filteredPhotos = activeCategory === "All" 
    ? displayPhotos 
    : displayPhotos.filter(p => p.category === activeCategory);

  return (
    <div className="flex flex-col min-h-[100dvh] bg-black text-white pb-24">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/10 sticky top-0 bg-black/90 backdrop-blur-md z-40">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-white/80 hover:text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold">CMS Gallery</h1>
            <p className="text-[10px] text-white/40 leading-none">Official Stills & Moments</p>
          </div>
        </div>

        {/* Shortcut to upload for Content Admins and Super Admins */}
        {canUpload && (
          <Link 
            href="/admin/gallery"
            className="bg-cms-yellow text-black text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md active:scale-95 transition-transform"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            <span>Upload Photo</span>
          </Link>
        )}
      </header>

      {/* ── Category Navigation Tabs ── */}
      <nav className="flex items-center gap-2 px-4 py-3 overflow-x-auto no-scrollbar border-b border-white/10">
        <Link href="/" className="text-white/60 text-xs font-medium whitespace-nowrap shrink-0 px-3 py-1 rounded-full hover:bg-white/5">All</Link>
        <Link href="/movies" className="text-white/60 text-xs font-medium whitespace-nowrap shrink-0 px-3 py-1 rounded-full hover:bg-white/5">Movies</Link>
        <Link href="/series" className="text-white/60 text-xs font-medium whitespace-nowrap shrink-0 px-3 py-1 rounded-full hover:bg-white/5">Series</Link>
        <span className="bg-cms-yellow text-black text-xs font-bold px-3.5 py-1 rounded-full whitespace-nowrap shrink-0 shadow-sm">Gallery</span>
        <Link href="/shorts" className="text-white/60 text-xs font-medium whitespace-nowrap shrink-0 px-3 py-1 rounded-full hover:bg-white/5">Shorts</Link>
        <Link href="/communities" className="text-white/60 text-xs font-medium whitespace-nowrap shrink-0 px-3 py-1 rounded-full hover:bg-white/5">Communities</Link>
      </nav>

      {/* ── Filter by Photo Category ── */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 overflow-x-auto no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${
              activeCategory === cat 
                ? "bg-white/15 text-white border border-white/20" 
                : "bg-transparent text-white/50 hover:text-white"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Gallery Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 px-3 mt-2">
        {filteredPhotos.map((img) => (
          <div 
            key={img.id} 
            onClick={() => setSelectedPhoto(img)}
            className="relative w-full aspect-[4/3] bg-[#141416] rounded-xl overflow-hidden group cursor-pointer border border-white/5 hover:border-white/20 transition-all shadow-md"
          >
            <img 
              src={img.imageUrl} 
              alt={img.title || "CMS Photo"} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
            />

            {/* Overlay Gradient with Title */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5">
              <span className="text-[9px] font-bold text-cms-yellow uppercase tracking-wider">
                {img.category || "Set Photo"}
              </span>
              <h3 className="text-xs font-bold text-white truncate drop-shadow-sm">
                {img.title}
              </h3>
            </div>
          </div>
        ))}
      </div>

      {/* ── Fullscreen Lightbox Modal ── */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black/95 z-[100] flex flex-col justify-between p-4 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="flex items-center justify-between pb-3">
            <div>
              <span className="text-[10px] font-bold text-cms-yellow uppercase tracking-wider">
                {selectedPhoto.category}
              </span>
              <h2 className="text-sm font-bold text-white truncate max-w-[280px] sm:max-w-md">
                {selectedPhoto.title}
              </h2>
            </div>
            <button 
              onClick={() => setSelectedPhoto(null)}
              className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center overflow-hidden my-2" onClick={e => e.stopPropagation()}>
            <img 
              src={selectedPhoto.imageUrl} 
              alt={selectedPhoto.title} 
              className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl" 
            />
          </div>

          <div className="text-center pt-2 text-xs text-white/50" onClick={e => e.stopPropagation()}>
            {selectedPhoto.uploadedBy && (
              <p>Uploaded by <span className="text-white font-semibold">{selectedPhoto.uploadedBy}</span></p>
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
