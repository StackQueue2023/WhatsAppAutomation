import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Image as ImageIcon,
  FileText,
  Archive,
  X,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  QrCode,
  ShieldCheck,
  StopCircle,
  Plus,
  Edit2,
  Trash2,
  Bookmark
} from 'lucide-react';

const DEFAULT_TEMPLATES = [
  {
    id: 'batch_alert',
    title: '🎓 New Batch Alert',
    text: 'Hi {name}! 👋 New batch starting this week at Stack Queue. Reply to reserve your slot!',
  },
  {
    id: 'reminder',
    title: '⏰ Reminder',
    text: 'Dear {name}, friendly reminder for your upcoming session today with Stack Queue.',
  },
  {
    id: 'announcement',
    title: '🎉 Announcement',
    text: 'Special announcement for {name}! Check out our latest update from Stack Queue.',
  },
];

export default function ComposeTab({
  status,
  contacts,
  groups,
  onOpenQr,
  onBroadcastSuccess,
  isBroadcasting,
  broadcastProgress,
  onCancelBroadcast
}) {
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [recipientMode, setRecipientMode] = useState('all'); // 'all' | 'group' | 'selected'
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [delayInterval, setDelayInterval] = useState('turbo'); // 'turbo' | 'fast' | 'safe'
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Message template management
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateContent, setTemplateContent] = useState('');

  const fileInputRef = useRef(null);

  const isConnected = status?.whatsapp?.status === 'connected';

  // Load templates from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('stackqueue_web_templates');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) setTemplates(parsed);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const saveTemplates = (newTpls) => {
    setTemplates(newTpls);
    try {
      localStorage.setItem('stackqueue_web_templates', JSON.stringify(newTpls));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveTemplate = (e) => {
    e.preventDefault();
    if (!templateTitle.trim() || !templateContent.trim()) {
      alert('Please provide title and content for template.');
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
      updated = [
        ...templates,
        { id: 'tpl_' + Date.now(), title: templateTitle.trim(), text: templateContent.trim() }
      ];
    }
    saveTemplates(updated);
    setShowTemplateModal(false);
    setEditingTemplate(null);
    setTemplateTitle('');
    setTemplateContent('');
  };

  const handleDeleteTemplate = (id) => {
    if (confirm('Delete this template?')) {
      const updated = templates.filter((t) => t.id !== id);
      saveTemplates(updated);
      setShowTemplateModal(false);
    }
  };

  // Helper to extract list of groups for a contact (supports multiple groups)
  const getContactGroupList = (c) => {
    if (!c) return ['General'];
    if (Array.isArray(c.groups) && c.groups.length > 0) return c.groups;
    if (typeof c.group === 'string' && c.group.trim()) {
      return c.group.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return ['General'];
  };

  // Handle File Selection (Images, PDF, ZIP, RAR, DOC, etc.)
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview(reader.result);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Quick message tags insertion
  const insertTag = (tag) => {
    setMessage((prev) => prev + tag);
  };

  // Filter recipients based on mode supporting multiple groups
  const getActiveRecipients = () => {
    let list = contacts.filter((c) => c.status !== 'inactive' && c.phone);
    if (recipientMode === 'group' && selectedGroup) {
      list = list.filter((c) => getContactGroupList(c).includes(selectedGroup));
    } else if (recipientMode === 'selected') {
      list = list.filter((c) => selectedContactIds.includes(c._id));
    }
    return list;
  };

  const activeRecipients = getActiveRecipients();

  // Mode badge
  const getModeLabel = () => {
    if (selectedFile) {
      const isImg = selectedFile.type.startsWith('image/');
      const ext = selectedFile.name.split('.').pop().toUpperCase();
      if (message.trim()) return isImg ? '🖼️ Image + Message Caption' : `📄 ${ext} Document + Caption`;
      return isImg ? '🖼️ Image Only' : `📄 ${ext} Document Only`;
    }
    if (message.trim()) return '📝 Text Message Only';
    return 'Empty Broadcast';
  };

  // Submit Broadcast
  const handleSendBroadcast = async () => {
    if (!isConnected) {
      onOpenQr();
      return;
    }

    if (!message.trim() && !selectedFile) {
      alert('Please enter a message or attach a file (Image / PDF / ZIP / Document).');
      return;
    }

    if (activeRecipients.length === 0) {
      alert('No recipients selected. Please add or select contacts.');
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const formData = new FormData();
    formData.append('message', message);
    if (selectedFile) {
      formData.append('document', selectedFile);
    }
    formData.append('recipientType', recipientMode);
    if (recipientMode === 'group') {
      formData.append('groupName', selectedGroup);
    } else if (recipientMode === 'selected') {
      formData.append('selectedIds', JSON.stringify(selectedContactIds));
    }

    // Delays
    if (delayInterval === 'turbo') {
      formData.append('minDelay', 0.05);
      formData.append('maxDelay', 0.15);
    } else if (delayInterval === 'fast') {
      formData.append('minDelay', 0.4);
      formData.append('maxDelay', 0.8);
    } else {
      formData.append('minDelay', 1.2);
      formData.append('maxDelay', 2.0);
    }

    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start broadcast');
      }

      setFeedback({
        type: 'success',
        text: `Broadcast started for ${data.totalRecipients} recipients! Watch live progress below.`,
      });

      if (onBroadcastSuccess) onBroadcastSuccess();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 p-4 pb-20 space-y-4">
      {/* WhatsApp Disconnected Warning Banner */}
      {!isConnected && (
        <div
          onClick={onOpenQr}
          className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 flex items-center justify-between cursor-pointer hover:bg-amber-100/70 transition shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-200/80 flex items-center justify-center text-amber-900">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-950">WhatsApp Not Connected</p>
              <p className="text-[11px] text-amber-800">Tap here to scan QR code & link Business account</p>
            </div>
          </div>
          <span className="text-[10px] bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-xs">
            Link
          </span>
        </div>
      )}

      {/* Live Broadcast Progress Card (when active) */}
      {(isBroadcasting || (broadcastProgress && broadcastProgress.status === 'sending')) && (
        <div className="bg-white border-2 border-amber-400 rounded-2xl p-4 shadow-lg shadow-amber-400/10 space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <span className="text-xs font-extrabold text-amber-700 uppercase tracking-wider">
                Broadcasting Live...
              </span>
            </div>
            <button
              onClick={onCancelBroadcast}
              className="flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full hover:bg-rose-100"
            >
              <StopCircle className="w-3.5 h-3.5" />
              Cancel
            </button>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-xs text-slate-700 mb-1 font-semibold">
              <span>
                Sending {broadcastProgress?.current || 0} / {broadcastProgress?.total || 0}
              </span>
              <span>
                {Math.round(
                  ((broadcastProgress?.current || 0) / (broadcastProgress?.total || 1)) * 100
                )}
                %
              </span>
            </div>
            <div className="w-full bg-amber-100/70 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 h-full transition-all duration-300 rounded-full"
                style={{
                  width: `${
                    ((broadcastProgress?.current || 0) / (broadcastProgress?.total || 1)) * 100
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Live Log Ticker */}
          {broadcastProgress?.logs && broadcastProgress.logs.length > 0 && (
            <div className="max-h-28 overflow-y-auto bg-amber-50/50 rounded-xl p-2.5 text-[11px] space-y-1 border border-amber-200/60">
              {broadcastProgress.logs.slice(-4).map((l, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-slate-800 truncate font-medium">
                    {l.contactName} ({l.phone})
                  </span>
                  {l.status === 'sent' ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Sent
                    </span>
                  ) : (
                    <span className="text-rose-600 font-bold">Failed</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Broadcast Card */}
      <div className="bg-white border border-amber-200/80 rounded-3xl p-4 shadow-sm space-y-4">
        {/* Recipient Selection Header */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
              <Users className="w-3.5 h-3.5 text-amber-500" />
              Recipients ({activeRecipients.length})
            </label>
            <span className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold">
              {contacts.length} in DB
            </span>
          </div>

          {/* Recipient Mode Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-amber-50/70 rounded-2xl border border-amber-200/70">
            <button
              type="button"
              onClick={() => setRecipientMode('all')}
              className={`py-1.5 text-xs font-extrabold rounded-xl transition ${
                recipientMode === 'all'
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              All Contacts
            </button>
            <button
              type="button"
              onClick={() => {
                setRecipientMode('group');
                if (!selectedGroup && groups.length > 0) setSelectedGroup(groups[0]);
              }}
              className={`py-1.5 text-xs font-extrabold rounded-xl transition ${
                recipientMode === 'group'
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              By Group
            </button>
            <button
              type="button"
              onClick={() => {
                setRecipientMode('selected');
                setShowRecipientModal(true);
              }}
              className={`py-1.5 text-xs font-extrabold rounded-xl transition ${
                recipientMode === 'selected'
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              Pick ({selectedContactIds.length})
            </button>
          </div>

          {/* Group Selector Dropdown */}
          {recipientMode === 'group' && (
            <div className="mt-2.5">
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full bg-white text-slate-900 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 font-medium"
              >
                <option value="">Select a Group...</option>
                {groups.map((g, idx) => {
                  const gName = typeof g === 'object' && g !== null ? g.name : g;
                  if (!gName) return null;
                  return (
                    <option key={idx} value={gName}>
                      📁 {gName}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        {/* Message Input Area */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
              Message Content
            </label>
            <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
              {getModeLabel()}
            </span>
          </div>

          {/* Quick Tags Insertion */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
            <span className="text-slate-500 text-[10px] font-bold mr-1">Insert:</span>
            <button
              type="button"
              onClick={() => insertTag(' {name} ')}
              className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-950 border border-amber-200/80 hover:bg-amber-100 font-bold transition"
            >
              + {'{name}'}
            </button>
            <button
              type="button"
              onClick={() => insertTag(' {group} ')}
              className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-950 border border-amber-200/80 hover:bg-amber-100 font-bold transition"
            >
              + {'{group}'}
            </button>
            <button
              type="button"
              onClick={() => insertTag(' 🚀 ')}
              className="px-2 py-1 rounded-lg bg-white border border-slate-200 hover:bg-amber-50 transition"
            >
              🚀
            </button>
            <button
              type="button"
              onClick={() => insertTag(' 📢 ')}
              className="px-2 py-1 rounded-lg bg-white border border-slate-200 hover:bg-amber-50 transition"
            >
              📢
            </button>
            <button
              type="button"
              onClick={() => insertTag(' ✨ ')}
              className="px-2 py-1 rounded-lg bg-white border border-slate-200 hover:bg-amber-50 transition"
            >
              ✨
            </button>
          </div>

          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Hi {name}, welcome to Stack Queue! Here is your update..."
            className="w-full bg-slate-50/80 text-slate-950 placeholder-slate-400 border border-slate-200 rounded-2xl p-3 text-xs leading-relaxed focus:outline-none focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50 transition resize-none font-medium"
          />

          {/* Dynamic & Editable Templates */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-amber-900 font-bold">
              <span>Quick Templates:</span>
              <button
                type="button"
                onClick={() => {
                  setEditingTemplate(null);
                  setTemplateTitle('');
                  setTemplateContent(message || '');
                  setShowTemplateModal(true);
                }}
                className="flex items-center gap-1 text-[10px] text-amber-800 hover:text-amber-950 bg-amber-100/70 px-2 py-0.5 rounded-md transition"
              >
                <Plus className="w-3 h-3" /> New Template
              </button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto text-[11px] pb-1">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex items-center bg-amber-50/80 border border-amber-200/90 rounded-xl overflow-hidden shadow-2xs shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => setMessage(tpl.text)}
                    className="px-2.5 py-1 text-amber-950 font-bold hover:bg-amber-100 transition whitespace-nowrap"
                  >
                    {tpl.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTemplate(tpl);
                      setTemplateTitle(tpl.title);
                      setTemplateContent(tpl.text);
                      setShowTemplateModal(true);
                    }}
                    title="Edit template"
                    className="p-1 text-amber-700 hover:text-amber-950 hover:bg-amber-200/60 border-l border-amber-200"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Media / Document Attachment Box */}
        <div className="space-y-2">
          <label className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center justify-between">
            <span>Attach Media / Document (PDF, ZIP, DOC, etc.)</span>
            {selectedFile && (
              <span className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </span>
            )}
          </label>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.zip,.rar,.7z,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.tar,.gz,image/*,application/*"
            className="hidden"
          />

          {!selectedFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-amber-300/80 hover:border-amber-400 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer bg-amber-50/30 hover:bg-amber-50/60 transition group"
            >
              <div className="w-10 h-10 rounded-full bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center text-amber-700 transition mb-2">
                <FileText className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-800 group-hover:text-amber-950">
                Tap to attach Image, PDF, ZIP, or Document
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Supports JPG, PNG, PDF, ZIP, RAR, DOC, XLS (Up to 50MB)</p>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-amber-200 bg-amber-50/40 p-2.5 flex items-center gap-3">
              {filePreview ? (
                <img
                  src={filePreview}
                  alt="Upload Preview"
                  className="w-16 h-16 object-cover rounded-xl border border-amber-200 shadow-xs"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-amber-100 border border-amber-200 flex flex-col items-center justify-center text-amber-800 shadow-xs">
                  {['zip', 'rar', '7z', 'tar', 'gz'].includes(
                    selectedFile.name.split('.').pop().toLowerCase()
                  ) ? (
                    <Archive className="w-6 h-6 text-amber-600" />
                  ) : (
                    <FileText className="w-6 h-6 text-amber-600" />
                  )}
                  <span className="text-[9px] font-black uppercase mt-1">
                    {selectedFile.name.split('.').pop()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{selectedFile.name}</p>
                <p className="text-[10px] text-amber-800 font-semibold mt-0.5">
                  {message.trim() ? 'Caption will be attached' : 'File attachment only'}
                </p>
              </div>
              <button
                type="button"
                onClick={removeFile}
                className="w-7 h-7 rounded-full bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 flex items-center justify-center transition mr-1 shadow-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Anti-Ban Safety Throttle */}
        <div className="bg-amber-50/50 rounded-2xl p-3 border border-amber-200/70 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              Safety Delay (Anti-Ban)
            </span>
            <span className="text-[11px] text-amber-800 font-bold">
              {delayInterval === 'turbo' ? '0.1s (Ultra Fast)' : delayInterval === 'fast' ? '0.5s (Fast)' : '1.5s (Safe)'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'turbo', label: '⚡ Ultra Fast (0.1s)' },
              { id: 'fast', label: '🚀 Fast (0.5s)' },
              { id: 'safe', label: '🛡️ Safe (1.5s)' },
            ].map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDelayInterval(d.id)}
                className={`py-1.5 text-[10px] font-bold rounded-xl border transition ${
                  delayInterval === d.id
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 border-amber-400 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                : 'bg-rose-50 text-rose-800 border border-rose-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Main Send Broadcast Button */}
        <button
          type="button"
          onClick={handleSendBroadcast}
          disabled={isSubmitting || isBroadcasting}
          className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition shadow-lg ${
            !isConnected
              ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 shadow-amber-200/50'
              : 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 shadow-amber-400/30 active:scale-[0.98]'
          }`}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2 text-slate-950">
              <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              Starting Broadcast...
            </span>
          ) : !isConnected ? (
            <>
              <QrCode className="w-4 h-4 text-amber-900" />
              Link WhatsApp to Send
            </>
          ) : (
            <>
              <Send className="w-4 h-4 stroke-[2.5]" />
              Send to {activeRecipients.length} Recipients
            </>
          )}
        </button>
      </div>

      {/* Recipient Picker Modal (When 'Pick' mode is chosen) */}
      {showRecipientModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white border border-amber-200 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col p-4 shadow-2xl animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between pb-3 border-b border-amber-100">
              <h3 className="text-sm font-extrabold text-slate-950 flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                Select Recipients ({selectedContactIds.length})
              </h3>
              <button
                onClick={() => setShowRecipientModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="my-3">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search name, phone, or group..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200 font-medium"
              />
            </div>

            {/* Quick Select All / Clear */}
            <div className="flex justify-between text-xs text-slate-600 mb-2 font-semibold">
              <button
                type="button"
                onClick={() => setSelectedContactIds(contacts.map((c) => c._id))}
                className="text-amber-700 hover:underline"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setSelectedContactIds([])}
                className="text-slate-500 hover:underline"
              >
                Clear All
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {contacts
                .filter(
                  (c) =>
                    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    c.phone.includes(searchTerm) ||
                    (c.group && c.group.toLowerCase().includes(searchTerm.toLowerCase()))
                )
                .map((contact) => {
                  const isChecked = selectedContactIds.includes(contact._id);
                  return (
                    <div
                      key={contact._id}
                      onClick={() => {
                        if (isChecked) {
                           setSelectedContactIds((prev) => prev.filter((id) => id !== contact._id));
                        } else {
                          setSelectedContactIds((prev) => [...prev, contact._id]);
                        }
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                        isChecked
                          ? 'bg-amber-50 border-amber-300 text-amber-950 font-bold shadow-xs'
                          : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold">{contact.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono">+{contact.phone}</p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 font-medium">
                        {contact.group || 'General'}
                      </span>
                    </div>
                  );
                })}
            </div>

            {/* Confirm */}
            <div className="pt-3 border-t border-amber-100 mt-2">
              <button
                type="button"
                onClick={() => setShowRecipientModal(false)}
                className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black rounded-xl text-xs shadow-md shadow-amber-400/25 active:scale-98 transition"
              >
                Done ({selectedContactIds.length} Selected)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Management Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-amber-300 w-full max-w-md rounded-3xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-amber-100">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {editingTemplate ? 'Edit Message Template' : 'Create New Template'}
                </h3>
                <p className="text-[11px] text-amber-800">
                  Quickly fill messages with one tap
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Template Title (e.g. 🎓 New Batch Alert)
                </label>
                <input
                  type="text"
                  required
                  value={templateTitle}
                  onChange={(e) => setTemplateTitle(e.target.value)}
                  placeholder="e.g. 🎓 New Batch Alert"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-amber-400 font-medium"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">Message Content</label>
                  <div className="flex gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setTemplateContent((prev) => prev + ' {name} ')}
                      className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 font-bold"
                    >
                      +{'{name}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemplateContent((prev) => prev + ' {group} ')}
                      className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 font-bold"
                    >
                      +{'{group}'}
                    </button>
                  </div>
                </div>
                <textarea
                  rows={4}
                  required
                  value={templateContent}
                  onChange={(e) => setTemplateContent(e.target.value)}
                  placeholder="Hi {name}! Welcome to Stack Queue..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-amber-400 font-medium resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                {editingTemplate && (
                  <button
                    type="button"
                    onClick={() => handleDeleteTemplate(editingTemplate.id)}
                    className="px-3 py-2 rounded-xl text-rose-700 bg-rose-50 hover:bg-rose-100 font-bold text-xs flex items-center gap-1 border border-rose-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black text-xs shadow-xs hover:opacity-95"
                  >
                    {editingTemplate ? 'Save Changes' : 'Create Template'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
