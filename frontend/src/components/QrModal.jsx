import React, { useState } from 'react';
import {
  QrCode,
  Smartphone,
  X,
  RefreshCw,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

export default function QrModal({ isOpen, onClose, status, onReconnect }) {
  const [activeTab, setActiveTab] = useState('qr'); // 'qr' | 'code'
  const [phoneInput, setPhoneInput] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isConnected = status?.whatsapp?.status === 'connected';
  const qrImage = status?.whatsapp?.qrCode;
  const userProfile = status?.whatsapp?.userProfile;

  // Request phone pairing code
  const handleRequestPairingCode = async (e) => {
    e.preventDefault();
    if (!phoneInput.trim()) return;

    setIsLoadingCode(true);
    try {
      const res = await fetch('/api/whatsapp/pair-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get code');
      setPairingCode(data.pairingCode);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsLoadingCode(false);
    }
  };

  const copyCode = () => {
    if (pairingCode) {
      navigator.clipboard.writeText(pairingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-amber-200 rounded-3xl w-full max-w-sm p-5 shadow-2xl relative animate-in zoom-in-95">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Title */}
        <div className="text-center mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 text-amber-700 mx-auto flex items-center justify-center mb-2 shadow-xs">
            <Smartphone className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-slate-950">Link WhatsApp Business</h3>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            100% Free • Multi-Device • No Meta API Charges
          </p>
        </div>

        {isConnected ? (
          <div className="text-center py-6 space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-950">WhatsApp Business Linked!</p>
              <p className="text-xs text-emerald-700 font-mono mt-0.5 font-bold">
                {userProfile?.name || 'Active Account'} (+{userProfile?.phone || ''})
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black rounded-xl text-xs shadow-md shadow-amber-400/25 mt-2 active:scale-98 transition"
            >
              Start Sending Messages
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Tabs for QR vs Pairing Code */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-amber-50/70 rounded-xl border border-amber-200/70 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('qr')}
                className={`py-1.5 font-extrabold rounded-lg transition ${
                  activeTab === 'qr'
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Scan QR Code
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('code')}
                className={`py-1.5 font-extrabold rounded-lg transition ${
                  activeTab === 'code'
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pairing Code
              </button>
            </div>

            {/* TAB 1: QR CODE */}
            {activeTab === 'qr' && (
              <div className="flex flex-col items-center space-y-3">
                <div className="bg-white p-3 rounded-2xl shadow-md border-4 border-amber-200">
                  {qrImage ? (
                    <img
                      src={qrImage}
                      alt="WhatsApp QR Code"
                      className="w-52 h-52 object-contain"
                    />
                  ) : (
                    <div className="w-52 h-52 flex flex-col items-center justify-center text-slate-800 gap-2">
                      <RefreshCw className="w-7 h-7 animate-spin text-amber-500" />
                      <span className="text-xs font-bold text-slate-700">Generating QR...</span>
                    </div>
                  )}
                </div>

                {/* Instructions */}
                <div className="text-[11px] text-slate-800 space-y-1 bg-amber-50/60 p-3 rounded-xl border border-amber-200 w-full">
                  <p className="font-bold text-amber-900 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" /> How to connect:
                  </p>
                  <ol className="list-decimal list-inside space-y-0.5 text-slate-700 text-[10px] font-medium">
                    <li>Open WhatsApp Business on your phone.</li>
                    <li>Tap <b>Linked Devices</b> (இணைக்கப்பட்ட சாதனங்கள்).</li>
                    <li>Tap <b>Link a Device</b> and point at this QR.</li>
                  </ol>
                </div>

                <button
                  type="button"
                  onClick={onReconnect}
                  className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-amber-700 transition font-bold"
                >
                  <RefreshCw className="w-3 h-3 text-amber-600" />
                  <span>Refresh QR Code</span>
                </button>
              </div>
            )}

            {/* TAB 2: PAIRING CODE */}
            {activeTab === 'code' && (
              <div className="space-y-3">
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                  Enter your WhatsApp Business number to receive an 8-character pairing code to type directly on your phone:
                </p>

                <form onSubmit={handleRequestPairingCode} className="space-y-2">
                  <input
                    type="text"
                    required
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="e.g. 919876543210 (with country code)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200 font-medium"
                  />
                  <button
                    type="submit"
                    disabled={isLoadingCode}
                    className="w-full py-2 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-xs transition shadow-md shadow-amber-400/25 active:scale-98"
                  >
                    {isLoadingCode ? 'Requesting Code...' : 'Generate 8-Digit Pairing Code'}
                  </button>
                </form>

                {pairingCode && (
                  <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-center space-y-2">
                    <span className="text-[10px] text-amber-900 uppercase font-bold">
                      Your WhatsApp Pairing Code:
                    </span>
                    <div className="text-2xl font-black text-amber-950 font-mono tracking-widest flex items-center justify-center gap-2">
                      <span>{pairingCode}</span>
                      <button
                        onClick={copyCode}
                        className="p-1.5 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-emerald-700" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-600 font-medium">
                      Open WhatsApp &gt; Linked Devices &gt; Link with phone number instead &gt; enter this code.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
