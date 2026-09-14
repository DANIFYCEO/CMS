"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { canManageMembers, canSuspendMembers } from "@/lib/adminRoles";

export default function AdminMembersPage() {
  const { userData } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const canAccess = canManageMembers(userData?.role, userData?.isAdmin);
  const canSuspend = canSuspendMembers(userData?.role, userData?.isAdmin);

  useEffect(() => {
    if (!db) return;

    const usersRef = collection(db, "users");
    const unsub = onSnapshot(usersRef, (snapshot) => {
      const userList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      userList.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeB - timeA;
      });
      setMembers(userList);
      setLoading(false);
    }, (err) => {
      console.error("Error loading members:", err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleToggleSuspend = async (member: any) => {
    if (!canSuspend) {
      alert("Only the President and Vice President can suspend or reactivate members.");
      return;
    }

    const isSuspended = member.isSuspended === true;
    const action = isSuspended ? "reactivate" : "suspend";
    if (!confirm(`Are you sure you want to ${action} ${member.displayName || member.email}?`)) {
      return;
    }

    setActionLoadingId(member.id);
    try {
      await updateDoc(doc(db, "users", member.id), {
        isSuspended: !isSuspended,
        suspendedAt: !isSuspended ? new Date() : null,
        suspendedBy: !isSuspended ? userData?.displayName || "Admin" : null
      });
    } catch (err) {
      console.error("Error updating suspension:", err);
      alert(`Failed to ${action} member.`);
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!canAccess) {
    return (
      <div className="p-8 text-center max-w-md mx-auto mt-8">
        <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h3 className="text-base font-bold text-white mb-1">Restricted Directory</h3>
        <p className="text-xs text-white/50 leading-relaxed">
          Member directory and registration records are accessible to the President, Vice President, and Secretary.
        </p>
      </div>
    );
  }

  const filteredMembers = members.filter(m => {
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = !q || (
      (m.displayName || "").toLowerCase().includes(q) ||
      (m.email || "").toLowerCase().includes(q) ||
      (m.cmsId || "").toLowerCase().includes(q) ||
      (m.username || "").toLowerCase().includes(q) ||
      (m.university || "").toLowerCase().includes(q) ||
      (m.registrationForm?.creativeDepartments || []).some((dept: string) => dept.toLowerCase().includes(q))
    );

    const memberTier = m.membership || "free";
    const matchesTier = selectedTier === "all" || memberTier === selectedTier;

    return matchesQuery && matchesTier;
  });

  const getTierBadge = (tier?: string, role?: string, isAdmin?: boolean) => {
    if (isAdmin || (role && role !== "member")) return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">Executive</span>;
    if (tier === "elite-member") return <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">Elite</span>;
    if (tier === "premium-member") return <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">Premium</span>;
    if (tier === "cms-member" || tier === "CMS Member") return <span className="bg-cms-yellow/20 text-cms-yellow border border-cms-yellow/30 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">Member</span>;
    return <span className="bg-white/10 text-white/50 border border-white/10 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">Free</span>;
  };

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span>Member Directory & Registrations</span>
            <span className="text-xs bg-cms-yellow/10 text-cms-yellow border border-cms-yellow/30 px-2 py-0.5 rounded-full font-bold">
              {members.length} Registered
            </span>
          </h2>
          <p className="text-xs text-white/60 mt-0.5">
            View registered creatives, monitor membership levels, and manage records.
          </p>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-5">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, CMS ID, department..."
            className="w-full bg-[#141416] border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-cms-yellow transition-colors"
          />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
        </div>

        {/* Tier Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-[#141416] p-1 rounded-2xl border border-white/10 shrink-0">
          {[
            { id: "all", label: "All" },
            { id: "cms-member", label: "Members" },
            { id: "premium-member", label: "Premium" },
            { id: "elite-member", label: "Elite" },
            { id: "free", label: "Free" },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTier(t.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedTier === t.id 
                  ? "bg-cms-yellow text-black shadow-sm" 
                  : "text-white/60 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Member Table / Cards ── */}
      {loading ? (
        <div className="p-12 flex justify-center">
          <div className="w-8 h-8 border-3 border-cms-yellow border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="bg-[#121214] border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-white/50 text-xs">No members found matching your search criteria.</p>
        </div>
      ) : (
        <div className="bg-[#121214] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-white/50 text-[10px] uppercase font-bold tracking-wider">
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">CMS ID</th>
                  <th className="py-3 px-4">Tier</th>
                  <th className="py-3 px-4">Departments</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredMembers.map(m => {
                  const depts = m.registrationForm?.creativeDepartments || [];
                  const isSuspended = m.isSuspended === true;

                  return (
                    <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Member info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#202020] border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                            {m.photoURL ? (
                              <img src={m.photoURL} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-bold text-white/60">
                                {(m.displayName || m.email || "?").charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate max-w-[140px] sm:max-w-[180px]">
                              {m.displayName || "CMS Member"}
                            </p>
                            <p className="text-[11px] text-white/40 truncate max-w-[140px] sm:max-w-[180px]">
                              {m.email}
                            </p>
                            {m.university && (
                              <p className="text-[10px] text-cms-yellow/90 truncate max-w-[140px] sm:max-w-[180px] flex items-center gap-1 mt-0.5">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                                <span>{m.university}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* CMS ID */}
                      <td className="py-3 px-4 font-mono font-bold text-cms-yellow">
                        {m.cmsId || <span className="text-white/20 font-normal">None</span>}
                      </td>

                      {/* Membership Tier */}
                      <td className="py-3 px-4">
                        {getTierBadge(m.membership, m.role, m.isAdmin)}
                      </td>

                      {/* Creative Departments */}
                      <td className="py-3 px-4">
                        {depts.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {depts.slice(0, 2).map((d: string, idx: number) => (
                              <span key={idx} className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[10px] text-white/70">
                                {d}
                              </span>
                            ))}
                            {depts.length > 2 && (
                              <span className="text-[10px] text-white/40">+{depts.length - 2}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-white/20">Not set</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {isSuspended ? (
                          <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">
                            Suspended
                          </span>
                        ) : (
                          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">
                            Active
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedMember(m)}
                            className="bg-white/5 hover:bg-white/10 text-white/70 hover:text-white px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
                          >
                            Details
                          </button>

                          {canSuspend && (
                            <button
                              onClick={() => handleToggleSuspend(m)}
                              disabled={actionLoadingId === m.id}
                              className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                isSuspended 
                                  ? "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20" 
                                  : "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                              }`}
                            >
                              {actionLoadingId === m.id ? "..." : isSuspended ? "Reactivate" : "Suspend"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Member Details Modal ── */}
      {selectedMember && (
        <div 
          className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4 backdrop-blur-md"
          onClick={() => setSelectedMember(null)}
        >
          <div 
            className="bg-[#121214] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 relative"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <h3 className="font-bold text-base text-white">Member Profile Details</h3>
              <button 
                onClick={() => setSelectedMember(null)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="flex items-center gap-3.5 mb-5">
              <div className="w-14 h-14 rounded-full bg-[#202020] border-2 border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                {selectedMember.photoURL ? (
                  <img src={selectedMember.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-white/60">
                    {(selectedMember.displayName || selectedMember.email || "?").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <h4 className="font-bold text-base text-white">{selectedMember.displayName || "CMS Member"}</h4>
                <p className="text-xs text-white/50">{selectedMember.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  {getTierBadge(selectedMember.membership, selectedMember.role, selectedMember.isAdmin)}
                  {selectedMember.cmsId && (
                    <span className="text-xs font-mono font-bold text-cms-yellow bg-cms-yellow/10 px-2 py-0.5 rounded-full border border-cms-yellow/20">
                      {selectedMember.cmsId}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3 bg-black/40 p-4 rounded-2xl border border-white/5 text-xs mb-5">
              <div>
                <p className="text-[10px] uppercase font-bold text-white/40">Username</p>
                <p className="text-white font-medium">{selectedMember.username ? `@${selectedMember.username}` : "Not set"}</p>
              </div>

              <div>
                <p className="text-[10px] uppercase font-bold text-white/40">Creative Departments</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {(selectedMember.registrationForm?.creativeDepartments || []).length > 0 ? (
                    selectedMember.registrationForm.creativeDepartments.map((dept: string, i: number) => (
                      <span key={i} className="bg-white/10 text-white/90 px-2 py-0.5 rounded-md text-[11px]">
                        {dept}
                      </span>
                    ))
                  ) : (
                    <p className="text-white/40 italic">No department selected</p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase font-bold text-white/40">Bio</p>
                <p className="text-white/80 leading-relaxed">{selectedMember.bio || "No bio written yet."}</p>
              </div>

              <div>
                <p className="text-[10px] uppercase font-bold text-white/40">Account Status</p>
                <p className={selectedMember.isSuspended ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                  {selectedMember.isSuspended ? "Account Suspended" : "Account Active"}
                </p>
              </div>
            </div>

            {canSuspend && (
              <button
                onClick={() => {
                  handleToggleSuspend(selectedMember);
                  setSelectedMember((prev: any) => prev ? { ...prev, isSuspended: !prev.isSuspended } : null);
                }}
                className={`w-full py-2.5 rounded-xl font-bold text-xs transition-colors ${
                  selectedMember.isSuspended 
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" 
                    : "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                }`}
              >
                {selectedMember.isSuspended ? "Reactivate Member Account" : "Suspend Member Account"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
