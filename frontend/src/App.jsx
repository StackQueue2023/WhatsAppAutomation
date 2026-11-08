import React, { useState, useEffect } from 'react';
import MobileFrame from './components/MobileFrame';
import MobileHeader from './components/MobileHeader';
import BottomNav from './components/BottomNav';
import ComposeTab from './components/ComposeTab';
import ContactsTab from './components/ContactsTab';
import HistoryTab from './components/HistoryTab';
import SettingsTab from './components/SettingsTab';
import QrModal from './components/QrModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('compose');
  const [status, setStatus] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState(null);

  // Fetch initial status
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setStatus(data);
      if (data?.whatsapp?.isBroadcasting) {
        setIsBroadcasting(true);
        setBroadcastProgress(data.whatsapp.broadcastProgress);
      }
    } catch (e) {
      console.warn("Status fetch error:", e);
    }
  };

  // Fetch contacts
  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/contacts');
      const data = await res.json();
      setContacts(data);
    } catch (e) {
      console.warn("Contacts fetch error:", e);
    }
  };

  // Fetch groups
  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups');
      const data = await res.json();
      setGroups(data);
    } catch (e) {
      console.warn("Groups fetch error:", e);
    }
  };

  // Connect SSE for real-time live events
  useEffect(() => {
    fetchStatus();
    fetchContacts();
    fetchGroups();

    const evtSource = new EventSource('/api/events');

    evtSource.addEventListener('init', (e) => {
      try {
        const data = JSON.parse(e.data);
        setStatus(data);
      } catch (err) {}
    });

    evtSource.addEventListener('status', (e) => {
      try {
        const data = JSON.parse(e.data);
        setStatus((prev) => ({
          ...prev,
          whatsapp: data.whatsapp,
          db: data.db
        }));

        if (data.whatsapp?.status === 'connected') {
          setIsQrOpen(false);
        }
      } catch (err) {}
    });

    evtSource.addEventListener('qr', (e) => {
      try {
        const data = JSON.parse(e.data);
        setStatus((prev) => ({
          ...prev,
          whatsapp: {
            ...(prev?.whatsapp || {}),
            qrCode: data.qr,
            status: 'qr_ready'
          }
        }));
      } catch (err) {}
    });

    evtSource.addEventListener('broadcast_progress', (e) => {
      try {
        const data = JSON.parse(e.data);
        setBroadcastProgress(data);
        if (data.status === 'sending') {
          setIsBroadcasting(true);
        } else {
          setIsBroadcasting(false);
          fetchContacts();
        }
      } catch (err) {}
    });

    evtSource.onerror = () => {
      // Fallback polling if SSE is disconnected
    };

    // Polling fallback every 6 seconds
    const interval = setInterval(() => {
      fetchStatus();
    }, 6000);

    return () => {
      evtSource.close();
      clearInterval(interval);
    };
  }, []);

  // WhatsApp Reconnect
  const handleReconnect = async () => {
    try {
      await fetch('/api/whatsapp/reconnect', { method: 'POST' });
      fetchStatus();
    } catch (e) {
      console.error(e);
    }
  };

  // WhatsApp Logout
  const handleLogout = async () => {
    if (!confirm('Are you sure you want to disconnect your WhatsApp Business account?')) return;
    try {
      await fetch('/api/whatsapp/logout', { method: 'POST' });
      fetchStatus();
    } catch (e) {
      console.error(e);
    }
  };

  // Cancel Broadcast
  const handleCancelBroadcast = async () => {
    try {
      await fetch('/api/broadcast/cancel', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <MobileFrame>
      {/* Header */}
      <MobileHeader
        status={status}
        onOpenQr={() => setIsQrOpen(true)}
        onOpenSettings={() => setActiveTab('settings')}
      />

      {/* Main Tab Screens */}
      <main className="flex-1 overflow-y-auto bg-[#FAF9F5]">
        {activeTab === 'compose' && (
          <ComposeTab
            status={status}
            contacts={contacts}
            groups={groups}
            onOpenQr={() => setIsQrOpen(true)}
            onBroadcastSuccess={() => {
              fetchContacts();
            }}
            isBroadcasting={isBroadcasting}
            broadcastProgress={broadcastProgress}
            onCancelBroadcast={handleCancelBroadcast}
          />
        )}

        {activeTab === 'contacts' && (
          <ContactsTab
            contacts={contacts}
            groups={groups}
            onRefreshContacts={() => {
              fetchContacts();
              fetchGroups();
            }}
            status={status}
          />
        )}

        {activeTab === 'history' && <HistoryTab />}

        {activeTab === 'settings' && (
          <SettingsTab
            status={status}
            onOpenQr={() => setIsQrOpen(true)}
            onLogout={handleLogout}
            onReconnect={handleReconnect}
          />
        )}
      </main>

      {/* Bottom Mobile Navigation */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* WhatsApp QR & Pairing Code Modal */}
      <QrModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        status={status}
        onReconnect={handleReconnect}
      />
    </MobileFrame>
  );
}
