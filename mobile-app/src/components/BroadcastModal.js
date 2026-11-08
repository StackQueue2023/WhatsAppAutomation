import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function BroadcastModal({
  visible,
  progress,
  isBroadcasting,
  onCancel,
  onClose
}) {
  if (!visible) return null;

  const total = progress?.total || 1;
  const current = progress?.current || 0;
  const percent = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;
  const logs = progress?.logs || [];
  const statusStr = progress?.status || (isBroadcasting ? 'sending' : 'completed');
  const isDone = !isBroadcasting || statusStr === 'completed' || statusStr === 'cancelled' || statusStr === 'partial';

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.statusDotRow}>
              {!isDone ? (
                <View style={styles.pulseDot} />
              ) : (
                <Ionicons
                  name={statusStr === 'completed' ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={statusStr === 'completed' ? '#16A34A' : '#EAB308'}
                />
              )}
              <Text style={styles.title}>
                {statusStr === 'completed'
                  ? 'Broadcast Completed!'
                  : statusStr === 'cancelled'
                  ? 'Broadcast Cancelled'
                  : 'Broadcasting in Progress...'}
              </Text>
            </View>
            {!isDone ? (
              <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
                <Ionicons name="stop-circle-outline" size={16} color="#DC2626" />
                <Text style={styles.cancelText}>Stop</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={onClose} style={styles.closeXBtn}>
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>

          {/* Progress Bar & Stats */}
          <View style={styles.progressSection}>
            <View style={styles.statsRow}>
              <Text style={styles.statCount}>
                Sent {current} / {total} Recipients
              </Text>
              <Text style={styles.statPercent}>{percent}%</Text>
            </View>

            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
            </View>
          </View>

          {/* Real-time Recipient Delivery Log */}
          <View style={styles.logSection}>
            <Text style={styles.logHeader}>Live Delivery Ticker:</Text>
            <ScrollView style={styles.logScroll} showsVerticalScrollIndicator={false}>
              {logs.length === 0 ? (
                <View style={styles.emptyLog}>
                  <ActivityIndicator size="small" color="#CA8A04" />
                  <Text style={styles.emptyLogText}>Connecting to WhatsApp engine...</Text>
                </View>
              ) : (
                logs.map((item, idx) => (
                  <View key={idx} style={styles.logItem}>
                    <View style={styles.logContactInfo}>
                      <Text style={styles.logName}>{item.contactName}</Text>
                      <Text style={styles.logPhone}>+{item.phone}</Text>
                    </View>
                    {item.status === 'sent' ? (
                      <View style={styles.statusSent}>
                        <Ionicons name="checkmark-done" size={14} color="#15803D" />
                        <Text style={styles.statusSentText}>Delivered</Text>
                      </View>
                    ) : (
                      <View style={styles.statusFailed}>
                        <Ionicons name="close-circle" size={14} color="#DC2626" />
                        <Text style={styles.statusFailedText}>Failed</Text>
                      </View>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          </View>

          {/* Footer Action */}
          {isDone && (
            <TouchableOpacity onPress={onClose} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Close Report</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FEF08A',
    padding: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FACC15',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cancelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  closeXBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  progressSection: {
    marginTop: 16,
    gap: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  statPercent: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B45309',
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: '#FEF9C3',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FEF08A',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FACC15',
    borderRadius: 6,
  },
  logSection: {
    marginTop: 16,
    gap: 8,
    flexShrink: 1,
  },
  logHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  logScroll: {
    maxHeight: 180,
    backgroundColor: '#FAF9F5',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyLog: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    justifyContent: 'center',
  },
  emptyLogText: {
    fontSize: 11,
    color: '#64748B',
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  logContactInfo: {
    flex: 1,
  },
  logName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  logPhone: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: 'monospace',
    marginTop: 1,
  },
  statusSent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusSentText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  statusFailed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusFailedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  doneBtn: {
    marginTop: 16,
    backgroundColor: '#FACC15',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
