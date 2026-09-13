"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SettingsPage() {
  const router = useRouter();
  
  const [notifications, setNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(false);
  const [autoplay, setAutoplay] = useState(true);

  return (
    <div className="flex flex-col min-h-[100dvh] bg-black text-white pb-safe overflow-y-auto">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-5 border-b border-white/5 sticky top-0 bg-black/90 backdrop-blur-md z-50">
        <button onClick={() => router.back()} className="p-1 -ml-1 text-white hover:text-cms-yellow">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 className="text-[15px] font-bold tracking-wide uppercase">Settings</h1>
      </header>

      {/* Content */}
      <div className="p-6 flex flex-col gap-8">
        
        <section className="flex flex-col gap-4">
          <h2 className="text-xs text-white/50 uppercase tracking-wider font-bold mb-1">Preferences</h2>
          
          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-2xl">
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-[15px]">Push Notifications</span>
              <span className="text-xs text-white/50">Receive alerts for new movies & shorts</span>
            </div>
            <button 
              onClick={() => setNotifications(!notifications)}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${notifications ? 'bg-cms-yellow' : 'bg-white/20'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${notifications ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-2xl">
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-[15px]">Email Updates</span>
              <span className="text-xs text-white/50">Weekly digests and special offers</span>
            </div>
            <button 
              onClick={() => setEmailUpdates(!emailUpdates)}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${emailUpdates ? 'bg-cms-yellow' : 'bg-white/20'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${emailUpdates ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-2xl">
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-[15px]">Autoplay Videos</span>
              <span className="text-xs text-white/50">Automatically play the next recommended video</span>
            </div>
            <button 
              onClick={() => setAutoplay(!autoplay)}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${autoplay ? 'bg-cms-yellow' : 'bg-white/20'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${autoplay ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xs text-white/50 uppercase tracking-wider font-bold mb-1">Account & Support</h2>
          
          <button className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-2xl active:scale-95 transition-transform text-left">
            <span className="font-semibold text-[15px]">Privacy Policy</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/30"><path d="m9 18 6-6-6-6"/></svg>
          </button>
          
          <button className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-2xl active:scale-95 transition-transform text-left">
            <span className="font-semibold text-[15px]">Terms of Service</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/30"><path d="m9 18 6-6-6-6"/></svg>
          </button>

          <button className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-2xl active:scale-95 transition-transform text-left">
            <span className="font-semibold text-[15px] text-red-400">Delete Account</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400/50"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </section>

      </div>
    </div>
  );
}
