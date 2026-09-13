"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { canSendAnnouncements, canDeleteContent, ADMIN_ROLES_META, normalizeAdminRole } from "@/lib/adminRoles";

export default function AdminAnnouncementsPage() {
  const { user, userData } = useAuth();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tag, setTag] = useState("Official Notice");
  const [audience, setAudience] = useState("All Members");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const currentRole = normalizeAdminRole(userData?.role, userData?.isAdmin);
  const roleMeta = ADMIN_ROLES_META[currentRole];
  const canSend = canSendAnnouncements(userData?.role, userData?.isAdmin);
  const canDelete = canDeleteContent(userData?.role, userData?.isAdmin);

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Announcements snapshot error:", err);
    });
    return () => unsub();
  }, []);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError("Please fill in both the title and content.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await addDoc(collection(db, "announcements"), {
        title: title.trim(),
        content: content.trim(),
        tag: tag,
        audience: audience,
        authorName: userData?.displayName || user?.displayName || "CMS Executive",
        authorEmail: user?.email || "",
        authorRole: currentRole,
        authorTitle: userData?.adminTitle || roleMeta.title,
        createdAt: serverTimestamp(),
      });

      setSuccess("Official announcement broadcasted to members!");
      setTitle("");
      setContent("");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      console.error("Error broadcasting announcement:", err);
      setError(`Failed to post announcement: ${err?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (announcement: any) => {
    const isAuthor = announcement.authorEmail === user?.email;
    if (!canDelete && !isAuthor) {
      alert("Only the author or Super Admin can delete this announcement.");
      return;
    }

    if (!confirm(`Delete announcement "${announcement.title}"?`)) return;

    try {
      await deleteDoc(doc(db, "announcements", announcement.id));
    } catch (err) {
      console.error("Error deleting announcement:", err);
      alert("Failed to delete announcement.");
    }
  };

  if (!canSend) {
    return (
      <div className="p-8 text-center max-w-md mx-auto mt-8">
        <div className="w-12 h-12 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h3 className="text-base font-bold text-white mb-1">Restricted Access</h3>
        <p className="text-xs text-white/50 leading-relaxed">
          Announcements can only be published by CMS Executive Leadership.
        </p>
      </div>
    );
  }

  const getTagBadge = (t: string) => {
    switch (t) {
      case "Urgent": return "bg-rose-500/20 text-rose-300 border-rose-500/30";
      case "Event": return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case "Production": return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      default: return "bg-cms-yellow/20 text-cms-yellow border-cms-yellow/30";
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div className="mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <span>Official Announcements & Notices</span>
          <span className="text-xs bg-cms-yellow/10 text-cms-yellow border border-cms-yellow/30 px-2 py-0.5 rounded-full font-bold">
            {announcements.length} Published
          </span>
        </h2>
        <p className="text-xs text-white/60 mt-0.5">
          Broadcast official news, audition alerts, meeting notices, and updates to the CMS community.
        </p>
      </div>

      {/* ── Composer Form ── */}
      <div className="bg-[#121214] border border-white/10 rounded-2xl p-5 mb-8 shadow-xl">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-cms-yellow"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
          <span>Broadcast New Announcement</span>
        </h3>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-3 rounded-xl mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handlePost} className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-white/60 block mb-1.5">
              Announcement Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Official Cast Call: Auditions for 'THE EMPIRE' Season 2"
              required
              className="w-full bg-[#18181b] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-cms-yellow"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                Category Tag
              </label>
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="w-full bg-[#18181b] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cms-yellow cursor-pointer"
              >
                <option value="Official Notice">Official Notice</option>
                <option value="Event">Event & Audition</option>
                <option value="Production">Production Update</option>
                <option value="Urgent">Urgent Alert</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                Target Audience
              </label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full bg-[#18181b] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cms-yellow cursor-pointer"
              >
                <option value="All Members">All Members & Public</option>
                <option value="Verified Members Only">Verified CMS Members Only</option>
                <option value="Cast & Crew">Cast, Directors & Crew</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-white/60 block mb-1.5">
              Announcement Message
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write the full announcement message here..."
              rows={4}
              required
              className="w-full bg-[#18181b] border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-cms-yellow leading-relaxed resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-[11px] text-white/50 flex items-center gap-1.5">
              <span>Publishing as:</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleMeta.badgeClass}`}>
                {userData?.adminTitle || roleMeta.title}
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || !title.trim() || !content.trim()}
              className="bg-cms-yellow text-black text-xs font-bold px-5 py-2.5 rounded-full active:scale-95 transition-transform disabled:opacity-40 shadow-md shadow-cms-yellow/20"
            >
              {loading ? "Publishing..." : "Publish Announcement"}
            </button>
          </div>
        </form>
      </div>

      {/* ── Published Feed ── */}
      <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-4">
        Broadcast History ({announcements.length})
      </h3>

      {announcements.length === 0 ? (
        <div className="bg-[#121214] border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-xs text-white/40">No announcements published yet. Fill out the form above to broadcast your first message!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {announcements.map((a) => {
            const isAuthor = a.authorEmail === user?.email;
            return (
              <div key={a.id} className="bg-[#121214] border border-white/10 rounded-2xl p-4 sm:p-5 relative group">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getTagBadge(a.tag)}`}>
                      {a.tag}
                    </span>
                    <span className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
                      {a.audience}
                    </span>
                  </div>

                  {(canDelete || isAuthor) && (
                    <button
                      onClick={() => handleDelete(a)}
                      className="text-white/30 hover:text-rose-400 text-xs p-1 transition-colors"
                      title="Delete announcement"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  )}
                </div>

                <h4 className="text-sm sm:text-base font-bold text-white mb-2">{a.title}</h4>
                <p className="text-xs text-white/75 leading-relaxed whitespace-pre-line mb-4 bg-black/30 p-3 rounded-xl border border-white/5">
                  {a.content}
                </p>

                <div className="flex items-center justify-between text-[10px] text-white/40 pt-2 border-t border-white/5">
                  <span>
                    By <strong className="text-white/80">{a.authorName}</strong> ({a.authorTitle || a.authorRole})
                  </span>
                  <span>
                    {a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Recent"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
