"use client";

import { useState, useEffect, useRef } from "react";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, deleteDoc, getDocs, where } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { canUploadContent, canDeleteContent } from "@/lib/adminRoles";

export default function AdminShortsPage() {
  const { userData } = useAuth();
  const [mediaTypeChoice, setMediaTypeChoice] = useState<"video" | "image">("video");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploads, setUploads] = useState<any[]>([]);

  const canUpload = canUploadContent(userData?.role, userData?.isAdmin);
  const canDelete = canDeleteContent(userData?.role, userData?.isAdmin);

  useEffect(() => {
    const q = query(collection(db, "shorts"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setUploads(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Handle media file selection with preview
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    if (file) {
      setMediaFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError("");
    } else {
      setMediaFile(null);
      setPreviewUrl(null);
    }
  };

  const handleTypeSwitch = (type: "video" | "image") => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setMediaTypeChoice(type);
    setMediaFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDeleteShort = async (shortId: string, shortTitle: string, videoId?: string) => {
    if (!canDelete) {
      alert("Only Super Admins can delete media from the feed.");
      return;
    }
    if (!confirm(`Are you sure you want to delete "${shortTitle}"?`)) return;

    try {
      // Delete from shorts collection
      await deleteDoc(doc(db, "shorts", shortId));

      // Also delete from videos collection if mirrored
      if (videoId) {
        const qV = query(collection(db, "videos"), where("videoId", "==", videoId));
        const snap = await getDocs(qV);
        snap.forEach(async (d) => {
          await deleteDoc(doc(db, "videos", d.id));
        });
      }
    } catch (err) {
      console.error("Error deleting short:", err);
      alert("Failed to delete media.");
    }
  };

  const handleAddMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaFile) {
      setError(`Please select a ${mediaTypeChoice === "video" ? "video" : "picture"} file first.`);
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    setProgress(0);

    try {
      const isVideo = mediaTypeChoice === "video" || mediaFile.type.startsWith("video/");
      const fileExt = mediaFile.name.split('.').pop() || (isVideo ? "mp4" : "jpg");
      const videoId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const fileName = `media/${videoId}.${fileExt}`;
      const storageRef = ref(storage, fileName);
      
      const uploadTask = uploadBytesResumable(storageRef, mediaFile);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(p);
        }, 
        (error) => {
          console.error(error);
          setError("Upload failed. Please check your network connection and storage rules.");
          setLoading(false);
        }, 
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const nowIso = new Date().toISOString();
          
          // 1. Save to shorts collection
          await addDoc(collection(db, "shorts"), {
            id: videoId,
            videoId: videoId,
            videoUrl: downloadURL,
            mediaType: isVideo ? "video" : "image",
            title: title.trim() || (isVideo ? "CMS Short Video" : "CMS Post"),
            thumbnailUrl: "",
            publishedAt: nowIso,
            createdAt: serverTimestamp(),
            views: 0,
            likes: 0,
            comments: 0
          });

          // 2. Also mirror to videos collection so it appears on home feed and shorts player
          await addDoc(collection(db, "videos"), {
            videoId: videoId,
            videoUrl: downloadURL,
            mediaType: isVideo ? "video" : "image",
            title: title.trim() || (isVideo ? "CMS Short Video" : "CMS Post"),
            category: isVideo ? "shorts" : "posts",
            thumbnailUrl: isVideo ? "" : downloadURL,
            publishedAt: nowIso,
            createdAt: serverTimestamp(),
            views: 0,
            likes: 0,
            comments: 0
          });

          setSuccess(`Successfully uploaded ${isVideo ? "Video Short" : "Picture Post"}!`);
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setMediaFile(null);
          setPreviewUrl(null);
          setTitle("");
          setLoading(false);
          setProgress(0);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      );
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to upload media");
      setLoading(false);
    }
  };

  if (!canUpload) {
    return (
      <div className="p-8 text-center max-w-md mx-auto mt-8">
        <div className="w-12 h-12 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h3 className="text-base font-bold text-white mb-1">Restricted Access</h3>
        <p className="text-xs text-white/50 leading-relaxed">
          Shorts and media publishing is restricted to the Content Admin, Vice President, and Super Admins.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 pb-20">
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-1">Upload Media & Shorts</h2>
        <p className="text-sm text-white/60">Upload vertical video shorts or pictures directly to the CMS feed.</p>
      </div>

      <form onSubmit={handleAddMedia} className="bg-[#111] border border-white/10 rounded-2xl p-5 mb-8 shadow-xl">
        {success && <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-3 rounded-xl text-sm mb-5 font-medium">{success}</div>}
        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm mb-5 font-medium">{error}</div>}

        {/* Media Type Selector */}
        <div className="mb-5">
          <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">Choose Media Type</label>
          <div className="grid grid-cols-2 gap-2 bg-[#1A1A1A] p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => handleTypeSwitch("video")}
              className={`py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                mediaTypeChoice === "video" 
                  ? "bg-cms-yellow text-black shadow-md" 
                  : "text-white/60 hover:text-white"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              📹 Video Short
            </button>
            <button
              type="button"
              onClick={() => handleTypeSwitch("image")}
              className={`py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                mediaTypeChoice === "image" 
                  ? "bg-cms-yellow text-black shadow-md" 
                  : "text-white/60 hover:text-white"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
              🖼️ Picture / Photo
            </button>
          </div>
          <p className="text-[11px] text-white/40 mt-1.5">
            {mediaTypeChoice === "video" 
              ? "Selecting 'Video Short' opens your video library (MP4, MOV, WebM). Only videos will be shown." 
              : "Selecting 'Picture / Photo' opens your image gallery (JPG, PNG, WebP)."}
          </p>
        </div>

        {/* File Picker */}
        <div className="mb-5">
          <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">
            Select {mediaTypeChoice === "video" ? "Video File (MP4, MOV, WebM)" : "Photo File (JPG, PNG, WebP)"}
          </label>
          <input 
            ref={fileInputRef}
            type="file" 
            accept={mediaTypeChoice === "video" ? "video/mp4,video/webm,video/quicktime,video/*" : "image/jpeg,image/png,image/webp,image/*"}
            onChange={handleFileChange}
            required
            className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-cms-yellow transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-cms-yellow/10 file:text-cms-yellow hover:file:bg-cms-yellow/20"
          />
        </div>

        {/* Live File Preview */}
        {previewUrl && mediaFile && (
          <div className="mb-5 p-3.5 bg-[#161616] border border-cms-yellow/30 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-cms-yellow uppercase tracking-wider">Preview Selected Media</span>
              <span className="text-[11px] text-white/50">{(mediaFile.size / (1024 * 1024)).toFixed(2)} MB</span>
            </div>
            {mediaTypeChoice === "video" ? (
              <video 
                src={previewUrl} 
                controls 
                className="w-full max-h-64 object-contain rounded-lg bg-black border border-white/10" 
              />
            ) : (
              <img 
                src={previewUrl} 
                alt="Preview" 
                className="w-full max-h-64 object-contain rounded-lg bg-black border border-white/10" 
              />
            )}
            <p className="text-[11px] text-white/60 mt-2 truncate">File: {mediaFile.name}</p>
          </div>
        )}

        <div className="mb-6">
          <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">Caption / Title</label>
          <input 
            type="text" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={mediaTypeChoice === "video" ? "e.g. Behind the scenes reel" : "e.g. Cast photoshoot on set"}
            required
            className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-cms-yellow transition-colors text-sm"
          />
        </div>
        
        {loading && progress > 0 && (
          <div className="mb-6">
            <div className="flex justify-between text-xs font-bold mb-2 text-white/70">
              <span>Uploading...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div className="bg-cms-yellow h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading || !mediaFile} 
          className="w-full bg-cms-yellow text-black font-bold py-3.5 rounded-xl active:scale-95 transition-transform disabled:opacity-50 text-sm shadow-lg shadow-cms-yellow/20"
        >
          {loading ? "Uploading to Feed..." : "Upload to Feed"}
        </button>
      </form>

      {/* Metrics Section */}
      <h3 className="font-bold mb-4 uppercase tracking-wider text-sm text-white/50">Media Metrics & Moderation</h3>
      <div className="flex flex-col gap-3">
        {uploads.map((item) => (
          <div key={item.id} className="bg-[#111] border border-white/10 rounded-xl p-4 flex gap-4 items-center">
            <div className="w-16 h-16 bg-black rounded-lg border border-white/10 overflow-hidden shrink-0 flex items-center justify-center relative">
              {item.mediaType === "image" ? (
                <img src={item.videoUrl} alt="Thumbnail" className="w-full h-full object-cover" />
              ) : (
                <video src={item.videoUrl} className="w-full h-full object-cover" />
              )}
              {item.mediaType === "video" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-bold uppercase tracking-wider bg-white/10 text-white/80 px-2 py-0.5 rounded">
                  {item.mediaType === "image" ? "Photo" : "Video"}
                </span>
                <h4 className="font-bold text-sm truncate">{item.title}</h4>
              </div>
              <p className="text-[10px] text-white/40">
                Uploaded {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : ""}
              </p>
              
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-cms-yellow">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  {item.views || 0}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  {item.likes || 0}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                  {item.comments || 0}
                </div>
              </div>
            </div>

            {canDelete && (
              <button
                onClick={() => handleDeleteShort(item.id, item.title, item.videoId)}
                className="text-white/30 hover:text-rose-400 p-2 transition-colors rounded-lg hover:bg-rose-500/10 shrink-0"
                title="Delete media"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            )}
          </div>
        ))}
        {uploads.length === 0 && (
          <p className="text-sm text-white/50">No media uploaded yet.</p>
        )}
      </div>
    </div>
  );
}
