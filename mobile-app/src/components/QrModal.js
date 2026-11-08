import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API } from '../api';

export default function QrModal({ visible, onClose, status, onReconnect }) {
  const [tab, setTab] = useState('qr'); // 'qr' | 'code'
  const [phone, setPhone] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [loadingCode, setLoadingCode] = useState(false);

  const isConnected = status?.whatsapp?.status === 'connected';
  const qrBase64 = status?.whatsapp?.qrCode;
  const userProfile = status?.whatsapp?.userProfile;

  const handleRequestCode = async () => {
    if (!phone.trim()) {
      Alert.alert('Required', 'Please enter your phone number with country code (e.g. 919876543210)');
      return;
    }
    setLoadingCode(true);
    try {
      const res = await API.requestPairingCode(phone);
      setPairingCode(res.pairingCode);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoadingCode(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.titleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="phone-portrait-outline" size={20} color="#713F12" />
              </View>
              <View>
                <Text style={styles.sheetTitle}>Link WhatsApp Business</Text>
                <Text style={styles.sheetSub}>100% Free • Multi-Device • No API Costs</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {isConnected ? (
              <View style={styles.connectedCard}>
                <Ionicons name="checkmark-circle" size={54} color="#16A34A" />
                <Text style={styles.connectedTitle}>WhatsApp Business Linked!</Text>
                <Text style={styles.connectedProfile}>
                  {userProfile?.name || 'Active Account'} (+{userProfile?.phone})
                </Text>
                <TouchableOpacity onPress={onClose} style={styles.actionBtn}>
                  <Text style={styles.actionBtnText}>Start Sending Messages</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 16 }}>
                {/* Switcher */}
                <View style={styles.tabSwitcher}>
                  <TouchableOpacity
                    onPress={() => setTab('qr')}
                    style={[styles.tabBtn, tab === 'qr' && styles.tabBtnActive]}
                  >
                    <Text style={[styles.tabText, tab === 'qr' && styles.tabTextActive]}>
                      Scan QR Code
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setTab('code')}
                    style={[styles.tabBtn, tab === 'code' && styles.tabBtnActive]}
                  >
                    <Text style={[styles.tabText, tab === 'code' && styles.tabTextActive]}>
                      Pairing Code
                    </Text>
                  </TouchableOpacity>
                </View>

                {tab === 'qr' ? (
                  <View style={styles.qrContainer}>
                    <View style={styles.qrBox}>
                      {qrBase64 ? (
                        <Image
                          source={{ uri: qrBase64 }}
                          style={styles.qrImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={styles.loadingBox}>
                          <ActivityIndicator size="large" color="#EAB308" />
                          <Text style={styles.loadingText}>Generating QR Code...</Text>
                        </View>
                      )}
                    </View>

                    {/* Step Guide */}
                    <View style={styles.guideBox}>
                      <Text style={styles.guideHeader}>📌 How to Connect:</Text>
                      <Text style={styles.guideStep}>1. Open WhatsApp Business on your phone</Text>
                      <Text style={styles.guideStep}>2. Tap Settings &gt; Linked Devices</Text>
                      <Text style={styles.guideStep}>3. Tap "Link a Device" and scan this QR code</Text>
                    </View>

                    <TouchableOpacity onPress={onReconnect} style={styles.refreshBtn}>
                      <Ionicons name="refresh" size={14} color="#CA8A04" />
                      <Text style={styles.refreshText}>Refresh QR Code</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.codeContainer}>
                    <Text style={styles.codeDesc}>
                      Enter your WhatsApp Business number to receive an 8-digit linking code:
                    </Text>
                    <TextInput
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="e.g. 919876543210"
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                      style={styles.input}
                    />
                    <TouchableOpacity
                      onPress={handleRequestCode}
                      disabled={loadingCode}
                      style={styles.generateBtn}
                    >
                      {loadingCode ? (
                        <ActivityIndicator size="small" color="#0F172A" />
                      ) : (
                        <Text style={styles.generateBtnText}>Get 8-Digit Pairing Code</Text>
                      )}
                    </TouchableOpacity>

                    {pairingCode ? (
                      <View style={styles.codeDisplayBox}>
                        <Text style={styles.codeLabel}>YOUR LINKING CODE:</Text>
                        <Text style={styles.codeValue}>{pairingCode}</Text>
                        <Text style={styles.codeHelp}>
                          Open WhatsApp &gt; Linked Devices &gt; Link with phone number instead &gt; enter this code.
                        </Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: '#FEF08A',
    maxHeight: '90%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF08A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  sheetSub: {
    fontSize: 10,
    color: '#B45309',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 20,
    paddingBottom: 36,
  },
  connectedCard: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  connectedTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 8,
  },
  connectedProfile: {
    fontSize: 13,
    color: '#16A34A',
    fontWeight: '600',
  },
  actionBtn: {
    backgroundColor: '#FACC15',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 16,
  },
  actionBtnText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 13,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#FAF9F5',
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 11,
  },
  tabBtnActive: {
    backgroundColor: '#FACC15',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#0F172A',
    fontWeight: 'bold',
  },
  qrContainer: {
    alignItems: 'center',
    gap: 14,
  },
  qrBox: {
    width: 220,
    height: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FACC15',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  qrImage: {
    width: '100%',
    height: '100%',
  },
  loadingBox: {
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  guideBox: {
    backgroundColor: '#FAF9F5',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
    gap: 4,
  },
  guideHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#713F12',
    marginBottom: 2,
  },
  guideStep: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  refreshText: {
    fontSize: 11,
    color: '#CA8A04',
    fontWeight: '700',
  },
  codeContainer: {
    gap: 12,
  },
  codeDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  generateBtn: {
    backgroundColor: '#FACC15',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  generateBtnText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 13,
  },
  codeDisplayBox: {
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FDE047',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#713F12',
    letterSpacing: 1,
  },
  codeValue: {
    fontSize: 26,
    fontWeight: '900',
    color: '#B45309',
    letterSpacing: 4,
    fontFamily: 'monospace',
  },
  codeHelp: {
    fontSize: 10,
    color: '#854D0E',
    textAlign: 'center',
    marginTop: 4,
  },
});
