import React, { useState, useEffect } from 'react';
import { History, CheckCircle2, XCircle, Clock, Image as ImageIcon, ChevronRight, X, AlertCircle } from 'lucide-react';

export default function HistoryTab() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns');
      const data = await res.json();
      setCampaigns(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const totalSent = campaigns.reduce((acc, c) => acc + (c.sentCount || 0), 0);
  const totalFailed = campaigns.reduce((acc, c) => acc + (c.failedCount || 0), 0);
  const totalRecipients = totalSent + totalFailed;
  const successRate = totalRecipients > 0 ? Math.round((totalSent / totalRecipients) * 100) : 100;

  return (
    <div className="flex-1 p-4 pb-20 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-base font-extrabold text-slate-950 flex items-center gap-2">
          <History className="w-5 h-5 text-amber-500" />
          Broadcast Reports
        </h2>
        <p className="text-[11px] text-slate-500 font-medium">Past message deliveries and analytics</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white border border-amber-200/80 rounded-2xl p-3 text-center shadow-xs">
          <span className="text-[10px] text-slate-500 uppercase font-bold block">Campaigns</span>
          <span className="text-lg font-black text-slate-950">{campaigns.length}</span>
        </div>
        <div className="bg-white border border-amber-200/80 rounded-2xl p-3 text-center shadow-xs">
          <span className="text-[10px] text-slate-500 uppercase font-bold block">Delivered</span>
          <span className="text-lg font-black text-emerald-700">{totalSent}</span>
        </div>
        <div className="bg-white border border-amber-200/80 rounded-2xl p-3 text-center shadow-xs">
          <span className="text-[10px] text-slate-500 uppercase font-bold block">Success Rate</span>
          <span className="text-lg font-black text-amber-600">{successRate}%</span>
        </div>
      </div>

      {/* Campaign List */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="text-center py-8 text-xs text-slate-400 font-medium">Loading reports...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-3xl border border-amber-200/80 p-6 shadow-xs">
            <History className="w-10 h-10 text-amber-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-800">No broadcasts sent yet</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Compose a message and send your first campaign!
            </p>
          </div>
        ) : (
          campaigns.map((camp) => (
            <div
              key={camp._id}
              onClick={() => setSelectedCampaign(camp)}
              className="bg-white border border-amber-200/70 rounded-2xl p-3.5 shadow-xs hover:border-amber-400 hover:shadow-md transition cursor-pointer flex items-center justify-between"
            >
              <div className="min-w-0 flex-1 mr-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono font-medium">
                    <Clock className="w-3 h-3 text-amber-500" />
                    {new Date(camp.createdAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {camp.hasImage && (
                    <span className="text-[9px] bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1 font-bold">
                      <ImageIcon className="w-2.5 h-2.5" /> Image
                    </span>
                  )}
                </div>

                <p className="text-xs font-bold text-slate-900 line-clamp-1">
                  {camp.message || 'Image broadcast without text'}
                </p>

                <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {camp.sentCount} sent
                  </span>
                  {camp.failedCount > 0 && (
                    <span className="text-rose-600 font-bold flex items-center gap-1">
                      <XCircle className="w-3 h-3" />
                      {camp.failedCount} failed
                    </span>
                  )}
                  <span className="text-slate-500 font-medium">Total: {camp.totalRecipients}</span>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </div>
          ))
        )}
      </div>

      {/* Details Modal */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white border border-amber-200 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col p-5 shadow-2xl animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between pb-3 border-b border-amber-100">
              <h3 className="text-sm font-extrabold text-slate-950 flex items-center gap-2">
                <History className="w-4 h-4 text-amber-500" />
                Campaign Details
              </h3>
              <button
                onClick={() => setSelectedCampaign(null)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 mt-3 pr-1">
              {/* Message snippet */}
              <div className="bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200/80">
                <span className="text-[10px] text-amber-900 uppercase font-bold block mb-1">
                  Broadcast Message
                </span>
                <p className="text-xs text-slate-900 whitespace-pre-wrap leading-relaxed font-medium">
                  {selectedCampaign.message || '(Image only)'}
                </p>
                {selectedCampaign.imageName && (
                  <div className="mt-2 pt-2 border-t border-amber-200/60">
                    <img
                      src={`/uploads/${selectedCampaign.imageName}`}
                      alt="Broadcast Media"
                      className="max-h-40 rounded-xl object-contain mx-auto border border-amber-200 shadow-xs"
                      onError={(e) => (e.target.style.display = 'none')}
                    />
                  </div>
                )}
              </div>

              {/* Logs */}
              <div>
                <span className="text-[11px] font-bold text-slate-800 block mb-1.5">
                  Recipient Logs ({selectedCampaign.logs?.length || 0})
                </span>
                <div className="space-y-1.5">
                  {selectedCampaign.logs?.map((l, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{l.contactName}</p>
                        <p className="text-[10px] text-slate-500 font-mono font-medium">+{l.phone}</p>
                      </div>
                      {l.status === 'sent' ? (
                        <span className="text-emerald-700 text-[11px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
                        </span>
                      ) : (
                        <span className="text-rose-600 text-[11px] font-bold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Failed
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
