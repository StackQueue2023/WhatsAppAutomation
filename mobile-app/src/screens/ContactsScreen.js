import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API } from '../api';

export default function ContactsScreen({
  contacts,
  groups,
  onRefresh,
  onNavigateToBroadcast,
  status
}) {
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showAssignGroupModal, setShowAssignGroupModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);

  // Multi-select for bulk group operations or broadcast
  const [selectedContactIds, setSelectedContactIds] = useState([]);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [group, setGroup] = useState('');
  const [notes, setNotes] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkGroup, setBulkGroup] = useState('Full Stack Batch');
  const [newGroupName, setNewGroupName] = useState('');
  const [targetAssignGroup, setTargetAssignGroup] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAtlas = status?.db?.isAtlas;

  // Helper to extract list of groups for a contact (supports multiple groups per member)
  const getContactGroupList = (c) => {
    if (!c) return ['General'];
    if (Array.isArray(c.groups) && c.groups.length > 0) return c.groups;
    if (typeof c.group === 'string' && c.group.trim()) {
      return c.group.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return ['General'];
  };

  // Toggle group inside Add/Edit form
  const toggleGroupInForm = (gName) => {
    const list = group ? group.split(',').map((s) => s.trim()).filter(Boolean) : [];
    if (list.includes(gName)) {
      setGroup(list.filter((item) => item !== gName).join(', '));
    } else {
      setGroup([...list, gName].join(', '));
    }
  };

  // Normalize groups to { name, count }
  const groupList = groups.map((g) => {
    const gName = typeof g === 'object' && g !== null ? g.name : g;
    const matchCount = contacts.filter((c) => {
      if (c.status === 'inactive') return false;
      const cGroups = getContactGroupList(c);
      return cGroups.includes(gName);
    }).length;

    return {
      name: gName,
      count: matchCount,
    };
  });

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setGroup('');
    setNotes('');
    setEditingContact(null);
  };

  const openAdd = () => {
    resetForm();
    if (selectedGroup !== 'all') {
      setGroup(selectedGroup);
    }
    setShowAddModal(true);
  };

  const openEdit = (contact) => {
    setEditingContact(contact);
    setName(contact.name || '');
    setPhone(contact.phone || '');
    setEmail(contact.email || '');
    const cGroups = getContactGroupList(contact);
    setGroup(cGroups.join(', '));
    setNotes(contact.notes || '');
    setShowAddModal(true);
  };

  const handleSaveContact = async () => {
    if (!phone.trim()) {
      Alert.alert('Required', 'Please enter a valid WhatsApp phone number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const gList = group ? group.split(',').map((s) => s.trim()).filter(Boolean) : ['General'];
      const payload = {
        name: name || 'Contact',
        phone,
        email,
        group: gList.join(', '),
        groups: gList,
        notes,
      };

      if (editingContact) {
        await API.updateContact(editingContact._id, payload);
      } else {
        await API.addContact(payload);
      }

      setShowAddModal(false);
      resetForm();
      onRefresh();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (contact) => {
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to delete ${contact.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await API.deleteContact(contact._id);
              onRefresh();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const handleBulkImport = async () => {
    if (!bulkText.trim()) {
      Alert.alert('Required', 'Please enter or paste phone numbers.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await API.bulkImport(bulkText, bulkGroup.trim() || 'General');
      Alert.alert('Imported', `Successfully added ${res.added} contacts to "${bulkGroup}"!`);
      setShowBulkModal(false);
      setBulkText('');
      onRefresh();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create new group & assign contacts (Requires at least 1 member!)
  const handleCreateGroup = async () => {
    const clean = newGroupName.trim();
    if (!clean) {
      Alert.alert('Required', 'Please enter a name for the Broadcast Group.');
      return;
    }
    if (selectedContactIds.length === 0) {
      Alert.alert(
        'Members Required',
        'Please select at least 1 contact to create this group. Groups cannot be created without members.'
      );
      return;
    }
    setIsSubmitting(true);
    try {
      await API.createGroup(clean, '', selectedContactIds);
      Alert.alert('Group Created', `Broadcast Group "${clean}" created with ${selectedContactIds.length} members!`);
      setShowCreateGroupModal(false);
      setNewGroupName('');
      setSelectedContactIds([]);
      setSelectedGroup(clean);
      onRefresh();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Assign selected contacts to existing or new group
  const handleAssignSelectedToGroup = async () => {
    const clean = targetAssignGroup.trim();
    if (!clean) {
      Alert.alert('Required', 'Please enter or select a group name.');
      return;
    }
    if (selectedContactIds.length === 0) {
      Alert.alert('Required', 'Please select contacts to assign.');
      return;
    }

    setIsSubmitting(true);
    try {
      await API.assignContactsToGroup(selectedContactIds, clean);
      Alert.alert('Updated', `Assigned ${selectedContactIds.length} contacts to "${clean}"!`);
      setShowAssignGroupModal(false);
      setSelectedContactIds([]);
      onRefresh();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle selection
  const toggleContactSelect = (id) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Filter contacts supporting multiple groups
  const filtered = contacts.filter((c) => {
    const cGroups = getContactGroupList(c);
    const matchesSearch =
      !search ||
      (c.name && c.name.toLowerCase().includes(search.toLowerCase())) ||
      (c.phone && c.phone.includes(search)) ||
      cGroups.some((g) => g.toLowerCase().includes(search.toLowerCase())) ||
      (c.group && c.group.toLowerCase().includes(search.toLowerCase()));

    const matchesGroup =
      selectedGroup === 'all' || cGroups.includes(selectedGroup);

    return matchesSearch && matchesGroup;
  });

  return (
    <View style={styles.container}>
      {/* Top Header Card */}
      <View style={styles.topCard}>
        <View style={styles.topTitleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Recipients Database</Text>
            <Text style={styles.subTitle}>
              {isAtlas ? '☁️ Stored in MongoDB Atlas Cloud' : '📁 Local Storage (Atlas Sync)'}
            </Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{contacts.length} Contacts</Text>
          </View>
        </View>

        {/* Action Toolbar with 3 clear buttons with generous spacing */}
        <View style={styles.actionToolbar}>
          <TouchableOpacity
            onPress={() => {
              setNewGroupName('');
              setShowCreateGroupModal(true);
            }}
            style={styles.actionBtnGroup}
          >
            <Ionicons name="folder-outline" size={15} color="#854D0E" />
            <Text style={styles.actionBtnGroupText}>+ Group</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowBulkModal(true)}
            style={styles.actionBtnBulk}
          >
            <Ionicons name="cloud-upload-outline" size={15} color="#854D0E" />
            <Text style={styles.actionBtnBulkText}>Bulk Upload</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={openAdd} style={styles.actionBtnAdd}>
            <Ionicons name="add" size={16} color="#0F172A" />
            <Text style={styles.actionBtnAddText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#CA8A04" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, phone, or group..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Broadcast Group Filter Chips */}
        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <TouchableOpacity
              onPress={() => setSelectedGroup('all')}
              style={[styles.filterChip, selectedGroup === 'all' && styles.filterChipActive]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedGroup === 'all' && styles.filterChipTextActive,
                ]}
              >
                All ({contacts.length})
              </Text>
            </TouchableOpacity>

            {groupList.map((g, idx) => {
              const isSelected = selectedGroup === g.name;
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setSelectedGroup(g.name)}
                  style={[styles.filterChip, isSelected && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                    📁 {g.name} ({g.count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Quick Broadcast button for selected group */}
          {selectedGroup !== 'all' && onNavigateToBroadcast && (
            <TouchableOpacity
              onPress={() => onNavigateToBroadcast(selectedGroup)}
              style={styles.groupBroadcastPill}
            >
              <Ionicons name="paper-plane" size={12} color="#CA8A04" />
              <Text style={styles.groupBroadcastPillText}>Broadcast to "{selectedGroup}"</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Contact List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={40} color="#CBD5E1" />
            <Text style={styles.emptyText}>No contacts found</Text>
            <TouchableOpacity onPress={openAdd} style={styles.emptyAddBtn}>
              <Text style={styles.emptyAddBtnText}>+ Add First Contact</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const isSelected = selectedContactIds.includes(item._id);
          const memberGroups = getContactGroupList(item);
          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => toggleContactSelect(item._id)}
              style={[styles.contactCard, isSelected && styles.contactCardSelected]}
            >
              <View style={styles.contactLeft}>
                {/* Selection Checkbox */}
                <TouchableOpacity
                  onPress={() => toggleContactSelect(item._id)}
                  style={styles.checkIcon}
                >
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={isSelected ? '#EAB308' : '#CBD5E1'}
                  />
                </TouchableOpacity>

                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.name ? item.name.charAt(0).toUpperCase() : '#'}
                  </Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.phone}>+{item.phone}</Text>

                  {/* Multiple Group Badges */}
                  <View style={styles.groupBadgesRow}>
                    {memberGroups.map((gName, gIdx) => (
                      <View key={gIdx} style={styles.groupBadgePill}>
                        <Ionicons name="folder-outline" size={10} color="#854D0E" />
                        <Text style={styles.groupBadge}>{gName}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => Linking.openURL(`https://wa.me/${item.phone}`)}
                  style={styles.actionIcon}
                >
                  <Ionicons name="logo-whatsapp" size={16} color="#16A34A" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionIcon}>
                  <Ionicons name="pencil" size={15} color="#CA8A04" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionIcon}>
                  <Ionicons name="trash-outline" size={15} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Floating Action Bar for Selected Contacts */}
      {selectedContactIds.length > 0 && (
        <View style={styles.floatingActionBar}>
          <View style={styles.floatingLeft}>
            <Text style={styles.floatingCount}>
              {selectedContactIds.length} Selected
            </Text>
            <TouchableOpacity onPress={() => setSelectedContactIds([])}>
              <Text style={styles.floatingClear}>Clear</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.floatingRight}>
            <TouchableOpacity
              onPress={() => {
                setTargetAssignGroup(selectedGroup !== 'all' ? selectedGroup : '');
                setShowAssignGroupModal(true);
              }}
              style={styles.floatingAssignBtn}
            >
              <Ionicons name="folder-open" size={14} color="#FDE047" />
              <Text style={styles.floatingAssignText}>Assign Group</Text>
            </TouchableOpacity>

            {onNavigateToBroadcast && (
              <TouchableOpacity
                onPress={() => onNavigateToBroadcast(null, selectedContactIds)}
                style={styles.floatingBroadcastBtn}
              >
                <Ionicons name="paper-plane" size={14} color="#0F172A" />
                <Text style={styles.floatingBroadcastText}>Broadcast</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Add / Edit Contact Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingContact ? 'Edit Contact' : 'Add New Recipient'}
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGap}>
              <Text style={styles.formLabel}>Full Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Aravind Kumar"
                placeholderTextColor="#94A3B8"
                style={styles.modalInput}
              />

              <Text style={styles.formLabel}>WhatsApp Number (with country code)</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. 919876543210 (without +)"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                style={styles.modalInput}
              />

              <Text style={styles.formLabel}>Groups (Select or Type comma-separated)</Text>
              <TextInput
                value={group}
                onChangeText={setGroup}
                placeholder="e.g. Full Stack Batch, Python Automation"
                placeholderTextColor="#94A3B8"
                style={styles.modalInput}
              />

              {/* Group Toggle Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestChips}>
                {groupList.map((g, idx) => {
                  const currentSelected = group
                    ? group.split(',').map((s) => s.trim().toLowerCase()).includes(g.name.toLowerCase())
                    : false;
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => toggleGroupInForm(g.name)}
                      style={[styles.suggestChip, currentSelected && styles.suggestChipActive]}
                    >
                      <Ionicons
                        name={currentSelected ? 'checkmark-circle' : 'add'}
                        size={12}
                        color={currentSelected ? '#713F12' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.suggestChipText,
                          currentSelected && styles.suggestChipTextActive,
                        ]}
                      >
                        {g.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.formLabel}>Notes (Optional)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. Inquired about classes"
                placeholderTextColor="#94A3B8"
                style={styles.modalInput}
              />

              <TouchableOpacity
                onPress={handleSaveContact}
                disabled={isSubmitting}
                style={styles.saveBtn}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#0F172A" />
                ) : (
                  <Text style={styles.saveBtnText}>Save to MongoDB Atlas ☁️</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create New Group Modal (Requires at least 1 member) */}
      <Modal visible={showCreateGroupModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Create Broadcast Group</Text>
                <Text style={styles.modalSub}>Group contacts for separate broadcast lists (At least 1 member required)</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCreateGroupModal(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGap}>
              <Text style={styles.formLabel}>Group Name</Text>
              <TextInput
                value={newGroupName}
                onChangeText={setNewGroupName}
                placeholder="e.g. Morning Batch, Weekend Class..."
                placeholderTextColor="#94A3B8"
                style={styles.modalInput}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.formLabel}>
                  Select Members ({selectedContactIds.length} Selected)
                </Text>
                {selectedContactIds.length === 0 && (
                  <Text style={{ fontSize: 10, color: '#DC2626', fontWeight: 'bold' }}>
                    * At least 1 member required
                  </Text>
                )}
              </View>

              <FlatList
                data={contacts}
                keyExtractor={(item) => item._id}
                style={{ maxHeight: 180 }}
                renderItem={({ item }) => {
                  const isChecked = selectedContactIds.includes(item._id);
                  return (
                    <TouchableOpacity
                      onPress={() => toggleContactSelect(item._id)}
                      style={styles.pickRow}
                    >
                      <Ionicons
                        name={isChecked ? 'checkbox' : 'square-outline'}
                        size={18}
                        color={isChecked ? '#CA8A04' : '#CBD5E1'}
                      />
                      <Text style={styles.pickRowName}>{item.name}</Text>
                      <Text style={styles.pickRowPhone}>+{item.phone}</Text>
                    </TouchableOpacity>
                  );
                }}
              />

              <TouchableOpacity
                onPress={handleCreateGroup}
                disabled={isSubmitting || selectedContactIds.length === 0}
                style={[
                  styles.saveBtn,
                  selectedContactIds.length === 0 && { opacity: 0.6, backgroundColor: '#E2E8F0' },
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#0F172A" />
                ) : (
                  <Text
                    style={[
                      styles.saveBtnText,
                      selectedContactIds.length === 0 && { color: '#94A3B8' },
                    ]}
                  >
                    {selectedContactIds.length > 0
                      ? `Create Group with ${selectedContactIds.length} Members ☁️`
                      : 'Select Members to Create Group'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Assign Selected Contacts to Group Modal */}
      <Modal visible={showAssignGroupModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Assign to Broadcast Group</Text>
                <Text style={styles.modalSub}>Add {selectedContactIds.length} contacts to a group</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAssignGroupModal(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGap}>
              <Text style={styles.formLabel}>Select or Type Group Name</Text>
              <TextInput
                value={targetAssignGroup}
                onChangeText={setTargetAssignGroup}
                placeholder="e.g. Full Stack Batch, Python Automation..."
                placeholderTextColor="#94A3B8"
                style={styles.modalInput}
              />

              {/* Group choices */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestChips}>
                {groupList.map((g, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => setTargetAssignGroup(g.name)}
                    style={[
                      styles.suggestChip,
                      targetAssignGroup === g.name && styles.suggestChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.suggestChipText,
                        targetAssignGroup === g.name && styles.suggestChipTextActive,
                      ]}
                    >
                      📁 {g.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                onPress={handleAssignSelectedToGroup}
                disabled={isSubmitting}
                style={styles.saveBtn}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#0F172A" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    Assign {selectedContactIds.length} Contacts
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal visible={showBulkModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Bulk Import Recipients</Text>
                <Text style={styles.modalSub}>Paste numbers line by line (Name, Phone)</Text>
              </View>
              <TouchableOpacity onPress={() => setShowBulkModal(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGap}>
              <Text style={styles.formLabel}>Assign to Group</Text>
              <TextInput
                value={bulkGroup}
                onChangeText={setBulkGroup}
                placeholder="e.g. New Batch 2024"
                placeholderTextColor="#94A3B8"
                style={styles.modalInput}
              />

              <Text style={styles.formLabel}>Recipient Data</Text>
              <TextInput
                multiline
                numberOfLines={6}
                value={bulkText}
                onChangeText={setBulkText}
                placeholder={"Aravind Kumar, 919876543210\nPriya, 919876543211\n919876543212"}
                placeholderTextColor="#94A3B8"
                style={[styles.modalInput, styles.textArea]}
              />

              <TouchableOpacity
                onPress={handleBulkImport}
                disabled={isSubmitting}
                style={styles.saveBtn}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#0F172A" />
                ) : (
                  <Text style={styles.saveBtnText}>Import into MongoDB Atlas</Text>
                )}
              </TouchableOpacity>
            </View>
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
  },
  topCard: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#FEF08A',
    padding: 16,
    gap: 12,
  },
  topTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  subTitle: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEF08A',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#854D0E',
  },
  actionToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF9C3',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  actionBtnGroupText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#854D0E',
  },
  actionBtnBulk: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  actionBtnBulkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#854D0E',
  },
  actionBtnAdd: {
    flex: 0.9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FACC15',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  actionBtnAddText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  groupBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  groupBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#FEF08A',
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 12,
    padding: 0,
  },
  filterSection: {
    gap: 8,
  },
  filterRow: {
    flexDirection: 'row',
  },
  filterChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#FEF08A',
    borderColor: '#EAB308',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#713F12',
    fontWeight: '700',
  },
  groupBroadcastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#FEF08A',
  },
  groupBroadcastPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#713F12',
  },
  listContent: {
    padding: 16,
    gap: 10,
    paddingBottom: 90,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  contactCardSelected: {
    borderColor: '#EAB308',
    backgroundColor: '#FEFCE8',
  },
  contactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  checkIcon: {
    padding: 2,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF08A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#713F12',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  groupBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#713F12',
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  phone: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionIcon: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  floatingActionBar: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#FACC15',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  floatingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  floatingCount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  floatingClear: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F87171',
  },
  floatingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  floatingAssignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  floatingAssignText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FDE047',
  },
  floatingBroadcastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FACC15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  floatingBroadcastText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: '#FEF08A',
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  formGap: {
    marginTop: 14,
    gap: 8,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  modalInput: {
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    color: '#0F172A',
    fontSize: 13,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  suggestChips: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  suggestChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 6,
  },
  suggestChipActive: {
    backgroundColor: '#FACC15',
  },
  suggestChipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  suggestChipTextActive: {
    color: '#0F172A',
    fontWeight: 'bold',
  },
  helpText: {
    fontSize: 11,
    color: '#64748B',
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickRowName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  pickRowPhone: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: 'monospace',
  },
  saveBtn: {
    backgroundColor: '#FACC15',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  emptyAddBtn: {
    backgroundColor: '#FEF08A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  emptyAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#713F12',
  },
});
