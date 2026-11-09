import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const SERVER_URL_KEY = '@stackqueue_server_url';
const MANUAL_OVERRIDE_KEY = '@stackqueue_manual_override';

// Auto-detect host: priorities: 1) EXPO_PUBLIC_API_URL, 2) Expo Metro host, 3) LAN IP fallback
export function getDetectedHost() {
  if (process.env.EXPO_PUBLIC_API_URL && process.env.EXPO_PUBLIC_API_URL.trim()) {
    let envUrl = process.env.EXPO_PUBLIC_API_URL.trim();
    if (envUrl.endsWith('/')) envUrl = envUrl.slice(0, -1);
    return envUrl;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost ||
    '';

  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5000`;
    }
  }
  // Fallback to permanent 24/7 cloud server
  return 'https://stackqueue-whatsapp.onrender.com';
}

export const DEFAULT_SERVER_URL = getDetectedHost();
let cachedServerUrl = DEFAULT_SERVER_URL;

export async function initServerUrl() {
  const detected = getDetectedHost();
  try {
    const isManual = await AsyncStorage.getItem(MANUAL_OVERRIDE_KEY);
    const saved = await AsyncStorage.getItem(SERVER_URL_KEY);
    
    // Purge dead temporary quick tunnels (trycloudflare / localtunnel)
    const isOldTunnel = saved && (saved.includes('trycloudflare.com') || saved.includes('loca.lt'));
    
    if (saved && isManual === 'true' && !isOldTunnel && (saved.startsWith('http://') || saved.startsWith('https://'))) {
      cachedServerUrl = saved;
    } else {
      cachedServerUrl = detected;
      await AsyncStorage.setItem(SERVER_URL_KEY, detected);
      if (isOldTunnel) {
        await AsyncStorage.removeItem(MANUAL_OVERRIDE_KEY);
      }
    }
  } catch (e) {
    cachedServerUrl = detected;
  }
  return cachedServerUrl;
}

export function getCurrentServerUrl() {
  return cachedServerUrl;
}

export async function setServerUrl(url, isManual = true) {
  let clean = url.trim();
  if (clean.endsWith('/')) {
    clean = clean.slice(0, -1);
  }
  cachedServerUrl = clean;
  await AsyncStorage.setItem(SERVER_URL_KEY, clean);
  if (isManual) {
    await AsyncStorage.setItem(MANUAL_OVERRIDE_KEY, 'true');
  } else {
    await AsyncStorage.removeItem(MANUAL_OVERRIDE_KEY);
  }
  return clean;
}

// Fetch helper with timeout & clear network error reporting
async function request(path, options = {}) {
  const url = `${cachedServerUrl}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      throw new Error(text || `Server returned ${res.status}`);
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Server error (${res.status})`);
    }
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(
        `Server took too long to respond at ${url}.\nPlease check your internet connection.`
      );
    }
    if (err.message && err.message.includes('Network request failed')) {
      throw new Error(
        `Cannot reach server at ${url}.\nPlease verify your internet connection or cloud service status.`
      );
    }
    throw err;
  }
}

export const API = {
  getStatus: () => request('/api/status'),

  getContacts: (search = '', group = 'all') => {
    let q = [];
    if (search) q.push(`search=${encodeURIComponent(search)}`);
    if (group && group !== 'all') q.push(`group=${encodeURIComponent(group)}`);
    const qs = q.length > 0 ? `?${q.join('&')}` : '';
    return request(`/api/contacts${qs}`);
  },

  addContact: (data) =>
    request('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  updateContact: (id, data) =>
    request(`/api/contacts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  deleteContact: (id) =>
    request(`/api/contacts/${id}`, {
      method: 'DELETE',
    }),

  bulkImport: (rawText, group) =>
    request('/api/contacts/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText, group }),
    }),

  getGroups: () => request('/api/groups'),

  createGroup: (name, description = '', contactIds = []) =>
    request('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, contactIds }),
    }),

  assignContactsToGroup: (contactIds, groupName) =>
    request('/api/groups/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactIds, groupName }),
    }),

  deleteGroup: (name) =>
    request(`/api/groups/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    }),

  getCampaigns: () => request('/api/campaigns'),

  getBroadcastProgress: () => request('/api/broadcast/status'),

  sendBroadcast: async (payload) => {
    const url = `${cachedServerUrl}/api/broadcast`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;

    const headers = {};
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: isFormData ? payload : JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start broadcast');
      }
      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Broadcast upload timed out to ${url}.`);
      }
      throw err;
    }
  },

  cancelBroadcast: () =>
    request('/api/broadcast/cancel', {
      method: 'POST',
    }),

  requestPairingCode: (phone) =>
    request('/api/whatsapp/pair-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    }),

  reconnectWhatsApp: () =>
    request('/api/whatsapp/reconnect', {
      method: 'POST',
    }),

  logoutWhatsApp: () =>
    request('/api/whatsapp/logout', {
      method: 'POST',
    }),
};
