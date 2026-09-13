"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { 
  normalizeAdminRole, 
  ADMIN_ROLES_META, 
  canManageAdmins, 
  canManagePayments, 
  canManageMembers, 
  canUploadGallery, 
  canUploadContent, 
  canSendAnnouncements 
} from "@/lib/adminRoles";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const currentRole = useMemo(() => {
    return normalizeAdminRole(userData?.role, userData?.isAdmin);
  }, [userData]);

  const isAuthorizedAdmin = currentRole !== "member" || userData?.isAdmin === true;
  const roleMeta = ADMIN_ROLES_META[currentRole] || ADMIN_ROLES_META.super_admin;
  const displayTitle = userData?.adminTitle || roleMeta.title;

  const tabs = useMemo(() => [
    { 
      id: "admins", 
      label: "Admin Team", 
      href: "/admin/admins", 
      allowed: canManageAdmins(currentRole),
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="m9 12 2 2 4-4"/>
        </svg>
      )
    },
    { 
      id: "metrics", 
      label: "Metrics & Activity", 
      href: "/admin/metrics", 
      allowed: isAuthorizedAdmin,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      )
    },
    { 
      id: "payments", 
      label: "Payments", 
      href: "/admin", 
      allowed: canManagePayments(currentRole),
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="5" rx="2"/>
          <line x1="2" y1="10" x2="22" y2="10"/>
        </svg>
      )
    },
    { 
      id: "members", 
      label: "Members", 
      href: "/admin/members", 
      allowed: canManageMembers(currentRole),
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      )
    },
    { 
      id: "gallery", 
      label: "Gallery", 
      href: "/admin/gallery", 
      allowed: canUploadGallery(currentRole),
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
          <circle cx="9" cy="9" r="2"/>
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
        </svg>
      )
    },
    { 
      id: "shorts", 
      label: "Shorts & Media", 
      href: "/admin/shorts", 
      allowed: canUploadContent(currentRole),
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="23 7 16 12 23 17 23 7"/>
          <rect width="14" height="14" x="1" y="5" rx="2" ry="2"/>
        </svg>
      )
    },
    { 
      id: "announcements", 
      label: "Announcements", 
      href: "/admin/announcements", 
      allowed: canSendAnnouncements(currentRole),
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 11 18-5v12L3 14v-3z"/>
          <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
        </svg>
      )
    },
  ], [currentRole, isAuthorizedAdmin]);

  const availableTabs = useMemo(() => tabs.filter(t => t.allowed), [tabs]);

  useEffect(() => {
    if (loading) return;

    if (!user || !isAuthorizedAdmin) {
      router.replace("/");
      return;
    }

    // Protection: If currently on a tab the admin has no permission for, redirect to first allowed tab
    const currentTab = tabs.find(t => t.href === pathname);
    if (currentTab && !currentTab.allowed && availableTabs.length > 0) {
      router.replace(availableTabs[0].href);
    }
  }, [user, isAuthorizedAdmin, loading, pathname, tabs, availableTabs, router]);

  if (loading || !isAuthorizedAdmin) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[#0A0A0A]">
        <div className="w-8 h-8 border-4 border-cms-yellow border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0A0A0A] text-white pb-safe">
      {/* ── Top Header with Executive Role Badge ── */}
      <header className="flex items-center justify-between px-4 py-4 border-b border-white/5 sticky top-0 bg-[#0A0A0A]/95 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/profile")} className="p-1 -ml-1 text-white/70 hover:text-cms-yellow transition-colors">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div>
            <h1 className="text-sm font-bold tracking-wide uppercase">Admin Portal</h1>
            <p className="text-[10px] text-white/40 leading-none mt-0.5 truncate max-w-[200px]">{userData?.displayName || user?.email}</p>
          </div>
        </div>

        {/* Executive Role Badge */}
        <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1.5 shadow-sm ${roleMeta.badgeClass}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
          <span>{displayTitle}</span>
        </div>
      </header>

      {/* ── Dynamic Permission-Based Navigation Tabs with Proper SVG Icons ── */}
      <div className="flex overflow-x-auto px-4 py-3 gap-2 border-b border-white/5 no-scrollbar shrink-0 bg-[#0c0c0e]">
        {availableTabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link key={tab.id} href={tab.href}>
              <div className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all active:scale-95 ${
                isActive 
                  ? "bg-cms-yellow text-black shadow-md shadow-cms-yellow/20" 
                  : "bg-white/[0.04] text-white/70 hover:text-white border border-white/5 hover:bg-white/[0.08]"
              }`}>
                <span className={isActive ? "text-black" : "text-white/60"}>{tab.icon}</span>
                <span>{tab.label}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Tab Content Viewport ── */}
      <div className="flex-1 overflow-y-auto pb-24">
        {children}
      </div>
      
      <BottomNav />
    </div>
  );
}
