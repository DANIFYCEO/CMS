"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useState, useRef, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizeAdminRole, ADMIN_ROLES_META } from "@/lib/adminRoles";

export default function ProfilePage() {
  const { user, userData, logout } = useAuth();
  const router = useRouter();
  
  // Secret admin tap logic
  const [tapCount, setTapCount] = useState(0);
  const tapTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  const currentRole = normalizeAdminRole(userData?.role, userData?.isAdmin);
  const isExecutive = currentRole !== "member" || userData?.isAdmin === true;
  const roleMeta = ADMIN_ROLES_META[currentRole];

  useEffect(() => {
    if (!user) return;
    const checkPayment = async () => {
      try {
        const q = query(collection(db, "payment_requests"), where("userId", "==", user.uid));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          // get most recent
          const p = snapshot.docs.map(doc => doc.data());
          p.sort((a: any, b: any) => {
            return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
          });
          setPaymentStatus(p[0].status || "pending");
        }
      } catch (err) {
        console.error("Error checking payment", err);
      }
    };
    checkPayment();
  }, [user]);

  const handleSecretTap = () => {
    if (!isExecutive) return;
    
    const newCount = tapCount + 1;
    if (newCount >= 5) {
      router.push("/admin");
      setTapCount(0);
    } else {
      setTapCount(newCount);
    }

    if (tapTimeout.current) clearTimeout(tapTimeout.current);
    tapTimeout.current = setTimeout(() => setTapCount(0), 1000);
  };

  const menuItems = [
    ...(isExecutive ? [{
      label: `Admin Portal (${userData?.adminTitle || roleMeta.shortTitle})`,
      href: "/admin",
      iconPath: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
      isHighlight: true
    }] : []),
    { label: "My Profile", href: "/profile/edit", iconPath: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
    { label: "Membership", href: "/profile/membership", iconPath: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" },
    { label: "Payment History", href: "/profile/payments", iconPath: "M2 5h20v14H2zM2 10h20" },
    { label: "My Communities", href: "/communities", iconPath: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
    { label: "Settings", href: "/settings", iconPath: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" },
  ];

  const displayName = userData?.displayName || user?.displayName || "CMS User";
  const photoUrl = userData?.photoURL || null;
  const membershipId = userData?.membership || "free";
  
  const getMembershipDetails = () => {
    switch (membershipId) {
      case "cms-member": return { label: "CMS Member", icon: <><path d="M2 4h20M2 20h20M9 4v16M15 4v16"/><path d="M2 16l4-12 6 8 6-8 4 12z"/></> };
      case "premium-member": return { label: "Premium Member", icon: <><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></> };
      case "elite-member": return { label: "Elite Member", icon: <><path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></> };
      default: return { label: "Basic User", icon: null };
    }
  };
  
  const membership = getMembershipDetails();

  return (
    <div className="flex flex-col min-h-[100dvh] bg-black text-white pb-safe overflow-y-auto">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-5 border-b border-white/5 sticky top-0 bg-black/90 backdrop-blur-md z-50">
        <Link href="/" className="p-1 -ml-1 text-white hover:text-cms-yellow">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </Link>
        <h1 
          onClick={handleSecretTap} 
          className="text-[15px] font-bold tracking-wide uppercase select-none cursor-default"
        >
          Account Dashboard
        </h1>
      </header>

      {/* Profile Info */}
      <div className="px-6 py-8 flex items-center gap-5">
        <div className="relative shrink-0">
          <div className="w-20 h-20 rounded-full bg-[#1A1A1A] border-2 border-white/20 relative flex items-center justify-center overflow-hidden">
            {photoUrl ? (
              <img src={photoUrl} alt="User Profile" className="w-full h-full object-cover" />
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/40"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            )}
          </div>
          {membership.icon && (
            <div className="absolute -top-1 -right-1 bg-black rounded-full p-1 border border-cms-yellow z-10 text-cms-yellow flex items-center justify-center shadow-lg">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {membership.icon}
              </svg>
            </div>
          )}
        </div>
        
        <div className="flex flex-col items-start gap-1.5">
          <h2 className="text-[22px] font-bold leading-none">{displayName}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <div className="border border-cms-yellow px-3 py-1 rounded-full text-cms-yellow text-[11px] font-bold">
              {membership.label}
            </div>
            {paymentStatus && (
              <div className={`px-3 py-1 rounded-full text-[11px] font-bold border ${paymentStatus === 'approved' ? 'border-green-400 text-green-400' : paymentStatus === 'rejected' ? 'border-red-400 text-red-400' : 'border-cms-yellow/50 text-cms-yellow/80'}`}>
                Payment: {paymentStatus.toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Menu List */}
      <div className="px-4 pb-8">
        <div className="bg-[#111] rounded-3xl border border-white/5 flex flex-col overflow-hidden">
          {menuItems.map((item, i) => (
            <button 
              key={i} 
              onClick={() => router.push(item.href)} 
              className={`flex items-center justify-between p-4 px-5 transition-colors ${
                (item as any).isHighlight 
                  ? "bg-cms-yellow/10 hover:bg-cms-yellow/15 border-b border-cms-yellow/20" 
                  : `bg-transparent hover:bg-white/5 ${i !== menuItems.length - 1 ? 'border-b border-white/5' : ''}`
              }`}
            >
              <div className="flex items-center gap-4">
                <svg 
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className={(item as any).isHighlight ? "text-cms-yellow" : "text-white/60"}
                >
                  <path d={item.iconPath} />
                </svg>
                <span className={`text-[15px] font-medium ${(item as any).isHighlight ? "text-cms-yellow font-bold" : "text-white/90"}`}>
                  {item.label}
                </span>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={(item as any).isHighlight ? "text-cms-yellow" : "text-white/30"}>
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>
          ))}
          
          {/* Logout Button */}
          <button 
            onClick={async () => {
              try {
                await logout();
                window.location.href = "/?login=true";
              } catch (e) {
                console.error("Logout failed", e);
              }
            }}
            className="flex items-center justify-between p-4 px-5 bg-transparent hover:bg-white/5 transition-colors border-t border-white/5"
          >
            <div className="flex items-center gap-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-cms-yellow">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
              </svg>
              <span className="text-[15px] font-medium text-white/90">Logout</span>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/30">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
