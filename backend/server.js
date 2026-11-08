const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { initDb, DB, MONGO_URI } = require('./db');
const { whatsAppService } = require('./whatsapp');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Upload directory for broadcast media
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/logo.png', express.static(path.join(__dirname, '..', 'logo.png')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|7z|tar|gz|mp4|mp3/i;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowed.test(ext)) {
      return cb(null, true);
    }
    cb(new Error("File format not supported. Allowed formats: Images, PDF, Word, Excel, PowerPoint, Text, CSV, ZIP, RAR, 7Z, MP4, MP3"));
  }
});

// SSE Clients for real-time live sync
let sseClients = [];

function broadcastSSE(eventType, data) {
  sseClients.forEach(client => {
    try {
      client.res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      // client disconnected
    }
  });
}

// Connect WhatsApp service events to SSE
whatsAppService.on('status_change', (status) => {
  broadcastSSE('status', {
    whatsapp: status,
    db: DB.getState()
  });
});

whatsAppService.on('qr', (qr) => {
  broadcastSSE('qr', { qr });
});

whatsAppService.on('broadcast_progress', (progress) => {
  broadcastSSE('broadcast_progress', progress);
});

// Real-time SSE endpoint
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  sseClients.push(newClient);

  // Send initial snapshot
  res.write(`event: init\ndata: ${JSON.stringify({
    whatsapp: whatsAppService.getStatus(),
    db: DB.getState()
  })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// 1. App Status
app.get('/api/status', (req, res) => {
  res.json({
    whatsapp: whatsAppService.getStatus(),
    db: DB.getState(),
    mongoUri: MONGO_URI.replace(/:([^:@]+)@/, ':****@')
  });
});

// 2. WhatsApp Controls
app.post('/api/whatsapp/pair-code', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Phone number is required." });
    }
    const code = await whatsAppService.requestPairingCode(phone);
    res.json({ success: true, pairingCode: code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/whatsapp/reconnect', async (req, res) => {
  try {
    await whatsAppService.initSocket();
    res.json({ success: true, message: "Reconnecting to WhatsApp..." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/whatsapp/logout', async (req, res) => {
  try {
    await whatsAppService.logout();
    res.json({ success: true, message: "Logged out from WhatsApp." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Contacts API
app.get('/api/contacts', async (req, res) => {
  try {
    const { search, group } = req.query;
    const contacts = await DB.getContacts({ search, group });
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/contacts', async (req, res) => {
  try {
    const { name, phone, email, group, groups, tags, notes } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Phone number is required." });
    }
    const created = await DB.addContact({ name, phone, email, group, groups, tags, notes });
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/contacts/:id', async (req, res) => {
  try {
    const updated = await DB.updateContact(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/contacts/:id', async (req, res) => {
  try {
    await DB.deleteContact(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk import contacts
app.post('/api/contacts/bulk', async (req, res) => {
  try {
    const { contacts, rawText, group } = req.body;
    let listToImport = [];

    if (Array.isArray(contacts)) {
      listToImport = contacts;
    } else if (rawText && typeof rawText === 'string') {
      // Parse plain text line by line: Name, Phone OR just Phone
      const lines = rawText.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parts = trimmed.split(/[,;\t]/).map(p => p.trim());
        if (parts.length >= 2) {
          listToImport.push({
            name: parts[0],
            phone: parts[1],
            group: group || 'Imported'
          });
        } else {
          listToImport.push({
            name: 'Contact',
            phone: parts[0],
            group: group || 'Imported'
          });
        }
      }
    }

    const result = await DB.bulkAddContacts(listToImport);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/groups', async (req, res) => {
  try {
    const groups = await DB.getGroups();
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/groups', async (req, res) => {
  try {
    const { name, description, contactIds } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Group name is required." });
    }
    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ error: "Please select at least 1 contact to create this group. Groups cannot be created without members." });
    }
    const result = await DB.createGroup(name, description, contactIds);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/groups/assign', async (req, res) => {
  try {
    const { contactIds, groupName } = req.body;
    if (!contactIds || !contactIds.length || !groupName) {
      return res.status(400).json({ error: "contactIds and groupName are required." });
    }
    const result = await DB.assignContactsToGroup(contactIds, groupName);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/groups/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const result = await DB.deleteGroup(name);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Broadcast API (Supports both JSON Base64 and Multipart for images & documents like PDF, ZIP)
const broadcastUploadMiddleware = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'file', maxCount: 1 },
  { name: 'document', maxCount: 1 }
]);

app.post('/api/broadcast', (req, res, next) => {
  // Gracefully handle json or multipart
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    broadcastUploadMiddleware(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  } else {
    next();
  }
}, async (req, res) => {
  try {
    const { message, recipientType, groupName, selectedIds, minDelay, maxDelay } = req.body;
    
    let mediaFilePath = null;
    let originalFileName = null;
    let hasMedia = false;

    // Check multipart files (image, file, or document)
    const uploadedFile = req.file || (req.files && (req.files.image?.[0] || req.files.file?.[0] || req.files.document?.[0]));
    if (uploadedFile) {
      mediaFilePath = uploadedFile.path;
      originalFileName = uploadedFile.originalname;
      hasMedia = true;
    } else if (req.body.file && req.body.file.base64) {
      const fileData = req.body.file;
      originalFileName = fileData.name || 'attachment.jpg';
      const ext = path.extname(originalFileName) || '.jpg';
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      mediaFilePath = path.join(UPLOAD_DIR, uniqueName);
      const base64Clean = fileData.base64.replace(/^data:[^;]+;base64,/, '');
      await fs.promises.writeFile(mediaFilePath, Buffer.from(base64Clean, 'base64'));
      hasMedia = true;
    }

    // Check WhatsApp status
    if (whatsAppService.status !== 'connected') {
      if (mediaFilePath && fs.existsSync(mediaFilePath)) fs.unlinkSync(mediaFilePath);
      return res.status(400).json({
        error: "WhatsApp Business is not linked! Please scan the QR code first."
      });
    }

    if (!message && !hasMedia) {
      return res.status(400).json({
        error: "Please provide either a message, an attachment (image/document), or both!"
      });
    }

    // Determine recipients
    let recipients = [];
    if (recipientType === 'selected') {
      let ids = [];
      try {
        ids = typeof selectedIds === 'string' ? JSON.parse(selectedIds) : selectedIds;
      } catch (e) {
        ids = (selectedIds || '').split(',').map(s => s.trim());
      }
      const all = await DB.getContacts();
      recipients = all.filter(c => ids.includes(c._id.toString()));
    } else if (recipientType === 'group' && groupName) {
      recipients = await DB.getContacts({ group: groupName });
    } else {
      // all active contacts
      recipients = await DB.getContacts();
    }

    // Filter only active contacts
    recipients = recipients.filter(c => c.status !== 'inactive' && c.phone);

    if (recipients.length === 0) {
      if (mediaFilePath && fs.existsSync(mediaFilePath)) fs.unlinkSync(mediaFilePath);
      return res.status(400).json({ error: "No valid recipient contacts found for this broadcast." });
    }

    // Respond immediately with started status, broadcast continues asynchronously
    res.json({
      success: true,
      message: `Broadcast started for ${recipients.length} recipients.`,
      totalRecipients: recipients.length
    });

    const parsedMinDelay = req.body.minDelay !== undefined && !isNaN(parseFloat(req.body.minDelay)) ? parseFloat(req.body.minDelay) : 0.1;
    const parsedMaxDelay = req.body.maxDelay !== undefined && !isNaN(parseFloat(req.body.maxDelay)) ? parseFloat(req.body.maxDelay) : 0.3;

    // Execute in background
    (async () => {
      try {
        const result = await whatsAppService.runBroadcast({
          recipients,
          message,
          mediaFilePath,
          originalFileName,
          minDelay: parsedMinDelay,
          maxDelay: parsedMaxDelay
        });

        // Save campaign record
        await DB.saveCampaign({
          title: message ? message.substring(0, 30) + '...' : (originalFileName || 'Broadcast Attachment'),
          message: message || '',
          hasImage: hasMedia,
          imageName: originalFileName || (mediaFilePath ? path.basename(mediaFilePath) : null),
          totalRecipients: result.total,
          sentCount: result.sentCount,
          failedCount: result.failedCount,
          status: result.status,
          logs: result.logs
        });

        // Update contacts with lastMessageSentAt
        for (const log of result.logs) {
          if (log.status === 'sent') {
            const match = recipients.find(r => r.phone === log.phone);
            if (match) {
              await DB.updateContact(match._id, {
                lastMessageSentAt: new Date(),
                lastMessageStatus: 'sent'
              });
            }
          }
        }
      } catch (broadcastErr) {
        console.error("Background broadcast error:", broadcastErr);
      }
    })();

  } catch (err) {
    console.error("Broadcast handler error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/broadcast/cancel', (req, res) => {
  whatsAppService.cancelBroadcast();
  res.json({ success: true, message: "Broadcast cancellation requested." });
});

app.get('/api/broadcast/status', (req, res) => {
  res.json({
    isBroadcasting: whatsAppService.isBroadcasting,
    progress: whatsAppService.broadcastProgress || {
      total: 0,
      current: 0,
      sentCount: 0,
      failedCount: 0,
      status: 'idle',
      logs: []
    }
  });
});

// 5. Campaigns History
app.get('/api/campaigns', async (req, res) => {
  try {
    const campaigns = await DB.getCampaigns();
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend if built
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.use((req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

// Start Server
async function startServer() {
  await initDb();
  await whatsAppService.initSocket();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(`STACK QUEUE WhatsApp Automation Server Running!`);
    console.log(`Local URL: http://localhost:${PORT}`);
    console.log(`Mobile Access: http://<your-local-ip>:${PORT}`);
    console.log(`===============================================`);
  });
}

startServer();
