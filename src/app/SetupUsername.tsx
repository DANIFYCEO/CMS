"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";

export default function SetupUsername({ onComplete }: { onComplete: () => void }) {
  const { user, userData } = useAuth();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setError("");
    setLoading(true);

    try {
      const finalUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (finalUsername.length < 3) {
        setError("Username must be at least 3 characters.");
        setLoading(false);
        return;
      }

      // Check if taken
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", finalUsername));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        setError("Username is already taken.");
        setLoading(false);
        return;
      }

      // Save
      await updateDoc(doc(db, "users", user.uid), {
        username: finalUsername
      });

      // Reload auth context might be needed, but since we listen to onSnapshot in layout (if any), 
      // wait, AuthContext doesn't listen to doc changes automatically. 
      // It's okay, we can just call onComplete and let them refresh if needed, 
      // or we can update local state.
      onComplete();
    } catch (err: any) {
      setError(err.message || "Failed to save username.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111] p-8 rounded-2xl border border-white/10">
        <h1 className="text-2xl font-bold text-white mb-2 text-center">Complete Registration</h1>
        <p className="text-white/50 text-center mb-8 text-sm">You signed in with Google. Please choose a unique username to continue.</p>
        
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              required
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-cms-yellow transition-colors"
            />
          </div>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          
          <button 
            type="submit"
            disabled={loading || !username}
            className="w-full bg-cms-yellow text-black font-bold py-3.5 rounded-xl mt-4 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
