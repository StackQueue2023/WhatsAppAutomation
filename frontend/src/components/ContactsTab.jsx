import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  FileSpreadsheet,
  Search,
  Trash2,
  Edit2,
  Phone,
  MessageSquare,
  X,
  CheckCircle2,
  Database
} from 'lucide-react';

export default function ContactsTab({ contacts, groups, onRefreshContacts, status }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);

  // Form states for Add / Edit
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formGroup, setFormGroup] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bulk Import state
  const [bulkText, setBulkText] = useState('');
  const [bulkGroup, setBulkGroup] = useState('Bulk Import');

  const isAtlas = status?.db?.isAtlas;

  const resetForm = () => {
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormGroup('');
    setFormNotes('');
    setEditingContact(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
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

  const openEditModal = (contact) => {
    setEditingContact(contact);
    setFormName(contact.name || '');
    setFormPhone(contact.phone || '');
    setFormEmail(contact.email || '');
    const cGroups = getContactGroupList(contact);
    setFormGroup(cGroups.join(', '));
    setFormNotes(contact.notes || '');
    setShowAddModal(true);
  };

  // Save Contact (Add or Edit)
  const handleSaveContact = async (e) => {
    e.preventDefault();
    if (!formPhone.trim()) {
      alert('Phone number is required!');
      return;
    }

    setIsSubmitting(true);
    try {
      const gList = formGroup
        ? formGroup.split(',').map((s) => s.trim()).filter(Boolean)
        : ['General'];

      const payload = {
        name: formName || 'Contact',
        phone: formPhone,
        email: formEmail,
        group: gList.join(', '),
        groups: gList,
        notes: formNotes,
      };

      let url = '/api/contacts';
      let method = 'POST';

      if (editingContact) {
        url = `/api/contacts/${editingContact._id}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save contact');

      setShowAddModal(false);
      resetForm();
      onRefreshContacts();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Contact
  const handleDeleteContact = async (id, name) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;

    try {
      const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete contact');
      onRefreshContacts();
    } catch (err) {
      alert(err.message);
    }
  };

  // Bulk Import Submit
  const handleBulkImport = async () => {
    if (!bulkText.trim()) {
      alert('Please paste some phone numbers or contacts.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: bulkText,
          group: bulkGroup,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to import contacts');

      alert(`Successfully imported ${data.added} contacts!`);
      setShowBulkModal(false);
      setBulkText('');
      onRefreshContacts();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter contacts supporting multiple groups
  const filteredContacts = contacts.filter((c) => {
    const cGroups = getContactGroupList(c);
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      cGroups.some((g) => g.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.group && c.group.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesGroup = selectedGroup === 'all' || cGroups.includes(selectedGroup);

    return matchesSearch && matchesGroup;
  });

  return (
    <div className="flex-1 p-4 pb-20 space-y-4">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-950 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            Recipients Database
          </h2>
          <p className="text-[11px] text-slate-500 font-medium">
            {isAtlas ? '☁️ Stored in MongoDB Atlas Cloud' : '📁 Local Storage Active'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 text-amber-950 font-bold text-xs border border-amber-200 hover:bg-amber-100 transition shadow-2xs"
            title="Bulk Import Contacts"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
            <span>Bulk Upload</span>
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-xs shadow-md shadow-amber-400/25 transition active:scale-95"
          >
            <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>+ Add Contact</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name, number, or group..."
          className="w-full bg-white border border-slate-200 rounded-2xl pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200/60 transition shadow-xs font-medium"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Group Filter Chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 text-[11px]">
        <button
          onClick={() => setSelectedGroup('all')}
          className={`px-3 py-1 rounded-full whitespace-nowrap transition font-bold ${
            selectedGroup === 'all'
              ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          All ({contacts.length})
        </button>
        {groups.map((g, idx) => {
          const gName = typeof g === 'object' && g !== null ? g.name : g;
          if (!gName) return null;
          const matchCount =
            typeof g === 'object' && g?.count !== undefined
              ? g.count
              : contacts.filter((c) => getContactGroupList(c).includes(gName)).length;
          return (
            <button
              key={idx}
              onClick={() => setSelectedGroup(gName)}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition font-bold ${
                selectedGroup === gName
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              📁 {gName} ({matchCount})
            </button>
          );
        })}
      </div>

      {/* Contact Cards List */}
      <div className="space-y-2.5">
        {filteredContacts.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-3xl border border-amber-200/80 p-6 shadow-xs">
            <Users className="w-10 h-10 text-amber-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-800">No contacts found</p>
            <p className="text-[11px] text-slate-500 mt-1">Tap "+ Add Contact" to add your first recipient.</p>
          </div>
        ) : (
          filteredContacts.map((contact) => {
            const memberGroups = getContactGroupList(contact);
            return (
              <div
                key={contact._id}
                className="bg-white border border-amber-200/70 rounded-2xl p-3 shadow-xs hover:border-amber-400 hover:shadow-md transition flex items-center justify-between"
              >
                {/* Left Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-100 to-yellow-200 border border-amber-300 flex items-center justify-center text-amber-950 font-black text-sm shrink-0 shadow-xs">
                    {contact.name ? contact.name.charAt(0).toUpperCase() : '#'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-950 truncate">{contact.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-slate-600 font-mono tracking-tight font-medium">
                        +{contact.phone}
                      </span>
                      {contact.lastMessageSentAt && (
                        <span className="text-[9px] text-emerald-700 font-semibold flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Sent
                        </span>
                      )}
                    </div>
                    {/* Multiple Group Badges */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {memberGroups.map((gName, gIdx) => (
                        <span
                          key={gIdx}
                          className="text-[9px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-semibold"
                        >
                          📁 {gName}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={`https://wa.me/${contact.phone}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition"
                  title="Direct WhatsApp Chat"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => openEditModal(contact)}
                  className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition"
                  title="Edit"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteContact(contact._id, contact.name)}
                  className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })
      )}
      </div>

      {/* Add / Edit Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white border border-amber-200 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 shadow-2xl animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between pb-3 border-b border-amber-100">
              <h3 className="text-sm font-extrabold text-slate-950 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-amber-500" />
                {editingContact ? 'Edit Contact' : 'Add New Recipient'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="space-y-3 mt-4">
              <div>
                <label className="text-[11px] font-bold text-slate-800 block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Karthik Raja"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200 font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-800 block mb-1">
                  WhatsApp Phone Number (with Country Code)
                </label>
                <input
                  type="text"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="e.g. 919876543210 (without + or spaces)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200 font-medium"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block font-medium">
                  India: prefix with 91 (e.g. 919876543210)
                </span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-800 block mb-1">
                  Group / Batch
                </label>
                <input
                  type="text"
                  value={formGroup}
                  onChange={(e) => setFormGroup(e.target.value)}
                  placeholder="e.g. Python Automation, Full Stack Batch"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200 font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-800 block mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. student@gmail.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200 font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-800 block mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Additional notes about lead or student..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200 resize-none font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-xs transition mt-2 shadow-md shadow-amber-400/25 active:scale-98"
              >
                {isSubmitting ? 'Saving to Database...' : editingContact ? 'Update Contact' : 'Save to MongoDB'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white border border-amber-200 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 shadow-2xl animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between pb-3 border-b border-amber-100">
              <h3 className="text-sm font-extrabold text-slate-950 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                Quick Bulk Import
              </h3>
              <button
                onClick={() => setShowBulkModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 mt-4">
              <div>
                <label className="text-[11px] font-bold text-slate-800 block mb-1">
                  Assign to Group
                </label>
                <input
                  type="text"
                  value={bulkGroup}
                  onChange={(e) => setBulkGroup(e.target.value)}
                  placeholder="e.g. New Batch, Leads 2024"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200 font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-800 block mb-1">
                  Paste Contacts (One per line)
                </label>
                <p className="text-[10px] text-slate-500 mb-1">
                  Formats supported: <br />
                  <code className="text-amber-800 font-mono font-bold bg-amber-50 px-1 py-0.5 rounded border border-amber-200">Name, 919876543210</code> or just{' '}
                  <code className="text-amber-800 font-mono font-bold bg-amber-50 px-1 py-0.5 rounded border border-amber-200">919876543210</code>
                </p>
                <textarea
                  rows={6}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`Ravi Kumar, 919876543210\nDeepa, 919876543211\n919876543212`}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200 resize-none font-medium"
                />
              </div>

              <button
                type="button"
                onClick={handleBulkImport}
                disabled={isSubmitting}
                className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-xs transition shadow-md shadow-amber-400/25 active:scale-98"
              >
                {isSubmitting ? 'Importing into Database...' : 'Import All Contacts'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
