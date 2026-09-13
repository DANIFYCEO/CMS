"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, addDoc, serverTimestamp, onSnapshot, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, orderBy } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { canModerateCommunity } from "@/lib/adminRoles";

const communityDetails: Record<string, { title: string, img: string }> = {
  actors: { title: "Actors", img: "/communities/actors.png" },
  filmmaker: { title: "The Filmmaker", img: "/communities/filmmaker.png" },
  editor: { title: "Editors", img: "/communities/editor.png" },
  cinematography: { title: "Cinematographers / DOP", img: "/communities/cinematography.png" },
};

const getTimestampMs = (val: any): number => {
  if (!val) return 0;
  if (typeof val.toMillis === "function") return val.toMillis();
  if (val.seconds) return val.seconds * 1000;
  if (val instanceof Date) return val.getTime();
  if (typeof val === "string") return new Date(val).getTime() || 0;
  return 0;
};

const formatPostDate = (val: any): string => {
  if (!val) return "Just now";
  try {
    if (typeof val.toDate === "function") {
      return val.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
    if (val instanceof Date) {
      return val.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
    if (typeof val === "string") {
      return new Date(val).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
  } catch {
    return "Just now";
  }
  return "Just now";
};

const joinMapping: Record<string, string> = {
  actors: "Actor",
  filmmaker: "Director",
  cinematography: "Cinematographer / DOP",
  editor: "Editor"
};

const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Blob failed"));
        }, "image/jpeg", 0.7);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export default function CommunityFeedPage() {
  const router = useRouter();
  const routeParams = useParams();
  const deptId = (routeParams?.id as string) || "";
  const { user, userData } = useAuth();
  const canModerate = canModerateCommunity(userData?.role, userData?.isAdmin);
  
  const details = communityDetails[deptId] || { title: "Community", img: "" };

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);

  // Comments & Likes state
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [cmsIdInput, setCmsIdInput] = useState("");
  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);
  const [showComposer, setShowComposer] = useState(false);

  const isJoined = userData?.registrationForm?.creativeDepartments?.includes(joinMapping[deptId]) || 
                   (deptId === 'actors' && userData?.registrationForm?.creativeDepartments?.includes("Actress"));

  const handleJoinWithId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!cmsIdInput.trim()) {
      alert("Please enter your CMS ID");
      return;
    }

    setIsSubmittingJoin(true);
    try {
      const joinVal = joinMapping[deptId];
      if (joinVal) {
        await updateDoc(doc(db, "users", user.uid), {
          "registrationForm.creativeDepartments": arrayUnion(joinVal),
          cmsId: cmsIdInput.trim().toUpperCase()
        });
      }
      setShowJoinModal(false);
    } catch (err) {
      console.error("Error joining with ID:", err);
      alert("Failed to join. Please try again.");
    } finally {
      setIsSubmittingJoin(false);
    }
  };

  useEffect(() => {
    if (!deptId) return;
    
    const q = query(
      collection(db, "community_posts"),
      where("department", "==", deptId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const p = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      p.sort((a: any, b: any) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt));
      setPosts(p);
      setLoading(false);
    }, (err) => {
      console.error("Snapshot error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [deptId]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!text.trim() && !imageFile) || !user) return;
    setIsPosting(true);

    try {
      let imageUrl = null;
      if (imageFile) {
        const compressedBlob = await compressImage(imageFile);
        
        const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;
        if (!apiKey) throw new Error("Missing ImgBB API Key in .env.local");

        const formData = new FormData();
        formData.append("image", compressedBlob);

        const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
          method: "POST",
          body: formData
        });
        
        const data = await res.json();
        if (data.success) {
          imageUrl = data.data.url;
        } else {
          throw new Error(data.error?.message || "Failed to upload image to ImgBB");
        }
      }

      await addDoc(collection(db, "community_posts"), {
        department: deptId,
        text: text.trim(),
        imageUrl: imageUrl,
        senderId: user.uid,
        senderName: userData?.displayName || user.displayName || "CMS Member",
        senderPhoto: userData?.photoURL || null,
        senderTier: userData?.membership || "free",
        likes: 0,
        comments: 0,
        createdAt: serverTimestamp(),
      });

      setText("");
      setImageFile(null);
      setShowComposer(false);
    } catch (err: any) {
      console.error("Error posting:", err);
      alert(`Failed to post: ${err?.message || "Unknown error"}`);
    } finally {
      setIsPosting(false);
    }
  };

  const handleLike = async (postId: string, likedBy: string[] = [], currentLikes: number = 0) => {
    if (!user) return;
    const postRef = doc(db, "community_posts", postId);
    const hasLiked = likedBy.includes(user.uid);
    
    try {
      if (hasLiked) {
        await updateDoc(postRef, {
          likedBy: arrayRemove(user.uid),
          likes: Math.max(0, currentLikes - 1)
        });
      } else {
        await updateDoc(postRef, {
          likedBy: arrayUnion(user.uid),
          likes: currentLikes + 1
        });
      }
    } catch (err) {
      console.error("Error toggling like:", err);
    }
  };

  const toggleComments = (postId: string) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
      setActiveCommentPostId(null);
      setComments([]);
    } else {
      setExpandedPostId(postId);
      setActiveCommentPostId(null);
      setComments([]); // clear old comments
      // fetch comments
      const q = query(
        collection(db, "community_posts", postId, "comments")
      );
      onSnapshot(q, (snapshot) => {
        const c = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        c.sort((a: any, b: any) => getTimestampMs(a.createdAt) - getTimestampMs(b.createdAt));
        setComments(c);
      });
    }
  };

  const submitComment = async (postId: string, currentComments: number = 0) => {
    if (!user || !commentText.trim()) return;
    setIsCommenting(true);
    try {
      await addDoc(collection(db, "community_posts", postId, "comments"), {
        text: commentText.trim(),
        senderId: user.uid,
        senderName: userData?.displayName || user.displayName || "CMS Member",
        senderPhoto: userData?.photoURL || null,
        senderTier: userData?.membership || "free",
        createdAt: serverTimestamp()
      });
      
      const postRef = doc(db, "community_posts", postId);
      await updateDoc(postRef, {
        comments: currentComments + 1
      });
      
      setCommentText("");
      setActiveCommentPostId(null); // Comment input disappears after posting reply
    } catch (err) {
      console.error("Error adding comment:", err);
    } finally {
      setIsCommenting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!user || !db) return;
    if (!confirm("Are you sure you want to delete this post?")) return;
    try {
      await deleteDoc(doc(db, "community_posts", postId));
    } catch (err) {
      console.error("Error deleting post:", err);
    }
  };

  const handleDeletePostComment = async (postId: string, commentId: string, currentComments: number = 1) => {
    if (!user || !db) return;
    if (!confirm("Are you sure you want to delete this comment?")) return;
    try {
      await deleteDoc(doc(db, "community_posts", postId, "comments", commentId));
      await updateDoc(doc(db, "community_posts", postId), {
        comments: Math.max(0, currentComments - 1)
      });
    } catch (err) {
      console.error("Error deleting comment:", err);
    }
  };

  const getTierBadge = (tierId: string) => {
    if (tierId === "elite-member") return <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded text-[9px] font-bold uppercase ml-2 border border-purple-500/30">Elite</span>;
    if (tierId === "premium-member") return <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded text-[9px] font-bold uppercase ml-2 border border-blue-500/30">Premium</span>;
    if (tierId === "cms-member" || tierId === "CMS Member") return <span className="bg-cms-yellow/20 text-cms-yellow px-2 py-0.5 rounded text-[9px] font-bold uppercase ml-2 border border-cms-yellow/30">Member</span>;
    return <span className="bg-white/10 text-white/50 px-2 py-0.5 rounded text-[9px] font-bold uppercase ml-2 border border-white/10">Free</span>;
  };

  const getAvatarBadge = (tierId?: string, size: "sm" | "md" | "lg" = "md") => {
    if (!tierId || tierId === "free" || tierId === "basic") return null;

    const isElite = tierId === "elite-member";
    const isPremium = tierId === "premium-member";
    const isMember = tierId === "cms-member" || tierId === "CMS Member";

    if (!isElite && !isPremium && !isMember) return null;

    let iconSize = 10;
    let containerClass = "absolute -top-1 -right-1 bg-black rounded-full p-0.5 border border-cms-yellow z-10 text-cms-yellow flex items-center justify-center shadow-lg pointer-events-none";

    if (size === "sm") {
      iconSize = 7;
      containerClass = "absolute -top-1 -right-1 bg-black rounded-full p-0.5 border border-cms-yellow z-10 text-cms-yellow flex items-center justify-center shadow-md pointer-events-none";
    } else if (size === "lg") {
      iconSize = 14;
      containerClass = "absolute -top-1.5 -right-1.5 bg-black rounded-full p-1 border-2 border-cms-yellow z-10 text-cms-yellow flex items-center justify-center shadow-xl pointer-events-none";
    }

    let borderClass = "border-cms-yellow text-cms-yellow";
    let icon = (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 4h20M2 20h20M9 4v16M15 4v16"/><path d="M2 16l4-12 6 8 6-8 4 12z"/>
      </svg>
    );

    if (isElite) {
      borderClass = "border-purple-400 text-purple-400";
      icon = (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>
        </svg>
      );
    } else if (isPremium) {
      borderClass = "border-blue-400 text-blue-400";
      icon = (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
        </svg>
      );
    }

    return (
      <div className={`${containerClass} ${borderClass}`}>
        {icon}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#050505] text-white pb-24">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-[#111] border-b border-white/5 sticky top-0 z-50">
        <button onClick={() => router.back()} className="p-1 -ml-2 text-white hover:text-cms-yellow transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        {details.img ? (
          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-white/10">
            <img src={details.img} alt={details.title} className="w-full h-full object-cover" />
          </div>
        ) : null}
        <h1 className="text-[16px] font-bold leading-tight">{details.title} Feed</h1>
        
        <button 
          onClick={() => setShowComposer(true)}
          className="ml-auto w-8 h-8 rounded-full bg-cms-yellow text-black flex items-center justify-center active:scale-90 transition-transform font-bold shadow-md shadow-cms-yellow/20"
          title="New Post"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </header>

      {/* Join Community Banner if not joined */}
      {!isJoined && deptId !== "general" && user && (
        <div className="mx-4 mt-3 p-3.5 bg-[#141414] border border-cms-yellow/30 rounded-2xl flex items-center justify-between shadow-lg shadow-cms-yellow/5">
          <div className="flex-1 pr-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cms-yellow animate-pulse"></span>
              <p className="text-xs font-bold text-cms-yellow">Join {details.title}</p>
            </div>
            <p className="text-[11px] text-white/60 mt-0.5">Enter your CMS ID to become an active community member</p>
          </div>
          <button 
            onClick={() => {
              setCmsIdInput((userData as any)?.cmsId || "");
              setShowJoinModal(true);
            }}
            className="bg-cms-yellow text-black text-xs font-bold px-4 py-1.5 rounded-full active:scale-95 transition-transform shrink-0 shadow-md"
          >
            Join
          </button>
        </div>
      )}

      {/* Feed */}
      <div className="flex flex-col">
        {loading ? (
          <div className="p-8 text-center text-white/50 text-sm">Loading posts...</div>
        ) : posts.length === 0 ? (
          <div className="p-8 text-center text-white/50 text-sm">No posts yet. Be the first!</div>
        ) : (
          posts.map(post => (
            <div key={post.id} className="p-4 border-b border-white/5 hover:bg-[#111]/50 transition-colors">
              <div className="flex gap-3">
                <div 
                  onClick={() => setSelectedProfile({ name: post.senderName, photo: post.senderPhoto, tier: post.senderTier })}
                  className="relative shrink-0 cursor-pointer active:scale-95 transition-transform"
                >
                  <div className="w-10 h-10 rounded-full bg-[#222] overflow-hidden border border-white/10">
                    {post.senderPhoto ? (
                      <img src={post.senderPhoto} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white/50">
                        {post.senderName?.charAt(0)}
                      </div>
                    )}
                  </div>
                  {getAvatarBadge(post.senderTier, "md")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span 
                      onClick={() => setSelectedProfile({ name: post.senderName, photo: post.senderPhoto, tier: post.senderTier })}
                      className="font-bold text-sm cursor-pointer hover:underline"
                    >
                      {post.senderName}
                    </span>
                    {getTierBadge(post.senderTier)}
                    <span className="text-[10px] text-white/30 ml-auto">
                      {formatPostDate(post.createdAt)}
                    </span>
                    {(post.senderId === user?.uid || canModerate) && (
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="text-white/30 hover:text-red-400 p-0.5 transition-colors ml-1"
                        title="Delete post"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                        </svg>
                      </button>
                    )}
                  </div>
                  
                  {post.text && <p className="text-[14px] text-white/90 leading-snug whitespace-pre-wrap">{post.text}</p>}
                  
                  {post.imageUrl && (
                    <div className="mt-3 rounded-2xl overflow-hidden border border-white/10 max-h-[300px]">
                      <img src={post.imageUrl} alt="Post image" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="flex items-center gap-6 mt-4 text-white/40">
                    <button 
                      onClick={() => toggleComments(post.id)}
                      className={`flex items-center gap-1.5 text-xs transition-colors group ${expandedPostId === post.id ? "text-white" : "hover:text-white"}`}
                    >
                      <div className="p-1.5 rounded-full group-hover:bg-white/10 transition-colors -ml-1.5">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                      </div>
                      <span>{post.comments || 0}</span>
                    </button>
                    <button 
                      onClick={() => handleLike(post.id, post.likedBy, post.likes)}
                      className={`flex items-center gap-1.5 text-xs transition-colors group ${post.likedBy?.includes(user?.uid) ? "text-cms-yellow" : "hover:text-cms-yellow"}`}
                    >
                      <div className="p-1.5 rounded-full group-hover:bg-cms-yellow/10 transition-colors -ml-1.5">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill={post.likedBy?.includes(user?.uid) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                      </div>
                      <span>{post.likes || 0}</span>
                    </button>
                  </div>
                  
                  {/* Inline Comments */}
                  {expandedPostId === post.id && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      {/* Comment Input Composer (shown when user wants to reply/comment) */}
                      {activeCommentPostId === post.id ? (
                        <div className="flex items-center gap-2 mb-4 bg-white/[0.04] p-2 rounded-2xl border border-white/10 animate-in slide-in-from-top-2 duration-200">
                          <input 
                            type="text" 
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Write a comment..."
                            autoFocus
                            className="flex-1 bg-transparent px-3 py-1.5 text-xs text-white placeholder:text-white/40 focus:outline-none"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') submitComment(post.id, post.comments);
                            }}
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              setActiveCommentPostId(null);
                              setCommentText("");
                            }}
                            className="text-white/40 hover:text-white text-xs px-2 py-1 transition-colors"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={() => submitComment(post.id, post.comments)}
                            disabled={!commentText.trim() || isCommenting}
                            className="bg-cms-yellow text-black text-xs font-bold px-4 py-1.5 rounded-full disabled:opacity-50 active:scale-95 transition-transform shrink-0 shadow-sm"
                          >
                            {isCommenting ? "..." : "Reply"}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold text-white/50">
                            Comments ({comments.length})
                          </span>
                          <button
                            onClick={() => {
                              setActiveCommentPostId(post.id);
                              setCommentText("");
                            }}
                            className="bg-cms-yellow/10 border border-cms-yellow/30 text-cms-yellow text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 active:scale-95 transition-all"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                            Write a comment
                          </button>
                        </div>
                      )}
                      
                      <div className="space-y-3">
                        {comments.length === 0 ? (
                          <div className="text-xs text-white/30 text-center py-4">
                            No comments yet. Be the first to comment!
                          </div>
                        ) : (
                          comments.map(c => (
                            <div key={c.id} className="flex gap-2">
                              <div className="relative shrink-0">
                                <div className="w-6 h-6 rounded-full bg-[#222] overflow-hidden border border-white/10">
                                  {c.senderPhoto ? (
                                    <img src={c.senderPhoto} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white/50">{c.senderName?.charAt(0)}</div>
                                  )}
                                </div>
                                {getAvatarBadge(c.senderTier, "sm")}
                              </div>
                              <div className="flex-1 bg-white/5 rounded-2xl rounded-tl-none px-3 py-2 text-sm">
                                <div className="flex items-center gap-1 mb-0.5">
                                  <span className="font-bold text-xs">{c.senderName}</span>
                                  {c.senderTier === "elite-member" && <span className="text-[8px] text-purple-300 ml-1">ELITE</span>}
                                  {c.senderTier === "premium-member" && <span className="text-[8px] text-blue-300 ml-1">PREMIUM</span>}
                                  <span className="text-[9px] text-white/30 ml-auto">{formatPostDate(c.createdAt)}</span>
                                  {(c.senderId === user?.uid || canModerate) && (
                                    <button
                                      onClick={() => handleDeletePostComment(post.id, c.id, post.comments)}
                                      className="text-white/30 hover:text-red-400 p-0.5 transition-colors ml-1"
                                      title="Delete comment"
                                    >
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                                      </svg>
                                    </button>
                                  )}
                                </div>
                                <p className="text-white/80 text-[13px]">{c.text}</p>
                                
                                {/* Reply button on individual comment */}
                                <div className="flex items-center gap-3 mt-1.5">
                                  <button
                                    onClick={() => {
                                      setActiveCommentPostId(post.id);
                                      setCommentText(`@${c.senderName} `);
                                    }}
                                    className="text-[11px] font-semibold text-white/40 hover:text-cms-yellow flex items-center gap-1 transition-colors active:scale-95"
                                  >
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
                                    </svg>
                                    Reply
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Profile Modal */}
      {selectedProfile && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedProfile(null)}>
          <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-xs overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="h-24 bg-gradient-to-r from-cms-yellow/20 to-black relative">
              <button onClick={() => setSelectedProfile(null)} className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="px-6 pb-6 pt-0 relative flex flex-col items-center">
              <div className="relative shrink-0 -mt-10 mb-3">
                <div className="w-20 h-20 bg-[#222] rounded-full border-4 border-[#111] overflow-hidden">
                  {selectedProfile.photo ? (
                    <img src={selectedProfile.photo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white/50">
                      {selectedProfile.name?.charAt(0)}
                    </div>
                  )}
                </div>
                {getAvatarBadge(selectedProfile.tier, "lg")}
              </div>
              <h2 className="text-xl font-bold text-center leading-tight mb-1">{selectedProfile.name}</h2>
              <div className="mt-1">
                {getTierBadge(selectedProfile.tier)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Join Community with CMS ID Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4 backdrop-blur-md" onClick={() => setShowJoinModal(false)}>
          <div className="bg-[#121212] border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 relative" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setShowJoinModal(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>

            {details.img && (
              <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 mx-auto mb-4">
                <img src={details.img} alt={details.title} className="w-full h-full object-cover" />
              </div>
            )}

            <h3 className="text-lg font-bold text-center mb-1">Join {details.title}</h3>
            <p className="text-xs text-white/50 text-center mb-6 leading-relaxed">
              Please enter your unique CMS ID below to activate your membership in this community.
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

      {/* Post Creation Modal */}
      {showComposer && (
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4 backdrop-blur-md" onClick={() => setShowComposer(false)}>
          <div className="bg-[#121212] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <button 
                onClick={() => setShowComposer(false)}
                className="text-xs font-semibold text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <h2 className="text-sm font-bold text-white">Create Post</h2>
              <button 
                onClick={handlePost}
                disabled={isPosting || (!text.trim() && !imageFile)}
                className="bg-cms-yellow text-black text-xs font-bold px-4 py-1.5 rounded-full active:scale-95 transition-transform disabled:opacity-40 shadow-md"
              >
                {isPosting ? "Posting..." : "Post"}
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex gap-3.5">
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-[#222] overflow-hidden border border-white/10">
                  {userData?.photoURL ? (
                    <img src={userData.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white/50">
                      {userData?.displayName?.charAt(0) || "?"}
                    </div>
                  )}
                </div>
                {getAvatarBadge(userData?.membership, "md")}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white/80 mb-1">{userData?.displayName || "You"}</p>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`What's happening in ${details.title}?`}
                  rows={5}
                  autoFocus
                  className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none resize-none leading-relaxed"
                />

                {imageFile && (
                  <div className="relative w-full h-44 rounded-2xl overflow-hidden mb-3 border border-white/10 mt-2">
                    <img src={URL.createObjectURL(imageFile)} alt="Preview" className="w-full h-full object-cover" />
                    <button 
                      type="button" 
                      onClick={() => setImageFile(null)}
                      className="absolute top-2.5 right-2.5 w-7 h-7 bg-black/70 rounded-full flex items-center justify-center backdrop-blur-md text-white hover:bg-black transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="px-5 py-3 border-t border-white/10 bg-[#151515] flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-semibold text-cms-yellow cursor-pointer hover:bg-cms-yellow/10 px-3 py-1.5 rounded-full transition-colors">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                  <circle cx="9" cy="9" r="2"/>
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                </svg>
                <span>Add Image</span>
              </label>

              <span className="text-[11px] text-white/40">
                {text.length} chars
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
