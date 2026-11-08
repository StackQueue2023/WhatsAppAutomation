import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentServerUrl, setServerUrl, getDetectedHost, API } from '../api';

export default function SettingsScreen({ status, onOpenQr, onLogout, onRefreshStatus }) {
  const [serverUrlInput, setServerUrlInput] = useState(getCurrentServerUrl());
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null); // 'connected' | 'error' | null

  const isConnected = status?.whatsapp?.status === 'connected';
  const userProfile = status?.whatsapp?.userProfile;
  const isAtlas = status?.db?.isAtlas;

  useEffect(() => {
    setServerUrlInput(getCurrentServerUrl());
  }, []);

  const handleSaveUrl = async () => {
    if (!serverUrlInput.trim()) {
      Alert.alert('Required', 'Server URL cannot be empty.');
      return;
    }
    setIsTesting(true);
    setConnectionStatus(null);
    try {
      await setServerUrl(serverUrlInput);
      const res = await API.getStatus();
      setConnectionStatus('connected');
      Alert.alert('Connected!', 'Successfully reached backend server at ' + serverUrlInput);
      onRefreshStatus();
    } catch (err) {
      setConnectionStatus('error');
      Alert.alert(
        'Connection Failed',
        err.message + '\n\nMake sure your PC and phone are on the exact same Wi-Fi network.'
      );
    } finally {
      setIsTesting(false);
    }
  };

  const handleAutoDetect = async () => {
    const autoUrl = getDetectedHost();
    setServerUrlInput(autoUrl);
    setIsTesting(true);
    setConnectionStatus(null);
    try {
      await setServerUrl(autoUrl);
      await API.getStatus();
      setConnectionStatus('connected');
      Alert.alert('Auto-Detected!', `Connected to PC at ${autoUrl}`);
      onRefreshStatus();
    } catch (err) {
      setConnectionStatus('error');
      Alert.alert('Auto-Detect Result', `Attempted ${autoUrl}: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };
  const handleConfirmUnlink = () => {
    Alert.alert(
      'Unlink WhatsApp Account?',
      'Are you sure you want to unlink your WhatsApp account?\n\nYou will need to scan the QR code again to reconnect and send broadcasts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Unlink',
          style: 'destructive',
          onPress: async () => {
            try {
              if (onLogout) await onLogout();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Title */}
      <Text style={styles.title}>Settings & Connections</Text>

      {/* Backend Server URL Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="server-outline" size={16} color="#CA8A04" />
          <Text style={styles.cardTitle}>Backend Server Connection</Text>
          {connectionStatus === 'connected' && (
            <View style={styles.onlinePill}>
              <Text style={styles.onlinePillText}>Connected 🟢</Text>
            </View>
          )}
          {connectionStatus === 'error' && (
            <View style={styles.offlinePill}>
              <Text style={styles.offlinePillText}>Offline 🔴</Text>
            </View>
          )}
        </View>

        <Text style={styles.cardDesc}>
          Enter your 24/7 Cloud URL (e.g. Render/Cloudflare) or your local PC IP:
        </Text>

        <TextInput
          value={serverUrlInput}
          onChangeText={setServerUrlInput}
          placeholder="https://your-cloud-url.onrender.com"
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        <View style={styles.btnRow}>
          <TouchableOpacity
            onPress={handleAutoDetect}
            disabled={isTesting}
            style={styles.autoDetectBtn}
          >
            <Ionicons name="flash-outline" size={14} color="#CA8A04" />
            <Text style={styles.autoDetectText}>Reset Default</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSaveUrl}
            disabled={isTesting}
            style={styles.saveUrlBtn}
          >
            {isTesting ? (
              <ActivityIndicator size="small" color="#0F172A" />
            ) : (
              <Text style={styles.saveUrlText}>Save & Connect</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* WhatsApp Business Connection Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="logo-whatsapp" size={16} color="#16A34A" />
          <Text style={styles.cardTitle}>WhatsApp Business Account</Text>
        </View>

        {isConnected ? (
          <View style={styles.connectedBox}>
            <View>
              <Text style={styles.accountName}>{userProfile?.name || 'WhatsApp Business'}</Text>
              <Text style={styles.accountPhone}>+{userProfile?.phone}</Text>
            </View>
            <TouchableOpacity onPress={handleConfirmUnlink} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={15} color="#DC2626" />
              <Text style={styles.logoutText}>Unlink</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={onOpenQr} style={styles.linkBtn}>
            <Ionicons name="qr-code-outline" size={16} color="#0F172A" />
            <Text style={styles.linkBtnText}>Link WhatsApp Business Account</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* MongoDB Atlas Database Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="cloud-done-outline" size={16} color="#CA8A04" />
          <Text style={styles.cardTitle}>MongoDB Atlas Cloud</Text>
        </View>

        <View style={styles.dbInfoBox}>
          <Text style={styles.dbInfoLabel}>CLUSTER URI:</Text>
          <Text style={styles.dbInfoVal}>
            {status?.mongoUri || 'mongodb+srv://STACK_QUEUE:****@stackqueuecluster.wfarxbd.mongodb.net/'}
          </Text>
          <Text style={styles.dbInfoLabel}>STORAGE STATUS:</Text>
          <Text style={[styles.dbInfoVal, { color: isAtlas ? '#16A34A' : '#CA8A04' }]}>
            {isAtlas
              ? 'Direct Atlas Cloud Sync Active'
              : 'Local Fallback Storage Active (Pending IP Whitelist)'}
          </Text>
        </View>

        {!isAtlas && (
          <View style={styles.whitelistGuide}>
            <Text style={styles.guideTitle}>📌 To enable Atlas Cloud Sync:</Text>
            <Text style={styles.guideText}>1. Log in to cloud.mongodb.com</Text>
            <Text style={styles.guideText}>2. Go to Security &gt; Network Access</Text>
            <Text style={styles.guideText}>
              3. Click "+ Add IP Address" and select "Allow Access from Anywhere (0.0.0.0/0)"
            </Text>
            <Text style={styles.guideText}>4. Click Confirm!</Text>
          </View>
        )}
      </View>

      {/* Stack Queue Branding Footer */}
      <View style={styles.footer}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.footerLogo}
          resizeMode="contain"
        />
        <Text style={styles.footerBrand}>Stack Queue — Inclusive Learning</Text>
        <Text style={styles.footerVersion}>Mobile App Version 1.0.0 (Expo SDK 58)</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F5',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FEF08A',
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
    textTransform: 'uppercase',
    flex: 1,
  },
  onlinePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  onlinePillText: {
    fontSize: 10,
    color: '#15803D',
    fontWeight: 'bold',
  },
  offlinePill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  offlinePillText: {
    fontSize: 10,
    color: '#DC2626',
    fontWeight: 'bold',
  },
  cardDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  input: {
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0F172A',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  autoDetectBtn: {
    flex: 1,
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FDE047',
    borderRadius: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  autoDetectText: {
    color: '#713F12',
    fontWeight: 'bold',
    fontSize: 12,
  },
  saveUrlBtn: {
    flex: 1,
    backgroundColor: '#FACC15',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveUrlText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 12,
  },
  connectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF9F5',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FEF08A',
  },
  accountName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  accountPhone: {
    fontSize: 11,
    color: '#B45309',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  logoutText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FACC15',
    paddingVertical: 12,
    borderRadius: 14,
  },
  linkBtnText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 12,
  },
  dbInfoBox: {
    backgroundColor: '#FAF9F5',
    borderRadius: 12,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dbInfoLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '700',
  },
  dbInfoVal: {
    fontSize: 11,
    color: '#0F172A',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  whitelistGuide: {
    backgroundColor: '#FEF9C3',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE047',
    gap: 3,
  },
  guideTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#713F12',
    marginBottom: 2,
  },
  guideText: {
    fontSize: 10,
    color: '#854D0E',
    lineHeight: 15,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  footerLogo: {
    width: 32,
    height: 32,
    opacity: 0.8,
  },
  footerBrand: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  footerVersion: {
    fontSize: 10,
    color: '#94A3B8',
  },
});
