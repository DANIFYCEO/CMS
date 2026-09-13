"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { 
  User, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  updateProfile, 
  sendPasswordResetEmail 
} from "firebase/auth";
import { doc, getDoc, onSnapshot, collection, query, where, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

import { AdminRole, INITIAL_ADMIN_ROLES, normalizeAdminRole } from "@/lib/adminRoles";

export interface UserProfileData {
  uid: string;
  email: string;
  displayName: string;
  username: string;
  university?: string;
  photoURL?: string;
  membership?: string;
  isAdmin?: boolean;
  role?: AdminRole | string;
  adminTitle?: string;
  cmsId?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  userData: UserProfileData | null;
  loading: boolean;
  register: (email: string, password: string, fullName: string, username: string, university?: string) => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  register: async () => {},
  login: async () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
  resetPassword: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubsribeSnapshot: (() => void) | null = null;
    
    // Safety fallback: ensure loading never hangs if Firebase Auth is slow/reconnecting
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      clearTimeout(safetyTimer);
      setUser(currentUser);
      
      if (unsubsribeSnapshot) {
        unsubsribeSnapshot();
        unsubsribeSnapshot = null;
      }

      if (currentUser && db) {
        const userEmailLower = (currentUser.email || "").toLowerCase().trim();
        const initialConfig = INITIAL_ADMIN_ROLES[userEmailLower];

        unsubsribeSnapshot = onSnapshot(doc(db, "users", currentUser.uid), (userDoc) => {
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfileData;
            
            // Check if user is one of the designated initial leadership accounts and needs provisioning
            if (initialConfig && (data.role !== initialConfig.role || data.isAdmin !== true || (initialConfig.cmsId && !data.cmsId))) {
              setDoc(doc(db, "users", currentUser.uid), {
                isAdmin: true,
                role: initialConfig.role,
                adminTitle: initialConfig.title,
                ...(initialConfig.cmsId && !data.cmsId ? { cmsId: initialConfig.cmsId } : {})
              }, { merge: true }).catch(console.error);
            }

            setUserData(data);
          } else {
            const newUserData: UserProfileData = {
              uid: currentUser.uid,
              email: currentUser.email || "",
              displayName: initialConfig?.name || currentUser.displayName || "CMS Member",
              username: "",
              isAdmin: !!initialConfig,
              role: initialConfig ? initialConfig.role : "member",
              adminTitle: initialConfig?.title,
              cmsId: initialConfig?.cmsId,
            };
            
            setDoc(doc(db, "users", currentUser.uid), {
              ...newUserData,
              createdAt: serverTimestamp(),
            }, { merge: true }).catch(console.error);

            setUserData(newUserData);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error fetching user profile realtime:", error);
          setLoading(false);
        });
      } else {
        setUserData(null);
        setLoading(false);
      }
    });
    
    return () => {
      clearTimeout(safetyTimer);
      unsubscribeAuth();
      if (unsubsribeSnapshot) {
        unsubsribeSnapshot();
      }
    };
  }, []);

  const register = async (email: string, password: string, fullName: string, username: string, university?: string) => {
    const cleanUsername = username.trim().toLowerCase();
    
    // Check if username is already taken
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", cleanUsername));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      throw new Error("username-taken");
    }

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    
    // Set display name in auth
    await updateProfile(cred.user, { displayName: fullName });

    const newProfile: UserProfileData = {
      uid: cred.user.uid,
      email: cred.user.email || email,
      displayName: fullName,
      username: cleanUsername,
      university: university?.trim() || "",
      membership: "CMS Member",
    };

    // Create user document in Firestore
    try {
      await setDoc(doc(db, "users", cred.user.uid), {
        ...newProfile,
        createdAt: serverTimestamp(),
      });
      setUserData(newProfile);
    } catch (err) {
      console.warn("Firestore save user warning:", err);
    }
  };

  const login = async (identifier: string, password: string) => {
    let emailToUse = identifier.trim();

    // If identifier doesn't look like an email, assume it's a username or CMS ID
    if (!identifier.includes("@")) {
      const isCmsId = identifier.trim().toUpperCase().startsWith("CMS/");
      const usersRef = collection(db, "users");
      
      let q;
      if (isCmsId) {
        q = query(usersRef, where("cmsId", "==", identifier.trim().toUpperCase()));
      } else {
        q = query(usersRef, where("username", "==", identifier.trim().toLowerCase()));
      }

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        throw new Error("user-not-found");
      }
      
      const userDoc = querySnapshot.docs[0].data();
      if (userDoc.email) {
        emailToUse = userDoc.email;
      } else {
        throw new Error("user-not-found");
      }
    }

    await signInWithEmailAndPassword(auth, emailToUse, password);
  };

  const loginWithGoogle = async () => {
    const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    const cred = await signInWithPopup(auth, provider);
    
    // Save token for Youtube API calls if needed
    const credential = GoogleAuthProvider.credentialFromResult(cred);
    if (credential?.accessToken) {
      sessionStorage.setItem("youtube_access_token", credential.accessToken);
    }

    const usersRef = doc(db, "users", cred.user.uid);
    const userDoc = await getDoc(usersRef);
    
    if (!userDoc.exists()) {
      const userEmailLower = (cred.user.email || "").toLowerCase().trim();
      const initialConfig = INITIAL_ADMIN_ROLES[userEmailLower];

      const newProfile: UserProfileData = {
        uid: cred.user.uid,
        email: cred.user.email || "",
        displayName: initialConfig?.name || cred.user.displayName || "CMS Member",
        username: "",
        university: "",
        membership: "CMS Member",
        isAdmin: !!initialConfig,
        role: initialConfig ? initialConfig.role : "member",
        adminTitle: initialConfig?.title,
        cmsId: initialConfig?.cmsId,
      };
      await setDoc(usersRef, { ...newProfile, createdAt: serverTimestamp() });
      setUserData(newProfile);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUserData(null);
    sessionStorage.removeItem("cms_onboarded");
    sessionStorage.removeItem("youtube_access_token");
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, register, login, loginWithGoogle, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
