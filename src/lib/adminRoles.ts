export type AdminRole = 
  | "super_admin" 
  | "vice_president" 
  | "secretary" 
  | "content_admin" 
  | "member";

export interface AdminRoleMeta {
  role: AdminRole;
  title: string;
  shortTitle: string;
  badgeClass: string;
  borderClass: string;
  textClass: string;
  description: string;
  allowedTabs: string[];
}

export const ADMIN_ROLES_META: Record<AdminRole, AdminRoleMeta> = {
  super_admin: {
    role: "super_admin",
    title: "Super Admin / President",
    shortTitle: "President",
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    borderClass: "border-amber-400",
    textClass: "text-amber-300",
    description: "Full and highest access across all website and app systems.",
    allowedTabs: ["admins", "metrics", "payments", "members", "gallery", "shorts", "announcements"]
  },
  vice_president: {
    role: "vice_president",
    title: "Vice President",
    shortTitle: "Vice President",
    badgeClass: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
    borderClass: "border-indigo-400",
    textClass: "text-indigo-300",
    description: "Community management, member applications & directory, media upload/edit, and announcements.",
    allowedTabs: ["metrics", "members", "gallery", "shorts", "announcements"]
  },
  secretary: {
    role: "secretary",
    title: "Financial Secretary",
    shortTitle: "Secretary",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    borderClass: "border-emerald-400",
    textClass: "text-emerald-300",
    description: "Membership registrations, records, payment approvals, official notices, and comment moderation.",
    allowedTabs: ["metrics", "payments", "members", "announcements"]
  },
  content_admin: {
    role: "content_admin",
    title: "Social Media / Content Admin",
    shortTitle: "Content Admin",
    badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    borderClass: "border-rose-400",
    textClass: "text-rose-300",
    description: "Gallery uploads, shorts & media feed, community posts & moderation, and announcements.",
    allowedTabs: ["metrics", "gallery", "shorts", "announcements"]
  },
  member: {
    role: "member",
    title: "Member",
    shortTitle: "Member",
    badgeClass: "bg-white/10 text-white/60 border-white/10",
    borderClass: "border-white/20",
    textClass: "text-white/60",
    description: "Standard community member.",
    allowedTabs: []
  }
};

export interface InitialAdminConfig {
  role: AdminRole;
  title: string;
  name: string;
  cmsId?: string;
  isLeadDev?: boolean;
}

export const ROOT_SUPER_ADMIN_EMAILS = [
  "akachukwuazogu@gmail.com",
  "akachukwuazogu33@gmail.com",
  "azoguakachukwu@gmail.com",
  "josephazogu00@gmail.com",
  "giantlenspictures@gmail.com"
];

/**
 * Admins in this list operate in stealth mode:
 * They are completely hidden from all other admins in the Admin Team directory
 * and across public views, but can see everyone when logged in themselves.
 */
export const STEALTH_ADMIN_EMAILS = [
  "akachukwuazogu@gmail.com",
  "akachukwuazogu33@gmail.com",
  "azoguakachukwu@gmail.com",
  "josephazogu00@gmail.com"
];

export function isStealthAdmin(email?: string | null): boolean {
  if (!email) return false;
  return STEALTH_ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

export const INITIAL_ADMIN_ROLES: Record<string, InitialAdminConfig> = {
  "akachukwuazogu@gmail.com": {
    role: "super_admin",
    title: "Super Admin / Lead Developer",
    name: "Akachukwu Azogu",
    isLeadDev: true
  },
  "akachukwuazogu33@gmail.com": {
    role: "super_admin",
    title: "Super Admin / Lead Developer",
    name: "Akachukwu Azogu",
    isLeadDev: true
  },
  "azoguakachukwu@gmail.com": {
    role: "super_admin",
    title: "Super Admin / Lead Developer",
    name: "Joseph Azogu",
    isLeadDev: true
  },
  "josephazogu00@gmail.com": {
    role: "super_admin",
    title: "Super Admin / Lead Developer",
    name: "Joseph Azogu",
    isLeadDev: true
  },
  "giantlenspictures@gmail.com": {
    role: "super_admin",
    title: "President / Super Admin",
    name: "GIANT LENS PICTURES"
  },
  "lilangelisaac@gmail.com": {
    role: "vice_president",
    title: "CMS Vice President",
    name: "Isaac Blessing Chinecherem Angel (ANGEL_SPEAKS)"
  },
  "osicharmaine@gmail.com": {
    role: "secretary",
    title: "CMS Financial Secretary",
    name: "Osinachi Charmaine Okechukwu",
    cmsId: "CMS/2026/004"
  },
  "favourevans699@gmail.com": {
    role: "content_admin",
    title: "Social Media Manager / Content Admin",
    name: "Evans Chidera",
    cmsId: "CMS/2026/006"
  }
};

/**
 * Normalizes an admin role string or fallback to member
 */
export function normalizeAdminRole(role?: string | null, isAdmin?: boolean): AdminRole {
  if (!role && !isAdmin) return "member";
  if (role === "super_admin") return "super_admin";
  if (role === "vice_president") return "vice_president";
  if (role === "secretary") return "secretary";
  if (role === "content_admin") return "content_admin";
  // Backwards-compatibility with legacy boolean isAdmin or role === "admin"
  if (role === "admin" || isAdmin) return "super_admin";
  return "member";
}

/**
 * Permission check functions
 */
export function canManageAdmins(role?: string | null, isAdmin?: boolean): boolean {
  const norm = normalizeAdminRole(role, isAdmin);
  return norm === "super_admin";
}

export function canManagePayments(role?: string | null, isAdmin?: boolean): boolean {
  const norm = normalizeAdminRole(role, isAdmin);
  return norm === "super_admin" || norm === "secretary";
}

export function canManageMembers(role?: string | null, isAdmin?: boolean): boolean {
  const norm = normalizeAdminRole(role, isAdmin);
  return norm === "super_admin" || norm === "vice_president" || norm === "secretary";
}

export function canSuspendMembers(role?: string | null, isAdmin?: boolean): boolean {
  const norm = normalizeAdminRole(role, isAdmin);
  return norm === "super_admin" || norm === "vice_president";
}

export function canUploadGallery(role?: string | null, isAdmin?: boolean): boolean {
  const norm = normalizeAdminRole(role, isAdmin);
  return norm === "super_admin" || norm === "vice_president" || norm === "content_admin";
}

export function canUploadContent(role?: string | null, isAdmin?: boolean): boolean {
  const norm = normalizeAdminRole(role, isAdmin);
  return norm === "super_admin" || norm === "vice_president" || norm === "content_admin";
}

export function canDeleteContent(role?: string | null, isAdmin?: boolean): boolean {
  const norm = normalizeAdminRole(role, isAdmin);
  return norm === "super_admin";
}

export function canModerateCommunity(role?: string | null, isAdmin?: boolean): boolean {
  const norm = normalizeAdminRole(role, isAdmin);
  return ["super_admin", "vice_president", "secretary", "content_admin"].includes(norm);
}

export function canSendAnnouncements(role?: string | null, isAdmin?: boolean): boolean {
  const norm = normalizeAdminRole(role, isAdmin);
  return ["super_admin", "vice_president", "secretary", "content_admin"].includes(norm);
}

export function canAccessSettings(role?: string | null, isAdmin?: boolean): boolean {
  const norm = normalizeAdminRole(role, isAdmin);
  return norm === "super_admin";
}

export function isAllowedTab(tab: string, role?: string | null, isAdmin?: boolean): boolean {
  const norm = normalizeAdminRole(role, isAdmin);
  const meta = ADMIN_ROLES_META[norm];
  return meta ? meta.allowedTabs.includes(tab) : false;
}
