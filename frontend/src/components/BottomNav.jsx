import React from 'react';
import { Send, Users, History, Settings } from 'lucide-react';

export default function BottomNav({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'compose', label: 'Broadcast', icon: Send },
    { id: 'contacts', label: 'Recipients', icon: Users },
    { id: 'history', label: 'Reports', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="bg-white/95 border-t border-amber-200/70 backdrop-blur-md px-3 py-1.5 flex items-center justify-around sticky bottom-0 z-30 select-none shadow-sm">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
              isActive
                ? 'text-amber-800 font-extrabold scale-105'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className={`p-1 rounded-xl transition ${isActive ? 'bg-amber-100 text-amber-900 border border-amber-300/80 shadow-xs' : ''}`}>
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
