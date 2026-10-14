import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  BarChart3, 
  Activity, 
  TrendingUp, 
  ShieldCheck, 
  Search, 
  Download, 
  RefreshCw, 
  Calendar, 
  Zap, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  X, 
  Sparkles, 
  Database, 
  Sliders, 
  UserCheck, 
  Trash2, 
  ArrowUpRight,
  Filter,
  Layers,
  ChevronRight,
  UserPlus,
  Lock
} from 'lucide-react';
import statsTracker from '../services/statsTracker';
import './AdminPanel.css';

const AdminPanel = ({ isOpen, onClose, currentUser, onAdminLogout }) => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'users' | 'logs' | 'analytics'
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [logFilter, setLogFilter] = useState('all');
  const [dateRange, setDateRange] = useState('7d');
  const [notification, setNotification] = useState(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');

  // Load latest data from statsTracker
  const refreshData = () => {
    const loadedUsers = statsTracker.getUsers();
    const loadedLogs = statsTracker.getLogs();
    const loadedStats = statsTracker.getAggregatedStats();
    setUsers(loadedUsers);
    setLogs(loadedLogs);
    setStats(loadedStats);
  };

  useEffect(() => {
    if (isOpen) {
      refreshData();
    }
  }, [isOpen]);

  const showToast = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Format relative timestamp
  const formatTimeAgo = (isoString) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = 
        (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const matchesSearch = 
        (l.userName && l.userName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (l.userEmail && l.userEmail.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (l.action && l.action.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesFilter = 
        logFilter === 'all' || 
        (logFilter === 'metadata' && l.mode === 'metadata') ||
        (logFilter === 'prompt' && l.mode === 'prompt') ||
        (logFilter === 'auth' && l.provider === 'auth');
      return matchesSearch && matchesFilter;
    });
  }, [logs, searchQuery, logFilter]);

  // Handle Export CSV
  const handleExportCsv = () => {
    const csvRows = [];
    csvRows.push(['GFX METADATA - ADMIN USER STATISTICS REPORT']);
    csvRows.push([`Generated at: ${new Date().toLocaleString()}`]);
    csvRows.push([]);
    csvRows.push(['--- USERS LIST ---']);
    csvRows.push(['ID', 'Name', 'Email', 'Role', 'Status', 'Total Generations', 'Total Images Processed', 'Preferred Provider', 'Last Active']);

    users.forEach(u => {
      csvRows.push([
        u.id,
        `"${u.name}"`,
        u.email,
        u.role,
        u.status,
        u.totalGenerations || 0,
        u.totalImages || 0,
        u.favoriteProvider || 'N/A',
        u.lastActive ? new Date(u.lastActive).toLocaleString() : 'N/A'
      ]);
    });

    csvRows.push([]);
    csvRows.push(['--- RECENT GENERATION & ACTIVITY LOGS ---']);
    csvRows.push(['Timestamp', 'User', 'Email', 'Action', 'Provider', 'Model', 'Items Count', 'Duration', 'Status']);

    logs.slice(0, 50).forEach(l => {
      csvRows.push([
        new Date(l.timestamp).toLocaleString(),
        `"${l.userName}"`,
        l.userEmail,
        `"${l.action}"`,
        l.provider,
        l.model,
        l.count || 1,
        l.duration || '',
        l.status
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `gfx_user_statistics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('User Statistics CSV exported successfully!');
  };

  // Toggle user role
  const handleToggleRole = (userId, currentRole) => {
    const nextRole = currentRole === 'super_admin' ? 'member' : 'super_admin';
    const updated = statsTracker.updateUserRole(userId, nextRole);
    setUsers(updated);
    showToast(`Role updated to ${nextRole === 'super_admin' ? 'Super Admin' : 'Member'}`);
  };

  // Delete user
  const handleDeleteUser = (userId, userEmail) => {
    if (window.confirm(`Are you sure you want to remove user ${userEmail}?`)) {
      const updated = statsTracker.deleteUser(userId);
      setUsers(updated);
      showToast('User removed');
    }
  };

  // Add simulated user
  const handleAddUser = (e) => {
    e.preventDefault();
    if (!newUserEmail.trim()) return;
    const name = newUserName.trim() || newUserEmail.split('@')[0];
    statsTracker.recordLogin({
      name,
      email: newUserEmail.trim(),
      avatar: null
    });
    refreshData();
    setShowAddUserModal(false);
    setNewUserName('');
    setNewUserEmail('');
    showToast(`User ${newUserEmail} registered successfully!`);
  };

  // Reset / purge stats to clean 0 counters
  const handleResetRealData = () => {
    if (window.confirm('Clear all stored statistics and reset counters to clean live data (0 images, 0 batches)?')) {
      statsTracker.resetToCleanRealData();
      refreshData();
      showToast('All statistics reset to clean 0 counters.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="admin-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={e => e.stopPropagation()}>
        {/* Top Header */}
        <div className="admin-header">
          <div className="admin-header-title">
            <div className="admin-badge-icon">
              <ShieldCheck size={22} color="#EC1C24" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2>Admin Panel & User Statistics</h2>
                <span className="live-status-pill">
                  <span className="live-dot"></span> Live
                </span>
              </div>
              <p className="admin-subtitle">
                System insights, user telemetry, and AI workload analytics for GFX Metadata
              </p>
            </div>
          </div>

          <div className="admin-header-actions">
            <button className="admin-btn-secondary" onClick={() => {
              statsTracker.cleanupMockData();
              refreshData();
              showToast('Mock data purged. Real live data synced.');
            }} title="Purge Dummy Data & Sync Live">
              <Sparkles size={15} color="#EC1C24" />
              <span>Sync Live Data</span>
            </button>
            <button className="admin-btn-secondary" onClick={refreshData} title="Refresh Live Data">
              <RefreshCw size={15} />
              <span>Refresh</span>
            </button>
            <button className="admin-btn-accent" onClick={handleExportCsv} title="Download CSV Report">
              <Download size={15} />
              <span>Export CSV</span>
            </button>
            {onAdminLogout && (
              <button 
                className="admin-btn-secondary danger" 
                onClick={() => {
                  onAdminLogout();
                  onClose();
                }} 
                title="Lock & Exit Admin Mode"
              >
                <Lock size={14} />
                <span>Lock Admin</span>
              </button>
            )}
            <button className="admin-close-btn" onClick={onClose} title="Close Admin Panel">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div className="admin-toast">
            <CheckCircle2 size={16} color="#10B981" />
            <span>{notification}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="admin-tabs-bar">
          <button 
            className={`admin-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Activity size={17} />
            <span>Overview & KPIs</span>
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={17} />
            <span>User Directory ({users.length})</span>
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            <Clock size={17} />
            <span>Generation Logs ({logs.length})</span>
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 size={17} />
            <span>Model Analytics</span>
          </button>
        </div>

        {/* Main Tab Content */}
        <div className="admin-body-content">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && stats && (
            <div className="overview-container">
              {/* Metric Cards Grid */}
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-card-top">
                    <span className="metric-label">Total Registered Users</span>
                    <div className="metric-icon-wrap" style={{ background: 'rgba(236, 28, 36, 0.15)', color: '#EC1C24' }}>
                      <Users size={20} />
                    </div>
                  </div>
                  <div className="metric-value-row">
                    <span className="metric-number">{stats.totalUsers}</span>
                    <span className="metric-trend positive">
                      <ArrowUpRight size={14} /> {stats.activeUsersToday} Active Today
                    </span>
                  </div>
                  <div className="metric-footer-bar">
                    <div className="metric-bar-fill" style={{ width: `${Math.min(100, (stats.activeUsersToday / stats.totalUsers) * 100)}%`, background: '#EC1C24' }}></div>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-card-top">
                    <span className="metric-label">Total Images Processed</span>
                    <div className="metric-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6' }}>
                      <Layers size={20} />
                    </div>
                  </div>
                  <div className="metric-value-row">
                    <span className="metric-number">{stats.totalImagesProcessed.toLocaleString()}</span>
                    <span className="metric-trend positive">
                      <TrendingUp size={14} /> {stats.totalGenerations} Batches
                    </span>
                  </div>
                  <div className="metric-footer-bar">
                    <div className="metric-bar-fill" style={{ width: stats.totalImagesProcessed > 0 ? '100%' : '0%', background: '#3B82F6' }}></div>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-card-top">
                    <span className="metric-label">API Success Rate</span>
                    <div className="metric-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }}>
                      <Zap size={20} />
                    </div>
                  </div>
                  <div className="metric-value-row">
                    <span className="metric-number">{stats.successRate}%</span>
                    <span className="metric-trend positive">
                      <CheckCircle2 size={14} /> High Reliability
                    </span>
                  </div>
                  <div className="metric-footer-bar">
                    <div className="metric-bar-fill" style={{ width: `${stats.successRate}%`, background: '#10B981' }}></div>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-card-top">
                    <span className="metric-label">Provider Workload</span>
                    <div className="metric-icon-wrap" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#A855F7' }}>
                      <Sparkles size={20} />
                    </div>
                  </div>
                  <div className="metric-value-row">
                    {(stats.geminiCount === 0 && stats.groqCount === 0) ? (
                      <>
                        <span className="metric-number">0 Calls</span>
                        <span className="metric-trend neutral">No workload yet</span>
                      </>
                    ) : (
                      <>
                        <span className="metric-number">Gemini {stats.geminiPercentage}%</span>
                        <span className="metric-trend neutral">Groq {stats.groqPercentage}%</span>
                      </>
                    )}
                  </div>
                  <div className="metric-footer-bar" style={{ display: 'flex' }}>
                    <div style={{ width: `${stats.geminiPercentage}%`, height: '100%', background: '#3B82F6', borderRadius: '4px 0 0 4px' }}></div>
                    <div style={{ width: `${stats.groqPercentage}%`, height: '100%', background: '#F97316', borderRadius: '0 4px 4px 0' }}></div>
                  </div>
                </div>
              </div>

              {/* 7-Day Activity Chart & Top Users Split */}
              <div className="overview-split-row">
                {/* 7-Day Activity Visual Chart */}
                <div className="admin-chart-card">
                  <div className="card-heading-row">
                    <div>
                      <h3 className="card-title">Daily Generation Volume</h3>
                      <p className="card-subtitle">Images processed across the past 7 days</p>
                    </div>
                    <div className="chart-legend">
                      <span className="legend-item"><span className="legend-dot gemini"></span> Gemini</span>
                      <span className="legend-item"><span className="legend-dot groq"></span> Groq</span>
                    </div>
                  </div>

                  <div className="bar-chart-container">
                    {stats.dailyData.map((d, idx) => {
                      const maxVal = Math.max(...stats.dailyData.map(item => item.count), 1);
                      const heightPercent = d.count > 0 ? Math.max(14, Math.round((d.count / maxVal) * 100)) : 5;
                      const geminiHeight = d.count > 0 ? Math.round((d.gemini / d.count) * 100) : 0;
                      return (
                        <div key={idx} className="chart-bar-col">
                          <div className="bar-tooltip">
                            <strong>{d.count} images</strong>
                            <span>Gemini: {d.gemini}</span>
                            <span>Groq: {d.groq}</span>
                          </div>
                          <div className="bar-track" style={{ height: `${heightPercent}%`, opacity: d.count > 0 ? 1 : 0.25 }}>
                            <div className="bar-segment gemini" style={{ height: `${geminiHeight}%` }}></div>
                            <div className="bar-segment groq" style={{ height: `${100 - geminiHeight}%` }}></div>
                          </div>
                          <span className="bar-day-label">{d.day}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="chart-metrics-footer">
                    <div className="chart-footer-stat">
                      <span className="footer-stat-label">7-Day Total</span>
                      <span className="footer-stat-val">
                        {stats.dailyData.reduce((acc, curr) => acc + (curr.count || 0), 0)} images
                      </span>
                    </div>
                    <div className="chart-footer-stat">
                      <span className="footer-stat-label">Daily Average</span>
                      <span className="footer-stat-val">
                        {Math.round(stats.dailyData.reduce((acc, curr) => acc + (curr.count || 0), 0) / 7)} / day
                      </span>
                    </div>
                    <div className="chart-footer-stat">
                      <span className="footer-stat-label">Peak Volume</span>
                      <span className="footer-stat-val">
                        {(() => {
                          const peak = stats.dailyData.reduce((prev, curr) => (curr.count > prev.count ? curr : prev), stats.dailyData[0]);
                          return peak && peak.count > 0 ? `${peak.day} (${peak.count})` : '0';
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Top Creators Leaderboard */}
                <div className="admin-leaderboard-card">
                  <div className="card-heading-row">
                    <div>
                      <h3 className="card-title">Top Active Users</h3>
                      <p className="card-subtitle">Highest metadata volume creators</p>
                    </div>
                  </div>

                  <div className="leaderboard-list">
                    {[...users].sort((a, b) => (b.totalImages || 0) - (a.totalImages || 0)).slice(0, 5).map((u, i) => (
                      <div key={u.id} className="leaderboard-item">
                        <span className={`rank-badge rank-${i + 1}`}>#{i + 1}</span>
                        <div className="user-avatar-initials">
                          {u.avatar ? (
                            <img src={u.avatar} alt={u.name} />
                          ) : (
                            <span>{u.name ? u.name.charAt(0).toUpperCase() : 'U'}</span>
                          )}
                        </div>
                        <div className="leaderboard-info">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="leaderboard-name">{u.name}</span>
                            {u.role === 'super_admin' && <span className="admin-mini-tag">Admin</span>}
                          </div>
                          <span className="leaderboard-email">{u.email}</span>
                        </div>
                        <div className="leaderboard-stat">
                          <span className="leaderboard-count">{u.totalImages || 0}</span>
                          <span className="leaderboard-label">images</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick Generation Stream */}
              <div className="admin-recent-feed-card">
                <div className="card-heading-row">
                  <div>
                    <h3 className="card-title">Live Activity Stream</h3>
                    <p className="card-subtitle">Recent batches processed in real-time</p>
                  </div>
                  <button className="admin-link-btn" onClick={() => setActiveTab('logs')}>
                    View All Logs <ChevronRight size={14} />
                  </button>
                </div>

                <div className="quick-logs-grid">
                  {logs.slice(0, 4).map(l => (
                    <div key={l.id} className="quick-log-card">
                      <div className="quick-log-top">
                        <span className="quick-log-user">{l.userName}</span>
                        <span className="quick-log-time">{formatTimeAgo(l.timestamp)}</span>
                      </div>
                      <div className="quick-log-action">{l.action}</div>
                      <div className="quick-log-bottom">
                        <span className={`provider-pill pill-${l.provider}`}>{l.provider}</span>
                        <span className="quick-log-count">{l.count || 1} images</span>
                        <span className="quick-log-badge success">{l.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USERS DIRECTORY */}
          {activeTab === 'users' && (
            <div className="users-tab-container">
              {/* Search & Filter Toolbar */}
              <div className="admin-toolbar">
                <div className="search-box">
                  <Search size={16} />
                  <input 
                    type="text" 
                    placeholder="Search by user name or email..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="toolbar-controls">
                  <select 
                    value={roleFilter} 
                    onChange={e => setRoleFilter(e.target.value)}
                    className="admin-select"
                  >
                    <option value="all">All Roles</option>
                    <option value="super_admin">Super Admins</option>
                    <option value="member">Members</option>
                  </select>

                  <button className="admin-btn-primary" onClick={() => setShowAddUserModal(true)}>
                    <UserPlus size={15} /> Add User
                  </button>
                </div>
              </div>

              {/* Users Table */}
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Images Generated</th>
                      <th>Preferred Engine</th>
                      <th>Last Active</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                          No users found matching your search.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map(u => (
                        <tr key={u.id}>
                          <td>
                            <div className="user-cell">
                              <div className="user-avatar-initials">
                                {u.avatar ? (
                                  <img src={u.avatar} alt={u.name} />
                                ) : (
                                  <span>{u.name.charAt(0).toUpperCase()}</span>
                                )}
                              </div>
                              <div className="user-cell-meta">
                                <span className="user-cell-name">{u.name}</span>
                                <span className="user-cell-email">{u.email}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`role-pill role-${u.role}`}>
                              {u.role === 'super_admin' ? 'Super Admin' : 'Member'}
                            </span>
                          </td>
                          <td>
                            <div className="count-cell">
                              <span className="count-number">{u.totalImages || 0}</span>
                              <span className="count-sub">({u.totalGenerations || 0} batches)</span>
                            </div>
                          </td>
                          <td>
                            <span className={`provider-pill pill-${u.favoriteProvider || 'gemini'}`}>
                              {u.favoriteProvider || 'Gemini'}
                            </span>
                          </td>
                          <td>
                            <span className="time-cell" title={new Date(u.lastActive).toLocaleString()}>
                              {formatTimeAgo(u.lastActive)}
                            </span>
                          </td>
                          <td>
                            <span className={`status-pill status-${u.status || 'active'}`}>
                              <span className="status-dot"></span> {u.status || 'Active'}
                            </span>
                          </td>
                          <td>
                            <div className="table-actions-cell">
                              <button 
                                className="action-icon-btn" 
                                onClick={() => handleToggleRole(u.id, u.role)}
                                title={u.role === 'super_admin' ? 'Change to Member' : 'Promote to Admin'}
                              >
                                <ShieldCheck size={16} color={u.role === 'super_admin' ? '#EC1C24' : 'var(--text-secondary)'} />
                              </button>
                              <button 
                                className="action-icon-btn danger" 
                                onClick={() => handleDeleteUser(u.id, u.email)}
                                title="Remove User"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: GENERATION & ACTIVITY LOGS */}
          {activeTab === 'logs' && (
            <div className="logs-tab-container">
              <div className="admin-toolbar">
                <div className="search-box">
                  <Search size={16} />
                  <input 
                    type="text" 
                    placeholder="Search logs by user, action, or provider..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="toolbar-controls">
                  <select 
                    value={logFilter} 
                    onChange={e => setLogFilter(e.target.value)}
                    className="admin-select"
                  >
                    <option value="all">All Actions</option>
                    <option value="metadata">Metadata Generations</option>
                    <option value="prompt">Prompt Generations</option>
                    <option value="auth">User Logins</option>
                  </select>
                </div>
              </div>

              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Provider & Model</th>
                      <th>Items</th>
                      <th>Duration</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                          No activity logs found.
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map(l => (
                        <tr key={l.id}>
                          <td>
                            <div className="timestamp-cell">
                              <span className="time-primary">{new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className="time-secondary">{new Date(l.timestamp).toLocaleDateString()}</span>
                            </div>
                          </td>
                          <td>
                            <div className="log-user-info">
                              <span className="log-user-name">{l.userName}</span>
                              <span className="log-user-email">{l.userEmail}</span>
                            </div>
                          </td>
                          <td>
                            <span className="action-text">{l.action}</span>
                          </td>
                          <td>
                            <div className="model-cell">
                              <span className={`provider-pill pill-${l.provider}`}>{l.provider}</span>
                              <span className="model-name">{l.model}</span>
                            </div>
                          </td>
                          <td>
                            <span className="count-number">{l.count || 1}</span>
                          </td>
                          <td>
                            <span className="time-secondary">{l.duration || '1.8s'}</span>
                          </td>
                          <td>
                            <span className={`status-pill status-${l.status === 'success' ? 'active' : 'error'}`}>
                              <span className="status-dot"></span> {l.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: MODEL & SYSTEM ANALYTICS */}
          {activeTab === 'analytics' && stats && (
            <div className="analytics-tab-container">
              <div className="analytics-cards-row">
                {/* Engine Comparison */}
                <div className="analytics-card">
                  <h3 className="card-title">AI Engine Workload Distribution</h3>
                  <p className="card-subtitle">Comparison between Gemini and Groq requests</p>
                  
                  <div className="engine-breakdown">
                    <div className="engine-stat-block">
                      <div className="engine-badge gemini">Google Gemini</div>
                      <span className="engine-percentage">{stats.geminiPercentage}%</span>
                      <span className="engine-details">{stats.geminiCount} images processed</span>
                      <p className="engine-desc">Multi-modal vision analysis (2.5 Flash, 3.1 Flash-Lite)</p>
                    </div>

                    <div className="engine-divider-v"></div>

                    <div className="engine-stat-block">
                      <div className="engine-badge groq">Groq Vision</div>
                      <span className="engine-percentage">{stats.groqPercentage}%</span>
                      <span className="engine-details">{stats.groqCount} images processed</span>
                      <p className="engine-desc">Ultra fast inference with Llama-4 Scout & Maverick</p>
                    </div>
                  </div>

                  <div className="usage-progress-bar">
                    <div className="progress-seg gemini" style={{ width: `${stats.geminiPercentage}%` }}></div>
                    <div className="progress-seg groq" style={{ width: `${stats.groqPercentage}%` }}></div>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="analytics-card">
                  <h3 className="card-title">Efficiency & Savings Summary</h3>
                  <p className="card-subtitle">Estimated performance gains for your users</p>

                  <div className="efficiency-grid">
                    <div className="eff-item">
                      <span className="eff-label">Avg Keywords per Image</span>
                      <span className="eff-val">38.4</span>
                      <span className="eff-sub">Full commercial stock tagsets</span>
                    </div>
                    <div className="eff-item">
                      <span className="eff-label">Average Response Time</span>
                      <span className="eff-val">{stats.avgDuration || '0.00s'}</span>
                      <span className="eff-sub">Real API response latency</span>
                    </div>
                    <div className="eff-item">
                      <span className="eff-label">API Success Rate</span>
                      <span className="eff-val">{stats.successRate}%</span>
                      <span className="eff-sub">Based on live generation logs</span>
                    </div>
                    <div className="eff-item">
                      <span className="eff-label">Total Batches Completed</span>
                      <span className="eff-val">{stats.totalGenerations} batches</span>
                      <span className="eff-sub">Tracked in real time</span>
                    </div>
                    <div className="eff-item">
                      <span className="eff-label">CSV Export Deliveries</span>
                      <span className="eff-val">{stats.totalExports || 0} exports</span>
                      <span className="eff-sub">Downloaded spreadsheet files</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Maintenance & Reset Box */}
              <div className="admin-danger-zone">
                <div>
                  <h4 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: '600' }}>Live Telemetry & Data Controls</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>
                    Reset all counters to clean 0 and purge any old cached mock data.
                  </p>
                </div>
                <button className="admin-btn-secondary danger" onClick={handleResetRealData}>
                  <RefreshCw size={14} /> Reset All To 0 & Sync Real
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal: Add New User */}
        {showAddUserModal && (
          <div className="sub-modal-overlay" onClick={() => setShowAddUserModal(false)}>
            <div className="sub-modal-card" onClick={e => e.stopPropagation()}>
              <div className="sub-modal-header">
                <h3>Add User to Directory</h3>
                <X size={18} style={{ cursor: 'pointer' }} onClick={() => setShowAddUserModal(false)} />
              </div>
              <form onSubmit={handleAddUser} className="sub-modal-form">
                <div className="sub-form-group">
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Shakil Ahmed" 
                    value={newUserName}
                    onChange={e => setNewUserName(e.target.value)}
                  />
                </div>
                <div className="sub-form-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    placeholder="e.g. shakil@example.com" 
                    required 
                    value={newUserEmail}
                    onChange={e => setNewUserEmail(e.target.value)}
                  />
                </div>
                <div className="sub-modal-actions">
                  <button type="button" className="admin-btn-secondary" onClick={() => setShowAddUserModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="admin-btn-accent">
                    Save User
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
