// Real-time Cloud & Local Persistent Analytics Tracker for GFX Metadata

const STORAGE_KEYS = {
  USERS: 'gfx_admin_users',
  LOGS: 'gfx_admin_logs',
  FIREBASE_URL: 'gfx_firebase_db_url'
};

const DEFAULT_FIREBASE_URL = 'https://gfx-matadata-default-rtdb.asia-southeast1.firebasedatabase.app';

const INITIAL_ADMIN_USERS = [
  {
    id: 'usr_admin_dipta',
    name: 'Dipta (Super Admin)',
    email: 'diptag22@gmail.com',
    avatar: null,
    role: 'super_admin',
    status: 'active',
    totalGenerations: 0,
    totalImages: 0,
    favoriteProvider: 'gemini',
    favoriteModel: 'gemini-2.5-flash',
    joinedAt: new Date().toISOString(),
    lastActive: new Date().toISOString()
  },
  {
    id: 'usr_admin_mirzapur',
    name: 'Mirzapur IT',
    email: 'mirzapurit@gmail.com',
    avatar: 'https://lh3.googleusercontent.com/a/default-user',
    role: 'super_admin',
    status: 'active',
    totalGenerations: 0,
    totalImages: 0,
    favoriteProvider: 'gemini',
    favoriteModel: 'gemini-2.5-flash',
    joinedAt: new Date().toISOString(),
    lastActive: new Date().toISOString()
  }
];

class StatsTracker {
  constructor() {
    this.listeners = new Set();
    this.broadcastChannel = null;
    this.lastCloudSyncSuccess = false;
    this.initBroadcastChannel();
    this.cleanupMockData();
    this.ensureInitialized();
    // Background cloud fetch on startup
    this.fetchCloudData().catch(() => {});
  }

  initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('gfx_telemetry_stream');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type === 'SYNC') {
            this.notifyListeners();
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel not supported:', e);
      }
    }
  }

  broadcastUpdate() {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'SYNC', timestamp: Date.now() });
      } catch {}
    }
    this.notifyListeners();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners() {
    this.listeners.forEach(cb => {
      try { cb(); } catch {}
    });
  }

  getFirebaseDbUrl() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FIREBASE_URL);
      if (saved && saved.trim()) {
        const cleanSaved = saved.trim().replace(/\/+$/, '');
        // Auto-migrate legacy non-functioning URL to the actual regional Firebase URL
        if (cleanSaved.includes('gfx-metadata-default-rtdb.firebaseio.com')) {
          localStorage.setItem(STORAGE_KEYS.FIREBASE_URL, DEFAULT_FIREBASE_URL);
          return DEFAULT_FIREBASE_URL;
        }
        return cleanSaved;
      }
      if (import.meta.env.VITE_FIREBASE_DB_URL) return import.meta.env.VITE_FIREBASE_DB_URL.trim().replace(/\/+$/, '');
    } catch {}
    return DEFAULT_FIREBASE_URL;
  }

  setFirebaseDbUrl(url) {
    const clean = (url || '').trim().replace(/\/+$/, '');
    localStorage.setItem(STORAGE_KEYS.FIREBASE_URL, clean);
    this.fetchCloudData().catch(() => {});
    this.broadcastUpdate();
  }

  encodeKey(key) {
    return (key || 'user').toLowerCase().replace(/\./g, '_').replace(/[@#$%[\]/]/g, '_');
  }

  // Purge any previously stored mock users
  cleanupMockData() {
    try {
      const mockEmails = new Set([
        'alex.vance@stockcreators.io',
        'sara.designer@pixelstudio.net',
        'karim.creative@gmail.com',
        'john.vectorlab@gmail.com',
        'guest@gfxmetadata.com'
      ]);

      const rawUsers = localStorage.getItem(STORAGE_KEYS.USERS);
      if (rawUsers) {
        const parsed = JSON.parse(rawUsers);
        const realUsers = parsed.filter(u => !mockEmails.has((u.email || '').toLowerCase()));
        
        realUsers.forEach(u => {
          if (u.totalImages === 1420 || u.totalImages === 864) {
            u.totalImages = 0;
            u.totalGenerations = 0;
          }
        });

        if (realUsers.length === 0) {
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_ADMIN_USERS));
        } else {
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(realUsers));
        }
      }

      const rawLogs = localStorage.getItem(STORAGE_KEYS.LOGS);
      if (rawLogs) {
        const parsedLogs = JSON.parse(rawLogs);
        const realLogs = parsedLogs.filter(l => !mockEmails.has((l.userEmail || '').toLowerCase()));
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(realLogs));
      }
    } catch (e) {
      console.warn('Error during mock data cleanup:', e);
    }
  }

  ensureInitialized() {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_ADMIN_USERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.LOGS)) {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([]));
    }
  }

  getUsers() {
    try {
      this.ensureInitialized();
      const raw = localStorage.getItem(STORAGE_KEYS.USERS);
      return raw ? JSON.parse(raw) : INITIAL_ADMIN_USERS;
    } catch {
      return INITIAL_ADMIN_USERS;
    }
  }

  saveUsers(users) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }

  getLogs() {
    try {
      this.ensureInitialized();
      const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveLogs(logs) {
    const trimmed = logs.slice(0, 300);
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(trimmed));
  }

  // --- Real-Time Cloud Synchronization Methods ---

  async syncUserToCloud(user) {
    const baseUrl = this.getFirebaseDbUrl();
    if (!baseUrl || !user?.email) return;
    const safeKey = this.encodeKey(user.email);
    try {
      await fetch(`${baseUrl}/gfx_users/${safeKey}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
      this.lastCloudSyncSuccess = true;
    } catch (e) {
      // Cloud sync offline fallback
      this.lastCloudSyncSuccess = false;
    }
  }

  // Non-destructive auth sync: updates profile and activity timestamp without resetting generation counters
  async syncUserAuthToCloud(user) {
    const baseUrl = this.getFirebaseDbUrl();
    if (!baseUrl || !user?.email) return;
    const safeKey = this.encodeKey(user.email);
    try {
      await fetch(`${baseUrl}/gfx_users/${safeKey}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar || null,
          role: user.role,
          status: user.status || 'active',
          lastActive: user.lastActive || new Date().toISOString()
        })
      });
      this.lastCloudSyncSuccess = true;
    } catch (e) {
      this.lastCloudSyncSuccess = false;
    }
  }

  async syncLogToCloud(logEntry) {
    const baseUrl = this.getFirebaseDbUrl();
    if (!baseUrl) return;
    try {
      await fetch(`${baseUrl}/gfx_logs.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry)
      });
      this.lastCloudSyncSuccess = true;
    } catch (e) {
      this.lastCloudSyncSuccess = false;
    }
  }

  // Pull latest users and logs from Firebase Realtime Database
  async fetchCloudData() {
    const baseUrl = this.getFirebaseDbUrl();
    if (!baseUrl) return { success: false, users: this.getUsers(), logs: this.getLogs() };

    try {
      const [usersRes, logsRes] = await Promise.all([
        fetch(`${baseUrl}/gfx_users.json`, { cache: 'no-store' }),
        fetch(`${baseUrl}/gfx_logs.json`, { cache: 'no-store' })
      ]);

      let cloudUsersList = [];
      let cloudLogsList = [];

      if (usersRes.ok) {
        const usersObj = await usersRes.json();
        if (usersObj && typeof usersObj === 'object') {
          cloudUsersList = Object.values(usersObj);
        }
      }

      if (logsRes.ok) {
        const logsObj = await logsRes.json();
        if (logsObj && typeof logsObj === 'object') {
          cloudLogsList = Object.values(logsObj);
          // Sort logs newest first and keep up to 300
          cloudLogsList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          cloudLogsList = cloudLogsList.slice(0, 300);
        }
      }

      if (cloudUsersList.length > 0) {
        // Merge cloud users with local admins to ensure no admin is missed
        const localUsers = this.getUsers();
        const mergedUsersMap = new Map();

        localUsers.forEach(u => {
          if (u && u.email) mergedUsersMap.set(u.email.toLowerCase(), { ...u });
        });

        cloudUsersList.forEach(u => {
          if (u && u.email) {
            const emailKey = u.email.toLowerCase();
            const existing = mergedUsersMap.get(emailKey);
            if (existing) {
              mergedUsersMap.set(emailKey, {
                ...existing,
                ...u,
                totalImages: Math.max(Number(existing.totalImages) || 0, Number(u.totalImages) || 0),
                totalGenerations: Math.max(Number(existing.totalGenerations) || 0, Number(u.totalGenerations) || 0),
                lastActive: (new Date(existing.lastActive || 0) > new Date(u.lastActive || 0)) ? existing.lastActive : (u.lastActive || existing.lastActive)
              });
            } else {
              mergedUsersMap.set(emailKey, u);
            }
          }
        });

        const mergedUsers = Array.from(mergedUsersMap.values());
        this.saveUsers(mergedUsers);
      }

      if (cloudLogsList.length > 0) {
        this.saveLogs(cloudLogsList);
      }

      this.lastCloudSyncSuccess = true;
      this.notifyListeners();

      return {
        success: true,
        users: this.getUsers(),
        logs: this.getLogs()
      };
    } catch (e) {
      this.lastCloudSyncSuccess = false;
      return {
        success: false,
        users: this.getUsers(),
        logs: this.getLogs()
      };
    }
  }

  // --- Real-time Activity Recording ---

  recordLogin(user) {
    if (!user || !user.email) return;
    try {
      const email = user.email.toLowerCase();
      if (email === 'guest@gfxmetadata.com') return;

      const users = this.getUsers();
      const existingIdx = users.findIndex(u => u.email.toLowerCase() === email);
      const isOwner = email === 'diptag22@gmail.com' || email === 'mirzapurit@gmail.com';

      let targetUser;

      if (existingIdx >= 0) {
        users[existingIdx].lastActive = new Date().toISOString();
        users[existingIdx].status = 'active';
        if (user.avatar) users[existingIdx].avatar = user.avatar;
        if (user.name) users[existingIdx].name = user.name;
        if (isOwner) users[existingIdx].role = 'super_admin';
        targetUser = users[existingIdx];
      } else {
        targetUser = {
          id: `usr_${Date.now()}`,
          name: user.name || user.email.split('@')[0],
          email: user.email,
          avatar: user.avatar || null,
          role: isOwner ? 'super_admin' : (user.role || 'member'),
          status: 'active',
          totalGenerations: 0,
          totalImages: 0,
          favoriteProvider: 'gemini',
          favoriteModel: 'gemini-2.5-flash',
          joinedAt: new Date().toISOString(),
          lastActive: new Date().toISOString()
        };
        users.unshift(targetUser);
      }
      this.saveUsers(users);

      const logEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        userEmail: user.email,
        userName: user.name || user.email.split('@')[0],
        action: 'User Sign In',
        provider: 'auth',
        model: 'system',
        mode: 'auth',
        count: 0,
        status: 'success',
        duration: '0.1s'
      };

      const logs = this.getLogs();
      logs.unshift(logEntry);
      this.saveLogs(logs);

      // Realtime Cloud Dispatch & Multi-Tab Broadcast
      this.syncUserAuthToCloud(targetUser);
      this.syncLogToCloud(logEntry);
      this.broadcastUpdate();
    } catch (e) {
      console.error('Failed to record user login:', e);
    }
  }

  recordGeneration({ user, provider, model, mode, count = 1, success = true, duration = '1.8s' }) {
    try {
      const email = user?.email || 'mirzapurit@gmail.com';
      if (email === 'guest@gfxmetadata.com') return;
      const name = user?.name || (email.split('@')[0]);

      const users = this.getUsers();
      const userIdx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

      let targetUser;

      if (userIdx >= 0) {
        users[userIdx].totalGenerations = (users[userIdx].totalGenerations || 0) + 1;
        users[userIdx].totalImages = (users[userIdx].totalImages || 0) + count;
        users[userIdx].lastActive = new Date().toISOString();
        users[userIdx].status = 'active';
        if (provider) users[userIdx].favoriteProvider = provider;
        if (model) users[userIdx].favoriteModel = model;
        targetUser = users[userIdx];
      } else {
        const isOwner = email.toLowerCase() === 'diptag22@gmail.com' || email.toLowerCase() === 'mirzapurit@gmail.com';
        targetUser = {
          id: `usr_${Date.now()}`,
          name,
          email,
          avatar: user?.avatar || null,
          role: isOwner ? 'super_admin' : 'member',
          status: 'active',
          totalGenerations: 1,
          totalImages: count,
          favoriteProvider: provider || 'gemini',
          favoriteModel: model || 'gemini-2.5-flash',
          joinedAt: new Date().toISOString(),
          lastActive: new Date().toISOString()
        };
        users.unshift(targetUser);
      }
      this.saveUsers(users);

      const logEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        userEmail: email,
        userName: name,
        action: mode === 'prompt' ? 'Prompt Generation' : 'Metadata Generation',
        provider: provider || 'gemini',
        model: model ? model.split('/').pop() : (provider || 'gemini'),
        mode: mode || 'metadata',
        count,
        status: success ? 'success' : 'failed',
        duration
      };

      const logs = this.getLogs();
      logs.unshift(logEntry);
      this.saveLogs(logs);

      // Realtime Cloud Dispatch & Multi-Tab Broadcast
      this.syncUserToCloud(targetUser);
      this.syncLogToCloud(logEntry);
      this.broadcastUpdate();
    } catch (e) {
      console.error('Failed to record generation stats:', e);
    }
  }

  recordExport(user, count = 0) {
    const email = user?.email || 'mirzapurit@gmail.com';
    const name = user?.name || (email.split('@')[0]);

    const logEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      userEmail: email,
      userName: name,
      action: 'CSV Metadata Export',
      provider: 'export',
      model: 'system',
      mode: 'export',
      count,
      status: 'success',
      duration: '0.2s'
    };

    const logs = this.getLogs();
    logs.unshift(logEntry);
    this.saveLogs(logs);

    this.syncLogToCloud(logEntry);
    this.broadcastUpdate();
  }

  getAggregatedStats() {
    const users = this.getUsers();
    const logs = this.getLogs();

    const totalUsers = users.length;
    const activeUsersToday = users.filter(u => {
      if (!u.lastActive) return false;
      const last = new Date(u.lastActive);
      const diffHours = (Date.now() - last.getTime()) / (1000 * 60 * 60);
      return diffHours <= 24;
    }).length;

    const generationLogs = logs.filter(l => l.provider !== 'auth' && l.provider !== 'export' && l.mode !== 'auth' && l.action !== 'User Sign In');
    const logsTotalImages = generationLogs.reduce((acc, l) => acc + (Number(l.count) || 1), 0);
    const usersTotalImages = users.reduce((acc, u) => acc + (Number(u.totalImages) || 0), 0);
    const totalImagesProcessed = Math.max(usersTotalImages, logsTotalImages);

    const logsTotalGenerations = generationLogs.length;
    const usersTotalGenerations = users.reduce((acc, u) => acc + (Number(u.totalGenerations) || 0), 0);
    const totalGenerations = Math.max(usersTotalGenerations, logsTotalGenerations);

    const successLogs = generationLogs.filter(l => l.status === 'success');
    const successRate = generationLogs.length > 0 
      ? Math.round((successLogs.length / generationLogs.length) * 100) 
      : 100;

    let geminiCount = 0;
    let groqCount = 0;
    generationLogs.forEach(l => {
      if (l.provider === 'gemini') geminiCount += (l.count || 1);
      if (l.provider === 'groq') groqCount += (l.count || 1);
    });

    const totalCalls = geminiCount + groqCount;
    const geminiPercentage = totalCalls > 0 ? Math.round((geminiCount / totalCalls) * 100) : 0;
    const groqPercentage = totalCalls > 0 ? (100 - geminiPercentage) : 0;

    // Real last 7 days breakdown
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const dailyData = [];

    for (let i = 6; i >= 0; i--) {
      const targetDate = new Date();
      targetDate.setDate(now.getDate() - i);
      const dayName = days[targetDate.getDay()];
      const dateStr = targetDate.toISOString().slice(0, 10);

      const dayLogs = generationLogs.filter(l => l.timestamp && l.timestamp.startsWith(dateStr));
      let dayGemini = 0;
      let dayGroq = 0;
      dayLogs.forEach(l => {
        if (l.provider === 'gemini') dayGemini += (l.count || 1);
        if (l.provider === 'groq') dayGroq += (l.count || 1);
      });
      const dayTotal = dayGemini + dayGroq;

      dailyData.push({
        day: dayName,
        date: dateStr,
        count: dayTotal,
        gemini: dayGemini,
        groq: dayGroq
      });
    }

    const durations = generationLogs
      .map(l => parseFloat(l.duration))
      .filter(d => !isNaN(d) && d > 0);
    const avgDuration = durations.length > 0 
      ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2) + 's' 
      : '0.00s';

    const exportLogs = logs.filter(l => l.action && l.action.toLowerCase().includes('csv'));
    const totalExports = exportLogs.length;

    return {
      totalUsers,
      activeUsersToday,
      totalImagesProcessed,
      totalGenerations,
      successRate,
      geminiCount,
      groqCount,
      geminiPercentage,
      groqPercentage,
      dailyData,
      avgDuration,
      totalExports
    };
  }

  updateUserRole(userId, newRole) {
    const users = this.getUsers();
    const updated = users.map(u => u.id === userId ? { ...u, role: newRole } : u);
    this.saveUsers(updated);
    const target = updated.find(u => u.id === userId);
    if (target) this.syncUserToCloud(target);
    this.broadcastUpdate();
    return updated;
  }

  deleteUser(userId) {
    const users = this.getUsers();
    const target = users.find(u => u.id === userId);
    const updated = users.filter(u => u.id !== userId);
    this.saveUsers(updated);
    if (target && target.email) {
      const baseUrl = this.getFirebaseDbUrl();
      const safeKey = this.encodeKey(target.email);
      fetch(`${baseUrl}/gfx_users/${safeKey}.json`, { method: 'DELETE' }).catch(() => {});
    }
    this.broadcastUpdate();
    return updated;
  }

  resetToCleanRealData() {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_ADMIN_USERS));
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([]));
    const baseUrl = this.getFirebaseDbUrl();
    if (baseUrl) {
      fetch(`${baseUrl}/gfx_users.json`, { method: 'PUT', body: JSON.stringify({
        usr_admin_dipta: INITIAL_ADMIN_USERS[0],
        usr_admin_mirzapur: INITIAL_ADMIN_USERS[1]
      })}).catch(() => {});
      fetch(`${baseUrl}/gfx_logs.json`, { method: 'DELETE' }).catch(() => {});
    }
    this.broadcastUpdate();
  }
}

export const statsTracker = new StatsTracker();
export default statsTracker;
