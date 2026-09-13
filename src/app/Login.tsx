"use client";

import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";

export default function Login({ onLogin, onGoRegister }: { onLogin: () => void, onGoRegister: () => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const { login, loginWithGoogle } = useAuth();

  const handleLogin = async () => {
    setError("");
    setResetMsg("");
    if (!identifier || !password) {
      setError("Please fill in all fields");
      return;
    }
    setIsLoading(true);
    try {
      await login(identifier, password);
      onLogin();
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes("user-not-found")) {
          setError("This account is not registered. Please sign up instead.");
        } else if (err.message.includes("invalid-credential") || err.message.includes("wrong-password")) {
          setError("Incorrect credentials. Please try again.");
        } else if (err.message.includes("too-many-requests")) {
          setError("Too many failed attempts. Please try again later.");
        } else {
          setError("Failed to sign in. Please check your credentials.");
        }
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-black text-white overflow-y-auto">
      {/* ── Header ── */}
      <header className="px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-cms-yellow rounded-full"></div>
          <p className="text-sm font-semibold tracking-wide">LOGIN</p>
        </div>
        <div className="w-20 shrink-0 ml-4">
          <Image 
            src="/logo_original.jpg" 
            alt="CMS Logo" 
            width={120} 
            height={60}
            priority
            className="w-full h-auto object-contain mix-blend-screen"
          />
        </div>
      </header>

      {/* ── Form ── */}
      <div className="flex-1 flex flex-col px-6 pt-2 pb-safe">
        <h1 className="text-3xl font-extrabold leading-tight mb-2">Welcome Back!</h1>
        <p className="text-sm text-white/60 mb-6">
          Sign in to pick up where you left off.
        </p>

        <div className="flex flex-col gap-4">
          <div className="mb-4">
            <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">Email, Username, or CMS ID</label>
            <input 
              type="text" 
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Enter your email, username, or CMS ID"
              required
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-cms-yellow transition-colors placeholder:text-white/30"
            />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white/80 pl-1 uppercase tracking-wider">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3.5 pr-11 text-sm outline-none focus:border-cms-yellow transition-colors placeholder:text-white/30"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors p-1"
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
        {resetMsg && <p className="text-cms-yellow text-xs mt-3">{resetMsg}</p>}

        <button 
          onClick={async () => {
            setError("");
            setResetMsg("");
            if (!identifier) {
              setError("Please enter your email or username first");
              return;
            }
            setIsResetting(true);
            try {
              const res = await fetch('/api/send-reset-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier })
              });
              
              if (!res.ok) {
                const data = await res.json();
                if (data.error === "user-not-found") throw new Error("user-not-found");
                throw new Error("API failed");
              }
              
              setResetMsg("Password reset email sent! Check your inbox.");
            } catch (err: unknown) {
              if (err instanceof Error && err.message === "user-not-found") {
                setError("This account is not registered.");
              } else {
                setError("Failed to send reset email. Please try again.");
              }
            } finally {
              setIsResetting(false);
            }
          }}
          disabled={isResetting || isLoading}
          className="text-cms-yellow text-sm font-semibold text-right mt-4 mb-4 active:opacity-70 disabled:opacity-50"
        >
          {isResetting ? "Sending link..." : "Forgot Password?"}
        </button>

        <button 
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full bg-cms-yellow text-black font-bold py-3.5 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {isLoading ? "Signing In..." : "Sign In"}
        </button>

        <div className="relative flex items-center py-3">
          <div className="flex-grow border-t border-white/10"></div>
          <span className="flex-shrink-0 mx-4 text-white/40 text-xs font-semibold">OR</span>
          <div className="flex-grow border-t border-white/10"></div>
        </div>

        <button 
          onClick={async () => {
            try {
              setIsLoading(true);
              await loginWithGoogle();
              onLogin();
            } catch (err: any) {
              if (err?.code === 'auth/cancelled-popup-request' || err?.code === 'auth/popup-closed-by-user') {
                return; // User just closed the popup, no need to show an error
              }
              setError("Google sign in failed. Please try again.");
            } finally {
              setIsLoading(false);
            }
          }}
          className="w-full bg-white text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-transform"
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Sign in with Google
        </button>

        <p className="text-center text-sm text-white/50 mt-auto pt-4 pb-2">
          Don&apos;t have an account? <button onClick={onGoRegister} className="text-cms-yellow font-semibold">Sign Up</button>
        </p>
      </div>
    </div>
  );
}
