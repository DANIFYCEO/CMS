"use client";

import { useState, useEffect, Suspense } from "react";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode"); // The token from Firebase

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"VERIFYING" | "READY" | "SUCCESS" | "INVALID">("VERIFYING");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!oobCode) {
      setStatus("INVALID");
      return;
    }

    // Verify the code is valid and hasn't expired before showing the form
    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        setEmail(email);
        setStatus("READY");
      })
      .catch(() => {
        setStatus("INVALID");
      });
  }, [oobCode]);

  const handleReset = async () => {
    setError("");
    if (!newPassword || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!oobCode) return;

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setStatus("SUCCESS");
    } catch (err) {
      setError("Failed to reset password. The link may have expired.");
    }
  };

  if (status === "VERIFYING") {
    return (
      <div className="min-h-[100dvh] bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cms-yellow/20 border-t-cms-yellow rounded-full animate-spin"></div>
      </div>
    );
  }

  if (status === "SUCCESS") {
    return (
      <div className="min-h-[100dvh] bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 rounded-full bg-cms-yellow/20 flex items-center justify-center mb-6 animate-in zoom-in duration-500">
          <div className="w-16 h-16 rounded-full bg-cms-yellow flex items-center justify-center text-black">
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-4">Password Reset!</h1>
        <p className="text-white/60 mb-8 max-w-sm">
          Your password has been securely updated. You can now log in with your new password.
        </p>
        <button 
          onClick={() => window.location.href = "/?login=true"}
          className="w-full max-w-sm bg-cms-yellow text-black font-bold py-4 rounded-xl active:scale-[0.98] transition-transform"
        >
          Return to Login
        </button>
      </div>
    );
  }

  if (status === "INVALID") {
    return (
      <div className="min-h-[100dvh] bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white">
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-4">Invalid Link</h1>
        <p className="text-white/60 mb-8 max-w-sm">
          This password reset link is invalid or has expired. Please request a new one from the login screen.
        </p>
        <button 
          onClick={() => window.location.href = "/?login=true"}
          className="w-full max-w-sm bg-cms-yellow text-black font-bold py-4 rounded-xl active:scale-[0.98] transition-transform"
        >
          Return to Login
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-black text-white p-6 flex flex-col">
      <div className="flex-1 max-w-md w-full mx-auto flex flex-col justify-center">
        <h1 className="text-[28px] font-bold mb-2">Create New Password</h1>
        <p className="text-white/60 mb-10 text-sm">
          Please enter your new password for {email}.
        </p>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white/80 pl-1 uppercase tracking-wider">New Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
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

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white/80 pl-1 uppercase tracking-wider">Confirm Password</label>
            <input 
              type={showPassword ? "text" : "password"} 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-cms-yellow transition-colors placeholder:text-white/30"
            />
          </div>
        </div>

        {error && <p className="text-red-400 text-xs mt-4 text-center">{error}</p>}

        <button 
          onClick={handleReset}
          className="w-full bg-cms-yellow text-black font-bold py-4 rounded-xl mt-8 active:scale-[0.98] transition-transform"
        >
          Change Password
        </button>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-black" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}