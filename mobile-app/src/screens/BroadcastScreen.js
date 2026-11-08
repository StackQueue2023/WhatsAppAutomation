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
  Modal,
  FlatList,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { File as FileSystemNewFile } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API } from '../api';

/**
 * Universal base64 file reader for all Expo versions (SDK 52, 53, 54, 58+).
 * Tier 1: New Expo File API (File.base64())
 * Tier 2: Expo FileSystem legacy API (readAsStringAsync)
 * Tier 3: Universal fetch + FileReader (works for all content:// and file:// local URIs)
 */
const readFileAsBase64 = async (uri) => {
  // Strategy 1: New Expo File System API (Expo SDK 54 / 58+)
  try {
    if (FileSystemNewFile) {
      const file = new FileSystemNewFile(uri);
      if (typeof file.base64 === 'function') {
        const b64 = await file.base64();
        if (b64) return b64;
      }
    }
  } catch (e1) {
    console.log('New File API read failed or skipped, falling back:', e1?.message);
  }

  // Strategy 2: Legacy FileSystem API (expo-file-system/legacy)
  try {
    if (FileSystemLegacy && typeof FileSystemLegacy.readAsStringAsync === 'function') {
      const b64 = await FileSystemLegacy.readAsStringAsync(uri, {
        encoding: FileSystemLegacy.EncodingType?.Base64 || 'base64',
      });
      if (b64) return b64;
    }
  } catch (e2) {
    console.log('Legacy readAsStringAsync failed or skipped, falling back:', e2?.message);
  }

  // Strategy 3: Standard fetch -> Blob -> FileReader DataURL
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          const commaIdx = result.indexOf(',');
          resolve(commaIdx >= 0 ? result.substring(commaIdx + 1) : result);
        } else {
          reject(new Error('FileReader did not return a valid string'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e3) {
    console.error('All base64 conversion strategies failed:', e3);
    throw new Error('Unable to read attachment file: ' + (e3?.message || 'unknown error'));
  }
};

const DEFAULT_TEMPLATES = [
  {
    id: 'batch_alert',
    title: '🎓 New Batch Alert',
    text: 'Hi {name}! 👋 New batch starting this week at Stack Queue. Reply to reserve your seat!',
  },
  {
    id: 'reminder',
    title: '⏰ Reminder',
    text: 'Dear {name}, friendly reminder for your upcoming session with Stack Queue.',
  },
  {
    id: 'announcement',
    title: '🎉 Announcement',
    text: 'Special announcement for {name}! Check out our latest update from Stack Queue.',
  },
];

export default function BroadcastScreen({
  status,
  contacts,
  groups,
  targetGroup,
  targetContactIds,
  onClearTarget,
  onOpenQr,
  onStartBroadcast,
  onRefreshGroups
}) {
  const [message, setMessage] = useState('');
  const [selectedAttachment, setSelectedAttachment] = useState(null); // { uri, name, mimeType, base64, isImage }
  const [recipientMode, setRecipientMode] = useState('all'); // 'all' | 'group' | 'selected'
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [excludedMemberIds, setExcludedMemberIds] = useState([]);
  const [delayInterval, setDelayInterval] = useState('turbo');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Template states
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateContent, setTemplateContent] = useState('');

  // Modals
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupSelectedIds, setNewGroupSelectedIds] = useState([]);
  const [searchContact, setSearchContact] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const isConnected = status?.whatsapp?.status === 'connected';

  // Helper to extract list of groups for a contact (supports multiple groups)
  const getContactGroupList = (c) => {
    if (!c) return ['General'];
    if (Array.isArray(c.groups) && c.groups.length > 0) return c.groups;
    if (typeof c.group === 'string' && c.group.trim()) {
      return c.group.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return ['General'];
  };

  // Normalize groups to { name, count } supporting multiple groups
  const groupList = groups.map((g) => {
    const gName = typeof g === 'object' && g !== null ? g.name : g;
    const matchCount = contacts.filter((c) => {
      if (c.status === 'inactive' || !c.phone) return false;
      return getContactGroupList(c).includes(gName);
    }).length;

    return {
      name: gName,
      count: matchCount,
    };
  });

  // Load templates from AsyncStorage
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const stored = await AsyncStorage.getItem('@stackqueue_templates');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTemplates(parsed);
        }
      }
    } catch (e) {
      console.log('Error loading templates', e);
    }
  };

  const saveTemplates = async (newTemplates) => {
    try {
      await AsyncStorage.setItem('@stackqueue_templates', JSON.stringify(newTemplates));
      setTemplates(newTemplates);
    } catch (e) {
      Alert.alert('Storage Error', 'Could not save templates: ' + e.message);
    }
  };

  const openNewTemplateModal = () => {
    setEditingTemplate(null);
    setTemplateTitle('');
    setTemplateContent(message || '');
    setShowTemplateModal(true);
  };

  const openEditTemplateModal = (tpl) => {
    setEditingTemplate(tpl);
    setTemplateTitle(tpl.title);
    setTemplateContent(tpl.text);
    setShowTemplateModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateTitle.trim() || !templateContent.trim()) {
      Alert.alert('Required', 'Please enter a title and message content for the template.');
      return;
    }
    let updated;
    if (editingTemplate) {
      updated = templates.map((t) =>
        t.id === editingTemplate.id
          ? { ...t, title: templateTitle.trim(), text: templateContent.trim() }
          : t
      );
    } else {
      const newTpl = {
        id: 'tpl_' + Date.now(),
        title: templateTitle.trim(),
        text: templateContent.trim(),
      };
      updated = [...templates, newTpl];
    }
    await saveTemplates(updated);
    setShowTemplateModal(false);
    setEditingTemplate(null);
    setTemplateTitle('');
    setTemplateContent('');
    Alert.alert('Template Saved', 'Your template is ready to use!');
  };

  const handleDeleteTemplate = async (id) => {
    Alert.alert('Delete Template', 'Are you sure you want to delete this template?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = templates.filter((t) => t.id !== id);
          await saveTemplates(updated);
          setShowTemplateModal(false);
        },
      },
    ]);
  };

  const handleResetTemplates = async () => {
    Alert.alert('Reset Templates', 'Reset to default standard templates?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        onPress: async () => {
          await saveTemplates(DEFAULT_TEMPLATES);
          setShowTemplateModal(false);
        },
      },
    ]);
  };

  // Handle external navigation target
  useEffect(() => {
    if (targetGroup) {
      setRecipientMode('group');
      setSelectedGroup(targetGroup);
      setExcludedMemberIds([]);
      if (onClearTarget) onClearTarget();
    } else if (targetContactIds && targetContactIds.length > 0) {
      setRecipientMode('selected');
      setSelectedContactIds(targetContactIds);
      if (onClearTarget) onClearTarget();
    }
  }, [targetGroup, targetContactIds]);

  // If group mode selected and no group active, select first
  useEffect(() => {
    if (recipientMode === 'group' && !selectedGroup && groupList.length > 0) {
      setSelectedGroup(groupList[0].name);
      setExcludedMemberIds([]);
    }
  }, [recipientMode, groups]);

  // Gallery Image Picker (JPG, PNG, WEBP)
  const pickImage = async () => {
    try {
      const { status: permStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Camera roll access is needed to select images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        base64: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let base64 = asset.base64;
        if (!base64) {
          base64 = await readFileAsBase64(asset.uri);
        }
        const filename = asset.fileName || asset.uri.split('/').pop() || 'image.jpg';
        const ext = filename.split('.').pop().toLowerCase();
        let mime = 'image/jpeg';
        if (ext === 'png') mime = 'image/png';
        else if (ext === 'webp') mime = 'image/webp';

        setSelectedAttachment({
          uri: asset.uri,
          name: filename,
          mimeType: mime,
          base64: base64,
          isImage: true,
        });
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open image picker: ' + err.message);
    }
  };

  // Camera Photo (JPG)
  const takePhoto = async () => {
    try {
      const { status: permStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (permStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is needed to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        base64: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let base64 = asset.base64;
        if (!base64) {
          base64 = await readFileAsBase64(asset.uri);
        }
        setSelectedAttachment({
          uri: asset.uri,
          name: 'photo_' + Date.now() + '.jpg',
          mimeType: 'image/jpeg',
          base64: base64,
          isImage: true,
        });
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open camera: ' + err.message);
    }
  };

  // Document Picker (PDF, ZIP, RAR, 7Z, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, etc.)
  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const base64 = await readFileAsBase64(asset.uri);

        const filename = asset.name || 'document';
        const ext = filename.split('.').pop().toLowerCase();

        const mimeMap = {
          pdf: 'application/pdf',
          zip: 'application/zip',
          rar: 'application/x-rar-compressed',
          '7z': 'application/x-7z-compressed',
          tar: 'application/x-tar',
          gz: 'application/gzip',
          doc: 'application/msword',
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          xls: 'application/vnd.ms-excel',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ppt: 'application/vnd.ms-powerpoint',
          pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          txt: 'text/plain',
          csv: 'text/csv',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          png: 'image/png',
          webp: 'image/webp',
          mp4: 'video/mp4',
          mp3: 'audio/mpeg',
        };

        const mime = asset.mimeType || mimeMap[ext] || 'application/octet-stream';
        const isImg = ['jpg', 'jpeg', 'png', 'webp'].includes(ext);

        setSelectedAttachment({
          uri: asset.uri,
          name: filename,
          mimeType: mime,
          size: asset.size,
          base64: base64,
          isImage: isImg,
        });
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open document picker: ' + err.message);
    }
  };

  const removeAttachment = () => setSelectedAttachment(null);
  const insertTag = (tag) => setMessage((prev) => prev + tag);

  // Group members helper supporting contacts in multiple groups
  const getGroupMembers = (groupName) => {
    return contacts.filter((c) => {
      if (c.status === 'inactive' || !c.phone) return false;
      const cGroups = getContactGroupList(c);
      return cGroups.includes(groupName);
    });
  };

  const currentGroupMembers = recipientMode === 'group' && selectedGroup ? getGroupMembers(selectedGroup) : [];

  // Filter active recipients
  const getActiveRecipients = () => {
    const allActive = contacts.filter((c) => c.status !== 'inactive' && c.phone);
    if (recipientMode === 'group' && selectedGroup) {
      return currentGroupMembers.filter((c) => !excludedMemberIds.includes(c._id));
    }
    if (recipientMode === 'selected') {
      return allActive.filter((c) => selectedContactIds.includes(c._id));
    }
    return allActive;
  };

  const activeRecipients = getActiveRecipients();

  // Mode label
  const getModeLabel = () => {
    if (selectedAttachment?.isImage && message.trim()) return '🖼️ Image + Caption';
    if (selectedAttachment?.isImage) return '🖼️ Image Only';
    if (selectedAttachment && !selectedAttachment.isImage && message.trim()) {
      const ext = selectedAttachment.name.split('.').pop().toUpperCase();
      return `📄 ${ext} Document + Caption`;
    }
    if (selectedAttachment && !selectedAttachment.isImage) {
      const ext = selectedAttachment.name.split('.').pop().toUpperCase();
      return `📄 ${ext} Document Only`;
    }
    if (message.trim()) return '📝 Text Message Only';
    return 'Empty Broadcast';
  };

  // Toggle member inside group
  const toggleGroupMember = (contactId) => {
    setExcludedMemberIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const selectAllGroupMembers = () => setExcludedMemberIds([]);
  const deselectAllGroupMembers = () => {
    setExcludedMemberIds(currentGroupMembers.map((c) => c._id));
  };

  // Create new broadcast group (Requires at least 1 member!)
  const handleCreateGroup = async () => {
    const clean = newGroupName.trim();
    if (!clean) {
      Alert.alert('Required', 'Please enter a name for the Broadcast Group.');
      return;
    }
    if (newGroupSelectedIds.length === 0) {
      Alert.alert(
        'Members Required',
        'Please select at least 1 contact to create this group. Groups cannot be created without members.'
      );
      return;
    }
    setIsCreatingGroup(true);
    try {
      await API.createGroup(clean, '', newGroupSelectedIds);
      if (onRefreshGroups) await onRefreshGroups();
      setSelectedGroup(clean);
      setRecipientMode('group');
      setExcludedMemberIds([]);
      setShowCreateGroupModal(false);
      setNewGroupName('');
      setNewGroupSelectedIds([]);
      Alert.alert('Success', `Broadcast Group "${clean}" created with ${newGroupSelectedIds.length} members!`);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Add members to current group
  const handleAddMembersToCurrentGroup = async () => {
    if (!selectedGroup) return;
    if (newGroupSelectedIds.length === 0) {
      Alert.alert('Required', 'Please select at least one contact to add.');
      return;
    }
    setIsCreatingGroup(true);
    try {
      await API.assignContactsToGroup(newGroupSelectedIds, selectedGroup);
      if (onRefreshGroups) await onRefreshGroups();
      setShowAddMemberModal(false);
      setNewGroupSelectedIds([]);
      Alert.alert('Success', `Added ${newGroupSelectedIds.length} members to "${selectedGroup}"!`);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Handle Send using JSON Base64 (Eliminates Unsupported FormDataPart implementation completely!)
  const handleSend = async () => {
    if (!isConnected) {
      onOpenQr();
      return;
    }

    if (!message.trim() && !selectedAttachment) {
      Alert.alert('Required', 'Please enter a message or attach a file (Image / PDF).');
      return;
    }

    if (activeRecipients.length === 0) {
      Alert.alert('No Recipients', 'Please select at least one recipient for this broadcast.');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      message: message.trim(),
      file: selectedAttachment
        ? {
            base64: selectedAttachment.base64,
            name: selectedAttachment.name,
            type: selectedAttachment.mimeType,
          }
        : null,
      recipientType:
        recipientMode === 'group' && excludedMemberIds.length > 0
          ? 'selected'
          : recipientMode,
      groupName: recipientMode === 'group' ? selectedGroup : undefined,
      selectedIds:
        recipientMode === 'group' && excludedMemberIds.length > 0
          ? activeRecipients.map((c) => c._id)
          : recipientMode === 'selected'
          ? selectedContactIds
          : undefined,
      minDelay: delayInterval === 'turbo' ? 0.05 : delayInterval === 'fast' ? 0.4 : 1.2,
      maxDelay: delayInterval === 'turbo' ? 0.15 : delayInterval === 'fast' ? 0.8 : 2.0,
    };

    try {
      const res = await API.sendBroadcast(payload);
      if (onStartBroadcast) onStartBroadcast(res);
    } catch (err) {
      Alert.alert('Broadcast Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* WhatsApp Disconnected Warning Banner */}
      {!isConnected && (
        <TouchableOpacity onPress={onOpenQr} style={styles.warningBanner}>
          <View style={styles.warningLeft}>
            <View style={styles.warningIcon}>
              <Ionicons name="qr-code" size={18} color="#F59E0B" />
            </View>
            <View>
              <Text style={styles.warningTitle}>WhatsApp Not Connected</Text>
              <Text style={styles.warningSub}>Tap to scan QR & link your Business account</Text>
            </View>
          </View>
          <View style={styles.linkBadge}>
            <Text style={styles.linkBadgeText}>LINK</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Recipient / Broadcast Target Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="megaphone" size={16} color="#CA8A04" />
            <Text style={styles.cardTitle}>Broadcast Target</Text>
          </View>
          <Text style={styles.cardBadge}>{activeRecipients.length} Selected</Text>
        </View>

        {/* Mode Switcher */}
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            onPress={() => setRecipientMode('all')}
            style={[styles.segmentBtn, recipientMode === 'all' && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentText, recipientMode === 'all' && styles.segmentTextActive]}>
              All Contacts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setRecipientMode('group');
              if (!selectedGroup && groupList.length > 0) setSelectedGroup(groupList[0].name);
            }}
            style={[styles.segmentBtn, recipientMode === 'group' && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentText, recipientMode === 'group' && styles.segmentTextActive]}>
              By Group
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setRecipientMode('selected');
              setShowRecipientModal(true);
            }}
            style={[styles.segmentBtn, recipientMode === 'selected' && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentText, recipientMode === 'selected' && styles.segmentTextActive]}>
              Manual Pick ({selectedContactIds.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Group Horizontal Pills */}
        {recipientMode === 'group' && (
          <View style={styles.groupSection}>
            <View style={styles.groupHeaderRow}>
              <Text style={styles.subLabel}>Choose Broadcast Group:</Text>
              <TouchableOpacity
                onPress={() => {
                  setNewGroupName('');
                  setNewGroupSelectedIds([]);
                  setShowCreateGroupModal(true);
                }}
                style={styles.newGroupBtn}
              >
                <Ionicons name="add-circle" size={14} color="#CA8A04" />
                <Text style={styles.newGroupBtnText}>+ New Group</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupChips}>
              {groupList.map((g, idx) => {
                const isActive = selectedGroup === g.name;
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      setSelectedGroup(g.name);
                      setExcludedMemberIds([]);
                    }}
                    style={[styles.chip, isActive && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      📁 {g.name}
                    </Text>
                    <View style={[styles.chipBadge, isActive && styles.chipBadgeActive]}>
                      <Text style={[styles.chipBadgeText, isActive && styles.chipBadgeTextActive]}>
                        {g.count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Interactive Group Members Preview */}
            <View style={styles.groupMembersCard}>
              <View style={styles.membersHeader}>
                <View style={styles.membersTitleRow}>
                  <Text style={styles.membersTitle}>
                    Members in "{selectedGroup}" ({activeRecipients.length}/{currentGroupMembers.length})
                  </Text>
                </View>
                <View style={styles.memberActionLinks}>
                  <TouchableOpacity onPress={selectAllGroupMembers}>
                    <Text style={styles.linkText}>All</Text>
                  </TouchableOpacity>
                  <Text style={styles.dotSeparator}>•</Text>
                  <TouchableOpacity onPress={deselectAllGroupMembers}>
                    <Text style={styles.linkText}>None</Text>
                  </TouchableOpacity>
                  <Text style={styles.dotSeparator}>•</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setNewGroupSelectedIds([]);
                      setShowAddMemberModal(true);
                    }}
                    style={styles.addMemberPill}
                  >
                    <Ionicons name="person-add" size={11} color="#CA8A04" />
                    <Text style={styles.addMemberPillText}>+ Add</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {currentGroupMembers.length === 0 ? (
                <View style={styles.emptyGroup}>
                  <Text style={styles.emptyGroupText}>No active contacts in this broadcast group.</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setNewGroupSelectedIds([]);
                      setShowAddMemberModal(true);
                    }}
                    style={styles.emptyGroupBtn}
                  >
                    <Text style={styles.emptyGroupBtnText}>+ Add Members Now</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.membersList}>
                  {currentGroupMembers.map((member) => {
                    const isChecked = !excludedMemberIds.includes(member._id);
                    return (
                      <TouchableOpacity
                        key={member._id}
                        onPress={() => toggleGroupMember(member._id)}
                        style={[styles.memberItem, !isChecked && styles.memberItemInactive]}
                      >
                        <View style={styles.memberLeft}>
                          <Ionicons
                            name={isChecked ? 'checkbox' : 'square-outline'}
                            size={18}
                            color={isChecked ? '#CA8A04' : '#94A3B8'}
                          />
                          <View style={styles.memberAvatar}>
                            <Text style={styles.memberAvatarText}>
                              {member.name ? member.name.charAt(0).toUpperCase() : '#'}
                            </Text>
                          </View>
                          <View>
                            <Text style={[styles.memberName, !isChecked && styles.memberNameMuted]}>
                              {member.name}
                            </Text>
                            <Text style={styles.memberPhone}>+{member.phone}</Text>
                          </View>
                        </View>
                        <Text style={[styles.memberStatusText, isChecked && styles.memberStatusTextActive]}>
                          {isChecked ? 'Included' : 'Skipped'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Message Composition Card with Dynamic & Editable Templates */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.cardTitle}>Message Content</Text>
            <TouchableOpacity onPress={openNewTemplateModal} style={styles.newTemplateMiniBtn}>
              <Ionicons name="add-circle" size={13} color="#854D0E" />
              <Text style={styles.newTemplateMiniText}>+ Template</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.modeIndicator}>{getModeLabel()}</Text>
        </View>

        {/* Dynamic Variable Insertion */}
        <View style={styles.variableRow}>
          <Text style={styles.variableLabel}>Insert:</Text>
          <TouchableOpacity onPress={() => insertTag(' {name} ')} style={styles.varBtn}>
            <Text style={styles.varBtnText}>+ {'{name}'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => insertTag(' {group} ')} style={styles.varBtn}>
            <Text style={styles.varBtnText}>+ {'{group}'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => insertTag(' 🚀 ')} style={styles.varEmoji}>
            <Text>🚀</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => insertTag(' 📢 ')} style={styles.varEmoji}>
            <Text>📢</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => insertTag(' ✨ ')} style={styles.varEmoji}>
            <Text>✨</Text>
          </TouchableOpacity>
          {message.trim().length > 0 && (
            <TouchableOpacity onPress={openNewTemplateModal} style={styles.saveAsTemplatePill}>
              <Ionicons name="bookmark-outline" size={12} color="#854D0E" />
              <Text style={styles.saveAsTemplateText}>Save as Template</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Text Area */}
        <TextInput
          multiline
          numberOfLines={4}
          value={message}
          onChangeText={setMessage}
          placeholder="Hi {name}, welcome to Stack Queue! Here is your update..."
          placeholderTextColor="#64748B"
          style={styles.textArea}
        />

        {/* Dynamic & Editable Templates Row */}
        <View style={{ marginTop: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ fontSize: 10, color: '#854D0E', fontWeight: '700', textTransform: 'uppercase' }}>
              Quick Templates (Tap to fill, ✏️ to edit):
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateRow}>
            {templates.map((tpl) => (
              <View key={tpl.id} style={styles.templateChipContainer}>
                <TouchableOpacity
                  onPress={() => setMessage(tpl.text)}
                  style={styles.templateBtn}
                >
                  <Text style={styles.templateText}>{tpl.title}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => openEditTemplateModal(tpl)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.templateEditBtn}
                >
                  <Ionicons name="pencil" size={11} color="#B45309" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              onPress={openNewTemplateModal}
              style={styles.addTemplateBtn}
            >
              <Ionicons name="add" size={14} color="#854D0E" />
              <Text style={styles.addTemplateText}>New Template</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {/* Attachment Card (Images: JPG, PNG, WEBP & Documents: PDF, ZIP, RAR, DOC, XLS, TXT) */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Attach Media or Document</Text>
          {selectedAttachment && (
            <Text style={styles.cardBadge}>
              {selectedAttachment.isImage ? 'Photo Attached' : 'Document Attached'}
            </Text>
          )}
        </View>

        {!selectedAttachment ? (
          <View style={styles.attachRow}>
            <TouchableOpacity onPress={pickImage} style={styles.attachBtn}>
              <Ionicons name="images-outline" size={22} color="#CA8A04" />
              <Text style={styles.attachBtnText}>Gallery</Text>
              <Text style={styles.attachBtnSub}>JPG, PNG</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={takePhoto} style={styles.attachBtn}>
              <Ionicons name="camera-outline" size={22} color="#CA8A04" />
              <Text style={styles.attachBtnText}>Camera</Text>
              <Text style={styles.attachBtnSub}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={pickDocument} style={styles.attachBtn}>
              <Ionicons name="document-text-outline" size={22} color="#CA8A04" />
              <Text style={styles.attachBtnText}>Document</Text>
              <Text style={styles.attachBtnSub}>PDF, ZIP, DOC, etc.</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.previewBox}>
            {selectedAttachment.isImage ? (
              <Image source={{ uri: selectedAttachment.uri }} style={styles.previewImg} />
            ) : (
              <View
                style={[
                  styles.docIconBox,
                  ['zip', 'rar', '7z', 'tar', 'gz'].includes(
                    selectedAttachment.name.split('.').pop().toLowerCase()
                  ) && { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
                  ['doc', 'docx'].includes(
                    selectedAttachment.name.split('.').pop().toLowerCase()
                  ) && { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
                  ['xls', 'xlsx', 'csv'].includes(
                    selectedAttachment.name.split('.').pop().toLowerCase()
                  ) && { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
                ]}
              >
                <Ionicons
                  name={
                    ['zip', 'rar', '7z', 'tar', 'gz'].includes(
                      selectedAttachment.name.split('.').pop().toLowerCase()
                    )
                      ? 'archive'
                      : ['doc', 'docx'].includes(
                          selectedAttachment.name.split('.').pop().toLowerCase()
                        )
                      ? 'document-text'
                      : selectedAttachment.name.endsWith('.pdf')
                      ? 'document-text'
                      : 'document-attach'
                  }
                  size={26}
                  color={
                    ['zip', 'rar', '7z', 'tar', 'gz'].includes(
                      selectedAttachment.name.split('.').pop().toLowerCase()
                    )
                      ? '#D97706'
                      : ['doc', 'docx'].includes(
                          selectedAttachment.name.split('.').pop().toLowerCase()
                        )
                      ? '#2563EB'
                      : ['xls', 'xlsx', 'csv'].includes(
                          selectedAttachment.name.split('.').pop().toLowerCase()
                        )
                      ? '#16A34A'
                      : '#EF4444'
                  }
                />
                <Text
                  style={[
                    styles.docExtBadge,
                    ['zip', 'rar', '7z', 'tar', 'gz'].includes(
                      selectedAttachment.name.split('.').pop().toLowerCase()
                    ) && { color: '#B45309' },
                    ['doc', 'docx'].includes(
                      selectedAttachment.name.split('.').pop().toLowerCase()
                    ) && { color: '#1D4ED8' },
                    ['xls', 'xlsx', 'csv'].includes(
                      selectedAttachment.name.split('.').pop().toLowerCase()
                    ) && { color: '#15803D' },
                  ]}
                >
                  {selectedAttachment.name.split('.').pop().toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.previewInfo}>
              <Text style={styles.previewName} numberOfLines={1}>
                {selectedAttachment.name}
              </Text>
              <Text style={styles.previewSub}>
                {selectedAttachment.isImage ? 'Image attachment' : 'Document attachment'}
                {message.trim() ? ' • Caption will be attached' : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={removeAttachment} style={styles.removeImgBtn}>
              <Ionicons name="close-circle" size={22} color="#F43F5E" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Safety Throttle Selector */}
      <View style={styles.safetyCard}>
        <View style={styles.safetyHeader}>
          <Ionicons name="shield-checkmark" size={16} color="#CA8A04" />
          <Text style={styles.safetyTitle}>Safety Delay (Anti-Ban)</Text>
        </View>
        <View style={styles.safetyOptions}>
          {[
            { id: 'turbo', label: '⚡ Ultra Fast (0.1s)' },
            { id: 'fast', label: '🚀 Fast (0.5s)' },
            { id: 'safe', label: '🛡️ Safe (1.5s)' },
          ].map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => setDelayInterval(item.id)}
              style={[styles.safetyBtn, delayInterval === item.id && styles.safetyBtnActive]}
            >
              <Text
                style={[
                  styles.safetyBtnText,
                  delayInterval === item.id && styles.safetyBtnTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Big Action Button */}
      <TouchableOpacity
        onPress={handleSend}
        disabled={isSubmitting}
        style={[styles.sendBtn, !isConnected && styles.sendBtnWarning]}
      >
        {isSubmitting ? (
          <View style={styles.sendBtnContent}>
            <ActivityIndicator size="small" color="#000" />
            <Text style={styles.sendBtnText}> Preparing & Dispatching...</Text>
          </View>
        ) : (
          <View style={styles.sendBtnContent}>
            <Ionicons
              name={isConnected ? 'send' : 'qr-code'}
              size={18}
              color="#000"
            />
            <Text style={styles.sendBtnText}>
              {isConnected
                ? `Send to ${activeRecipients.length} in [${recipientMode === 'group' ? selectedGroup : 'All'}] 🚀`
                : 'Link WhatsApp to Send'}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Manual Recipient Picker Modal */}
      <Modal visible={showRecipientModal} animationType="slide" transparent={true}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                Select Contacts ({selectedContactIds.length})
              </Text>
              <TouchableOpacity
                onPress={() => setShowRecipientModal(false)}
                style={styles.pickerClose}
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <TextInput
              value={searchContact}
              onChangeText={setSearchContact}
              placeholder="Search by name, phone..."
              placeholderTextColor="#64748B"
              style={styles.pickerSearch}
            />

            <View style={styles.pickerActions}>
              <TouchableOpacity
                onPress={() => setSelectedContactIds(contacts.map((c) => c._id))}
              >
                <Text style={styles.pickerActionText}>Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelectedContactIds([])}>
                <Text style={styles.pickerActionText}>Clear All</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={contacts.filter(
                (c) =>
                  c.name.toLowerCase().includes(searchContact.toLowerCase()) ||
                  c.phone.includes(searchContact)
              )}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => {
                const isChecked = selectedContactIds.includes(item._id);
                return (
                  <TouchableOpacity
                    onPress={() => {
                      if (isChecked) {
                        setSelectedContactIds(selectedContactIds.filter((id) => id !== item._id));
                      } else {
                        setSelectedContactIds([...selectedContactIds, item._id]);
                      }
                    }}
                    style={styles.pickerItem}
                  >
                    <Ionicons
                      name={isChecked ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={isChecked ? '#CA8A04' : '#94A3B8'}
                    />
                    <View style={styles.pickerItemText}>
                      <Text style={styles.pickerName}>{item.name}</Text>
                      <Text style={styles.pickerPhone}>+{item.phone}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

            <TouchableOpacity
              onPress={() => setShowRecipientModal(false)}
              style={styles.pickerDoneBtn}
            >
              <Text style={styles.pickerDoneBtnText}>
                Confirm Selection ({selectedContactIds.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create New Group Modal (Requires at least 1 member) */}
      <Modal visible={showCreateGroupModal} animationType="slide" transparent={true}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <View>
                <Text style={styles.pickerTitle}>Create Broadcast Group</Text>
                <Text style={styles.pickerSub}>Organize contacts into custom broadcast lists (At least 1 member required)</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowCreateGroupModal(false)}
                style={styles.pickerClose}
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Group Name</Text>
              <TextInput
                value={newGroupName}
                onChangeText={setNewGroupName}
                placeholder="e.g. Morning Batch, VIP Leads..."
                placeholderTextColor="#64748B"
                style={styles.modalTextInput}
              />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <Text style={styles.modalInputLabel}>
                Select Members to Add ({newGroupSelectedIds.length})
              </Text>
              {newGroupSelectedIds.length === 0 && (
                <Text style={{ fontSize: 10, color: '#DC2626', fontWeight: 'bold' }}>
                  * At least 1 member required
                </Text>
              )}
            </View>

            <FlatList
              data={contacts}
              keyExtractor={(item) => item._id}
              style={{ maxHeight: 240 }}
              renderItem={({ item }) => {
                const isChecked = newGroupSelectedIds.includes(item._id);
                return (
                  <TouchableOpacity
                    onPress={() => {
                      if (isChecked) {
                        setNewGroupSelectedIds(newGroupSelectedIds.filter((id) => id !== item._id));
                      } else {
                        setNewGroupSelectedIds([...newGroupSelectedIds, item._id]);
                      }
                    }}
                    style={styles.pickerItem}
                  >
                    <Ionicons
                      name={isChecked ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={isChecked ? '#CA8A04' : '#94A3B8'}
                    />
                    <View style={styles.pickerItemText}>
                      <Text style={styles.pickerName}>{item.name}</Text>
                      <Text style={styles.pickerPhone}>+{item.phone} • {item.group || 'General'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

            <TouchableOpacity
              onPress={handleCreateGroup}
              disabled={isCreatingGroup || newGroupSelectedIds.length === 0}
              style={[
                styles.pickerDoneBtn,
                newGroupSelectedIds.length === 0 && { opacity: 0.6, backgroundColor: '#E2E8F0' },
              ]}
            >
              {isCreatingGroup ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text
                  style={[
                    styles.pickerDoneBtnText,
                    newGroupSelectedIds.length === 0 && { color: '#94A3B8' },
                  ]}
                >
                  {newGroupSelectedIds.length > 0
                    ? `Save Group (${newGroupSelectedIds.length} Members)`
                    : 'Select Members to Create Group'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Members to Current Group Modal */}
      <Modal visible={showAddMemberModal} animationType="slide" transparent={true}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <View>
                <Text style={styles.pickerTitle}>Add to "{selectedGroup}"</Text>
                <Text style={styles.pickerSub}>Select contacts to assign to this group</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAddMemberModal(false)}
                style={styles.pickerClose}
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={contacts.filter((c) => !getContactGroupList(c).includes(selectedGroup))}
              keyExtractor={(item) => item._id}
              style={{ maxHeight: 280 }}
              ListEmptyComponent={
                <Text style={styles.emptySearchText}>All contacts already belong to this group!</Text>
              }
              renderItem={({ item }) => {
                const isChecked = newGroupSelectedIds.includes(item._id);
                return (
                  <TouchableOpacity
                    onPress={() => {
                      if (isChecked) {
                        setNewGroupSelectedIds(newGroupSelectedIds.filter((id) => id !== item._id));
                      } else {
                        setNewGroupSelectedIds([...newGroupSelectedIds, item._id]);
                      }
                    }}
                    style={styles.pickerItem}
                  >
                    <Ionicons
                      name={isChecked ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={isChecked ? '#CA8A04' : '#94A3B8'}
                    />
                    <View style={styles.pickerItemText}>
                      <Text style={styles.pickerName}>{item.name}</Text>
                      <Text style={styles.pickerPhone}>+{item.phone} • (groups: {getContactGroupList(item).join(', ')})</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

            <TouchableOpacity
              onPress={handleAddMembersToCurrentGroup}
              disabled={isCreatingGroup}
              style={styles.pickerDoneBtn}
            >
              {isCreatingGroup ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.pickerDoneBtnText}>
                  Add {newGroupSelectedIds.length} to "{selectedGroup}"
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create / Edit Template Modal */}
      <Modal visible={showTemplateModal} animationType="slide" transparent={true}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <View>
                <Text style={styles.pickerTitle}>
                  {editingTemplate ? 'Edit Message Template' : 'Create New Template'}
                </Text>
                <Text style={styles.pickerSub}>
                  Saved templates appear on quick-fill buttons
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowTemplateModal(false)}
                style={styles.pickerClose}
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Template Title (e.g. 🎓 New Batch Alert)</Text>
              <TextInput
                value={templateTitle}
                onChangeText={setTemplateTitle}
                placeholder="e.g. 🎓 New Batch Alert, 📢 Weekend Class"
                placeholderTextColor="#64748B"
                style={styles.modalTextInput}
              />
            </View>

            <View style={styles.modalInputGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.modalInputLabel}>Message Content</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => setTemplateContent((prev) => prev + ' {name} ')}
                    style={styles.templateVarPill}
                  >
                    <Text style={styles.templateVarText}>+{'{name}'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setTemplateContent((prev) => prev + ' {group} ')}
                    style={styles.templateVarPill}
                  >
                    <Text style={styles.templateVarText}>+{'{group}'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TextInput
                multiline
                numberOfLines={5}
                value={templateContent}
                onChangeText={setTemplateContent}
                placeholder="Hi {name}! Welcome to Stack Queue..."
                placeholderTextColor="#64748B"
                style={[styles.modalTextInput, { minHeight: 110, textAlignVertical: 'top' }]}
              />
            </View>

            <View style={{ gap: 8, marginTop: 4 }}>
              <TouchableOpacity
                onPress={handleSaveTemplate}
                style={styles.pickerDoneBtn}
              >
                <Text style={styles.pickerDoneBtnText}>
                  {editingTemplate ? 'Save Template Changes' : 'Save New Template'}
                </Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                {editingTemplate && (
                  <TouchableOpacity
                    onPress={() => handleDeleteTemplate(editingTemplate.id)}
                    style={styles.templateDeleteBtn}
                  >
                    <Ionicons name="trash-outline" size={14} color="#DC2626" />
                    <Text style={styles.templateDeleteText}>Delete</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={handleResetTemplates}
                  style={styles.templateResetBtn}
                >
                  <Ionicons name="refresh-outline" size={14} color="#64748B" />
                  <Text style={styles.templateResetText}>Reset to Defaults</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
    gap: 16,
    paddingBottom: 40,
  },
  warningBanner: {
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FDE047',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  warningLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  warningIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF08A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#713F12',
  },
  warningSub: {
    fontSize: 11,
    color: '#854D0E',
    marginTop: 2,
  },
  linkBadge: {
    backgroundColor: '#FACC15',
    borderWidth: 1,
    borderColor: '#EAB308',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  linkBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FEF08A',
    padding: 16,
    gap: 12,
    elevation: 2,
    shadowColor: '#EAB308',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  cardBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  modeIndicator: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#FAF9F5',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 9,
  },
  segmentBtnActive: {
    backgroundColor: '#FACC15',
  },
  segmentText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#0F172A',
    fontWeight: 'bold',
  },
  groupSection: {
    marginTop: 6,
    gap: 10,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  newGroupBtn: {
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
  newGroupBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  groupChips: {
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#FEF9C3',
    borderColor: '#FACC15',
  },
  chipText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#713F12',
    fontWeight: '700',
  },
  chipBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  chipBadgeActive: {
    backgroundColor: '#FACC15',
  },
  chipBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  chipBadgeTextActive: {
    color: '#0F172A',
  },
  groupMembersCard: {
    backgroundColor: '#FAF9F5',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FEF08A',
    padding: 12,
    marginTop: 4,
  },
  membersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FEF08A',
  },
  membersTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  memberActionLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  dotSeparator: {
    fontSize: 11,
    color: '#CBD5E1',
  },
  addMemberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  addMemberPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  emptyGroup: {
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  emptyGroupText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  emptyGroupBtn: {
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  emptyGroupBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  membersList: {
    marginTop: 6,
    gap: 6,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  memberItemInactive: {
    opacity: 0.5,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEF08A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#713F12',
  },
  memberName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  memberNameMuted: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  memberPhone: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: 'monospace',
  },
  memberStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  memberStatusTextActive: {
    color: '#CA8A04',
  },
  variableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  variableLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  varBtn: {
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  varBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  varEmoji: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    color: '#0F172A',
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  newTemplateMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  newTemplateMiniText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#854D0E',
  },
  saveAsTemplatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF08A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FACC15',
  },
  saveAsTemplateText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#854D0E',
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  templateChipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FEF08A',
    borderRadius: 10,
    marginRight: 8,
    overflow: 'hidden',
  },
  templateBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  templateText: {
    fontSize: 11,
    color: '#713F12',
    fontWeight: '600',
  },
  templateEditBtn: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderLeftWidth: 1,
    borderLeftColor: '#FEF08A',
    backgroundColor: '#FFFBEB',
  },
  addTemplateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FDE047',
    borderStyle: 'dashed',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  addTemplateText: {
    fontSize: 11,
    color: '#854D0E',
    fontWeight: '700',
  },
  templateVarPill: {
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  templateVarText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#854D0E',
  },
  templateDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  templateDeleteText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  templateResetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  templateResetText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  attachRow: {
    flexDirection: 'row',
    gap: 10,
  },
  attachBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FEF08A',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
  },
  attachBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  attachBtnSub: {
    fontSize: 9,
    color: '#64748B',
  },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FAF9F5',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FEF08A',
  },
  previewImg: {
    width: 55,
    height: 55,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  docIconBox: {
    width: 55,
    height: 55,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  docExtBadge: {
    fontSize: 8,
    fontWeight: '800',
    color: '#EF4444',
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  previewSub: {
    fontSize: 10,
    color: '#CA8A04',
    marginTop: 2,
  },
  removeImgBtn: {
    padding: 6,
  },
  safetyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FEF08A',
    padding: 14,
    gap: 10,
    elevation: 1,
    shadowColor: '#EAB308',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  safetyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  safetyOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  safetyBtn: {
    flex: 1,
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  safetyBtnActive: {
    backgroundColor: '#FACC15',
    borderColor: '#EAB308',
  },
  safetyBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  safetyBtnTextActive: {
    color: '#0F172A',
    fontWeight: 'bold',
  },
  sendBtn: {
    backgroundColor: '#FACC15',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EAB308',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#EAB308',
  },
  sendBtnWarning: {
    backgroundColor: '#FDE047',
  },
  sendBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sendBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: '#FEF08A',
    padding: 20,
    maxHeight: '85%',
    gap: 12,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FEF08A',
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  pickerSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  pickerClose: {
    padding: 4,
  },
  pickerSearch: {
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    color: '#0F172A',
    fontSize: 12,
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  pickerActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  pickerItemText: {
    flex: 1,
  },
  pickerName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  pickerPhone: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'monospace',
  },
  pickerDoneBtn: {
    backgroundColor: '#FACC15',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#EAB308',
  },
  pickerDoneBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalInputGroup: {
    gap: 6,
  },
  modalInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  modalTextInput: {
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    color: '#0F172A',
    fontSize: 13,
  },
  emptySearchText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    padding: 20,
  },
});
