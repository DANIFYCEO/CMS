"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import UniversitySelect from "@/components/UniversitySelect";
import { NIGERIAN_UNIVERSITIES } from "@/lib/universities";

export default function EditProfilePage() {
  const { user, userData } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [university, setUniversity] = useState("");
  const [customUniversity, setCustomUniversity] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userData) {
      setDisplayName(userData.displayName || "");
      setUsername(userData.username || "");
      setAvatarPreview(userData.photoURL || "");
      if (userData.university) {
        if (NIGERIAN_UNIVERSITIES.includes(userData.university)) {
          setUniversity(userData.university);
        } else {
          setUniversity("Other / Custom Institution");
          setCustomUniversity(userData.university);
        }
      }
    }
  }, [userData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 256;
          const MAX_HEIGHT = 256;
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions while maintaining aspect ratio
          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height *= MAX_WIDTH / width));
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width *= MAX_HEIGHT / height));
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          // Compress to base64 JPEG at 70% quality (usually ~10-30kb)
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          setAvatarPreview(dataUrl);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // 1. Check if username is taken (if changed)
      let finalUsername = username.trim().toLowerCase();
      if (finalUsername !== userData?.username?.toLowerCase()) {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", finalUsername));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setError("Username is already taken.");
          setLoading(false);
          return;
        }
      }

      // 2. Update Firestore with base64 avatar directly in the DB
      const finalUni = university === "Other / Custom Institution" ? customUniversity.trim() : university.trim();
      await setDoc(doc(db, "users", user.uid), {
        displayName: displayName.trim(),
        username: finalUsername,
        university: finalUni,
        photoURL: avatarPreview,
      }, { merge: true });

      setSuccess("Profile updated successfully!");
      
      // Auto redirect after a short delay
      setTimeout(() => {
        router.push("/profile");
      }, 1500);

    } catch (err: any) {
      console.error("Failed to update profile", err);
      setError(err.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-black text-white pb-safe overflow-y-auto">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-5 border-b border-white/5 sticky top-0 bg-black/90 backdrop-blur-md z-50">
        <button onClick={() => router.back()} className="p-1 -ml-1 text-white hover:text-cms-yellow">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 className="text-[15px] font-bold tracking-wide uppercase">Edit Profile</h1>
      </header>

      <form onSubmit={handleSave} className="p-6 flex flex-col gap-8 max-w-md mx-auto w-full">
        
        {/* Avatar Upload (Base64) */}
        <div className="flex flex-col items-center gap-4">
          <div 
            className="w-24 h-24 rounded-full bg-[#1A1A1A] border-2 border-white/20 relative shrink-0 flex items-center justify-center overflow-hidden cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/40"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            )}
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            </div>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
          <span className="text-sm text-cms-yellow font-medium cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            Change Picture
          </span>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">Display Name</label>
            <input 
              type="text" 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-cms-yellow transition-colors"
            />
          </div>

          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s+/g, '').toLowerCase())}
              required
              className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-cms-yellow transition-colors"
            />
          </div>

          {/* University Selection with Instant Search */}
          <UniversitySelect
            value={university}
            onChange={setUniversity}
            customValue={customUniversity}
            onCustomChange={setCustomUniversity}
            required={false}
          />
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        {success && <p className="text-green-400 text-sm text-center">{success}</p>}

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-cms-yellow text-black font-bold py-3.5 rounded-xl active:scale-95 transition-transform disabled:opacity-50 mt-4"
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
