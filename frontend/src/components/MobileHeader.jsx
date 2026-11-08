import React from 'react';
import { QrCode, CheckCircle2, AlertCircle, RefreshCw, Database } from 'lucide-react';

export default function MobileHeader({ status, onOpenQr, onOpenSettings }) {
  const isConnected = status?.whatsapp?.status === 'connected';
  const isConnecting = status?.whatsapp?.status === 'connecting';
  const isQrReady = status?.whatsapp?.status === 'qr_ready';
  const isAtlas = status?.db?.isAtlas;

  return (
    <header className="px-4 py-3 bg-white/95 border-b border-amber-200/70 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between shadow-xs">
      {/* Brand & Logo */}
      <div className="flex items-center gap-2.5">
        <img
          src="/logo.png"
          alt="Stack Queue"
          className="h-7 w-auto object-contain drop-shadow-xs"
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
        <div className="flex flex-col">
          <span className="text-sm font-extrabold tracking-tight text-slate-950 flex items-center gap-1.5">
            STACK QUEUE
          </span>
          <span className="text-[10px] text-amber-600 font-bold tracking-wider">
            WHATSAPP AUTOMATION
          </span>
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex items-center gap-2">
        {/* DB Status Badge */}
        <button
          onClick={onOpenSettings}
          title={isAtlas ? "MongoDB Atlas Cloud Active" : "Local Storage Active"}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${
            isAtlas
              ? 'bg-amber-100/80 text-amber-900 border-amber-300'
              : 'bg-slate-100 text-slate-700 border-slate-200'
          }`}
        >
          <Database className="w-3 h-3 text-amber-600" />
          <span>{isAtlas ? 'Atlas' : 'Local'}</span>
        </button>

        {/* WhatsApp Business Connection Button */}
        {isConnected ? (
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition shadow-xs"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Online</span>
          </button>
        ) : (
          <button
            onClick={onOpenQr}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition shadow-sm ${
              isConnecting
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 shadow-amber-400/25 active:scale-95'
            }`}
          >
            {isConnecting ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin text-amber-700" />
                <span>Connecting</span>
              </>
            ) : (
              <>
                <QrCode className="w-3.5 h-3.5 text-slate-950" />
                <span>Link WA</span>
              </>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
