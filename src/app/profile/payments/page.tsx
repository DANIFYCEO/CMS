"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function PaymentHistoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const fetchPayments = async () => {
      try {
        const q = query(
          collection(db, "payment_requests"),
          where("userId", "==", user.uid)
        );
        const snapshot = await getDocs(q);
        const p: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // sort locally since we might not have a composite index
        p.sort((a: any, b: any) => {
          const tA = a.createdAt?.toMillis?.() || 0;
          const tB = b.createdAt?.toMillis?.() || 0;
          return tB - tA;
        });
        setPayments(p);
      } catch (err) {
        console.error("Error fetching payments", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPayments();
  }, [user]);

  const getStatusColor = (status: string) => {
    if (status === "approved") return "text-green-400 border-green-400/30 bg-green-400/10";
    if (status === "rejected") return "text-red-400 border-red-400/30 bg-red-400/10";
    return "text-cms-yellow border-cms-yellow/30 bg-cms-yellow/10";
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0A0A0A] text-white pb-safe overflow-y-auto">
      <header className="flex items-center gap-4 px-4 py-5 border-b border-white/5 sticky top-0 bg-[#0A0A0A]/90 backdrop-blur-md z-50">
        <button onClick={() => router.back()} className="p-1 -ml-1 text-white hover:text-cms-yellow transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 className="text-[15px] font-bold tracking-wide uppercase">Payment History</h1>
      </header>

      {loading ? (
        <div className="p-8 text-center text-white/50">Loading...</div>
      ) : payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-20 px-6 opacity-50 mt-10">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-5">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold mb-2">No payment history found</p>
            <p className="text-sm text-white/50 max-w-xs mx-auto">You do not have any recent transactions or active subscriptions on your account.</p>
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {payments.map(p => (
            <div key={p.id} className="bg-[#111] border border-white/5 p-4 rounded-xl">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-sm uppercase">{p.plan || "Membership"} Plan</h3>
                  <p className="text-xs text-white/40 mt-1">
                    {p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString() : "Recent"}
                  </p>
                </div>
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(p.status)}`}>
                  {p.status || "Pending"}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 flex justify-between text-sm">
                <span className="text-white/50">Method</span>
                <span className="capitalize font-medium">{p.method || "Transfer"}</span>
              </div>
              {p.senderName && (
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-white/50">Sender Name</span>
                  <span className="font-medium">{p.senderName}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
