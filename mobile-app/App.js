import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { initServerUrl, getCurrentServerUrl, API } from './src/api';
import Header from './src/components/Header';
import QrModal from './src/components/QrModal';
import BroadcastModal from './src/components/BroadcastModal';
import BroadcastScreen from './src/screens/BroadcastScreen';
import ContactsScreen from './src/screens/ContactsScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState('broadcast');
  const [status, setStatus] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const broadcastPollRef = useRef(null);

  // Fetch status
  const fetchStatus = async () => {
    try {
      const data = await API.getStatus();
      setStatus(data);
      if (data?.whatsapp?.status === 'connected') {
        setIsQrOpen(false);
      }
    } catch (e) {
      // Server might be loading or offline
    }
  };

  // Fetch contacts
  const fetchContacts = async () => {
    try {
      const data = await API.getContacts();
      setContacts(data);
    } catch (e) {}
  };

  // Fetch groups
  const fetchGroups = async () => {
    try {
      const data = await API.getGroups();
      setGroups(data);
    } catch (e) {}
  };

  useEffect(() => {
    (async () => {
      await initServerUrl();
      await Promise.all([fetchStatus(), fetchContacts(), fetchGroups()]);
      setInitialLoading(false);
    })();

    // Live polling interval for real-time sync with WhatsApp Multi-Device backend
    const interval = setInterval(() => {
      fetchStatus();
    }, 4000);

    return () => {
      clearInterval(interval);
      if (broadcastPollRef.current) clearInterval(broadcastPollRef.current);
    };
  }, []);

  const handleStartBroadcast = (result) => {
    setIsBroadcastModalOpen(true);
    setIsBroadcasting(true);
    setBroadcastProgress({
      total: result.totalRecipients || 1,
      current: 0,
      sentCount: 0,
      failedCount: 0,
      logs: [],
      status: 'sending',
    });

    if (broadcastPollRef.current) {
      clearInterval(broadcastPollRef.current);
    }

    // Fast active polling (every 700ms) for real-time delivery ticks
    broadcastPollRef.current = setInterval(async () => {
      try {
        const bStatus = await API.getBroadcastProgress();
        if (bStatus?.progress) {
          setBroadcastProgress(bStatus.progress);
        }
        if (!bStatus?.isBroadcasting) {
          setIsBroadcasting(false);
          clearInterval(broadcastPollRef.current);
          broadcastPollRef.current = null;
          fetchContacts();
        }
      } catch (e) {}
    }, 700);
  };

  const handleCancelBroadcast = async () => {
    try {
      await API.cancelBroadcast();
      const bStatus = await API.getBroadcastProgress();
      if (bStatus?.progress) {
        setBroadcastProgress(bStatus.progress);
      }
    } catch (e) {}
    setIsBroadcasting(false);
    if (broadcastPollRef.current) {
      clearInterval(broadcastPollRef.current);
      broadcastPollRef.current = null;
    }
  };

  const handleCloseBroadcastModal = () => {
    setIsBroadcastModalOpen(false);
    setIsBroadcasting(false);
    if (broadcastPollRef.current) {
      clearInterval(broadcastPollRef.current);
      broadcastPollRef.current = null;
    }
    fetchContacts();
  };

  const handleLogout = async () => {
    try {
      await API.logoutWhatsApp();
      fetchStatus();
    } catch (e) {}
  };

  const handleReconnect = async () => {
    try {
      await API.reconnectWhatsApp();
      fetchStatus();
    } catch (e) {}
  };

  const [targetBroadcastGroup, setTargetBroadcastGroup] = useState(null);
  const [targetContactIds, setTargetContactIds] = useState(null);

  const navigateToBroadcast = (groupName, contactIds = null) => {
    setTargetBroadcastGroup(groupName);
    setTargetContactIds(contactIds);
    setActiveTab('broadcast');
  };

  const tabs = [
    { id: 'broadcast', label: 'Broadcast', icon: 'paper-plane' },
    { id: 'contacts', label: 'Recipients', icon: 'people' },
    { id: 'reports', label: 'Reports', icon: 'bar-chart' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar style="dark" backgroundColor="#FFFFFF" />

        {/* Branded Header */}
        <Header
          status={status}
          onOpenQr={() => setIsQrOpen(true)}
          onOpenSettings={() => setActiveTab('settings')}
        />

        {/* Offline notification banner if backend is unreachable */}
        {!status && !initialLoading && (
          <TouchableOpacity
            onPress={() => setActiveTab('settings')}
            style={styles.offlineBar}
          >
            <Ionicons name="warning" size={14} color="#CA8A04" />
            <Text style={styles.offlineBarText} numberOfLines={1}>
              Backend unreachable ({getCurrentServerUrl()}). Tap to fix PC IP.
            </Text>
          </TouchableOpacity>
        )}

        {/* Screen Content */}
        <View style={styles.screenContainer}>
          {initialLoading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color="#CA8A04" />
              <Text style={styles.loadingText}>Connecting to Stack Queue Backend...</Text>
            </View>
          ) : (
            <>
              {activeTab === 'broadcast' && (
                <BroadcastScreen
                  status={status}
                  contacts={contacts}
                  groups={groups}
                  targetGroup={targetBroadcastGroup}
                  targetContactIds={targetContactIds}
                  onClearTarget={() => {
                    setTargetBroadcastGroup(null);
                    setTargetContactIds(null);
                  }}
                  onOpenQr={() => setIsQrOpen(true)}
                  onStartBroadcast={handleStartBroadcast}
                  onRefreshGroups={fetchGroups}
                />
              )}

              {activeTab === 'contacts' && (
                <ContactsScreen
                  contacts={contacts}
                  groups={groups}
                  onRefresh={() => {
                    fetchContacts();
                    fetchGroups();
                  }}
                  onNavigateToBroadcast={navigateToBroadcast}
                  status={status}
                />
              )}

              {activeTab === 'reports' && <ReportsScreen />}

              {activeTab === 'settings' && (
                <SettingsScreen
                  status={status}
                  onOpenQr={() => setIsQrOpen(true)}
                  onLogout={handleLogout}
                  onRefreshStatus={() => {
                    fetchStatus();
                    fetchContacts();
                    fetchGroups();
                  }}
                />
              )}
            </>
          )}
        </View>

        {/* Bottom Tab Navigation Bar */}
        <View style={styles.bottomNav}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={styles.navTab}
              >
                <View style={[styles.navIconContainer, isActive && styles.navIconActive]}>
                  <Ionicons
                    name={isActive ? tab.icon : `${tab.icon}-outline`}
                    size={20}
                    color={isActive ? '#CA8A04' : '#64748B'}
                  />
                </View>
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* WhatsApp QR & Pairing Code Modal */}
        <QrModal
          visible={isQrOpen}
          onClose={() => setIsQrOpen(false)}
          status={status}
          onReconnect={handleReconnect}
        />

        {/* Live Broadcast Progress Modal */}
        <BroadcastModal
          visible={isBroadcastModalOpen}
          progress={broadcastProgress}
          isBroadcasting={isBroadcasting}
          onCancel={handleCancelBroadcast}
          onClose={handleCloseBroadcastModal}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  offlineBar: {
    backgroundColor: '#FEF9C3',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE047',
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineBarText: {
    fontSize: 11,
    color: '#713F12',
    fontWeight: '700',
    flex: 1,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#FAF9F5',
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#FEF08A',
    paddingVertical: 6,
    paddingHorizontal: 8,
    justifyContent: 'space-around',
    elevation: 8,
    shadowColor: '#EAB308',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  navTab: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  navIconContainer: {
    padding: 6,
    borderRadius: 14,
  },
  navIconActive: {
    backgroundColor: '#FEF08A',
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#B45309',
    fontWeight: 'bold',
  },
});
