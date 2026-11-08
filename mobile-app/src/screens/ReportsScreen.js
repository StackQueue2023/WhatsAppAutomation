import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API } from '../api';

export default function ReportsScreen() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  const fetchReports = async () => {
    try {
      const data = await API.getCampaigns();
      setCampaigns(data);
    } catch (err) {
      console.warn('Reports fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const totalSent = campaigns.reduce((acc, c) => acc + (c.sentCount || 0), 0);
  const totalFailed = campaigns.reduce((acc, c) => acc + (c.failedCount || 0), 0);
  const totalRecipients = totalSent + totalFailed;
  const successRate = totalRecipients > 0 ? Math.round((totalSent / totalRecipients) * 100) : 100;

  return (
    <View style={styles.container}>
      {/* Title */}
      <View style={styles.header}>
        <Text style={styles.title}>Broadcast Reports</Text>
        <TouchableOpacity onPress={fetchReports} style={styles.refreshIcon}>
          <Ionicons name="refresh" size={16} color="#CA8A04" />
        </TouchableOpacity>
      </View>

      {/* Metrics Cards */}
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>CAMPAIGNS</Text>
          <Text style={styles.metricValue}>{campaigns.length}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>DELIVERED</Text>
          <Text style={[styles.metricValue, { color: '#CA8A04' }]}>{totalSent}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>SUCCESS</Text>
          <Text style={[styles.metricValue, { color: '#16A34A' }]}>{successRate}%</Text>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#EAB308" />
        </View>
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setSelectedCampaign(item)}
              style={styles.campaignCard}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardDate}>
                  {new Date(item.createdAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                {item.hasImage && (
                  <View style={styles.imageBadge}>
                    <Ionicons name="image" size={10} color="#CA8A04" />
                    <Text style={styles.imageBadgeText}>Image</Text>
                  </View>
                )}
              </View>

              <Text style={styles.cardMessage} numberOfLines={2}>
                {item.message || '(Image only broadcast)'}
              </Text>

              <View style={styles.cardBottom}>
                <View style={styles.statusRow}>
                  <Ionicons name="checkmark-done" size={13} color="#16A34A" />
                  <Text style={styles.sentCount}>{item.sentCount} sent</Text>
                  {item.failedCount > 0 && (
                    <Text style={styles.failedCount}>{item.failedCount} failed</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Details Modal */}
      <Modal visible={!!selectedCampaign} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Campaign Summary</Text>
              <TouchableOpacity onPress={() => setSelectedCampaign(null)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Message Box */}
              <View style={styles.messageBox}>
                <Text style={styles.boxLabel}>Broadcast Message:</Text>
                <Text style={styles.boxText}>{selectedCampaign?.message || '(No text)'}</Text>
              </View>

              {/* Logs */}
              <Text style={styles.logTitle}>
                Recipient Delivery ({selectedCampaign?.logs?.length || 0}):
              </Text>
              {selectedCampaign?.logs?.map((l, idx) => (
                <View key={idx} style={styles.logRow}>
                  <View>
                    <Text style={styles.logName}>{l.contactName}</Text>
                    <Text style={styles.logPhone}>+{l.phone}</Text>
                  </View>
                  {l.status === 'sent' ? (
                    <Text style={styles.logSent}>Delivered ✅</Text>
                  ) : (
                    <Text style={styles.logFailed}>Failed ❌</Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F5',
    padding: 16,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  refreshIcon: {
    padding: 6,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FEF08A',
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    gap: 10,
    paddingBottom: 24,
  },
  campaignCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FEF08A',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDate: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'monospace',
  },
  imageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  imageBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#713F12',
  },
  cardMessage: {
    fontSize: 12,
    color: '#0F172A',
    lineHeight: 18,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sentCount: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#16A34A',
  },
  failedCount: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: '#FEF08A',
    padding: 20,
    maxHeight: '80%',
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalScroll: {
    gap: 10,
  },
  messageBox: {
    backgroundColor: '#FAF9F5',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  boxLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  boxText: {
    fontSize: 12,
    color: '#0F172A',
    lineHeight: 18,
  },
  logTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAF9F5',
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  logPhone: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: 'monospace',
    marginTop: 1,
  },
  logSent: {
    fontSize: 10,
    color: '#16A34A',
    fontWeight: '700',
  },
  logFailed: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '700',
  },
});
