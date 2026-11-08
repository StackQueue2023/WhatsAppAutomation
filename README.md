# Stack Queue — WhatsApp Automation React Native Mobile App 📱🚀

100% Native Mobile App built with **React Native (Expo)**, **MongoDB Atlas**, and **WhatsApp Multi-Device Engine (Baileys)** for **Stack Queue — Inclusive Learning**.

---

## 🌟 Key Native Mobile Features

1. **Pure React Native (iOS & Android)**:
   - Native components: `<SafeAreaView>`, `<FlatList>`, `<Modal>`, `<TextInput>`, `<Image>`.
   - Real Camera & Photo Library image picker via `expo-image-picker`.
   - Native vector icons via `@expo/vector-icons` (Ionicons).
2. **100% Free WhatsApp Business Sending**:
   - Zero Meta API charges, zero template verification delays.
   - Uses Baileys Multi-Device protocol with live QR code linking & phone pairing codes.
3. **Flexible Broadcast Modes**:
   - 📝 **Text Message Only** (with dynamic tags `{name}`, `{group}`, emojis).
   - 🖼️ **Image Only** (select from phone's photo library or capture with camera).
   - 🖼️ + 📝 **Image with Caption / Personalized Text**.
4. **Cloud Database (MongoDB Atlas)**:
   - Connected to: `mongodb+srv://STACK_QUEUE:****@stackqueuecluster.wfarxbd.mongodb.net/`
   - Pre-seeded dummy contacts ready for testing.
   - Add new contacts, edit, delete, or 1-click bulk import.
   - Resilient local persistence fallback if Atlas Network Access whitelist is pending.
5. **Anti-Ban Safety Throttling**:
   - Built-in safe interval delay (2-4 seconds) between sends to protect your WhatsApp Business account.
6. **Real-time Live Broadcast Modal**:
   - Animated progress bar and live delivery ticker showing each contact delivered (`[Delivered ✅]`).

---

## 📲 How to Run on Your Phone (Android / iOS)

### Step 1: Install "Expo Go" on Your Phone
- **Android**: Install [Expo Go from Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
- **iPhone**: Install [Expo Go from Apple App Store](https://apps.apple.com/app/expo-go/id982107779)

### Step 2: Start the App
Double-click `start.bat` in the project root, or run in terminal:
```bash
npm start
```
This runs:
- The **Backend WhatsApp & MongoDB engine** on `http://10.95.21.21:5000`
- The **React Native Metro Bundler** with an Expo QR code in your terminal.

### Step 3: Scan and Open on Your Phone
1. Connect your phone to the **same Wi-Fi** as your computer.
2. Open **Expo Go** on your phone (or camera app on iPhone) and **scan the Metro QR code**.
3. The native app will bundle and open directly on your phone!

---

## 🛠️ Standalone APK Build (Optional)
If you want to create an installable `.apk` file directly for Android without Expo Go:
```bash
cd mobile-app
npx eas-cli login
npx eas-cli build -p android --profile preview
```

---

## 📂 Project Structure
```
d:\SQ\WhatsApp Automation\
├── mobile-app/                # 📱 100% React Native Mobile App
│   ├── App.js                 # Root app container, tabs, status bar
│   ├── app.json               # App configuration & Stack Queue branding
│   ├── assets/
│   │   ├── logo.png           # Stack Queue Logo
│   │   └── adaptive-icon.png
│   └── src/
│       ├── api.js             # API client connecting to backend
│       ├── components/
│       │   ├── Header.js          # Stack Queue branded top header
│       │   ├── QrModal.js         # WhatsApp QR & Pairing code modal
│       │   └── BroadcastModal.js  # Live sending ticker & progress bar
│       └── screens/
│           ├── BroadcastScreen.js # Compose, Camera/Gallery, Anti-ban delay
│           ├── ContactsScreen.js  # MongoDB Atlas contact book & bulk import
│           ├── ReportsScreen.js   # Analytics & delivery history
│           └── SettingsScreen.js  # Server URL config & WhatsApp unlink
├── backend/                   # 🚀 Node.js WhatsApp & MongoDB Server
│   ├── server.js              # Express API & Multer image handler
│   ├── db.js                  # MongoDB Atlas Mongoose models & fallback
│   └── whatsapp.js            # Baileys Multi-Device WhatsApp engine
├── start.bat                  # One-click Windows starter
└── package.json
```
