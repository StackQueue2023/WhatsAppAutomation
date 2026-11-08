import React, { useState } from 'react';
import {
  Settings,
  Database,
  Smartphone,
  LogOut,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Shield,
  Wifi
} from 'lucide-react';

export default function SettingsTab({ status, onOpenQr, onLogout, onReconnect }) {
  const [isRetryingDb, setIsRetryingDb] = useState(false);
  const isConnected = status?.whatsapp?.status === 'connected';
  const userProfile = status?.whatsapp?.userProfile;
  const isAtlas = status?.db?.isAtlas;
  const dbError = status?.db?.errorMessage;

  const handleRetryDb = async () => {
    setIsRetryingDb(true);
    try {
      await fetch('/api/status');
      setTimeout(() => setIsRetryingDb(false), 1000);
    } catch (e) {
      setIsRetryingDb(false);
    }
  };

  const handleConfirmLogout = () => {
    if (
      window.confirm(
        'Are you sure you want to unlink your WhatsApp account?\n\nYou will need to scan the QR code again to reconnect.'
      )
    ) {
      onLogout();
    }
  };

  return (
    <div className="flex-1 p-4 pb-20 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-base font-extrabold text-slate-950 flex items-center gap-2">
          <Settings className="w-5 h-5 text-amber-500" />
          Settings & Accounts
        </h2>
        <p className="text-[11px] text-slate-500 font-medium">Manage connections and configurations</p>
      </div>

      {/* WhatsApp Business Account Card */}
      <div className="bg-white border border-amber-200/80 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-slate-950 uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-amber-500" />
              WhatsApp Business Account
            </span>
          </div>
          {isConnected ? (
            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-300 px-2.5 py-0.5 rounded-full font-bold">
              Linked
            </span>
          ) : (
            <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full font-bold">
              Not Linked
            </span>
          )}
        </div>

        {isConnected ? (
          <div className="space-y-3 pt-1">
            <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200/80 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-950">{userProfile?.name || 'WhatsApp Business'}</p>
                <p className="text-[11px] text-amber-800 font-mono font-bold mt-0.5">+{userProfile?.phone}</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>

            <button
              onClick={handleConfirmLogout}
              className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Disconnect / Unlink Account
            </button>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-slate-600 font-medium">
              Link your WhatsApp Business device to send free automated broadcasts with text and images.
            </p>
            <button
              onClick={onOpenQr}
              className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-md shadow-amber-400/25 active:scale-98"
            >
              <QrCode className="w-4 h-4" />
              Link WhatsApp Account Now
            </button>
          </div>
        )}
      </div>

      {/* MongoDB Atlas Database Card */}
      <div className="bg-white border border-amber-200/80 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-extrabold text-slate-950 uppercase tracking-wider">
              MongoDB Atlas Cloud
            </span>
          </div>
          {isAtlas ? (
            <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full font-bold">
              Atlas Connected
            </span>
          ) : (
            <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold">
              Local Storage Mode
            </span>
          )}
        </div>

        <div className="bg-amber-50/40 p-3 rounded-xl border border-amber-200/70 space-y-2 text-xs">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-mono font-bold">Cluster URL</span>
            <span className="text-[11px] font-mono text-slate-800 break-all font-medium">
              {status?.mongoUri || 'mongodb+srv://STACK_QUEUE:****@stackqueuecluster.wfarxbd.mongodb.net/'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-mono font-bold">Status</span>
            <span className="text-[11px] font-bold text-amber-900">
              {isAtlas ? 'Direct Atlas Cloud Sync Active' : 'Local Fallback Storage Active (Contacts & Campaigns saved locally)'}
            </span>
          </div>
        </div>

        {/* IP Whitelist Guide if Atlas not connected yet */}
        {!isAtlas && (
          <div className="bg-amber-50 border border-amber-200/90 rounded-xl p-3 text-[11px] space-y-1.5 text-amber-950">
            <p className="font-bold flex items-center gap-1 text-amber-900">
              <Shield className="w-3.5 h-3.5 text-amber-600" />
              To enable Atlas Cloud Sync:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-slate-700 text-[10px] font-medium">
              <li>Log in to your <b>MongoDB Atlas</b> dashboard.</li>
              <li>Go to <b>Security &gt; Network Access</b>.</li>
              <li>
                Click <b>+ Add IP Address</b> and choose <b>Allow Access from Anywhere (0.0.0.0/0)</b>.
              </li>
              <li>Click Confirm!</li>
            </ol>
            <button
              onClick={handleRetryDb}
              disabled={isRetryingDb}
              className="mt-2 w-full py-1.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-bold rounded-lg text-[10px] flex items-center justify-center gap-1.5 transition shadow-xs active:scale-98"
            >
              <RefreshCw className={`w-3 h-3 ${isRetryingDb ? 'animate-spin' : ''}`} />
              Re-check Atlas Connection
            </button>
          </div>
        )}
      </div>

      {/* Mobile Access / PWA Guide */}
      <div className="bg-white border border-amber-200/80 rounded-2xl p-4 shadow-xs space-y-2">
        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-amber-600" />
          <span className="text-xs font-extrabold text-slate-950 uppercase tracking-wider">
            Mobile Phone Access
          </span>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed font-medium">
          Open this app on your Android or iPhone browser by typing your PC's IP address (e.g.{' '}
          <code className="text-amber-900 font-mono bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-bold">
            http://[your-pc-ip]:3000
          </code>
          ) while connected to the same Wi-Fi.
        </p>
        <p className="text-[11px] text-slate-500 font-medium">
          💡 Tap <b>"Add to Home Screen"</b> in Chrome or Safari to install it as a standalone mobile app icon!
        </p>
      </div>

      {/* Footer Branding */}
      <div className="text-center pt-2">
        <img
          src="/logo.png"
          alt="Stack Queue"
          className="h-6 w-auto mx-auto object-contain opacity-85"
          onError={(e) => (e.target.style.display = 'none')}
        />
        <p className="text-[10px] text-slate-500 mt-1 font-semibold">
          Stack Queue — Inclusive Learning • v1.0.0
        </p>
      </div>
    </div>
  );
}
