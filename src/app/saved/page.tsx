"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import BottomNav from "@/components/BottomNav";
import { cleanTitle } from "@/lib/videoUtils";

export default function SavedVideosPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [savedVideos, setSavedVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSavedVideos() {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const savedRef = collection(db, "users", user.uid, "savedVideos");
        const q = query(savedRef, orderBy("savedAt", "desc"));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSavedVideos(list);
      } catch (err) {
        console.error("Failed to load saved videos", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSavedVideos();
  }, [user]);

  return (
    <div className="flex flex-col min-h-[100dvh] bg-black text-white pb-20 overflow-y-auto">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-5 border-b border-white/5 sticky top-0 bg-black/90 backdrop-blur-md z-50">
        <h1 className="text-[15px] font-bold tracking-wide uppercase text-cms-yellow">Saved Videos</h1>
      </header>

      {/* Content */}
      <div className="p-4 flex flex-col gap-4">
        {loading ? (
          <p className="text-white/50 text-center py-10 text-sm">Loading saved videos...</p>
        ) : savedVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
            <p className="text-sm font-medium">No saved videos yet</p>
          </div>
        ) : (
          savedVideos.map((item, i) => (
            <Link 
              key={item.videoId}
              href={`/watch?v=${item.videoId}&t=${encodeURIComponent(cleanTitle(item.title))}`}
              className="flex gap-4 items-center group bg-[#111] border border-white/5 p-3 rounded-2xl active:scale-95 transition-all"
            >
              <div className="relative w-32 aspect-video bg-[#1A1A1A] rounded-xl overflow-hidden shrink-0">
                <Image src={`https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`} alt={item.title} fill className="object-cover" sizes="128px" />
              </div>
              <div className="flex flex-col justify-center flex-1 pr-2">
                <h4 className="text-[14px] font-semibold leading-snug line-clamp-2">{cleanTitle(item.title)}</h4>
                <p className="text-[12px] text-white/50 mt-1.5">Campus Movie Series</p>
              </div>
            </Link>
          ))
        )}
      </div>
      <BottomNav />
    </div>
  );
}
