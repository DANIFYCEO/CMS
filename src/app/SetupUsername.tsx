"use client";

import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import UniversitySelect from "@/components/UniversitySelect";

export default function SetupUsername({ onComplete }: { onComplete: () => void }) {
  const { user, userData } = useAuth();
  
  // Suggest a default username based on email or displayName if available
  const initialUsername = userData?.username || (user?.email ? user.email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "") : "");
  const [username, setUsername] = useState(initialUsername);
  const [selectedUni, setSelectedUni] = useState(userData?.university || "");
  const [customUni, setCustomUni] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isCustomUni = selectedUni === "Other / Custom Institution";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setError("");
    const finalUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    
    if (finalUsername.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }

    const finalUniversity = isCustomUni ? customUni.trim() : selectedUni.trim();
    if (!finalUniversity) {
      setError("Please select or enter your university/institution.");
      return;
    }

    setLoading(true);

    try {
      // Check if username is already taken by someone else
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", finalUsername));
      const snap = await getDocs(q);
      
      const takenByOther = snap.docs.some(d => d.id !== user.uid);
      if (takenByOther) {
        setError("This username is already taken. Please choose another.");
        setLoading(false);
        return;
      }

      // Save username and university
      await updateDoc(doc(db, "users", user.uid), {
        username: finalUsername,
        university: finalUniversity
      });

      onComplete();
    } catch (err: any) {
      setError(err?.message || "Failed to complete setup.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111] p-8 rounded-2xl border border-white/10 shadow-2xl">
        <div className="flex justify-center mb-6">
          <Image 
            src="/logo_original.jpg" 
            alt="CMS Logo" 
            width={120} 
            height={60}
            priority
            className="w-24 h-auto object-contain mix-blend-screen"
          />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2 text-center">Complete Your Profile</h1>
        <p className="text-white/50 text-center mb-6 text-xs">
          Welcome to CMS! Choose your unique handle and attribute your university campus to get started.
        </p>
        
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-white/80 mb-1.5 uppercase tracking-wider">
              Choose Username
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><path d="M12 8v2"/></svg>
              </span>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s+/g, '').toLowerCase())}
                placeholder="e.g. creative_dan"
                required
                className="w-full bg-black border border-white/15 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cms-yellow transition-colors"
              />
            </div>
            <p className="text-[11px] text-white/40 mt-1">At least 3 letters, numbers, or underscores.</p>
          </div>

          {/* University Selection with Instant Search */}
          <UniversitySelect
            value={selectedUni}
            onChange={setSelectedUni}
            customValue={customUni}
            onCustomChange={setCustomUni}
            required={true}
          />

          {error && <p className="text-red-400 text-xs text-center mt-1">{error}</p>}
          
          <button 
            type="submit"
            disabled={loading || !username || (!selectedUni && !customUni)}
            className="w-full bg-cms-yellow text-black font-bold py-3.5 rounded-xl mt-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {loading ? "Saving Profile..." : "Continue to CMS"}
          </button>
        </form>
      </div>
    </div>
  );
}
