import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function Header({ status, onOpenQr, onOpenSettings }) {
  const isConnected = status?.whatsapp?.status === 'connected';
  const isConnecting = status?.whatsapp?.status === 'connecting';
  const isAtlas = status?.db?.isAtlas;

  return (
    <View style={styles.header}>
      {/* Brand & Logo */}
      <View style={styles.brandRow}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.brandTextContainer}>
          <Text style={styles.brandTitle}>STACK QUEUE</Text>
          <Text style={styles.brandSubtitle}>WHATSAPP AUTOMATION</Text>
        </View>
      </View>

      {/* Badges */}
      <View style={styles.badgeRow}>
        {/* DB Status Badge */}
        <TouchableOpacity
          onPress={onOpenSettings}
          style={[styles.badge, isAtlas ? styles.badgeAtlas : styles.badgeLocal]}
        >
          <Ionicons
            name="cloud"
            size={11}
            color="#CA8A04"
          />
          <Text style={styles.badgeText}>
            {isAtlas ? 'Atlas' : 'Local'}
          </Text>
        </TouchableOpacity>

        {/* WhatsApp Status Pill */}
        {isConnected ? (
          <TouchableOpacity onPress={onOpenSettings} style={styles.connectedBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.connectedText}>Online</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onOpenQr}
            style={[styles.linkBadge, isConnecting && styles.connectingBadge]}
          >
            <Ionicons
              name={isConnecting ? "sync" : "qr-code"}
              size={12}
              color={isConnecting ? "#92400E" : "#0F172A"}
            />
            <Text style={[styles.linkText, isConnecting && { color: "#92400E" }]}>
              {isConnecting ? "Connecting" : "Link WA"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1.5,
    borderBottomColor: '#FEF08A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 3,
    shadowColor: '#EAB308',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 32,
    height: 32,
    marginRight: 8,
  },
  brandTextContainer: {
    flexDirection: 'column',
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeAtlas: {
    backgroundColor: '#FEF9C3',
    borderColor: '#FDE047',
  },
  badgeLocal: {
    backgroundColor: '#FEF9C3',
    borderColor: '#FDE047',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  connectedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  linkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FACC15',
    borderWidth: 1,
    borderColor: '#EAB308',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    shadowColor: '#EAB308',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  connectingBadge: {
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  linkText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
});
