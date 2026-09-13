"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { doc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function MembershipRegistrationPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState("cms-member");
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("online");
  const [loading, setLoading] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferSubmitted, setTransferSubmitted] = useState(false);
  const [senderName, setSenderName] = useState("");

  const plans = [
    {
      id: "cms-member",
      title: "CMS Member",
      price: "₦8,000 / Year",
      desc: "Full access to CMS community, resources and updates.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 4h20M2 20h20M9 4v16M15 4v16"/> 
          <path d="M2 16l4-12 6 8 6-8 4 12z"/>
        </svg>
      ),
      benefits: [
        "CMS Member ID/Card",
        "Access to CMS community",
        "CMS announcements and updates",
        "Access to CMS activities and events",
        "Opportunity to participate in CMS projects",
        "Access to selected training/workshops",
        "Member recognition and networking"
      ]
    },
    {
      id: "premium-member",
      title: "Premium Member",
      price: "₦15,000 / Year",
      desc: "All CMS Member benefits + exclusive content and priority support.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="7"/>
          <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
        </svg>
      ),
      benefits: [
        "Priority access to CMS projects",
        "Priority consideration for movie/film roles",
        "Access to premium training sessions",
        "Exclusive CMS resources and materials",
        "Priority communication/support",
        "Special recognition in selected CMS activities",
        "Networking opportunities with CMS creative teams"
      ]
    },
    {
      id: "elite-member",
      title: "Elite Member",
      price: "₦25,000 / Year",
      desc: "All Premium benefits + 1-on-1 mentorship, projects review and more.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3h12l4 6-10 13L2 9Z"/>
          <path d="M11 3 8 9l4 13 4-13-3-6"/>
          <path d="M2 9h20"/>
        </svg>
      ),
      benefits: [
        "1-on-1 guidance/mentorship when available",
        "Priority access to major CMS projects",
        "Project/creative work review",
        "Leadership and coordination opportunities",
        "Advanced filmmaking/media sessions",
        "Direct access to selected CMS executive/team sessions",
        "Elite member recognition",
        "Opportunities to partner and collaborate in CMS productions"
      ]
    }
  ];

  const handleProceed = async () => {
    if (!user) {
      alert("Please login first.");
      return;
    }
    
    if (paymentMethod === "transfer") {
      setShowTransfer(true);
      return;
    }

    setLoading(true);
    try {
      await new Promise(r => setTimeout(r, 1500));
      
      const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
      const newCmsId = `CMS/${new Date().getFullYear()}/${randomPart}`;

      await updateDoc(doc(db, "users", user.uid), {
        membership: selectedPlan,
        cmsId: newCmsId
      });

      await fetch('/api/send-id-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          newId: newCmsId,
          name: user.displayName || "New Member"
        })
      });

      setSuccessId(newCmsId);
    } catch (err) {
      console.error(err);
      alert("Payment failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !senderName.trim()) return;

    setLoading(true);
    try {
      const selectedPlanDetails = plans.find(p => p.id === selectedPlan);
      
      await addDoc(collection(db, "payment_requests"), {
        userId: user.uid,
        email: user.email,
        displayName: user.displayName,
        planId: selectedPlan,
        planTitle: selectedPlanDetails?.title,
        amountExpected: selectedPlanDetails?.price,
        senderName: senderName.trim(),
        status: "pending",
        createdAt: serverTimestamp(),
      });
      
      setTransferSubmitted(true);
    } catch (err) {
      console.error(err);
      alert("Failed to submit verification request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (successId) {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-[#0A0A0A] text-white pb-safe overflow-y-auto">
        <header className="flex items-center gap-4 px-4 py-5 border-b border-white/5 sticky top-0 bg-[#0A0A0A]/90 backdrop-blur-md z-50">
          <button onClick={() => router.push("/profile/membership/form")} className="p-1 -ml-1 text-white hover:text-cms-yellow transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <h1 className="text-[15px] font-bold tracking-wide uppercase">Payment Successful</h1>
        </header>

        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center mb-6">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-4">Welcome to CMS!</h2>
          <p className="text-white/70 mb-6 max-w-sm">
            Your payment was successful and your membership badge has been awarded!
          </p>
          
          <div className="bg-[#111] border border-cms-yellow/50 p-5 rounded-xl mb-6 w-full max-w-sm">
            <p className="text-xs text-white/50 uppercase tracking-wider font-bold mb-1">Your Secure CMS ID</p>
            <p className="text-2xl font-black text-cms-yellow tracking-widest">{successId}</p>
          </div>

          <p className="text-sm text-white/50 mb-8 max-w-sm">
            We have generated this secure ID for you and sent it to your email for safekeeping. You will need this for official CMS offline events.
          </p>

          <button 
            onClick={() => router.push("/profile/membership/form")}
            className="w-full max-w-sm bg-cms-yellow text-black font-bold py-3.5 rounded-xl active:scale-95 transition-transform"
          >
            Next: Complete Registration Form
          </button>
        </div>
      </div>
    );
  }

  if (transferSubmitted) {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-[#0A0A0A] text-white pb-safe overflow-y-auto">
        <header className="flex items-center gap-4 px-4 py-5 border-b border-white/5 sticky top-0 bg-[#0A0A0A]/90 backdrop-blur-md z-50">
          <button onClick={() => router.push("/profile/membership/form")} className="p-1 -ml-1 text-white hover:text-cms-yellow transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <h1 className="text-[15px] font-bold tracking-wide uppercase">Verification Pending</h1>
        </header>

        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-cms-yellow/20 text-cms-yellow flex items-center justify-center mb-6">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-4">Request Submitted</h2>
          <p className="text-white/70 mb-6 max-w-sm">
            We have received your transfer verification request.
          </p>
          <p className="text-sm text-white/50 mb-8 max-w-sm">
            Our admin team will review the transaction. Once the payment drops in our OPay account, your membership will be automatically activated and you will receive an email with your secure CMS ID.
          </p>

          <button 
            onClick={() => router.push("/profile/membership/form")}
            className="w-full max-w-sm bg-cms-yellow text-black font-bold py-3.5 rounded-xl active:scale-95 transition-transform"
          >
            Next: Complete Registration Form
          </button>
        </div>
      </div>
    );
  }

  if (showTransfer) {
    const selectedPlanDetails = plans.find(p => p.id === selectedPlan);
    
    return (
      <div className="flex flex-col min-h-[100dvh] bg-[#0A0A0A] text-white pb-safe overflow-y-auto">
        <header className="flex items-center gap-4 px-4 py-5 border-b border-white/5 sticky top-0 bg-[#0A0A0A]/90 backdrop-blur-md z-50">
          <button onClick={() => setShowTransfer(false)} className="p-1 -ml-1 text-white hover:text-cms-yellow transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <h1 className="text-[15px] font-bold tracking-wide uppercase">Make Transfer</h1>
        </header>

        <div className="p-4 flex flex-col flex-1">
          <div className="bg-[#1BB682] text-white rounded-3xl p-6 shadow-xl mb-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
            
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-sm font-semibold opacity-90 tracking-wide uppercase mb-1">Pay with Transfer</p>
                <h2 className="text-xl font-bold">OPay Account</h2>
              </div>
              <div className="bg-white rounded-lg p-1.5 px-3 flex items-center justify-center">
                <span className="text-[#1BB682] font-black text-xl italic tracking-tighter">OPay</span>
              </div>
            </div>

            <div className="bg-white text-[#111] rounded-2xl p-5 mb-4 shadow-sm">
              <p className="text-xs uppercase font-bold text-[#666] mb-1">Account Number</p>
              <div className="flex justify-between items-center">
                <p className="text-3xl font-black tracking-widest text-[#21115C]">610 015 2225</p>
              </div>
            </div>

            <div className="bg-white text-[#111] rounded-2xl p-5 shadow-sm">
              <p className="text-xs uppercase font-bold text-[#666] mb-1">Account Name</p>
              <p className="text-lg font-black text-[#21115C]">CHINECHEREM BLESSING ISAAC</p>
            </div>
            
            <div className="mt-6 text-center border-t border-white/20 pt-4">
              <p className="text-sm font-medium">Please transfer exactly: <span className="font-bold">{selectedPlanDetails?.price.split(' ')[0]}</span></p>
            </div>
          </div>

          <form onSubmit={handleTransferSubmit} className="mt-auto bg-[#111] border border-white/10 rounded-2xl p-5">
            <h3 className="font-bold mb-4">Confirm Your Transfer</h3>
            <p className="text-xs text-white/50 mb-4 leading-relaxed">
              Once you have made the exact transfer to the OPay account above, enter the sender name on the receipt so our admins can verify your payment.
            </p>
            
            <div className="mb-6">
              <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">Sender Account Name</label>
              <input 
                type="text" 
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="e.g. John Doe"
                required
                className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-cms-yellow transition-colors"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading || !senderName.trim()}
              className="w-full bg-cms-yellow text-black font-bold py-3.5 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
            >
              {loading ? "Submitting..." : "I Have Transferred"}
            </button>
          </form>
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
        <h1 className="text-[15px] font-bold tracking-wide uppercase">Membership Registration</h1>
      </header>

      <div className="p-4 flex flex-col flex-1">
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-1">Choose a membership plan</h2>
          <p className="text-sm text-white/60">Select the tier that fits you best.</p>
        </div>

        {/* Plans */}
        <div className="flex flex-col gap-4 mb-8">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const isExpanded = expandedPlan === plan.id;
            
            return (
              <div 
                key={plan.id}
                className={`rounded-xl border transition-all overflow-hidden ${
                  isSelected 
                    ? "border-cms-yellow bg-[#111]" 
                    : "border-white/10 hover:border-white/20 bg-[#111]"
                }`}
              >
                <div 
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`p-4 flex gap-4 cursor-pointer transition-all ${
                    isSelected ? "bg-cms-yellow/5" : ""
                  }`}
                >
                  <div className={`mt-1 flex-shrink-0 ${isSelected ? "text-cms-yellow" : "text-white/40"}`}>
                    {plan.icon}
                  </div>
                  <div className="flex-1 pr-2">
                    <h3 className="font-bold text-base">{plan.title}</h3>
                    <p className={`text-sm font-medium mt-0.5 ${isSelected ? "text-cms-yellow" : "text-white/80"}`}>{plan.price}</p>
                    <p className="text-xs text-white/50 mt-1.5 leading-relaxed">{plan.desc}</p>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedPlan(isExpanded ? null : plan.id);
                      }}
                      className="text-xs font-bold text-cms-yellow uppercase tracking-wider mt-3 flex items-center gap-1 hover:opacity-80 transition-opacity"
                    >
                      {isExpanded ? "Hide Benefits" : "See Benefits"}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        <path d="m6 9 6 6 6-6"/>
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center justify-center shrink-0">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? "border-cms-yellow" : "border-white/20"
                    }`}>
                      {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-cms-yellow" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Benefits List */}
                {isExpanded && (
                  <div className={`p-4 pt-0 border-t ${isSelected ? 'border-cms-yellow/20' : 'border-white/10'} bg-black/20`}>
                    <ul className="mt-4 space-y-2.5">
                      {plan.benefits.map((benefit, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-white/70">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cms-yellow shrink-0 mt-0.5">
                            <path d="M20 6 9 17l-5-5"/>
                          </svg>
                          <span className="leading-snug">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Payment Method */}
        <div className="mt-auto">
          <h3 className="font-bold mb-4">Payment Method</h3>
          <div className="flex flex-col gap-4 mb-8">
            <label className="flex items-center gap-3 cursor-pointer opacity-50">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                paymentMethod === "online" ? "border-cms-yellow" : "border-white/20"
              }`}>
                {paymentMethod === "online" && <div className="w-2.5 h-2.5 rounded-full bg-cms-yellow" />}
              </div>
              <input 
                type="radio" 
                className="hidden" 
                disabled
                checked={paymentMethod === "online"}
                onChange={() => setPaymentMethod("online")}
              />
              <span className="text-sm font-medium">Pay Online (Coming Soon)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                paymentMethod === "transfer" ? "border-cms-yellow" : "border-white/20"
              }`}>
                {paymentMethod === "transfer" && <div className="w-2.5 h-2.5 rounded-full bg-cms-yellow" />}
              </div>
              <input 
                type="radio" 
                className="hidden" 
                checked={paymentMethod === "transfer"}
                onChange={() => setPaymentMethod("transfer")}
              />
              <span className="text-sm font-medium text-white/80">Bank Transfer</span>
            </label>
          </div>

          <button 
            onClick={handleProceed}
            disabled={loading || paymentMethod === "online"}
            className="w-full bg-cms-yellow text-black font-bold py-3.5 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
          >
            {loading ? "Processing..." : "Proceed to Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}


