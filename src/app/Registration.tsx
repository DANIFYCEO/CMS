"use client";

import Image from "next/image";
import { useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import UniversitySelect from "@/components/UniversitySelect";

export default function Registration({ onGoLogin }: { onGoLogin: () => void }) {
  const [step, setStep] = useState(1);
  const [legalModal, setLegalModal] = useState<"NONE" | "TOS" | "PRIVACY">("NONE");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [university, setUniversity] = useState("");
  const [customUniversity, setCustomUniversity] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [expectedOtp, setExpectedOtp] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [resendStatus, setResendStatus] = useState("");
  const { register, loginWithGoogle } = useAuth();
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  return (
    <>
      {showSuccess && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center animate-in fade-in duration-500">
          <div className="w-32 h-32 rounded-full bg-cms-yellow/20 flex items-center justify-center mb-6 animate-in zoom-in duration-500">
            <div className="w-24 h-24 rounded-full bg-cms-yellow flex items-center justify-center animate-in zoom-in duration-500 delay-150 fill-mode-both">
              <svg className="w-12 h-12 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" className="animate-[dash_0.4s_ease-out_0.4s_forwards]" strokeDasharray="24" strokeDashoffset="24" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-cms-yellow animate-in slide-in-from-bottom-4 fade-in duration-500 delay-300">Verified!</h2>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes dash {
              to { stroke-dashoffset: 0; }
            }
          `}} />
        </div>
      )}

      <div className="flex flex-col min-h-[100dvh] bg-black text-white overflow-y-auto">
        {/* ── Header row ── */}
        <div className="px-5 pt-6 pb-2">
        {step > 1 && (
          <button onClick={() => setStep(step === 3 ? 2 : 1)} className="mb-4 text-white/70 hover:text-white" aria-label="Go back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          </button>
        )}

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[22px] font-bold leading-tight">
              {step === 1 ? "Create Your CMS Account" : step === 2 ? "Secure Your Account" : "Verify Your Account"}
            </h1>
            <p className="text-sm text-white/50 mt-1">
              {step === 1 ? "Join the CMS community today!" : step === 2 ? "Create a strong password" : "Enter the code sent to your email/phone"}
            </p>
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
        </div>
      </div>

      {/* ── Form ── */}
      <div className="flex-1 px-5 pt-4 pb-4 space-y-4">
        {step === 1 && (
          <>
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Full Name</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full bg-transparent border border-white/20 rounded-xl py-3.5 pl-11 pr-4 text-sm placeholder:text-white/30 focus:outline-none focus:border-cms-yellow transition-colors"
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><path d="M12 8v2"/></svg>
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/\s+/g, '').toLowerCase())}
                  placeholder="Choose a username"
                  className="w-full bg-transparent border border-white/20 rounded-xl py-3.5 pl-11 pr-4 text-sm placeholder:text-white/30 focus:outline-none focus:border-cms-yellow transition-colors"
                />
              </div>
            </div>

            {/* Email / Phone */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Email / Phone</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email or phone number"
                  className="w-full bg-transparent border border-white/20 rounded-xl py-3.5 pl-11 pr-4 text-sm placeholder:text-white/30 focus:outline-none focus:border-cms-yellow transition-colors"
                />
              </div>
              <p className="text-xs text-white/40 mt-2">You will need to verify this later.</p>
            </div>

            {/* University / Campus with Instant Search */}
            <UniversitySelect
              value={university}
              onChange={setUniversity}
              customValue={customUniversity}
              onCustomChange={setCustomUniversity}
              required={true}
            />

            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

            <button
              onClick={() => {
                setError("");
                if (!fullName.trim() || !email.trim() || !username.trim()) {
                  setError("Please fill in all fields.");
                  return;
                }
                const finalUni = university === "Other / Custom Institution" ? customUniversity.trim() : university.trim();
                if (!finalUni) {
                  setError("Please select or enter your university/institution.");
                  return;
                }
                if (username.length < 3) {
                  setError("Username must be at least 3 characters.");
                  return;
                }
                if (email.includes("@") && !email.toLowerCase().endsWith("@gmail.com")) {
                  setError("put a valid email account");
                  return;
                }
                setStep(2);
              }}
              className="w-full bg-cms-yellow text-black font-bold text-base rounded-xl py-3.5 mt-4 active:opacity-80 transition-opacity"
            >
              Next
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
                  setError("");
                  await loginWithGoogle();
                  // No need to redirect manually, page.tsx will handle the state change
                } catch (err: any) {
                  if (err?.code === 'auth/cancelled-popup-request' || err?.code === 'auth/popup-closed-by-user') {
                    return; // Ignore if user closed popup
                  }
                  if (err?.code === 'auth/unauthorized-domain') {
                    setError("Domain not authorized in Firebase Console. Please add this domain to Firebase Console -> Authentication -> Settings -> Authorized Domains.");
                    return;
                  }
                  if (err?.code === 'auth/popup-blocked') {
                    setError("Popup was blocked by your browser. Please enable popups for this site.");
                    return;
                  }
                  if (err?.code === 'auth/operation-not-allowed') {
                    setError("Google Sign-In is not enabled in Firebase Console -> Authentication -> Sign-in method.");
                    return;
                  }
                  setError(err?.message || "Google sign up failed. Please try again.");
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
              Sign up with Google
            </button>
          </>
        )}

        {step === 2 && (
          <>
            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full bg-transparent border border-white/20 rounded-xl py-3.5 pl-11 pr-11 text-sm placeholder:text-white/30 focus:outline-none focus:border-cms-yellow transition-colors"
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

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Confirm Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="w-full bg-transparent border border-white/20 rounded-xl py-3.5 pl-11 pr-11 text-sm placeholder:text-white/30 focus:outline-none focus:border-cms-yellow transition-colors"
                />
              </div>
            </div>

            {/* Terms checkbox */}
            <label className="flex items-center gap-3 cursor-pointer mt-4">
              <input 
                type="checkbox" 
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="w-5 h-5 rounded border-white/30 bg-transparent accent-[#FFB400] shrink-0" 
              />
              <span className="text-xs text-white/70">
                I agree to the <button type="button" onClick={(e) => { e.preventDefault(); setLegalModal("TOS"); }} className="text-cms-yellow underline">Terms of Service</button> and <button type="button" onClick={(e) => { e.preventDefault(); setLegalModal("PRIVACY"); }} className="text-cms-yellow underline">Privacy Policy</button>
              </span>
            </label>

            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

            <button
              onClick={async () => {
                setError("");
                if (!acceptedTerms) {
                  setError("You must agree to the Terms of Service and Privacy Policy.");
                  return;
                }
                if (password !== confirmPassword) {
                  setError("Passwords do not match");
                  return;
                }
                if (password.length < 6) {
                  setError("Password must be at least 6 characters");
                  return;
                }
                setIsLoading(true);
                try {
                  const code = Math.floor(1000 + Math.random() * 9000).toString();
                  setExpectedOtp(code);
                  
                  const finalUni = university === "Other / Custom Institution" ? customUniversity.trim() : university.trim();
                  const res = await fetch('/api/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, code, fullName, university: finalUni })
                  });
                  
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || "Failed to send verification email");
                  }
                  
                  // Move to the OTP screen (Step 3)
                  setStep(3);
                } catch (err: any) {
                  setError(err?.message || "Failed to send verification email. Please try again.");
                } finally {
                  setIsLoading(false);
                }
              }}
              className="w-full bg-cms-yellow text-black font-bold text-base rounded-xl py-3.5 mt-4 active:opacity-80 transition-opacity disabled:opacity-50"
            >
              {isLoading ? "Sending Code..." : "Sign Up"}
            </button>
          </>
        )}

        {step === 3 && (
          <>
            {/* OTP Verification */}
            <div className="flex justify-center gap-3 my-8">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => {
                    const val = e.target.value;
                    const newOtp = [...otp];
                    newOtp[index] = val;
                    setOtp(newOtp);
                    
                    if (val && index < 3) {
                      inputRefs.current[index + 1]?.focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !otp[index] && index > 0) {
                      inputRefs.current[index - 1]?.focus();
                    }
                  }}
                  className="w-14 h-14 text-center text-2xl font-bold bg-white/5 border border-white/20 rounded-xl focus:outline-none focus:border-cms-yellow transition-colors"
                  placeholder="-"
                />
              ))}
            </div>

            <p className="text-center text-sm text-white/60 mb-8">
              Didn't receive the code?{" "}
              <button
                className="text-cms-yellow font-semibold active:opacity-70"
                onClick={async () => {
                  setResendStatus("Sending...");
                  try {
                    const code = Math.floor(1000 + Math.random() * 9000).toString();
                    setExpectedOtp(code);
                    const finalUni = university === "Other / Custom Institution" ? customUniversity.trim() : university.trim();
                    const res = await fetch('/api/send-otp', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email, code, fullName, university: finalUni })
                    });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      throw new Error(data.error || "Failed to resend code");
                    }
                    setResendStatus("Code resent!");
                    setTimeout(() => setResendStatus(""), 3000);
                  } catch (err: any) {
                    setResendStatus(err?.message || "Failed to resend");
                  }
                }}
              >
                Resend
              </button>
            </p>
            {resendStatus && <p className="text-cms-yellow text-center text-xs mb-4">{resendStatus}</p>}

            {error && <p className="text-red-400 text-center text-xs mb-4">{error}</p>}

            <button
              onClick={async () => {
                setError("");
                
                if (otp.join("") !== expectedOtp) {
                  setError("Incorrect verification code.");
                  return;
                }

                setIsLoading(true);
                setShowSuccess(true);
                
                // Keep the success animation on screen for 2 seconds
                setTimeout(async () => {
                  try {
                    const finalUni = university === "Other / Custom Institution" ? customUniversity.trim() : university.trim();
                    await register(email, password, fullName, username, finalUni);
                    // page.tsx will detect the user auth state change and switch to HOME!
                  } catch (err: unknown) {
                    setShowSuccess(false); // Hide success screen if firebase fails
                    if (err instanceof Error) {
                      if (err.message.includes("email-already-in-use")) {
                        setError("This email is already registered. Please log in instead.");
                      } else if (err.message.includes("invalid-email")) {
                        setError("Please enter a valid email address.");
                      } else if (err.message.includes("weak-password")) {
                        setError("Your password is too weak.");
                      } else if (err.message.includes("username-taken")) {
                        setError("This username is already taken. Please go back and choose another.");
                      } else {
                        setError("Failed to create account. Please try again.");
                      }
                    } else {
                      setError("An unexpected error occurred.");
                    }
                  } finally {
                    setIsLoading(false);
                  }
                }, 2000);
              }}
              disabled={isLoading}
              className="w-full bg-cms-yellow text-black font-bold text-base rounded-xl py-3.5 active:opacity-80 transition-opacity disabled:opacity-50"
            >
              {isLoading ? "Verifying..." : "Verify & Continue"}
            </button>
          </>
        )}

        {/* Login link only on Step 1 */}
        {step === 1 && (
          <p className="text-center text-sm text-white/50 pt-4 pb-2">
            Already have an account? <button onClick={onGoLogin} className="text-cms-yellow font-semibold">Login</button>
          </p>
        )}
      </div>

      {/* ── Legal Modal ── */}
      {legalModal !== "NONE" && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setLegalModal("NONE")}></div>
          <div className="relative bg-[#1A1A1A] w-full max-w-[430px] max-h-[85vh] rounded-t-3xl sm:rounded-3xl flex flex-col animate-in slide-in-from-bottom-10 duration-300">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-lg font-bold">
                {legalModal === "TOS" ? "Terms of Service" : "Privacy Policy"}
              </h2>
              <button onClick={() => setLegalModal("NONE")} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="p-6 overflow-y-auto text-sm text-white/80 space-y-4 pb-12">
              {legalModal === "TOS" ? (
                <>
                  <p><strong>1. Acceptance of Terms</strong><br/>By accessing and using the Campus Movie Series (CMS) application, you accept and agree to be bound by the terms and provision of this agreement.</p>
                  <p><strong>2. User Accounts</strong><br/>You must register an account to access certain features. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
                  <p><strong>3. Content Guidelines</strong><br/>Users must not post, upload, or share any content that is illegal, abusive, harassing, or violates any third-party rights. CMS reserves the right to remove any content at our discretion.</p>
                  <p><strong>4. Intellectual Property</strong><br/>All original content produced by CMS, including movies, series, and shorts, are the exclusive property of Campus Movie Series and are protected by copyright laws.</p>
                  <p><strong>5. Modifications</strong><br/>We reserve the right to modify these terms at any time. Continued use of the app constitutes acceptance of any updated terms.</p>
                </>
              ) : (
                <>
                  <p><strong>1. Information We Collect</strong><br/>We collect information you provide directly to us, such as your name, email address, and phone number when you register for an account.</p>
                  <p><strong>2. How We Use Your Information</strong><br/>We use the information we collect to operate, maintain, and improve our services, as well as to communicate with you about updates, offers, and events.</p>
                  <p><strong>3. Data Sharing</strong><br/>We do not sell your personal data to third parties. We may share data with service providers who assist us in operating our platform, subject to strict confidentiality agreements.</p>
                  <p><strong>4. Security</strong><br/>We implement reasonable security measures to protect your personal information from unauthorized access, alteration, or disclosure.</p>
                  <p><strong>5. Your Rights</strong><br/>You have the right to access, update, or delete your personal information at any time through your account settings.</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
