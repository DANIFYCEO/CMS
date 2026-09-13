"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

export default function MembershipDashboardPage() {
  const router = useRouter();
  const { user, userData } = useAuth();
  const [fullName, setFullName] = useState("");
  const [cmsId, setCmsId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [migratedId, setMigratedId] = useState<string | null>(null);

  const hasMembership = userData?.membership && userData.membership !== "free";

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setError("");
    setLoading(true);

    try {
      // Query offline_members collection
      const membersRef = collection(db, "offline_members");
      const q = query(
        membersRef, 
        where("fullName", "==", fullName.trim()),
        where("cmsId", "==", cmsId.trim())
      );
      
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setError("You are not registered in our offline database. Please check your details or register online.");
        setLoading(false);
        return;
      }

      const offlineDocRef = snap.docs[0];
      const offlineDoc = offlineDocRef.data();
      const tier = offlineDoc.tier || "cms-member";
      
      if (offlineDoc.migrated) {
        setError("This CMS ID has already been migrated and connected to an account.");
        setLoading(false);
        return;
      }

      // Generate a new secure CMS ID if it's the old format (ends in 3 digits) or just generate one anyway
      const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
      const newCmsId = `CMS/${new Date().getFullYear()}/${randomPart}`;
      
      // Update the user account to include the tier and the new ID
      await updateDoc(doc(db, "users", user.uid), {
        membership: tier,
        cmsId: newCmsId
      });

      // Update the offline member document so it can't be used again
      await updateDoc(doc(db, "offline_members", offlineDocRef.id), {
        migrated: true,
        newCmsId: newCmsId,
        claimedBy: user.uid
      });

      // Send the email with the new ID via our API route
      await fetch('/api/send-id-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: offlineDoc.email || user.email,
          newId: newCmsId,
          name: offlineDoc.fullName
        })
      });
      
      setMigratedId(newCmsId);

    } catch (err) {
      console.error(err);
      setError("An error occurred during verification.");
    } finally {
      setLoading(false);
    }
  };

  if (migratedId) {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-[#0A0A0A] text-white pb-safe overflow-y-auto">
        <header className="flex items-center gap-4 px-4 py-5 border-b border-white/5 sticky top-0 bg-[#0A0A0A]/90 backdrop-blur-md z-50">
          <button onClick={() => router.push("/profile")} className="p-1 -ml-1 text-white hover:text-cms-yellow transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <h1 className="text-[15px] font-bold tracking-wide uppercase">Membership Verified</h1>
        </header>

        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center mb-6">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-4">Membership Linked!</h2>
          <p className="text-white/70 mb-6 max-w-sm">
            For security purposes, we have generated a new, randomized CMS ID for you. Your old generic ID is no longer active.
          </p>
          
          <div className="bg-[#111] border border-cms-yellow/50 p-5 rounded-xl mb-6 w-full max-w-sm">
            <p className="text-xs text-white/50 uppercase tracking-wider font-bold mb-1">Your New CMS ID</p>
            <p className="text-2xl font-black text-cms-yellow tracking-widest">{migratedId}</p>
          </div>

          <p className="text-sm text-white/50 mb-8 max-w-sm">
            We've also sent this new ID to your email address for safekeeping. Please use it for any future offline membership verifications.
          </p>

          <button 
            onClick={() => router.push("/profile")}
            className="w-full max-w-sm bg-cms-yellow text-black font-bold py-3.5 rounded-xl active:scale-95 transition-transform"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0A0A0A] text-white pb-safe overflow-y-auto">
      <header className="flex items-center gap-4 px-4 py-5 border-b border-white/5 sticky top-0 bg-[#0A0A0A]/90 backdrop-blur-md z-50">
        <button onClick={() => router.push("/profile")} className="p-1 -ml-1 text-white hover:text-cms-yellow transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 className="text-[15px] font-bold tracking-wide uppercase">Membership</h1>
      </header>

      <div className="p-4 flex flex-col flex-1">
        {hasMembership ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-24 h-24 rounded-full bg-cms-yellow/10 flex items-center justify-center text-cms-yellow mb-6">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {userData.membership === "elite-member" ? (
                  <><path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></>
                ) : userData.membership === "premium-member" ? (
                  <><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></>
                ) : (
                  <><path d="M2 4h20M2 20h20M9 4v16M15 4v16"/><path d="M2 16l4-12 6 8 6-8 4 12z"/></>
                )}
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">Active Member</h2>
            <p className="text-white/60 mb-6 max-w-xs mx-auto">Your membership is currently active. Enjoy your exclusive CMS benefits!</p>
            <div className="px-4 py-2 border border-cms-yellow text-cms-yellow rounded-full font-bold uppercase text-xs tracking-wider mb-6">
              {userData.membership?.replace("-", " ") || "Member"}
            </div>
            {userData.cmsId && (
              <div className="bg-[#111] border border-white/10 px-4 py-3 rounded-lg flex items-center gap-3">
                <span className="text-white/40 text-xs uppercase font-bold">CMS ID</span>
                <span className="font-mono text-sm tracking-widest">{userData.cmsId}</span>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="mb-8 mt-4">
              <h2 className="text-xl font-bold mb-2">Verify Offline Payment</h2>
              <p className="text-sm text-white/60 leading-relaxed">If you have already paid off the site, please enter your details to verify your membership and activate your badge.</p>
            </div>

            <form onSubmit={handleVerify} className="flex flex-col gap-5">
              <div>
                <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">Full Name</label>
                <input 
                  type="text" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  required
                  className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-cms-yellow transition-colors"
                />
              </div>

              <div>
                <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">CMS Registration ID</label>
                <input 
                  type="text" 
                  value={cmsId}
                  onChange={(e) => setCmsId(e.target.value)}
                  placeholder="Enter your old generic CMS ID"
                  required
                  className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-cms-yellow transition-colors"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-cms-yellow text-black font-bold py-3.5 rounded-xl active:scale-95 transition-transform disabled:opacity-50 mt-2"
              >
                {loading ? "Verifying..." : "Verify Membership"}
              </button>
            </form>

            <div className="mt-12 pt-8 border-t border-white/10 text-center">
              <h3 className="font-bold mb-2">Haven't registered yet?</h3>
              <p className="text-sm text-white/50 mb-6">Get full access to the CMS community, resources, and updates.</p>
              
              <Link 
                href="/profile/membership/register"
                className="block w-full bg-[#111] border border-white/20 text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all hover:border-white/40"
              >
                Register Online
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

