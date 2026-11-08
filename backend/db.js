const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

// Configure Google DNS for reliable SRV resolution on Windows
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  console.warn("DNS setServers warning:", e.message);
}

const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://STACK_QUEUE:stack2023@stackqueuecluster.wfarxbd.mongodb.net/whatsapp_automation?retryWrites=true&w=majority";

// Data directory for local persistence fallback if Atlas whitelist is pending
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const LOCAL_CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const LOCAL_CAMPAIGNS_FILE = path.join(DATA_DIR, 'campaigns.json');

let dbState = {
  isConnected: false,
  isAtlas: false,
  errorMessage: null,
  publicIp: null
};

// Initial dummy contacts
const DUMMY_CONTACTS = [
  {
    name: "Aravind Kumar",
    phone: "919876543210",
    email: "aravind@example.com",
    group: "Full Stack Batch",
    tags: ["Student", "2024"],
    status: "active",
    notes: "Batch A - Morning",
    createdAt: new Date()
  },
  {
    name: "Priya Dharshini",
    phone: "919876543211",
    email: "priya.d@example.com",
    group: "Python Automation",
    tags: ["Student", "Weekend"],
    status: "active",
    notes: "Batch B - Evening",
    createdAt: new Date()
  },
  {
    name: "Karthik Raja",
    phone: "919876543212",
    email: "karthik.raja@example.com",
    group: "New Enquiries",
    tags: ["Lead", "WhatsApp Web"],
    status: "active",
    notes: "Inquired about Stack Queue classes",
    createdAt: new Date()
  },
  {
    name: "Sneha Murugan",
    phone: "919876543213",
    email: "sneha.m@example.com",
    group: "Full Stack Batch",
    tags: ["Student"],
    status: "active",
    notes: "Completed React module",
    createdAt: new Date()
  },
  {
    name: "Vignesh Sundar",
    phone: "919876543214",
    email: "vignesh.s@example.com",
    group: "New Enquiries",
    tags: ["Lead"],
    status: "active",
    notes: "Follow up for next demo session",
    createdAt: new Date()
  }
];

// Contact Schema (Supports multiple groups per contact)
const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  group: { type: String, default: "General" }, // Comma-separated or primary group for display
  groups: [{ type: String }], // Array of groups this contact belongs to
  tags: [{ type: String }],
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  notes: { type: String },
  lastMessageSentAt: { type: Date },
  lastMessageStatus: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const ContactModel = mongoose.model('Contact', contactSchema);

// Helper function to extract normalized array of groups for any contact
function extractContactGroups(c) {
  if (!c) return ['General'];
  let list = [];
  if (Array.isArray(c.groups) && c.groups.length > 0) {
    list = c.groups.map(g => String(g).trim()).filter(Boolean);
  } else if (typeof c.group === 'string' && c.group.trim()) {
    list = c.group.split(',').map(g => g.trim()).filter(Boolean);
  }
  if (list.length === 0) list = ['General'];
  return [...new Set(list)];
}

function normalizeContact(c) {
  if (!c) return c;
  const doc = c.toObject ? c.toObject() : { ...c };
  const groups = extractContactGroups(doc);
  return {
    ...doc,
    groups,
    group: groups.join(', ')
  };
}

// Campaign Schema
const campaignSchema = new mongoose.Schema({
  title: { type: String, default: 'Broadcast' },
  message: { type: String },
  hasImage: { type: Boolean, default: false },
  imageName: { type: String },
  totalRecipients: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  status: { type: String, enum: ['completed', 'failed', 'partial'], default: 'completed' },
  logs: [
    {
      contactName: String,
      phone: String,
      status: String,
      error: String,
      sentAt: { type: Date, default: Date.now }
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

const CampaignModel = mongoose.model('Campaign', campaignSchema);

// Broadcast Group / Category Schema
const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const GroupModel = mongoose.model('BroadcastGroup', groupSchema);

// WhatsApp Baileys Session Schema for Cloud Persistence
const sessionSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  data: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now }
});
const SessionModel = mongoose.model('WhatsAppSession', sessionSchema);

const LOCAL_GROUPS_FILE = path.join(DATA_DIR, 'groups.json');

// Local fallback store helper
function getLocalGroups() {
  if (!fs.existsSync(LOCAL_GROUPS_FILE)) {
    fs.writeFileSync(LOCAL_GROUPS_FILE, JSON.stringify([
      { name: "Full Stack Batch", description: "Regular full-stack web development batch" },
      { name: "Python Automation", description: "Python automation students" },
      { name: "New Enquiries", description: "Recent leads and inquiries" }
    ], null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(LOCAL_GROUPS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveLocalGroups(groups) {
  fs.writeFileSync(LOCAL_GROUPS_FILE, JSON.stringify(groups, null, 2));
}

function getLocalContacts() {
  if (!fs.existsSync(LOCAL_CONTACTS_FILE)) {
    fs.writeFileSync(LOCAL_CONTACTS_FILE, JSON.stringify(DUMMY_CONTACTS.map((c, i) => ({ ...c, _id: 'local_' + (i + 1) })), null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(LOCAL_CONTACTS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveLocalContacts(contacts) {
  fs.writeFileSync(LOCAL_CONTACTS_FILE, JSON.stringify(contacts, null, 2));
}

function getLocalCampaigns() {
  if (!fs.existsSync(LOCAL_CAMPAIGNS_FILE)) {
    fs.writeFileSync(LOCAL_CAMPAIGNS_FILE, JSON.stringify([], null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(LOCAL_CAMPAIGNS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveLocalCampaigns(campaigns) {
  fs.writeFileSync(LOCAL_CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2));
}

// Connect function
async function initDb() {
  // Initialize local dummy file first so it's always ready immediately
  getLocalContacts();
  getLocalCampaigns();

  try {
    console.log("Connecting to MongoDB Atlas at:", MONGO_URI.replace(/:([^:@]+)@/, ':****@'));
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    dbState.isConnected = true;
    dbState.isAtlas = true;
    dbState.errorMessage = null;
    console.log("Connected to MongoDB Atlas successfully!");

    // Seed dummy contacts if collection is empty
    const count = await ContactModel.countDocuments();
    if (count === 0) {
      console.log("Seeding initial dummy contacts to MongoDB Atlas...");
      await ContactModel.insertMany(DUMMY_CONTACTS);
      console.log(`Inserted ${DUMMY_CONTACTS.length} dummy contacts into Atlas.`);
    }
  } catch (err) {
    dbState.isConnected = false;
    dbState.isAtlas = false;
    dbState.errorMessage = err.message;
    console.warn("MongoDB Atlas connection not ready (likely IP Access list):", err.message);
    console.log("Using resilient local persistent storage for contacts and campaigns.");
  }
}

// Public DB API that automatically routes to Atlas or Local
const DB = {
  getState: () => ({ ...dbState }),

  async getContacts(filter = {}) {
    if (dbState.isAtlas) {
      const q = {};
      if (filter.search) {
        q.$or = [
          { name: { $regex: filter.search, $options: 'i' } },
          { phone: { $regex: filter.search, $options: 'i' } },
          { group: { $regex: filter.search, $options: 'i' } },
          { groups: { $elemMatch: { $regex: filter.search, $options: 'i' } } }
        ];
      }
      if (filter.group && filter.group !== 'all') {
        const escaped = filter.group.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        q.$or = [
          { groups: filter.group },
          { group: { $regex: `(^|,\\s*)${escaped}(\\s*,|$)`, $options: 'i' } }
        ];
      }
      const docs = await ContactModel.find(q).sort({ createdAt: -1 });
      return docs.map(normalizeContact);
    } else {
      let contacts = getLocalContacts().map(normalizeContact);
      if (filter.search) {
        const s = filter.search.toLowerCase();
        contacts = contacts.filter(c => 
          (c.name && c.name.toLowerCase().includes(s)) ||
          (c.phone && c.phone.includes(s)) ||
          (c.groups && c.groups.some(g => g.toLowerCase().includes(s))) ||
          (c.group && c.group.toLowerCase().includes(s))
        );
      }
      if (filter.group && filter.group !== 'all') {
        contacts = contacts.filter(c => c.groups && c.groups.includes(filter.group));
      }
      return contacts;
    }
  },

  async addContact(data) {
    // Sanitize phone number (remove spaces, dashes, +, ensure digits)
    const cleanPhone = (data.phone || '').replace(/[^0-9]/g, '');
    let groups = [];
    if (Array.isArray(data.groups) && data.groups.length > 0) {
      groups = data.groups.map(g => String(g).trim()).filter(Boolean);
    } else if (typeof data.group === 'string' && data.group.trim()) {
      groups = data.group.split(',').map(g => g.trim()).filter(Boolean);
    }
    if (groups.length === 0) groups = ['General'];
    groups = [...new Set(groups)];

    const contactData = {
      name: data.name ? data.name.trim() : 'Unknown',
      phone: cleanPhone,
      email: data.email ? data.email.trim() : '',
      group: groups.join(', '),
      groups: groups,
      tags: Array.isArray(data.tags) ? data.tags : (data.tags ? data.tags.split(',').map(t => t.trim()) : []),
      status: data.status || 'active',
      notes: data.notes || '',
      createdAt: new Date()
    };

    if (dbState.isAtlas) {
      const newContact = new ContactModel(contactData);
      const saved = await newContact.save();
      return normalizeContact(saved);
    } else {
      const contacts = getLocalContacts();
      const newContact = {
        ...contactData,
        _id: 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)
      };
      contacts.unshift(newContact);
      saveLocalContacts(contacts);
      return normalizeContact(newContact);
    }
  },

  async bulkAddContacts(contactsList) {
    const results = { added: 0, skipped: 0 };
    for (const item of contactsList) {
      if (!item.phone) {
        results.skipped++;
        continue;
      }
      await this.addContact(item);
      results.added++;
    }
    return results;
  },

  async updateContact(id, updateData) {
    if (updateData.phone) {
      updateData.phone = updateData.phone.replace(/[^0-9]/g, '');
    }
    if (updateData.groups || updateData.group) {
      let groups = [];
      if (Array.isArray(updateData.groups) && updateData.groups.length > 0) {
        groups = updateData.groups.map(g => String(g).trim()).filter(Boolean);
      } else if (typeof updateData.group === 'string' && updateData.group.trim()) {
        groups = updateData.group.split(',').map(g => g.trim()).filter(Boolean);
      }
      if (groups.length === 0) groups = ['General'];
      updateData.groups = [...new Set(groups)];
      updateData.group = updateData.groups.join(', ');
    }

    if (dbState.isAtlas) {
      const updated = await ContactModel.findByIdAndUpdate(id, updateData, { new: true });
      return normalizeContact(updated);
    } else {
      const contacts = getLocalContacts();
      const idx = contacts.findIndex(c => c._id === id);
      if (idx !== -1) {
        contacts[idx] = { ...contacts[idx], ...updateData };
        saveLocalContacts(contacts);
        return normalizeContact(contacts[idx]);
      }
      return null;
    }
  },

  async deleteContact(id) {
    if (dbState.isAtlas) {
      return await ContactModel.findByIdAndDelete(id);
    } else {
      let contacts = getLocalContacts();
      const initialLen = contacts.length;
      contacts = contacts.filter(c => c._id !== id);
      saveLocalContacts(contacts);
      return contacts.length < initialLen;
    }
  },

  async saveCampaign(campaignData) {
    if (dbState.isAtlas) {
      const campaign = new CampaignModel(campaignData);
      return await campaign.save();
    } else {
      const campaigns = getLocalCampaigns();
      const newCampaign = {
        ...campaignData,
        _id: 'camp_' + Date.now(),
        createdAt: new Date()
      };
      campaigns.unshift(newCampaign);
      saveLocalCampaigns(campaigns);
      return newCampaign;
    }
  },

  async getCampaigns() {
    if (dbState.isAtlas) {
      return await CampaignModel.find().sort({ createdAt: -1 }).limit(50);
    } else {
      return getLocalCampaigns();
    }
  },

  async getGroups() {
    const groupMap = new Map();

    // Default known groups
    const defaults = ["Full Stack Batch", "Python Automation", "New Enquiries"];
    defaults.forEach(d => groupMap.set(d, { name: d, count: 0, description: '' }));

    if (dbState.isAtlas) {
      try {
        const customGroups = await GroupModel.find().lean();
        customGroups.forEach(g => {
          groupMap.set(g.name, {
            name: g.name,
            count: 0,
            description: g.description || '',
            _id: g._id
          });
        });
      } catch (e) {
        console.warn("Could not fetch groups from Atlas:", e.message);
      }
    } else {
      const customGroups = getLocalGroups();
      customGroups.forEach(g => {
        groupMap.set(g.name, {
          name: g.name,
          count: 0,
          description: g.description || '',
          _id: g._id
        });
      });
    }

    // Count active contacts in each group across ALL their multiple groups!
    const contacts = await this.getContacts();
    contacts.forEach(c => {
      if (c.status !== 'inactive') {
        const cGroups = extractContactGroups(c);
        cGroups.forEach(gName => {
          const cleanG = gName.trim();
          if (!cleanG) return;
          if (!groupMap.has(cleanG)) {
            groupMap.set(cleanG, { name: cleanG, count: 0, description: '' });
          }
          const item = groupMap.get(cleanG);
          item.count += 1;
        });
      }
    });

    return Array.from(groupMap.values());
  },

  async createGroup(name, description = '', contactIds = []) {
    const cleanName = (name || '').trim();
    if (!cleanName) throw new Error("Group name is required.");
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      throw new Error("Please select at least 1 contact to create this group. Groups cannot be created without members.");
    }

    if (dbState.isAtlas) {
      const savedGroup = await GroupModel.findOneAndUpdate(
        { name: cleanName },
        { name: cleanName, description },
        { upsert: true, new: true }
      );
      // Add group to selected contacts without removing their other groups
      const contactsToUpdate = await ContactModel.find({ _id: { $in: contactIds } });
      for (const c of contactsToUpdate) {
        const existing = extractContactGroups(c);
        if (!existing.includes(cleanName)) {
          existing.push(cleanName);
        }
        c.groups = existing;
        c.group = existing.join(', ');
        await c.save();
      }
      return { success: true, group: savedGroup };
    } else {
      const groups = getLocalGroups();
      let found = groups.find(g => g.name.toLowerCase() === cleanName.toLowerCase());
      if (!found) {
        found = { name: cleanName, description, _id: 'grp_' + Date.now() };
        groups.push(found);
        saveLocalGroups(groups);
      }
      const contacts = getLocalContacts();
      contacts.forEach(c => {
        if (contactIds.includes(c._id)) {
          const existing = extractContactGroups(c);
          if (!existing.includes(cleanName)) {
            existing.push(cleanName);
          }
          c.groups = existing;
          c.group = existing.join(', ');
        }
      });
      saveLocalContacts(contacts);
      return { success: true, group: found };
    }
  },

  async assignContactsToGroup(contactIds, groupName) {
    const cleanGroup = (groupName || '').trim();
    if (!cleanGroup) throw new Error("Group name is required.");
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      throw new Error("Please select at least 1 contact to assign.");
    }

    if (dbState.isAtlas) {
      const contactsToUpdate = await ContactModel.find({ _id: { $in: contactIds } });
      for (const c of contactsToUpdate) {
        const existing = extractContactGroups(c);
        if (!existing.includes(cleanGroup)) {
          existing.push(cleanGroup);
        }
        c.groups = existing;
        c.group = existing.join(', ');
        await c.save();
      }
    } else {
      const contacts = getLocalContacts();
      contacts.forEach(c => {
        if (contactIds.includes(c._id)) {
          const existing = extractContactGroups(c);
          if (!existing.includes(cleanGroup)) {
            existing.push(cleanGroup);
          }
          c.groups = existing;
          c.group = existing.join(', ');
        }
      });
      saveLocalContacts(contacts);
    }
    return { success: true, count: contactIds.length, group: cleanGroup };
  },

  async deleteGroup(groupName) {
    if (dbState.isAtlas) {
      await GroupModel.deleteOne({ name: groupName });
      const contacts = await ContactModel.find({
        $or: [{ groups: groupName }, { group: { $regex: groupName, $options: 'i' } }]
      });
      for (const c of contacts) {
        let existing = extractContactGroups(c).filter(g => g !== groupName);
        if (existing.length === 0) existing = ['General'];
        c.groups = existing;
        c.group = existing.join(', ');
        await c.save();
      }
    } else {
      let groups = getLocalGroups();
      groups = groups.filter(g => g.name !== groupName);
      saveLocalGroups(groups);
      const contacts = getLocalContacts();
      contacts.forEach(c => {
        let existing = extractContactGroups(c).filter(g => g !== groupName);
        if (existing.length === 0) existing = ['General'];
        c.groups = existing;
        c.group = existing.join(', ');
      });
      saveLocalContacts(contacts);
    }
    return { success: true };
  },

  async saveSessionKey(key, data) {
    if (!dbState.isAtlas) return;
    try {
      await SessionModel.findOneAndUpdate(
        { key },
        { key, data, updatedAt: new Date() },
        { upsert: true }
      );
    } catch (err) {
      console.error(`Error saving session key ${key} to Atlas:`, err.message);
    }
  },

  async restoreSessionFiles(targetDir) {
    if (!dbState.isAtlas) return 0;
    try {
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      const docs = await SessionModel.find({}).lean();
      if (!docs || docs.length === 0) return 0;
      for (const d of docs) {
        fs.writeFileSync(path.join(targetDir, d.key), d.data, 'utf8');
      }
      console.log(`Successfully restored ${docs.length} session files from MongoDB Atlas!`);
      return docs.length;
    } catch (err) {
      console.error("Error restoring session from Atlas:", err.message);
      return 0;
    }
  },

  async syncSessionFiles(sourceDir) {
    if (!dbState.isAtlas || !fs.existsSync(sourceDir)) return 0;
    try {
      const files = fs.readdirSync(sourceDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      if (jsonFiles.length === 0) return 0;
      
      const bulkOps = jsonFiles.map(f => {
        const full = path.join(sourceDir, f);
        const data = fs.readFileSync(full, 'utf8');
        return {
          updateOne: {
            filter: { key: f },
            update: { $set: { key: f, data, updatedAt: new Date() } },
            upsert: true
          }
        };
      });

      const BATCH_SIZE = 500;
      let totalSynced = 0;
      for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
        const batch = bulkOps.slice(i, i + BATCH_SIZE);
        await SessionModel.bulkWrite(batch, { ordered: false });
        totalSynced += batch.length;
      }
      console.log(`Successfully synced ${totalSynced} session files to MongoDB Atlas!`);
      return totalSynced;
    } catch (err) {
      console.error("Error syncing session files to Atlas:", err.message);
      return 0;
    }
  },

  async clearSessionKeys() {
    if (!dbState.isAtlas) return;
    try {
      await SessionModel.deleteMany({});
      console.log("Cleared session keys in MongoDB Atlas.");
    } catch (err) {
      console.error("Error clearing session in Atlas:", err.message);
    }
  }
};

module.exports = { initDb, DB, MONGO_URI };
