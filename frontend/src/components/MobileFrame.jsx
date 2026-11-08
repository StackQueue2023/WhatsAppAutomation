import React, { useState, useEffect } from 'react';
import { Smartphone, Monitor } from 'lucide-react';

export default function MobileFrame({ children }) {
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [forceMobileFrame, setForceMobileFrame] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    // Check if user is on actual mobile screen
    const checkMobile = () => {
      setIsMobileDevice(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Live clock for mobile status bar
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => {
      window.removeEventListener('resize', checkMobile);
      clearInterval(interval);
    };
  }, []);

  // If real mobile device or full-screen dashboard mode, render responsive dashboard
  if (isMobileDevice || !forceMobileFrame) {
    return (
      <div className="min-h-screen bg-[#FAF9F5] flex flex-col w-full max-w-2xl mx-auto relative shadow-sm border-x border-amber-100/70">
        {!isMobileDevice && (
          <div className="fixed top-4 right-4 z-50">
            <button
              onClick={() => setForceMobileFrame(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-white/95 text-slate-800 border border-amber-300 hover:text-amber-700 transition shadow-md backdrop-blur hover:bg-amber-50"
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-500" />
              Phone Preview
            </button>
          </div>
        )}
        {children}
      </div>
    );
  }

  // Desktop view with sleek iPhone/Android phone frame in Yellow & White aesthetic
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/80 via-slate-50 to-yellow-50/60 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient warm yellow lighting */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-amber-300/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-yellow-400/20 rounded-full blur-3xl pointer-events-none" />

      {/* Frame view switcher */}
      <div className="mb-3 flex items-center gap-3">
        <span className="text-xs text-slate-600 font-semibold tracking-wide">Stack Queue Simulator</span>
        <button
          onClick={() => setForceMobileFrame(false)}
          className="flex items-center gap-1.5 px-3.5 py-1 text-xs font-semibold rounded-full bg-white text-slate-700 border border-amber-200 hover:border-amber-400 hover:text-amber-800 transition shadow-sm"
        >
          <Monitor className="w-3.5 h-3.5 text-amber-500" />
          Full Screen Mode
        </button>
      </div>

      {/* Phone container - Ceramic White & Gold Shadow Chassis */}
      <div className="w-full max-w-[410px] h-[840px] bg-[#FAF9F5] rounded-[48px] shadow-[0_25px_60px_-15px_rgba(234,179,8,0.22),0_0_0_12px_#FFFFFF,0_0_0_14px_#E2E8F0] flex flex-col overflow-hidden relative border border-amber-200/70">
        
        {/* Dynamic Island / Speaker notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-5 bg-slate-900 rounded-full z-40 flex items-center justify-center shadow-inner">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-800 mr-4 border border-slate-700" />
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        </div>

        {/* Mobile Status Bar */}
        <div className="h-10 px-7 pt-2 flex items-center justify-between text-[11px] font-bold text-slate-700 select-none z-30 bg-[#FAF9F5]">
          <span>{currentTime || '9:41'}</span>
          <div className="flex items-center gap-1.5 text-slate-700">
            <span className="text-[10px] font-bold">5G</span>
            <div className="w-4 h-2 border border-slate-700 rounded-sm p-[1px] flex items-center">
              <div className="w-full h-full bg-amber-500 rounded-[1px]" />
            </div>
          </div>
        </div>

        {/* App Screen Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col relative bg-[#FAF9F5]">
          {children}
        </div>

        {/* Home gesture bar indicator */}
        <div className="h-4 bg-[#FAF9F5] flex items-center justify-center select-none pb-1">
          <div className="w-32 h-1 bg-slate-300 rounded-full" />
        </div>
      </div>
    </div>
  );
}
