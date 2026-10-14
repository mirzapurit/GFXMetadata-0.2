// Real-time Persistent Analytics & User Statistics Tracker for GFX Metadata

const STORAGE_KEYS = {
  USERS: 'gfx_admin_users',
  LOGS: 'gfx_admin_logs',
  METRICS: 'gfx_admin_metrics'
};

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
    this.cleanupMockData();
    this.ensureInitialized();
  }

  // Automatically purge any previously stored mock/sample users or logs
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
        
        // Reset old hardcoded sample numbers (1420 / 864) on admin accounts
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
    // Keep max 300 logs
    const trimmed = logs.slice(0, 300);
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(trimmed));
  }

  // Register or update active user on login
  recordLogin(user) {
    if (!user || !user.email) return;
    try {
      const email = user.email.toLowerCase();
      // Skip dummy guest account
      if (email === 'guest@gfxmetadata.com') return;

      const users = this.getUsers();
      const existingIdx = users.findIndex(u => u.email.toLowerCase() === email);
      const isOwner = email === 'diptag22@gmail.com' || email === 'mirzapurit@gmail.com';

      if (existingIdx >= 0) {
        users[existingIdx].lastActive = new Date().toISOString();
        users[existingIdx].status = 'active';
        if (user.avatar) users[existingIdx].avatar = user.avatar;
        if (user.name) users[existingIdx].name = user.name;
        if (isOwner) users[existingIdx].role = 'super_admin';
      } else {
        const newUser = {
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
        users.unshift(newUser);
      }
      this.saveUsers(users);

      this.addLog({
        userEmail: user.email,
        userName: user.name || user.email.split('@')[0],
        action: 'User Sign In',
        provider: 'auth',
        model: 'system',
        mode: 'auth',
        count: 1,
        status: 'success',
        duration: '0.1s'
      });
    } catch (e) {
      console.error('Failed to record user login stats:', e);
    }
  }

  // Record image generation action in real-time
  recordGeneration({ user, provider, model, mode, count = 1, success = true, duration = '1.8s' }) {
    try {
      const email = user?.email || 'mirzapurit@gmail.com';
      if (email === 'guest@gfxmetadata.com') return;
      const name = user?.name || (email.split('@')[0]);

      // Update user aggregate stats
      const users = this.getUsers();
      const userIdx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

      if (userIdx >= 0) {
        users[userIdx].totalGenerations = (users[userIdx].totalGenerations || 0) + 1;
        users[userIdx].totalImages = (users[userIdx].totalImages || 0) + count;
        users[userIdx].lastActive = new Date().toISOString();
        users[userIdx].status = 'active';
        if (provider) users[userIdx].favoriteProvider = provider;
        if (model) users[userIdx].favoriteModel = model;
        this.saveUsers(users);
      } else {
        const isOwner = email.toLowerCase() === 'diptag22@gmail.com' || email.toLowerCase() === 'mirzapurit@gmail.com';
        users.unshift({
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
        });
        this.saveUsers(users);
      }

      // Add to log
      this.addLog({
        userEmail: email,
        userName: name,
        action: mode === 'prompt' ? 'Prompt Generation' : 'Metadata Generation',
        provider: provider || 'gemini',
        model: model ? model.split('/').pop() : (provider || 'gemini'),
        mode: mode || 'metadata',
        count,
        status: success ? 'success' : 'failed',
        duration
      });
    } catch (e) {
      console.error('Failed to record generation stats:', e);
    }
  }

  // Record CSV export action
  recordExport(user, count = 0) {
    const email = user?.email || 'mirzapurit@gmail.com';
    const name = user?.name || (email.split('@')[0]);
    this.addLog({
      userEmail: email,
      userName: name,
      action: 'CSV Metadata Export',
      provider: 'export',
      model: 'system',
      mode: 'export',
      count,
      status: 'success',
      duration: '0.2s'
    });
  }

  addLog(entry) {
    try {
      const logs = this.getLogs();
      const newEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        ...entry
      };
      logs.unshift(newEntry);
      this.saveLogs(logs);
    } catch (e) {
      console.error('Failed to add log:', e);
    }
  }

  // Calculate REAL aggregated live stats (no mock baselines)
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

    const totalImagesProcessed = users.reduce((acc, u) => acc + (u.totalImages || 0), 0);
    const totalGenerations = users.reduce((acc, u) => acc + (u.totalGenerations || 0), 0);

    const generationLogs = logs.filter(l => l.provider !== 'auth' && l.provider !== 'export');
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

    // Real last 7 days breakdown based ONLY on actual logs
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

    // Real average response time
    const durations = generationLogs
      .map(l => parseFloat(l.duration))
      .filter(d => !isNaN(d) && d > 0);
    const avgDuration = durations.length > 0 
      ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2) + 's' 
      : '0.00s';

    // Real CSV exports
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

  // Update a user's role
  updateUserRole(userId, newRole) {
    const users = this.getUsers();
    const updated = users.map(u => u.id === userId ? { ...u, role: newRole } : u);
    this.saveUsers(updated);
    return updated;
  }

  // Delete a user from tracker
  deleteUser(userId) {
    const users = this.getUsers();
    const updated = users.filter(u => u.id !== userId);
    this.saveUsers(updated);
    return updated;
  }

  // Reset & Purge mock data, keeping clean admins
  resetToCleanRealData() {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_ADMIN_USERS));
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([]));
  }
}

export const statsTracker = new StatsTracker();
export default statsTracker;
