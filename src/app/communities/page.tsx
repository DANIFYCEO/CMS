"use client";

import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, getCountFromServer, doc, updateDoc, arrayUnion, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

const joinMapping: Record<string, string> = {
  actors: "Actor",
  filmmaker: "Director",
  cinematography: "Cinematographer / DOP",
  editor: "Editor"
};

export default function CommunitiesPage() {
  const router = useRouter();
  const { user, userData } = useAuth();

  const [counts, setCounts] = useState<Record<string, number>>({
    actors: 0,
    filmmaker: 0,
    cinematography: 0,
    editor: 0,
    general: 0
  });

  const [selectedCommunity, setSelectedCommunity] = useState<any>(null);
  const [cmsIdInput, setCmsIdInput] = useState("");
  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any>(null);

  useEffect(() => {
    // Realtime announcements listener
    const qAnnounce = query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(5));
    const unsubAnnounce = onSnapshot(qAnnounce, (snap) => {
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Realtime snapshot listener on users collection
    const usersRef = collection(db, "users");
    
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      let general = snapshot.size;
      let actors = 0;
      let filmmaker = 0;
      let cinematography = 0;
      let editor = 0;

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const depts = data.registrationForm?.creativeDepartments || [];
        if (depts.includes("Actor") || depts.includes("Actress")) actors++;
        if (depts.includes("Director")) filmmaker++;
        if (depts.includes("Cinematographer / DOP")) cinematography++;
        if (depts.includes("Editor")) editor++;
      });

      setCounts({
        general,
        actors,
        filmmaker,
        cinematography,
        editor
      });
    }, (err) => {
      console.error("Realtime count snapshot error:", err);
    });

    return () => {
      unsubAnnounce();
      unsubscribe();
    };
  }, []);

  const isUserJoined = (commId: string) => {
    if (!user) return false;
    const depts = (userData as any)?.registrationForm?.creativeDepartments || [];
    if (commId === "actors") {
      return depts.includes("Actor") || depts.includes("Actress");
    }
    return depts.includes(joinMapping[commId]);
  };

  const handleCommunityClick = (c: any) => {
    if (!user) {
      router.push("/?login=true");
      return;
    }

    if (isUserJoined(c.id)) {
      router.push(`/communities/${c.id}`);
    } else {
      setSelectedCommunity(c);
      setCmsIdInput((userData as any)?.cmsId || "");
    }
  };

  const handleJoinWithId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCommunity) return;
    if (!cmsIdInput.trim()) {
      alert("Please enter your CMS ID");
      return;
    }

    setIsSubmittingJoin(true);
    try {
      const joinVal = joinMapping[selectedCommunity.id];
      if (joinVal) {
        await updateDoc(doc(db, "users", user.uid), {
          "registrationForm.creativeDepartments": arrayUnion(joinVal),
          cmsId: cmsIdInput.trim().toUpperCase()
        });
      }

      setCounts(prev => ({
        ...prev,
        [selectedCommunity.id]: (prev[selectedCommunity.id] || 0) + 1
      }));

      const targetId = selectedCommunity.id;
      setSelectedCommunity(null);
      router.push(`/communities/${targetId}`);
    } catch (err) {
      console.error("Error joining community:", err);
      alert("Failed to join community. Please try again.");
    } finally {
      setIsSubmittingJoin(false);
    }
  };

  const communities = [
    { id: "actors", title: "Actors Community", desc: "Connect with actors and share opportunities, tips, and experiences.", members: counts.actors, img: "/communities/actors.png" },
    { id: "filmmaker", title: "Filmmakers Community", desc: "For directors, producers and filmmakers. Share ideas, projects and collaborate.", members: counts.filmmaker, img: "/communities/filmmaker.png" },
    { id: "cinematography", title: "Cinematographers (DOP)", desc: "A space for cinematographers and camera enthusiasts.", members: counts.cinematography, img: "/communities/cinematography.png" },
    { id: "editor", title: "Editors Community", desc: "Editors, video creators and post production professionals.", members: counts.editor, img: "/communities/editor.png" }
  ];

  return (
    <div className="flex flex-col min-h-[100dvh] bg-black text-white pb-24 overflow-x-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-white/5">
        <h1 className="text-2xl font-bold">Communities</h1>
      </header>

      {/* Official Announcements Section */}
      {announcements.length > 0 && (
        <section className="mt-4 px-4">
          <div className="bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-transparent border border-cms-yellow/30 rounded-2xl p-4 shadow-lg shadow-cms-yellow/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-cms-yellow/20 border border-cms-yellow/40 flex items-center justify-center text-cms-yellow">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
                  </svg>
                </div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-cms-yellow">Official Announcements</h2>
              </div>
              <span className="text-[10px] bg-cms-yellow/20 text-cms-yellow border border-cms-yellow/30 px-2.5 py-0.5 rounded-full font-bold">
                {announcements.length} {announcements.length === 1 ? 'Notice' : 'Notices'}
              </span>
            </div>

            {/* Featured / Latest Announcement */}
            <div 
              onClick={() => setSelectedAnnouncement(announcements[0])}
              className="bg-black/60 hover:bg-black/80 border border-cms-yellow/20 rounded-xl p-3.5 cursor-pointer transition-all active:scale-[0.99] group"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wider bg-cms-yellow text-black px-2 py-0.5 rounded-full">
                  {announcements[0].category || "Notice"}
                </span>
                <span className="text-[11px] text-white/50">
                  {announcements[0].authorRole || "Executive Memo"}
                </span>
              </div>
              <h3 className="font-bold text-sm text-white group-hover:text-cms-yellow transition-colors line-clamp-1">
                {announcements[0].title}
              </h3>
              <p className="text-xs text-white/60 line-clamp-2 mt-1 leading-relaxed">
                {announcements[0].content}
              </p>
              <div className="mt-2.5 flex items-center justify-between text-[11px] text-cms-yellow/90 font-semibold pt-2 border-t border-white/5">
                <span>Tap to read full notice</span>
                <span>→</span>
              </div>
            </div>

            {/* Additional announcements slider/pills if more than 1 */}
            {announcements.length > 1 && (
              <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar pt-1">
                {announcements.slice(1).map((ann) => (
                  <button
                    key={ann.id}
                    onClick={() => setSelectedAnnouncement(ann)}
                    className="text-left bg-black/40 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2 shrink-0 max-w-[220px] transition-colors"
                  >
                    <p className="text-[11px] font-semibold text-white/90 truncate">{ann.title}</p>
                    <p className="text-[9px] text-cms-yellow/70 uppercase tracking-wider mt-0.5">{ann.category || "Notice"}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="mt-4 px-4">
        {/* General Community Tab */}
        <Link href="/communities/general">
          <div className="flex items-center gap-4 p-4 mb-6 bg-[#111] border border-cms-yellow/30 rounded-2xl active:bg-white/5 transition-colors cursor-pointer shadow-lg shadow-cms-yellow/5">
            <div className="w-14 h-14 bg-cms-yellow/10 rounded-xl flex items-center justify-center shrink-0 border border-cms-yellow/50">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-cms-yellow" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-cms-yellow truncate">CMS General Community</h3>
              <p className="text-[11px] text-white/50 leading-tight mt-0.5 line-clamp-2">Live group chat for all members. Connect and talk with everyone.</p>
              <p className="text-[10px] text-cms-yellow/60 mt-1.5 flex items-center gap-1 font-bold">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                {counts.general} Members
              </p>
            </div>
          </div>
        </Link>

        {/* Departments List */}
        <div className="flex flex-col gap-3">
          {communities.map((c) => {
            const joined = isUserJoined(c.id);

            return (
              <div 
                key={c.id}
                onClick={() => handleCommunityClick(c)}
                className="flex items-center gap-4 p-3 bg-[#111] border border-white/5 rounded-2xl active:bg-white/5 transition-colors cursor-pointer hover:border-white/10"
              >
                <div className="w-14 h-14 bg-black border border-white/10 rounded-xl overflow-hidden shrink-0 relative">
                  <img src={c.img} alt={c.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <h3 className="font-semibold text-sm truncate">{c.title}</h3>
                    {joined ? (
                      <span className="text-[9px] text-cms-yellow bg-cms-yellow/10 border border-cms-yellow/30 px-2 py-0.5 rounded-full font-bold shrink-0">
                        Joined
                      </span>
                    ) : (
                      <span className="text-[9px] text-white/60 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-medium shrink-0">
                        Join with ID
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-white/50 leading-tight mt-0.5 line-clamp-2">{c.desc}</p>
                  <p className="text-[10px] text-white/40 mt-1.5 flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    {c.members} members
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Join Community with CMS ID Modal */}
      {selectedCommunity && (
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4 backdrop-blur-md" onClick={() => setSelectedCommunity(null)}>
          <div className="bg-[#121212] border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 relative" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedCommunity(null)} 
              className="absolute top-4 right-4 w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>

            {selectedCommunity.img && (
              <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 mx-auto mb-4">
                <img src={selectedCommunity.img} alt={selectedCommunity.title} className="w-full h-full object-cover" />
              </div>
            )}

            <h3 className="text-lg font-bold text-center mb-1">Join {selectedCommunity.title}</h3>
            <p className="text-xs text-white/50 text-center mb-6 leading-relaxed">
              Please enter your unique CMS ID below to activate your membership and enter this community.
            </p>

            <form onSubmit={handleJoinWithId}>
              <div className="mb-4">
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/60 block mb-2">Your CMS ID</label>
                <input 
                  type="text" 
                  value={cmsIdInput}
                  onChange={(e) => setCmsIdInput(e.target.value)}
                  placeholder="e.g. CMS/2026/100"
                  required
                  autoFocus
                  className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cms-yellow uppercase transition-colors"
                />
              </div>

              <button 
                type="submit" 
                disabled={isSubmittingJoin || !cmsIdInput.trim()}
                className="w-full bg-cms-yellow text-black font-bold py-3 rounded-xl active:scale-95 transition-transform disabled:opacity-50 text-sm shadow-lg shadow-cms-yellow/20"
              >
                {isSubmittingJoin ? "Joining..." : "Join Community"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Announcement Detail Modal */}
      {selectedAnnouncement && (
        <div 
          className="fixed inset-0 bg-black/85 z-[110] flex items-center justify-center p-4 backdrop-blur-md"
          onClick={() => setSelectedAnnouncement(null)}
        >
          <div 
            className="bg-[#141414] border border-cms-yellow/40 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 relative max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-cms-yellow text-black px-2.5 py-0.5 rounded-full">
                    {selectedAnnouncement.category || "Official Notice"}
                  </span>
                  <span className="text-xs text-white/50">
                    {selectedAnnouncement.authorRole || "Executive Memo"}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white leading-snug">
                  {selectedAnnouncement.title}
                </h3>
                {selectedAnnouncement.authorName && (
                  <p className="text-xs text-cms-yellow/80 mt-1">
                    Published by {selectedAnnouncement.authorName}
                  </p>
                )}
              </div>
              <button 
                onClick={() => setSelectedAnnouncement(null)} 
                className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
              {selectedAnnouncement.content}
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-[11px] text-white/40">
                {selectedAnnouncement.createdAt?.toDate ? selectedAnnouncement.createdAt.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""}
              </span>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="bg-cms-yellow text-black font-bold px-5 py-2 rounded-xl text-xs hover:bg-cms-yellow/90 active:scale-95 transition-all shadow-md shadow-cms-yellow/20"
              >
                Close Notice
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
