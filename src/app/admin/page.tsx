"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { canManagePayments } from "@/lib/adminRoles";

export default function AdminPaymentsPage() {
  const { userData } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const q = query(collection(db, "payment_requests"), where("status", "==", "pending"));
      const snap = await getDocs(q);
      const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort client side by createdAt descending
      reqs.sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setRequests(reqs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (req: any) => {
    if (!confirm(`Are you sure you want to approve payment for ${req.displayName}?`)) return;
    
    setProcessingId(req.id);
    try {
      // 1. Generate Secure CMS ID
      const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
      const newCmsId = `CMS/${new Date().getFullYear()}/${randomPart}`;

      // 2. Update the user account
      await updateDoc(doc(db, "users", req.userId), {
        membership: req.planId,
        cmsId: newCmsId
      });

      // 3. Update the request status
      await updateDoc(doc(db, "payment_requests", req.id), {
        status: "approved",
        approvedAt: new Date()
      });

      // 4. Send email
      await fetch('/api/send-id-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: req.email,
          newId: newCmsId,
          name: req.displayName || "Member"
        })
      });

      alert("Approved successfully! The user has been emailed their new ID.");
      fetchRequests();
    } catch (err) {
      console.error(err);
      alert("Failed to approve.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (req: any) => {
    if (!confirm(`Are you sure you want to reject this payment request?`)) return;
    
    setProcessingId(req.id);
    try {
      await updateDoc(doc(db, "payment_requests", req.id), {
        status: "rejected",
        rejectedAt: new Date()
      });
      fetchRequests();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="w-6 h-6 border-2 border-cms-yellow border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!canManagePayments(userData?.role, userData?.isAdmin)) {
    return (
      <div className="p-8 text-center max-w-md mx-auto mt-8">
        <div className="w-12 h-12 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h3 className="text-base font-bold text-white mb-1">Restricted Access</h3>
        <p className="text-xs text-white/50 leading-relaxed">
          Payment approvals and financial records are restricted to the Financial Secretary and Super Admins.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-1">Pending Payments</h2>
        <p className="text-sm text-white/60">Review and approve bank transfer requests.</p>
      </div>

      {requests.length === 0 ? (
        <div className="bg-[#111] border border-white/5 rounded-xl p-8 text-center">
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3 text-white/40">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <p className="text-white/60 text-sm">No pending payments.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {requests.map(req => (
            <div key={req.id} className="bg-[#111] border border-white/10 rounded-xl p-5 relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg">{req.displayName}</h3>
                  <p className="text-xs text-white/50 mb-1">{req.email}</p>
                </div>
                <div className="bg-cms-yellow/10 text-cms-yellow border border-cms-yellow/20 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
                  {req.planTitle}
                </div>
              </div>

              <div className="bg-black/30 rounded-lg p-3 mb-5 border border-white/5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-white/40 tracking-wider mb-0.5">Expected</p>
                    <p className="text-sm font-semibold">{req.amountExpected}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-white/40 tracking-wider mb-0.5">Sender Name</p>
                    <p className="text-sm font-semibold text-cms-yellow">{req.senderName}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleReject(req)}
                  disabled={processingId === req.id}
                  className="flex-1 border border-white/20 text-white/80 py-2.5 rounded-lg text-sm font-bold hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleApprove(req)}
                  disabled={processingId === req.id}
                  className="flex-1 bg-cms-yellow text-black py-2.5 rounded-lg text-sm font-bold active:scale-95 transition-transform disabled:opacity-50"
                >
                  {processingId === req.id ? "Processing..." : "Approve"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
