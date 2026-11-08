const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  delay,
  prepareWAMessageMedia,
  generateMessageID
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { DB } = require('./db');

const AUTH_DIR = path.join(__dirname, '..', 'auth_session');
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

class WhatsAppService extends EventEmitter {
  constructor() {
    super();
    this.sock = null;
    this.qrCode = null; // data URL of QR code
    this.pairingCode = null;
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
    this.userProfile = null;
    this.isBroadcasting = false;
    this.broadcastProgress = null;
    this.shouldCancelBroadcast = false;
  }

  getStatus() {
    return {
      status: this.status,
      qrCode: this.qrCode,
      pairingCode: this.pairingCode,
      userProfile: this.userProfile,
      isBroadcasting: this.isBroadcasting,
      broadcastProgress: this.broadcastProgress
    };
  }

  async initSocket() {
    try {
      this.status = 'connecting';
      this.emit('status_change', this.getStatus());

      // Restore session files from MongoDB Atlas if local folder is empty (e.g. freshly started on cloud)
      if (!fs.existsSync(AUTH_DIR) || fs.readdirSync(AUTH_DIR).length === 0) {
        console.log("Checking MongoDB Atlas for existing WhatsApp session...");
        await DB.restoreSessionFiles(AUTH_DIR);
      }

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['Stack Queue Business', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
      });

      this.sock = sock;

      sock.ev.on('creds.update', async () => {
        await saveCreds();
        try {
          const credsPath = path.join(AUTH_DIR, 'creds.json');
          if (fs.existsSync(credsPath)) {
            await DB.saveSessionKey('creds.json', fs.readFileSync(credsPath, 'utf8'));
          }
        } catch (e) {
          // ignore
        }
      });

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrCode = await QRCode.toDataURL(qr, { scale: 8 });
            this.status = 'qr_ready';
            console.log("New WhatsApp QR code generated. Ready to scan!");
            this.emit('qr', this.qrCode);
            this.emit('status_change', this.getStatus());
          } catch (qrErr) {
            console.error("Error generating QR data URL:", qrErr);
          }
        }

        if (connection === 'close') {
          const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
          console.log(`WhatsApp connection closed due to ${lastDisconnect?.error?.message}. Reconnecting: ${shouldReconnect}`);
          this.status = 'disconnected';
          this.qrCode = null;
          this.userProfile = null;
          this.emit('status_change', this.getStatus());

          if (shouldReconnect) {
            setTimeout(() => this.initSocket(), 3000);
          } else {
            console.log("Logged out from WhatsApp. Session cleared.");
            this.clearSession();
          }
        } else if (connection === 'open') {
          console.log("WhatsApp connection established successfully!");
          this.status = 'connected';
          this.qrCode = null;
          this.pairingCode = null;

          const me = sock.user;
          this.userProfile = {
            id: me?.id,
            name: me?.name || 'WhatsApp Business User',
            phone: me?.id ? me.id.split(':')[0] : ''
          };

          this.emit('status_change', this.getStatus());

          // Asynchronously sync all session keys to MongoDB Atlas for cloud persistence
          setTimeout(() => {
            DB.syncSessionFiles(AUTH_DIR).catch(err => {
              console.warn("Background Atlas session sync warning:", err.message);
            });
          }, 3000);
        }
      });

      return sock;
    } catch (err) {
      console.error("Failed to initialize WhatsApp socket:", err);
      this.status = 'disconnected';
      this.emit('status_change', this.getStatus());
      setTimeout(() => this.initSocket(), 5000);
    }
  }

  async requestPairingCode(phoneNumber) {
    if (!this.sock) {
      await this.initSocket();
    }
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    try {
      console.log(`Requesting pairing code for phone: ${cleanNumber}`);
      const code = await this.sock.requestPairingCode(cleanNumber);
      this.pairingCode = code;
      this.emit('status_change', this.getStatus());
      return code;
    } catch (err) {
      console.error("Error requesting pairing code:", err);
      throw err;
    }
  }

  async logout() {
    try {
      if (this.sock) {
        await this.sock.logout();
      }
    } catch (err) {
      console.warn("Logout warning:", err.message);
    }
    this.clearSession();
  }

  clearSession() {
    try {
      this.sock = null;
      this.qrCode = null;
      this.pairingCode = null;
      this.status = 'disconnected';
      this.userProfile = null;
      if (fs.existsSync(AUTH_DIR)) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        fs.mkdirSync(AUTH_DIR, { recursive: true });
      }
      DB.clearSessionKeys().catch(console.error);
      this.emit('status_change', this.getStatus());
    } catch (err) {
      console.error("Error clearing session:", err);
    }
  }

  // Format phone number to WhatsApp JID
  formatJid(rawPhone) {
    let clean = (rawPhone || '').replace(/[^0-9]/g, '');
    // If standard 10-digit Indian number without country code, prefix 91
    if (clean.length === 10) {
      clean = '91' + clean;
    }
    return `${clean}@s.whatsapp.net`;
  }

  // Helper to determine exact MIME type for images, PDFs, ZIPs, Docs, etc.
  getMimeType(filePathOrName) {
    const ext = path.extname(filePathOrName || '').toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.webp':
        return 'image/webp';
      case '.gif':
        return 'image/gif';
      case '.pdf':
        return 'application/pdf';
      case '.zip':
        return 'application/zip';
      case '.rar':
        return 'application/x-rar-compressed';
      case '.7z':
        return 'application/x-7z-compressed';
      case '.tar':
        return 'application/x-tar';
      case '.gz':
        return 'application/gzip';
      case '.doc':
        return 'application/msword';
      case '.docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case '.xls':
        return 'application/vnd.ms-excel';
      case '.xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case '.ppt':
        return 'application/vnd.ms-powerpoint';
      case '.pptx':
        return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      case '.txt':
        return 'text/plain';
      case '.csv':
        return 'text/csv';
      case '.mp4':
        return 'video/mp4';
      case '.mp3':
        return 'audio/mpeg';
      default:
        return 'application/octet-stream';
    }
  }

  // Send single message (text, image, document, ZIP, or media + caption)
  async sendMessage(phone, messageText, mediaFilePath = null, originalFileName = null) {
    if (this.status !== 'connected' || !this.sock) {
      throw new Error("WhatsApp is not connected! Please link your WhatsApp Business account first.");
    }

    const jid = this.formatJid(phone);

    if (mediaFilePath && fs.existsSync(mediaFilePath)) {
      const fileBuffer = fs.readFileSync(mediaFilePath);
      const ext = path.extname(mediaFilePath).toLowerCase();
      const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
      const mimeType = this.getMimeType(originalFileName || mediaFilePath);
      const fileName = originalFileName || path.basename(mediaFilePath);

      if (isImage) {
        const payload = {
          image: fileBuffer,
          mimetype: mimeType
        };
        if (messageText && messageText.trim().length > 0) {
          payload.caption = messageText;
        }
        return await this.sock.sendMessage(jid, payload);
      } else {
        // Document (PDF, ZIP, Word, Excel, etc.)
        const payload = {
          document: fileBuffer,
          mimetype: mimeType,
          fileName: fileName
        };
        if (messageText && messageText.trim().length > 0) {
          payload.caption = messageText;
        }
        return await this.sock.sendMessage(jid, payload);
      }
    } else {
      if (!messageText || messageText.trim().length === 0) {
        throw new Error("Either message text or an attachment must be provided.");
      }
      return await this.sock.sendMessage(jid, { text: messageText });
    }
  }

  // Cancel ongoing broadcast
  cancelBroadcast() {
    if (this.isBroadcasting) {
      this.shouldCancelBroadcast = true;
      console.log("Broadcast cancellation requested.");
    }
  }

  // Run broadcast to recipients (High-speed optimized with single CDN upload & fast relay)
  async runBroadcast({ recipients, message, mediaFilePath = null, originalFileName = null, minDelay = 0.5, maxDelay = 1.2 }) {
    if (this.status !== 'connected') {
      throw new Error("WhatsApp Business is not connected! Please link device first.");
    }

    if (this.isBroadcasting) {
      throw new Error("A broadcast is already in progress.");
    }

    this.isBroadcasting = true;
    this.shouldCancelBroadcast = false;

    const total = recipients.length;
    let sentCount = 0;
    let failedCount = 0;
    const logs = [];

    this.broadcastProgress = {
      total,
      current: 0,
      sentCount: 0,
      failedCount: 0,
      status: 'sending',
      logs: []
    };
    this.emit('broadcast_progress', this.broadcastProgress);

    // ⚡ SPEED BOOST 1: Pre-upload media to WhatsApp CDN ONCE instead of uploading for every single contact
    let preparedMedia = null;
    let isImageMedia = false;
    if (mediaFilePath && fs.existsSync(mediaFilePath)) {
      try {
        const fileBuffer = fs.readFileSync(mediaFilePath);
        const ext = path.extname(mediaFilePath).toLowerCase();
        isImageMedia = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);

        const mimeType = this.getMimeType(originalFileName || mediaFilePath);
        const fileName = originalFileName || path.basename(mediaFilePath);

        console.log(`[Turbo Speed] Uploading ${fileName} to WhatsApp CDN once...`);
        const mediaPayload = isImageMedia
          ? { image: fileBuffer, mimetype: mimeType }
          : { document: fileBuffer, mimetype: mimeType, fileName: fileName };

        preparedMedia = await prepareWAMessageMedia(mediaPayload, { upload: this.sock.waUploadToServer });
        console.log("[Turbo Speed] Media uploaded successfully! Ready to dispatch instantly to all recipients.");
      } catch (prepErr) {
        console.warn("[Turbo Speed] Pre-upload fallback:", prepErr.message);
        preparedMedia = null;
      }
    }

    for (let i = 0; i < recipients.length; i++) {
      if (this.shouldCancelBroadcast) {
        console.log("Broadcast cancelled by user.");
        break;
      }

      const recipient = recipients[i];
      const logEntry = {
        contactName: recipient.name || 'Recipient',
        phone: recipient.phone,
        status: 'pending',
        error: null,
        sentAt: new Date()
      };

      try {
        // Dynamic variable replacement e.g. {name}, {group}
        let personalizedMsg = message || '';
        personalizedMsg = personalizedMsg.replace(/\{name\}/gi, recipient.name || 'Valued Customer');
        personalizedMsg = personalizedMsg.replace(/\{group\}/gi, recipient.group || '');

        console.log(`[${i + 1}/${total}] Dispatching to ${recipient.name} (${recipient.phone})...`);
        const jid = this.formatJid(recipient.phone);

        // ⚡ SPEED BOOST 2: Direct CDN Relay with fallback
        if (preparedMedia) {
          const msgType = isImageMedia ? 'imageMessage' : 'documentMessage';
          const msgObj = {
            [msgType]: {
              ...preparedMedia[msgType],
              caption: personalizedMsg,
              ...(isImageMedia ? {} : {
                fileName: originalFileName || path.basename(mediaFilePath),
                mimetype: this.getMimeType(originalFileName || mediaFilePath)
              })
            }
          };
          try {
            await this.sock.relayMessage(jid, msgObj, { messageId: generateMessageID() });
          } catch (relayErr) {
            console.warn(`[Relay fallback] Retrying via direct sendMessage for ${recipient.phone}:`, relayErr.message);
            await this.sendMessage(recipient.phone, personalizedMsg, mediaFilePath, originalFileName);
          }
        } else {
          await this.sendMessage(recipient.phone, personalizedMsg, mediaFilePath, originalFileName);
        }

        logEntry.status = 'sent';
        sentCount++;
      } catch (err) {
        console.error(`Failed to send to ${recipient.phone}:`, err.message);
        logEntry.status = 'failed';
        logEntry.error = err.message;
        failedCount++;
      }

      logs.push(logEntry);
      this.broadcastProgress.current = i + 1;
      this.broadcastProgress.sentCount = sentCount;
      this.broadcastProgress.failedCount = failedCount;
      this.broadcastProgress.logs = [...logs];
      this.emit('broadcast_progress', this.broadcastProgress);

      // Throttling delay between sends (fractional seconds supported down to 30ms for ultra fast mode)
      if (i < recipients.length - 1 && !this.shouldCancelBroadcast) {
        const minVal = parseFloat(minDelay);
        const maxVal = parseFloat(maxDelay);
        const minMs = Math.max(30, Math.round((isNaN(minVal) ? 0.1 : minVal) * 1000));
        const maxMs = Math.max(minMs, Math.round((isNaN(maxVal) ? 0.3 : maxVal) * 1000));
        const randomMs = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
        if (randomMs > 30) {
          console.log(`Speed throttle: ${(randomMs / 1000).toFixed(2)}s before next recipient...`);
          await delay(randomMs);
        }
      }
    }

    this.broadcastProgress.status = this.shouldCancelBroadcast ? 'cancelled' : 'completed';
    this.isBroadcasting = false;
    this.emit('broadcast_progress', this.broadcastProgress);

    return {
      total,
      sentCount,
      failedCount,
      status: this.shouldCancelBroadcast ? 'cancelled' : (failedCount === 0 ? 'completed' : 'partial'),
      logs
    };
  }
}

const whatsAppService = new WhatsAppService();

module.exports = { whatsAppService };
