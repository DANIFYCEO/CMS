"use client";

import { useEffect, useState, useRef, use } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, setDoc, serverTimestamp, doc, getDoc, updateDoc, deleteDoc, getDocs, where } from "firebase/firestore";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface Message {
  id: string;
  text?: string;
  senderId: string;
  createdAt: any;
  edited?: boolean;
}

export default function ChatRoomPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId: otherUserId } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [otherUser, setOtherUser] = useState<any>(null);
  
  // Context Menu & Edit State
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [recentChats, setRecentChats] = useState<any[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pressTimerRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!otherUserId) return;
    const fetchOtherUser = async () => {
      const snap = await getDoc(doc(db, "users", otherUserId));
      if (snap.exists()) setOtherUser(snap.data());
    };
    fetchOtherUser();
  }, [otherUserId]);

  useEffect(() => {
    if (!user || !otherUserId) return;
    const chatId = user.uid < otherUserId ? user.uid + "_" + otherUserId : otherUserId + "_" + user.uid;
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((doc) => msgs.push({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [user, otherUserId]);

  const updateParentChat = async (chatId: string, lastMessage: string) => {
    if (!user || !otherUserId) return;
    await setDoc(doc(db, "chats", chatId), {
      participants: [user.uid, otherUserId],
      lastMessage,
      updatedAt: serverTimestamp()
    }, { merge: true });
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !user || !otherUserId) return;

    const chatId = user.uid < otherUserId ? user.uid + "_" + otherUserId : otherUserId + "_" + user.uid;
    const messagesRef = collection(db, "chats", chatId, "messages");
    
    if (editingMsgId) {
      await updateDoc(doc(messagesRef, editingMsgId), {
        text: newMessage.trim(),
        edited: true
      });
      setNewMessage("");
      setEditingMsgId(null);
      await updateParentChat(chatId, "Message edited");
      return;
    }

    const text = newMessage;
    setNewMessage("");
    await addDoc(messagesRef, { text: text.trim(), senderId: user.uid, createdAt: serverTimestamp() });
    await updateParentChat(chatId, text.trim());
  };

  // Long press handlers
  const handleTouchStart = (msgId: string) => {
    pressTimerRef.current = setTimeout(() => setSelectedMsgId(msgId), 500);
  };
  const handleTouchEnd = () => clearTimeout(pressTimerRef.current);

  const handleDelete = async (msgId: string) => {
    if (!user || !otherUserId) return;
    const chatId = user.uid < otherUserId ? user.uid + "_" + otherUserId : otherUserId + "_" + user.uid;
    await deleteDoc(doc(db, "chats", chatId, "messages", msgId));
    setSelectedMsgId(null);
  };

  const handleEdit = (msg: Message) => {
    if (!msg.text) return;
    setNewMessage(msg.text);
    setEditingMsgId(msg.id);
    setSelectedMsgId(null);
  };

  const openForwardModal = async () => {
    if (!user) return;
    const q = query(collection(db, "chats"), where("participants", "array-contains", user.uid));
    const snap = await getDocs(q);
    const chatsList = [];
    for (const docSnap of snap.docs) {
      const otherId = docSnap.data().participants.find((id: string) => id !== user.uid);
      if (otherId) {
        const uSnap = await getDoc(doc(db, "users", otherId));
        if (uSnap.exists()) chatsList.push({ uid: otherId, ...uSnap.data() });
      }
    }
    setRecentChats(chatsList);
    setShowForwardModal(true);
  };

  const executeForward = async (targetUserId: string) => {
    if (!user || !selectedMsgId) return;
    const sourceChatId = user.uid < otherUserId ? user.uid + "_" + otherUserId : otherUserId + "_" + user.uid;
    const sourceMsg = await getDoc(doc(db, "chats", sourceChatId, "messages", selectedMsgId));
    if (!sourceMsg.exists()) return;
    
    const targetChatId = user.uid < targetUserId ? user.uid + "_" + targetUserId : targetUserId + "_" + user.uid;
    const msgData = sourceMsg.data();
    
    await addDoc(collection(db, "chats", targetChatId, "messages"), {
      ...msgData,
      senderId: user.uid,
      createdAt: serverTimestamp(),
      edited: false
    });
    
    let lastMsgStr = "Forwarded message";
    if (msgData.text) lastMsgStr = msgData.text;
    
    await setDoc(doc(db, "chats", targetChatId), {
      participants: [user.uid, targetUserId],
      lastMessage: lastMsgStr,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    setShowForwardModal(false);
    setSelectedMsgId(null);
    alert("Message forwarded!");
  };

  const formatTime = (date: any) => date ? date.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";

  if (!user) return null;

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0b141a] text-[#e9edef] overflow-hidden relative">
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'url("https://w0.peakpx.com/wallpaper/818/148/HD-wallpaper-whatsapp-background-cool-dark-green-new-theme-whatsapp.jpg")', backgroundSize: 'cover', backgroundPosition: 'center' }}></div>

      <header className="sticky top-0 z-20 bg-[#202c33] px-3 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => router.back()} className="text-white active:scale-90 transition-transform flex items-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        {otherUser ? (
          <div className="flex items-center gap-3 cursor-pointer">
              <div className="relative w-10 h-10 rounded-full overflow-hidden bg-[#1A1A1A] flex items-center justify-center">
                {otherUser.photoURL ? (
                  <img src={otherUser.photoURL} alt={otherUser.displayName} className="w-full h-full object-cover" />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/40"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                )}
              </div>
            <div>
              <h1 className="font-bold text-[17px] leading-tight">{otherUser.displayName}</h1>
              <p className="text-xs text-white/50">@{otherUser.username}</p>
            </div>
          </div>
        ) : (
          <div className="w-full flex justify-center"><div className="w-5 h-5 border-2 border-[#FFB400] border-t-transparent rounded-full animate-spin"></div></div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-1.5 z-10 relative pb-4" onClick={() => setSelectedMsgId(null)}>
        {messages.map((msg, index) => {
          const isMe = msg.senderId === user.uid;
          const showTail = index === 0 || messages[index - 1]?.senderId !== msg.senderId;
          const isSelected = selectedMsgId === msg.id;
          
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} ${showTail ? 'mt-1.5' : ''}`}>
              <div 
                onTouchStart={() => handleTouchStart(msg.id)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchEnd}
                onMouseDown={() => handleTouchStart(msg.id)}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                className={`relative px-3 py-1.5 rounded-lg max-w-[80%] shadow-sm transition-colors cursor-pointer ${
                  isMe ? "bg-[#FFB400] text-black" : "bg-[#202c33]"
                } ${showTail && isMe ? 'rounded-tr-none' : ''} ${showTail && !isMe ? 'rounded-tl-none' : ''} ${isSelected ? 'brightness-125 ring-2 ring-[#FFB400]' : ''}`}
              >
                {/* Context Menu */}
                {isSelected && (
                  <div className={`absolute z-30 top-[-40px] ${isMe ? 'right-0' : 'left-0'} bg-[#233138] rounded-lg shadow-xl flex items-center p-1 border border-white/10`} onClick={e => e.stopPropagation()}>
                    {isMe && msg.text && (
                      <button onClick={() => handleEdit(msg)} className="px-3 py-1.5 hover:bg-white/10 rounded-md text-sm text-white">Edit</button>
                    )}
                    <button onClick={openForwardModal} className="px-3 py-1.5 hover:bg-white/10 rounded-md text-sm text-white">Forward</button>
                    {isMe && (
                      <button onClick={() => handleDelete(msg.id)} className="px-3 py-1.5 hover:bg-red-500/20 text-red-400 rounded-md text-sm">Delete</button>
                    )}
                  </div>
                )}

                {showTail && isMe && <svg viewBox="0 0 8 13" width="8" height="13" className="absolute top-0 -right-2 text-[#FFB400]"><path fill="currentColor" d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z"/></svg>}
                {showTail && !isMe && <svg viewBox="0 0 8 13" width="8" height="13" className="absolute top-0 -left-2 text-[#202c33]"><path fill="currentColor" d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" transform="matrix(-1 0 0 1 8 0)"/></svg>}

                <div className="flex flex-col select-none">
                  {msg.text && (
                    <p className={`text-[15px] leading-relaxed break-words pr-2 ${isMe ? 'text-black' : ''}`}>{msg.text}</p>
                  )}
                  <span className={`text-[10px] ${isMe ? 'text-black/60' : 'text-white/50'} self-end ml-4 -mb-1 mt-0.5 whitespace-nowrap flex items-center gap-1`}>
                    {msg.edited && <span className="italic mr-1">(edited)</span>}
                    {formatTime(msg.createdAt)}
                    {isMe && <svg viewBox="0 0 16 15" width="16" height="15" className={isMe ? 'text-black/50' : 'text-[#53bdeb]'}><path fill="currentColor" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.346.125.467-.025l6.236-8.083a.365.365 0 0 0-.012-.485zM9.304 3.316l-.478-.372a.365.365 0 0 0-.51.063L3.109 9.61a.32.32 0 0 1-.484.033L.19 7.424a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l2.748 2.637c.143.14.346.125.467-.025l6.738-8.733a.365.365 0 0 0-.012-.485z"/></svg>}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} className="h-2" />
      </main>

      <footer className="bg-[#0b141a] px-2 py-2.5 flex items-end gap-2 z-20 relative pb-safe">
        <div className="flex-1 bg-[#202c33] rounded-[22px] flex flex-col overflow-visible shadow-sm relative">
          {editingMsgId && (
            <div className="bg-[#111] px-4 py-2 rounded-t-[22px] border-b border-white/10 flex justify-between items-center text-sm">
              <span className="text-[#FFB400] font-medium flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                Editing message
              </span>
              <button type="button" onClick={() => { setEditingMsgId(null); setNewMessage(""); }} className="text-white/50 hover:text-white">✕</button>
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex-1 flex items-end">
            <input 
              type="text" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Message"
              className="flex-1 bg-transparent border-none px-4 py-3 min-h-[44px] focus:outline-none text-[#e9edef] placeholder:text-[#8696a0]"
            />
          </form>
        </div>
        
        <button 
          type="button"
          onClick={handleSendMessage}
          disabled={!newMessage.trim()}
          className={`w-11 h-11 shrink-0 flex items-center justify-center bg-[#FFB400] text-black rounded-full active:scale-95 transition-transform shadow-md ${!newMessage.trim() ? 'opacity-50' : 'opacity-100'}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </footer>

      {/* Forward Modal */}
      {showForwardModal && (
        <div className="absolute inset-0 z-50 bg-black/80 flex flex-col animate-in fade-in">
          <div className="bg-[#202c33] p-4 flex items-center gap-4">
            <button onClick={() => setShowForwardModal(false)} className="text-white"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
            <h2 className="text-lg font-bold">Forward to...</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {recentChats.map(chat => (
              <button key={chat.uid} onClick={() => executeForward(chat.uid)} className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl text-left transition-colors">
                  <div className="w-12 h-12 relative rounded-full overflow-hidden bg-[#1A1A1A] shrink-0 flex items-center justify-center">
                    {chat.photoURL ? (
                      <img src={chat.photoURL} alt={chat.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/40"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    )}
                  </div>
                <div className="flex-1">
                  <h3 className="font-bold text-[16px]">{chat.displayName}</h3>
                  <p className="text-sm text-white/50">@{chat.username}</p>
                </div>
              </button>
            ))}
            {recentChats.length === 0 && <p className="text-center text-white/50 mt-10">No recent chats available to forward to.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
