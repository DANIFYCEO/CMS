"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { collection, query, orderBy, limit, addDoc, serverTimestamp, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { canModerateCommunity } from "@/lib/adminRoles";

const formatMessageTime = (val: any): string => {
  if (!val) return "...";
  try {
    if (typeof val.toDate === "function") {
      return val.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (val instanceof Date) {
      return val.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (typeof val === "string") {
      return new Date(val).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  } catch {
    return "...";
  }
  return "...";
};

const getMessageDateLabel = (val: any): string => {
  if (!val) return "";
  try {
    let date: Date;
    if (typeof val.toDate === "function") date = val.toDate();
    else if (val instanceof Date) date = val;
    else if (val.seconds) date = new Date(val.seconds * 1000);
    else date = new Date(val);

    if (isNaN(date.getTime())) return "";

    const now = new Date();
    if (date.toDateString() === now.toDateString()) return "Today";

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
};

export default function GeneralCommunityChat() {
  const router = useRouter();
  const { user, userData } = useAuth();
  const canModerate = canModerateCommunity(userData?.role, userData?.isAdmin);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [memberCount, setMemberCount] = useState<number>(0);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [pinnedAnnouncement, setPinnedAnnouncement] = useState<any>(null);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);

  useEffect(() => {
    // Live member count
    const unsubscribeUsers = onSnapshot(collection(db, "users"), (snap) => {
      setMemberCount(snap.size);
    });

    // Live latest announcement
    const qAnnounce = query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(1));
    const unsubscribeAnnounce = onSnapshot(qAnnounce, (snap) => {
      if (!snap.empty) {
        setPinnedAnnouncement({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setPinnedAnnouncement(null);
      }
    });

    // Live messages
    const q = query(
      collection(db, "general_chat"),
      orderBy("createdAt", "asc"),
      limit(150)
    );

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 80);
    }, (err) => {
      console.error("General chat snapshot error:", err);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeAnnounce();
      unsubscribeMessages();
    };
  }, []);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
    setShowScrollDown(!isNearBottom);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user) return;

    const messageText = text.trim();
    setText("");

    try {
      await addDoc(collection(db, "general_chat"), {
        text: messageText,
        senderId: user.uid,
        senderName: userData?.displayName || user.displayName || "CMS Member",
        senderPhoto: userData?.photoURL || null,
        senderTier: userData?.membership || "free",
        createdAt: serverTimestamp(),
      });
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!user || !db || !msgId) return;
    if (!confirm("Are you sure you want to delete this message?")) return;
    try {
      await deleteDoc(doc(db, "general_chat", msgId));
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  };

  const getTierBadge = (tierId: string) => {
    if (tierId === "elite-member") return <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-purple-500/30">Elite</span>;
    if (tierId === "premium-member") return <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-blue-500/30">Premium</span>;
    if (tierId === "cms-member" || tierId === "CMS Member") return <span className="bg-cms-yellow/20 text-cms-yellow px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-cms-yellow/30">Member</span>;
    return <span className="bg-white/10 text-white/50 px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-white/10">Free</span>;
  };

  const getAvatarBadge = (tierId?: string, size: "sm" | "md" | "lg" = "md") => {
    if (!tierId || tierId === "free" || tierId === "basic") return null;

    const isElite = tierId === "elite-member";
    const isPremium = tierId === "premium-member";
    const isMember = tierId === "cms-member" || tierId === "CMS Member";

    if (!isElite && !isPremium && !isMember) return null;

    let iconSize = 9;
    let containerClass = "absolute -top-1 -right-1 bg-black rounded-full p-0.5 border border-cms-yellow z-10 text-cms-yellow flex items-center justify-center shadow-md pointer-events-none";

    if (size === "sm") {
      iconSize = 7;
      containerClass = "absolute -top-1 -right-1 bg-black rounded-full p-0.5 border border-cms-yellow z-10 text-cms-yellow flex items-center justify-center shadow-sm pointer-events-none";
    } else if (size === "lg") {
      iconSize = 14;
      containerClass = "absolute -top-1.5 -right-1.5 bg-black rounded-full p-1 border-2 border-cms-yellow z-10 text-cms-yellow flex items-center justify-center shadow-xl pointer-events-none";
    }

    let borderClass = "border-cms-yellow text-cms-yellow";
    let icon = (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 4h20M2 20h20M9 4v16M15 4v16"/><path d="M2 16l4-12 6 8 6-8 4 12z"/>
      </svg>
    );

    if (isElite) {
      borderClass = "border-purple-400 text-purple-400";
      icon = (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>
        </svg>
      );
    } else if (isPremium) {
      borderClass = "border-blue-400 text-blue-400";
      icon = (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

  const getSenderNameColor = (tierId?: string) => {
    if (tierId === "elite-member") return "text-purple-300";
    if (tierId === "premium-member") return "text-blue-300";
    if (tierId === "cms-member" || tierId === "CMS Member") return "text-cms-yellow";
    return "text-white/80";
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#080808] text-white">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3.5 bg-[#121212] border-b border-white/5 sticky top-0 z-50 shadow-md">
        <button onClick={() => router.back()} className="p-1.5 -ml-1.5 rounded-full text-white hover:bg-white/10 hover:text-cms-yellow transition-colors">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div className="relative">
          <div className="w-10 h-10 bg-cms-yellow/10 rounded-full flex items-center justify-center border border-cms-yellow/40 text-cms-yellow shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-black animate-pulse"></span>
        </div>
        <div className="flex flex-col">
          <h1 className="text-[15px] font-bold leading-tight flex items-center gap-1.5">
            CMS General Community
          </h1>
          <p className="text-[11px] text-white/50">
            {memberCount > 0 ? `${memberCount} Members • Live Global Chat` : "Live Global Chat"}
          </p>
        </div>
      </header>

      {/* Pinned Announcement Bar */}
      {pinnedAnnouncement && (
        <div 
          onClick={() => setShowAnnouncementModal(true)}
          className="bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-transparent border-b border-cms-yellow/30 px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-cms-yellow/20 transition-colors z-40"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xs shrink-0">📢</span>
            <span className="text-[9px] font-bold uppercase tracking-wider bg-cms-yellow text-black px-1.5 py-0.5 rounded shrink-0">
              {pinnedAnnouncement.category || "Notice"}
            </span>
            <p className="text-xs text-white font-medium truncate">
              {pinnedAnnouncement.title}
            </p>
          </div>
          <span className="text-[11px] text-cms-yellow font-bold shrink-0 ml-3 flex items-center gap-0.5">
            Read <span className="text-xs">→</span>
          </span>
        </div>
      )}

      {/* Messages */}
      <div 
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 pb-28"
      >
        <div className="text-center my-4">
          <span className="bg-white/5 border border-white/10 text-white/60 text-[10px] uppercase tracking-wider font-bold px-3.5 py-1.5 rounded-full shadow-sm">
            Welcome to the General Chat
          </span>
        </div>

        {messages.map((msg, idx) => {
          const isMe = msg.senderId === user?.uid;
          const currentDateLabel = getMessageDateLabel(msg.createdAt);
          const prevDateLabel = idx > 0 ? getMessageDateLabel(messages[idx - 1].createdAt) : null;
          const showDateSeparator = currentDateLabel && currentDateLabel !== prevDateLabel;

          return (
            <div key={msg.id} className="flex flex-col">
              {showDateSeparator && (
                <div className="flex justify-center my-3">
                  <span className="bg-[#181818] border border-white/10 text-white/40 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                    {currentDateLabel}
                  </span>
                </div>
              )}

              <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`flex max-w-[85%] sm:max-w-[75%] gap-2.5 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  
                  {/* Sender Avatar with Badge */}
                  <div 
                    onClick={() => setSelectedProfile({ name: msg.senderName, photo: msg.senderPhoto, tier: msg.senderTier })}
                    className="relative shrink-0 mt-auto cursor-pointer active:scale-95 transition-transform"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-[#222] border border-white/10 shadow-sm">
                      {msg.senderPhoto ? (
                        <img src={msg.senderPhoto} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white/60">
                          {msg.senderName?.charAt(0)}
                        </div>
                      )}
                    </div>
                    {getAvatarBadge(msg.senderTier, "sm")}
                  </div>

                  <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    {!isMe && (
                      <div className="flex items-center gap-1.5 mb-1 ml-1">
                        <span 
                          onClick={() => setSelectedProfile({ name: msg.senderName, photo: msg.senderPhoto, tier: msg.senderTier })}
                          className={`text-[11px] font-bold cursor-pointer hover:underline ${getSenderNameColor(msg.senderTier)}`}
                        >
                          {msg.senderName}
                        </span>
                        {getTierBadge(msg.senderTier)}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-1.5 group">
                      {isMe && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-400 text-white/30 p-1 transition-opacity active:opacity-100 shrink-0"
                          title="Delete message"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                          </svg>
                        </button>
                      )}

                      <div className={`px-4 py-2.5 rounded-2xl relative shadow-md ${
                        isMe 
                          ? "bg-cms-yellow text-black font-medium rounded-br-xs" 
                          : "bg-[#181818] border border-white/10 text-white rounded-bl-xs"
                      }`}>
                        <p className="text-[14px] leading-relaxed break-words whitespace-pre-wrap">{msg.text}</p>
                        <div className={`text-[9px] mt-1 flex items-center justify-end gap-1 ${isMe ? "text-black/60" : "text-white/40"}`}>
                          <span>{formatMessageTime(msg.createdAt)}</span>
                          {isMe && <span className="font-bold">✓✓</span>}
                        </div>
                      </div>

                      {!isMe && canModerate && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-400 text-white/30 p-1 transition-opacity active:opacity-100 shrink-0"
                          title="Delete message as admin"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollDown && (
        <button 
          onClick={scrollToBottom}
          className="fixed bottom-24 right-4 w-9 h-9 rounded-full bg-[#222] border border-white/20 text-white/80 flex items-center justify-center shadow-lg active:scale-90 transition-transform z-40"
          title="Scroll to bottom"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
        </button>
      )}

      {/* Input - Lifted above bottom */}
      <div className="fixed bottom-4 left-3 right-3 max-w-lg mx-auto bg-[#141414]/95 backdrop-blur-xl border border-white/15 rounded-full p-2 pl-4 shadow-2xl shadow-black z-40">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message #general..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none py-1.5"
          />
          <button 
            type="submit" 
            disabled={!text.trim()}
            className="w-10 h-10 bg-cms-yellow rounded-full flex items-center justify-center shrink-0 text-black active:scale-90 transition-transform disabled:opacity-30 disabled:bg-white/10 disabled:text-white/30 shadow-md shadow-cms-yellow/20"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </button>
        </form>
      </div>

      {/* Profile Modal */}
      {selectedProfile && (
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4 backdrop-blur-md" onClick={() => setSelectedProfile(null)}>
          <div className="bg-[#121212] border border-white/10 rounded-3xl w-full max-w-xs overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="h-24 bg-gradient-to-r from-cms-yellow/20 via-cms-yellow/10 to-transparent relative">
              <button onClick={() => setSelectedProfile(null)} className="absolute top-3 right-3 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-black/90 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="px-6 pb-6 pt-0 relative flex flex-col items-center">
              <div className="relative shrink-0 -mt-10 mb-3">
                <div className="w-20 h-20 bg-[#222] rounded-full border-4 border-[#121212] overflow-hidden shadow-lg">
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
              <div className="mt-2 flex items-center justify-center">
                {getTierBadge(selectedProfile.tier)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pinned Announcement Modal */}
      {showAnnouncementModal && pinnedAnnouncement && (
        <div 
          className="fixed inset-0 bg-black/85 z-[110] flex items-center justify-center p-4 backdrop-blur-md"
          onClick={() => setShowAnnouncementModal(false)}
        >
          <div 
            className="bg-[#141414] border border-cms-yellow/40 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 relative max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-cms-yellow text-black px-2.5 py-0.5 rounded-full">
                    {pinnedAnnouncement.category || "Official Notice"}
                  </span>
                  <span className="text-xs text-white/50">
                    {pinnedAnnouncement.authorRole || "Executive Memo"}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white leading-snug">
                  {pinnedAnnouncement.title}
                </h3>
                {pinnedAnnouncement.authorName && (
                  <p className="text-xs text-cms-yellow/80 mt-1">
                    Published by {pinnedAnnouncement.authorName}
                  </p>
                )}
              </div>
              <button 
                onClick={() => setShowAnnouncementModal(false)} 
                className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
              {pinnedAnnouncement.content}
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-[11px] text-white/40">
                {pinnedAnnouncement.createdAt?.toDate ? pinnedAnnouncement.createdAt.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""}
              </span>
              <button
                onClick={() => setShowAnnouncementModal(false)}
                className="bg-cms-yellow text-black font-bold px-5 py-2 rounded-xl text-xs hover:bg-cms-yellow/90 active:scale-95 transition-all shadow-md shadow-cms-yellow/20"
              >
                Close Notice
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
