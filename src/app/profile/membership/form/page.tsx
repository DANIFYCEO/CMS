"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function MembershipFormPage() {
  const router = useRouter();
  const { user, userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    creativeDepartments: [] as string[],
    stageName: "",
    placeOfBirth: "",
    dateOfBirth: "",
    fullAddress: "",
    maritalStatus: "",
    nationality: "",
    phoneNo: "",
    religion: "",
    cityCountry: "",
    educationStatus: "",
    gender: "",
    whatsapp: "",
    institution: "",
    reasonToJoin: ""
  });

  useEffect(() => {
    if (userData?.registrationForm) {
      setFormData(prev => ({
        ...prev,
        ...userData.registrationForm,
        creativeDepartments: userData.registrationForm.creativeDepartments || []
      }));
    }
  }, [userData]);

  const departmentsList = [
    "Director", "Actress", "Actor", 
    "Cinematographer / DOP", "Voice-over Artist", "Makeup Artist", "Editor"
  ];

  const handleDeptToggle = (dept: string) => {
    setFormData(prev => {
      const exists = prev.creativeDepartments.includes(dept);
      if (exists) {
        return { ...prev, creativeDepartments: prev.creativeDepartments.filter(d => d !== dept) };
      } else {
        return { ...prev, creativeDepartments: [...prev.creativeDepartments, dept] };
      }
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      await updateDoc(doc(db, "users", user.uid), {
        registrationForm: formData,
        formCompleted: true
      });
      setSuccess(true);
    } catch (err) {
      console.error(err);
      alert("Failed to save form. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-[#0A0A0A] text-white pb-safe overflow-y-auto">
        <header className="flex items-center gap-4 px-4 py-5 border-b border-white/5 sticky top-0 bg-[#0A0A0A]/90 backdrop-blur-md z-50">
          <h1 className="text-[15px] font-bold tracking-wide uppercase">Form Complete</h1>
        </header>
        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center mb-6">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-4">Registration Complete!</h2>
          <p className="text-white/70 mb-8 max-w-sm">
            Thank you for filling out your details. Your CMS profile is now fully updated.
          </p>
          <button 
            onClick={() => router.push("/profile")}
            className="w-full max-w-sm bg-cms-yellow text-black font-bold py-3.5 rounded-xl active:scale-95 transition-transform"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0A0A0A] text-white pb-safe overflow-y-auto">
      <header className="flex items-center gap-4 px-4 py-5 border-b border-white/5 sticky top-0 bg-[#0A0A0A]/90 backdrop-blur-md z-50">
        <button onClick={() => router.back()} className="p-1 -ml-1 text-white hover:text-cms-yellow transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 className="text-[15px] font-bold tracking-wide uppercase">CMS Registration Form</h1>
      </header>

      <div className="p-4 flex flex-col flex-1">
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-1 text-cms-yellow">Complete Your Profile</h2>
          <p className="text-sm text-white/60">Members are allowed to join any department and participate in any production role.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          
          {/* Membership Category */}
          <div className="bg-[#111] p-5 rounded-2xl border border-white/10">
            <h3 className="font-bold mb-4 uppercase tracking-wider text-sm">Membership Category</h3>
            
            <div className="mb-5">
              <label className="text-xs text-white/50 mb-3 block font-bold">CREATIVE DEPARTMENT(S) (Tick all that apply)</label>
              <div className="grid grid-cols-2 gap-3">
                {departmentsList.map(dept => {
                  const isChecked = formData.creativeDepartments.includes(dept);
                  return (
                    <div 
                      key={dept} 
                      onClick={() => handleDeptToggle(dept)}
                      role="checkbox"
                      aria-checked={isChecked}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          handleDeptToggle(dept);
                        }
                      }}
                      className={`border rounded-xl p-3 flex items-start gap-2.5 cursor-pointer select-none transition-all active:scale-[0.98] ${
                        isChecked 
                          ? "border-cms-yellow bg-cms-yellow/15 shadow-sm shadow-cms-yellow/10" 
                          : "border-white/10 hover:border-white/20 bg-white/[0.02]"
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        isChecked ? "border-cms-yellow bg-cms-yellow" : "border-white/30 bg-black/40"
                      }`}>
                        {isChecked && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </div>
                      <span className={`text-xs font-medium leading-tight ${isChecked ? "text-cms-yellow font-bold" : "text-white/80"}`}>
                        {dept}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">Stage/Celebrity Name (Optional)</label>
              <input 
                type="text" 
                name="stageName"
                value={formData.stageName}
                onChange={handleChange}
                className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cms-yellow outline-none"
              />
            </div>
          </div>

          {/* Personal Information */}
          <div className="bg-[#111] p-5 rounded-2xl border border-white/10 flex flex-col gap-5">
            <h3 className="font-bold uppercase tracking-wider text-sm border-b border-white/10 pb-3">Personal Information</h3>
            
            <div>
              <label className="text-xs text-white/50 font-bold mb-2 block">Full Name</label>
              <input type="text" name="fullName" defaultValue={userData?.displayName || ""} disabled className="w-full bg-[#1A1A1A] border border-white/5 rounded-xl px-4 py-3 text-white/50 outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/50 font-bold mb-2 block">Place of Birth</label>
                <input type="text" name="placeOfBirth" value={formData.placeOfBirth} onChange={handleChange} required className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cms-yellow outline-none" />
              </div>
              <div>
                <label className="text-xs text-white/50 font-bold mb-2 block">Date of Birth</label>
                <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} required className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cms-yellow outline-none" />
              </div>
            </div>

            <div>
              <label className="text-xs text-white/50 font-bold mb-2 block">Full Address</label>
              <input type="text" name="fullAddress" value={formData.fullAddress} onChange={handleChange} required className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cms-yellow outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/50 font-bold mb-2 block">Status</label>
                <select name="maritalStatus" value={formData.maritalStatus} onChange={handleChange} required className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cms-yellow outline-none">
                  <option value="">Select...</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorce">Divorce</option>
                  <option value="Others">Others</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 font-bold mb-2 block">Gender</label>
                <select name="gender" value={formData.gender} onChange={handleChange} required className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cms-yellow outline-none">
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/50 font-bold mb-2 block">Nationality</label>
                <input type="text" name="nationality" value={formData.nationality} onChange={handleChange} required className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cms-yellow outline-none" />
              </div>
              <div>
                <label className="text-xs text-white/50 font-bold mb-2 block">Phone No</label>
                <input type="tel" name="phoneNo" value={formData.phoneNo} onChange={handleChange} required className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cms-yellow outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/50 font-bold mb-2 block">Religion</label>
                <input type="text" name="religion" value={formData.religion} onChange={handleChange} className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cms-yellow outline-none" />
              </div>
              <div>
                <label className="text-xs text-white/50 font-bold mb-2 block">City / Country</label>
                <input type="text" name="cityCountry" value={formData.cityCountry} onChange={handleChange} required className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cms-yellow outline-none" />
              </div>
            </div>

            <div>
              <label className="text-xs text-white/50 font-bold mb-2 block">E-Mail</label>
              <input type="email" name="email" defaultValue={userData?.email || ""} disabled className="w-full bg-[#1A1A1A] border border-white/5 rounded-xl px-4 py-3 text-white/50 outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/50 font-bold mb-2 block">Education Status</label>
                <select name="educationStatus" value={formData.educationStatus} onChange={handleChange} required className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cms-yellow outline-none">
                  <option value="">Select...</option>
                  <option value="Yes (Student)">Yes (Student)</option>
                  <option value="Graduate">Graduate</option>
                  <option value="No">No</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 font-bold mb-2 block">WhatsApp Number</label>
                <input type="tel" name="whatsapp" value={formData.whatsapp} onChange={handleChange} required className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cms-yellow outline-none" />
              </div>
            </div>

            <div>
              <label className="text-xs text-white/50 font-bold mb-2 block">Institution (If applicable)</label>
              <input type="text" name="institution" value={formData.institution} onChange={handleChange} className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cms-yellow outline-none" />
            </div>

            <div>
              <label className="text-xs text-white/50 font-bold mb-2 block">Why do you want to join CMS?</label>
              <textarea 
                name="reasonToJoin" 
                value={formData.reasonToJoin} 
                onChange={handleChange} 
                required 
                rows={3}
                className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cms-yellow outline-none resize-none" 
              />
            </div>
            
            {userData?.cmsId && (
              <div>
                <label className="text-xs text-white/50 font-bold mb-2 block">ID No.</label>
                <input type="text" defaultValue={userData.cmsId} disabled className="w-full bg-cms-yellow/10 border border-cms-yellow/30 rounded-xl px-4 py-3 text-cms-yellow font-bold tracking-widest outline-none" />
              </div>
            )}
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-cms-yellow text-black font-bold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50 mt-4 shadow-lg shadow-cms-yellow/20"
          >
            {loading ? "Saving..." : "Submit Registration Form"}
          </button>
        </form>
      </div>
    </div>
  );
}

