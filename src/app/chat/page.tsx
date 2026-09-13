"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, onSnapshot } from "firebase/firestore";
import BottomNav from "@/components/BottomNav";

interface UserProfile {
  uid: string;
  displayName: string;
  username: string;
  photoURL?: string;
}

interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage: string;
  updatedAt: any;
  otherUser?: UserProfile;
}

export default function ChatListPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [recentChats, setRecentChats] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  // Listen to recent chats
  useEffect(() => {
    if (!user) return;
    
    const chatsRef = collection(db, "chats");
    const q = query(chatsRef, where("participants", "array-contains", user.uid));
    
    const unsubscribe = onSnapshot(q, async (snap) => {
      try {
        const chats: ChatRoom[] = [];
        
        const chatPromises = snap.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const otherUserId = data.participants?.find((id: string) => id !== user.uid);
          
          let otherUser;
          if (otherUserId) {
            const { doc, getDoc } = await import("firebase/firestore");
            const userDoc = await getDoc(doc(db, "users", otherUserId));
            if (userDoc.exists()) {
              otherUser = userDoc.data() as UserProfile;
            }
          }
          
          return {
            id: docSnap.id,
            participants: data.participants,
            lastMessage: data.lastMessage,
            updatedAt: data.updatedAt,
            otherUser
          };
        });

        const resolvedChats = await Promise.all(chatPromises);
        
        // Sort in Javascript to avoid missing index error
        resolvedChats.sort((a, b) => {
          const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
          const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
          return timeB - timeA;
        });

        setRecentChats(resolvedChats);
      } catch (err) {
        console.error("Error fetching chats:", err);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error("Chats onSnapshot error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Handle Search
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    
    const fetchSearch = async () => {
      setIsSearching(true);
      const q = query(
        collection(db, "users"), 
        where("username", ">=", search.toLowerCase()), 
        where("username", "<=", search.toLowerCase() + '\uf8ff')
      );
      const snap = await getDocs(q);
      const results: UserProfile[] = [];
      snap.forEach(doc => {
        if (doc.id !== user?.uid) {
          results.push(doc.data() as UserProfile);
        }
      });
      setSearchResults(results);
      setIsSearching(false);
    };

    const timer = setTimeout(fetchSearch, 400);
    return () => clearTimeout(timer);
  }, [search, user]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-black pb-24 text-white">
      <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-4">
        <h1 className="text-xl font-bold mb-4">Chat</h1>
        <div className="relative">
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search username..."
            className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 pl-10 text-white placeholder:text-white/30 focus:outline-none focus:border-[cms-yellow] transition-colors"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
      </header>

      <main className="p-4">
        {search.trim() ? (
          <div>
            <h2 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-4">Search Results</h2>
            {isSearching ? (
              <div className="flex justify-center mt-6">
                <div className="w-6 h-6 border-2 border-[cms-yellow] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-white/50 text-center py-4">No users found.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {searchResults.map(u => (
                  <Link 
                    key={u.uid} 
                    href={/chat/ + u.uid}
                    className="flex items-center gap-3 bg-[#111] p-3 rounded-xl border border-white/5 hover:border-white/20 transition-colors"
                  >
                    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-[#1A1A1A] shrink-0 flex items-center justify-center">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/40"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        )}
                      </div>
                    <div>
                      <h3 className="font-bold text-white leading-tight">{u.displayName}</h3>
                      <p className="text-xs text-white/50">@{u.username}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <h2 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-4">Recent Chats</h2>
            {loading ? (
              <div className="flex justify-center mt-10">
                <div className="w-8 h-8 border-2 border-[cms-yellow] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : recentChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-[#111] rounded-full flex items-center justify-center mb-4 text-white/20">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                </div>
                <p className="text-white/50 max-w-[200px]">Search for a username above to start messaging!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {recentChats.map(chat => (
                  <Link 
                    key={chat.id} 
                    href={/chat/ + (chat.otherUser?.uid || "")}
                    className="flex items-center gap-3 bg-[#111] p-3 rounded-xl border border-white/5 hover:border-white/20 transition-colors"
                  >
                    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-[#1A1A1A] shrink-0 flex items-center justify-center">
                        {chat.otherUser?.photoURL ? (
                          <img src={chat.otherUser.photoURL} alt={chat.otherUser?.displayName || "User"} className="w-full h-full object-cover" />
                        ) : (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/40"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        )}
                      </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="font-bold text-white truncate pr-2">{chat.otherUser?.displayName || "User"}</h3>
                        <span className="text-[10px] text-white/30 shrink-0">
                          {chat.updatedAt?.toDate ? chat.updatedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                        </span>
                      </div>
                      <p className="text-sm text-white/60 truncate">{chat.lastMessage}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
