"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { canUploadGallery, canDeleteContent } from "@/lib/adminRoles";

export default function AdminGalleryPage() {
  const { user, userData } = useAuth();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Set Photos");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [photos, setPhotos] = useState<any[]>([]);

  const canUpload = canUploadGallery(userData?.role, userData?.isAdmin);
  const canDelete = canDeleteContent(userData?.role, userData?.isAdmin);

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "gallery_photos"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setPhotos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Gallery photos snapshot error:", err);
    });
    return () => unsub();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) {
      setError("Please select an image file to upload.");
      return;
    }

    if (!title.trim()) {
      setError("Please provide a title or caption for this photo.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    setProgress(0);

    try {
      const fileExt = imageFile.name.split('.').pop() || "jpg";
      const fileName = `gallery/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const storageRef = ref(storage, fileName);

      const uploadTask = uploadBytesResumable(storageRef, imageFile);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(p);
        },
        (err) => {
          console.error(err);
          setError("Upload failed. Please check your network and storage limits.");
          setLoading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          await addDoc(collection(db, "gallery_photos"), {
            imageUrl: downloadURL,
            title: title.trim(),
            category: category,
            uploadedBy: userData?.displayName || user?.displayName || "Content Admin",
            uploaderEmail: user?.email || "",
            uploaderRole: userData?.role || "content_admin",
            createdAt: serverTimestamp(),
            views: 0,
            likes: 0
          });

          setSuccess("Photo published to Official Gallery successfully!");
          setImageFile(null);
          setTitle("");
          setProgress(0);
          setLoading(false);
        }
      );
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(`Failed to save gallery photo: ${err?.message || "Unknown error"}`);
      setLoading(false);
    }
  };

  const handleDeletePhoto = async (photo: any) => {
    const isOwner = photo.uploaderEmail === user?.email;
    if (!canDelete && !isOwner) {
      alert("Only Super Admins can delete gallery photos.");
      return;
    }

    if (!confirm(`Delete "${photo.title}" from the gallery?`)) return;

    try {
      await deleteDoc(doc(db, "gallery_photos", photo.id));
    } catch (err) {
      console.error("Error deleting photo:", err);
      alert("Failed to delete photo.");
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
          Gallery photo management is accessible to Social Media Managers, Content Admins, and Super Admins.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div className="mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <span>Gallery Photo Management</span>
          <span className="text-xs bg-cms-yellow/10 text-cms-yellow border border-cms-yellow/30 px-2 py-0.5 rounded-full font-bold">
            {photos.length} Photos Live
          </span>
        </h2>
        <p className="text-xs text-white/60 mt-0.5">
          Upload set photos, behind-the-scenes moments, and official production stills for the CMS Gallery.
        </p>
      </div>

      {/* ── Upload Form ── */}
      <div className="bg-[#121214] border border-white/10 rounded-2xl p-5 mb-8 shadow-xl">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-cms-yellow"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span>Publish New Photo to Gallery</span>
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

        <form onSubmit={handleUpload} className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-white/60 block mb-1.5">
              Photo Caption / Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. On set of THE EMPIRE — Scene 14 Breakdown"
              required
              className="w-full bg-[#18181b] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-cms-yellow"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-white/60 block mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-[#18181b] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cms-yellow cursor-pointer"
            >
              <option value="Set Photos">Set Photos</option>
              <option value="Behind the Scenes">Behind the Scenes (BTS)</option>
              <option value="Production Stills">Production Stills</option>
              <option value="Cast & Crew">Cast & Crew</option>
              <option value="Events & Premieres">Events & Premieres</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-white/60 block mb-1.5">
              Image File
            </label>
            <div className="border border-dashed border-white/20 rounded-xl p-4 bg-[#18181b] text-center">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="hidden"
                id="gallery-file-input"
              />
              <label htmlFor="gallery-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                {imageFile ? (
                  <div className="flex items-center gap-3">
                    <img 
                      src={URL.createObjectURL(imageFile)} 
                      alt="Preview" 
                      className="w-16 h-16 object-cover rounded-lg border border-white/20"
                    />
                    <div className="text-left">
                      <p className="text-xs font-bold text-white truncate max-w-xs">{imageFile.name}</p>
                      <p className="text-[10px] text-white/40">{(imageFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      <span className="text-[10px] text-cms-yellow font-bold">Click to change</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/50">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    </div>
                    <p className="text-xs font-semibold text-white/80">Click to browse photo</p>
                    <p className="text-[10px] text-white/40">PNG, JPG, WEBP up to 20MB</p>
                  </>
                )}
              </label>
            </div>
          </div>

          {loading && (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-white/60">
                <span>Uploading photo to storage...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div className="bg-cms-yellow h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !imageFile || !title.trim()}
            className="w-full bg-cms-yellow text-black font-bold py-3 rounded-xl active:scale-95 transition-transform disabled:opacity-40 text-xs shadow-md shadow-cms-yellow/20"
          >
            {loading ? "Publishing to Gallery..." : "Publish Photo to Gallery"}
          </button>
        </form>
      </div>

      {/* ── Live Gallery Stream ── */}
      <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-4">
        Published Gallery Photos ({photos.length})
      </h3>

      {photos.length === 0 ? (
        <div className="bg-[#121214] border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-xs text-white/40">No photos published yet. Use the uploader above to add your first photo!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map(p => (
            <div key={p.id} className="group relative bg-[#121214] border border-white/10 rounded-xl overflow-hidden flex flex-col">
              <div className="relative aspect-square w-full bg-black overflow-hidden">
                <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                <span className="absolute top-2 left-2 bg-black/70 backdrop-blur-md text-white text-[9px] font-bold px-2 py-0.5 rounded-full border border-white/10">
                  {p.category}
                </span>

                {(canDelete || p.uploaderEmail === user?.email) && (
                  <button
                    onClick={() => handleDeletePhoto(p)}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete photo"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                )}
              </div>

              <div className="p-2.5 flex-1 flex flex-col justify-between">
                <h4 className="text-xs font-bold text-white truncate" title={p.title}>{p.title}</h4>
                <p className="text-[10px] text-white/40 mt-1 truncate">By {p.uploadedBy}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
