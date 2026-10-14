import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Settings, 
  Key, 
  Plus, 
  Trash2, 
  Download, 
  Play, 
  Image as ImageIcon,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  X,
  Eye,
  EyeOff,
  Sparkles,
  Type,
  Database,
  Terminal,
  Cpu,
  Copy,
  RefreshCw,
  Clock,
  ShieldCheck,
  Users,
  Lock,
  Unlock,
  FileText,
  Paperclip
} from 'lucide-react';
import Papa from 'papaparse';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { groqService } from './services/groq';
import { geminiService } from './services/gemini';
import GroqService from './services/groq';
import AdminPanel from './components/AdminPanel';
import statsTracker from './services/statsTracker';
import { isEpsFile, extractEpsPreview, getBaseFileName, normalizeBaseFileName } from './services/epsHandler';
import { isVideoFile, extractVideoMetadataAndFrame } from './services/videoHandler';
import './App.css';

const providerModels = {
  groq: [
    { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout" },
    { id: "meta-llama/llama-4-maverick-17b-128e-instruct", name: "Llama 4 Maverick" }
  ],
  gemini: [
    { id: "gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash-Lite (Preview)" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite" },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
    { id: "gemini-3-flash", name: "Gemini 3 Flash (Preview)" }
  ]
};

const DetailsModal = ({ isOpen, onClose, image, activeMode, activeProvider, onRegenerate }) => {
  if (!isOpen || !image) return null;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal details-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>{image.isVideo ? 'Video Details' : 'Image Details'}</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{image.file.name}</p>
          </div>
          <X size={24} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={onClose} />
        </div>
        
        <div className="details-modal-content">
          <div className="details-image-view">
            {image.isVideo && image.videoUrl ? (
              <video 
                src={image.videoUrl} 
                controls 
                autoPlay 
                className="details-video-player"
              />
            ) : image.preview ? (
              <img src={image.preview} alt="Large preview" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '220px', color: 'var(--text-secondary)' }}>
                <FileText size={48} color="#EC1C24" />
                <p style={{ marginTop: '12px', fontSize: '0.85rem' }}>No preview available for this file</p>
              </div>
            )}
          </div>
          <div className="details-info-view">
            {image.status === 'done' ? (
              activeMode === 'metadata' && image.metadata ? (
                <div className="details-sections">
                  <div className="detail-section">
                    <div className="section-header">
                      <p className="section-title">Title</p>
                      <button className="copy-btn-small" onClick={() => copyToClipboard(image.metadata.title)}>
                        <Copy size={14} /> Copy
                      </button>
                    </div>
                    <p className="detail-text">{image.metadata.title}</p>
                  </div>

                  <div className="detail-section">
                    <div className="section-header">
                      <p className="section-title">Description</p>
                      <button className="copy-btn-small" onClick={() => copyToClipboard(image.metadata.description)}>
                        <Copy size={14} /> Copy
                      </button>
                    </div>
                    <p className="detail-text">{image.metadata.description}</p>
                  </div>

                  <div className="detail-section">
                    <div className="section-header">
                      <p className="section-title">Keywords ({image.metadata.keywords.length})</p>
                      <button className="copy-btn-small" onClick={() => copyToClipboard(image.metadata.keywords.join(', '))}>
                        <Copy size={14} /> Copy
                      </button>
                    </div>
                    <div className="card-keywords" style={{ maxHeight: 'none', overflow: 'visible' }}>
                      {image.metadata.keywords.map((kw, i) => (
                        <span key={i} className="keyword-tag" style={{ 
                          background: 'rgba(236, 28, 36, 0.1)', 
                          color: '#EC1C24' 
                        }}>
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="detail-section">
                  <div className="section-header">
                    <p className="section-title">Generated Prompt</p>
                    <button className="copy-btn-small" onClick={() => copyToClipboard(image.promptOutput)}>
                      <Copy size={14} /> Copy
                    </button>
                  </div>
                  <p className="detail-text italic">"{image.promptOutput}"</p>
                </div>
              )
            ) : (
              <div className="details-loading">
                <p>Status: {image.status}</p>
                {image.status === 'error' && <p className="error-text">{image.error}</p>}
              </div>
            )}
            
            <div className="details-footer-actions">
                <button 
                  className="regen-btn-full" 
                  onClick={() => onRegenerate(image.id)}
                  disabled={image.status === 'generating'}
                >
                  <RefreshCw size={18} className={image.status === 'generating' ? 'animate-spin' : ''} />
                  {image.status === 'generating' ? 'Regenerating...' : 'Regenerate This Image'}
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ApiKeysModal = ({ isOpen, onClose, apiKeys, onAddKey, onRemoveKey, activeProvider, setActiveProvider }) => {
  const [newKey, setNewKey] = useState('');
  const [showKeys, setShowKeys] = useState({});
  const [modalProvider, setModalProvider] = useState(activeProvider);

  const toggleKeyVisibility = (idx) => {
    setShowKeys(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>API Keys Management</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Manage your AI provider API keys. Keys are stored locally and securely.
            </p>
          </div>
          <X size={24} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={onClose} />
        </div>
        
        <div className="modal-content">
          <div className="api-management-layout">
            <div className="providers-sidebar">
              <p className="section-title">Select AI Provider</p>
              <div 
                className={`provider-card ${modalProvider === 'groq' ? 'active' : ''}`}
                onClick={() => setModalProvider('groq')}
              >
                <span className="provider-badge badge-free">Free</span>
                <div className="provider-card-header">
                  <Cpu size={20} color="#EC1C24" />
                  <div className="provider-card-info">
                    <h4>Groq</h4>
                    <p>{activeProvider === 'groq' ? 'Active' : 'Set Active'}</p>
                  </div>
                </div>
              </div>
              <div 
                className={`provider-card ${modalProvider === 'gemini' ? 'active' : ''}`}
                onClick={() => setModalProvider('gemini')}
              >
                <span className="provider-badge badge-both">Free & Paid</span>
                <div className="provider-card-header">
                  <Sparkles size={20} color="#EC1C24" />
                  <div className="provider-card-info">
                    <h4>Google Gemini</h4>
                    <p>{activeProvider === 'gemini' ? 'Active' : 'Set Active'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="provider-details">
              <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h3 style={{ marginBottom: '0.5rem' }}>
                        {modalProvider === 'groq' ? 'Groq Configuration' : 'Gemini Configuration'}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {modalProvider === 'groq' 
                        ? "Groq's advanced AI models for ultrafast image analysis."
                        : "Google's most capable AI models for multimodal tasks."
                    }
                    </p>
                </div>
                {activeProvider === modalProvider ? (
                    <button 
                        className="provider-status-btn active"
                        disabled
                    >
                        {modalProvider === 'groq' ? 'Groq Active' : 'Gemini Active'}
                    </button>
                ) : (
                    <button 
                        className="provider-status-btn activate"
                        onClick={() => setActiveProvider(modalProvider)}
                    >
                        Activate {modalProvider === 'groq' ? 'Groq' : 'Gemini'}
                    </button>
                )}
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <p className="section-title">Add New Key</p>
                <div className="api-input-wrapper">
                  <input 
                    type="password" 
                    placeholder={`Enter ${modalProvider === 'groq' ? 'Groq' : 'Gemini'} API key`}
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter' && newKey.trim()) {
                            onAddKey(modalProvider, newKey.trim());
                            setNewKey('');
                        }
                    }}
                  />
                  <button 
                    onClick={() => {
                        if (newKey.trim()) {
                            onAddKey(modalProvider, newKey.trim());
                            setNewKey('');
                        }
                    }} 
                    style={{ background: '#EC1C24', padding: '0.75rem' }}
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <a 
                  href={modalProvider === 'groq' ? "https://console.groq.com/keys" : "https://aistudio.google.com/app/apikey"}
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.75rem', color: '#EC1C24', textDecoration: 'none', display: 'inline-block', marginTop: '0.75rem' }}
                >
                  <Terminal size={12} style={{ marginRight: '4px' }} /> Get {modalProvider === 'groq' ? 'Groq' : 'Gemini'} API Key
                </a>
              </div>

              <div>
                <p className="section-title">Stored Keys ({apiKeys[modalProvider]?.length || 0})</p>
                <div className="stored-keys-container">
                  {(apiKeys[modalProvider] || []).map((key, idx) => (
                    <div key={idx} className="stored-key-item">
                      <code style={{ fontSize: '0.85rem' }}>
                        {showKeys[idx] ? key : `••••••••${key.slice(-4)}`}
                      </code>
                      <div className="key-actions">
                        {showKeys[idx] ? 
                          <EyeOff size={16} onClick={() => toggleKeyVisibility(idx)} /> : 
                          <Eye size={16} onClick={() => toggleKeyVisibility(idx)} />
                        }
                        <Trash2 size={16} className="trash" onClick={() => onRemoveKey(modalProvider, key)} />
                      </div>
                    </div>
                  ))}
                  {(apiKeys[modalProvider]?.length || 0) === 0 && (
                    <p style={{ textAlign: 'center', color: '#444', fontSize: '0.85rem', padding: '2rem' }}>
                      No keys stored. Add an API key to start generating.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

const RangeSlider = ({ min, max, value, onChange, label, unit }) => {
  const minPos = ((value[0] - min) / (max - min)) * 100;
  const maxPos = ((value[1] - min) / (max - min)) * 100;

  return (
    <div className="control-item">
      <div className="control-label">
        <span>{label}</span>
        <span className="control-value">{value[0]} - {value[1]} {unit}</span>
      </div>
      <div className="range-slider-wrapper">
        <div className="range-slider-track" />
        <div 
          className="range-slider-progress" 
          style={{ 
            left: `${minPos}%`, 
            right: `${100 - maxPos}%` 
          }} 
        />
        <div className="range-input-container">
          <input 
            type="range" 
            min={min} 
            max={max} 
            value={value[0]} 
            onChange={(e) => {
              const val = Math.min(parseInt(e.target.value), value[1] - 1);
              onChange([val, value[1]]);
            }}
          />
          <input 
            type="range" 
            min={min} 
            max={max} 
            value={value[1]} 
            onChange={(e) => {
              const val = Math.max(parseInt(e.target.value), value[0] + 1);
              onChange([value[0], val]);
            }}
          />
        </div>
      </div>
    </div>
  );
};

const Switch = ({ enabled, onChange }) => {
  return (
    <div 
      className={`switch-container ${enabled ? 'active' : ''}`} 
      style={{ background: enabled ? '#EC1C24' : 'rgba(255, 255, 255, 0.1)' }}
      onClick={() => onChange(!enabled)}
    >
      <div className="switch-handle" />
    </div>
  );
};

         {/* Custom Select for AI Model to avoid OS blue highlight */}
const CustomSelect = ({ value, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.id === value) || options[0];

  return (
    <div className="custom-select-wrapper" style={{ position: 'relative', width: '100%', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
      <div 
        className="custom-select-trigger"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: '#323031',
          border: `1px solid ${isOpen ? '#EC1C24' : 'var(--border-color)'}`,
          borderRadius: '10px',
          padding: '0.75rem',
          color: 'white',
          fontSize: '0.875rem',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'border-color 0.2s'
        }}
      >
        {selectedOption.name}
        <ChevronDown size={16} style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </div>
      
      {isOpen && (
        <div 
          className="custom-select-options"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            background: '#323031',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            overflow: 'hidden',
            zIndex: 50,
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}
        >
          {options.map((option) => (
            <div
              key={option.id}
              className="custom-select-option"
              onClick={() => {
                onChange(option.id);
                setIsOpen(false);
              }}
              style={{
                padding: '0.75rem',
                color: 'white',
                fontSize: '0.875rem',
                cursor: 'pointer',
                background: 'transparent',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => {
                // Apply red hover to ALL items when hovered
                e.target.style.background = '#EC1C24';
              }}
              onMouseLeave={(e) => {
                // Revert background to transparent
                e.target.style.background = 'transparent';
              }}
            >
              {option.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const App = () => {
  const [images, setImages] = useState([]);
  const [apiKeys, setApiKeys] = useState(() => {
    const saved = localStorage.getItem('dmatadata_keys_v2');
    if (saved) return JSON.parse(saved);
    const oldSaved = localStorage.getItem('dmatadata_keys');
    if (oldSaved) return { groq: JSON.parse(oldSaved), gemini: [] };
    return { groq: [], gemini: [] };
  });
  const [activeProvider, setActiveProvider] = useState(() => {
    return localStorage.getItem('dmatadata_active_provider') || 'groq';
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeMode, setActiveMode] = useState('metadata'); 
  const [showModal, setShowModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [stats, setStats] = useState({ total: 0, completed: 0 });
  const [isDragging, setIsDragging] = useState(false);
  // Admin Credentials & Authentication
  const ADMIN_CREDENTIALS = {
    email: 'diptag22@gmail.com',
    password: '8459512'
  };

  const DEFAULT_PREVIEW_USER = {
    name: 'Guest User',
    email: 'guest@gfxmetadata.com',
    avatar: null,
    role: 'member'
  };

  const REQUIRE_LOGIN = false;
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('miti_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email && parsed.email !== 'guest@gfxmetadata.com') {
          return parsed;
        }
      } catch {}
    }
    return null;
  });

  const isLoggedIn = !!user && user.email !== 'guest@gfxmetadata.com';

  const [showLoginModal, setShowLoginModal] = useState(() => {
    const saved = localStorage.getItem('miti_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email && parsed.email !== 'guest@gfxmetadata.com') {
          return false;
        }
      } catch {}
    }
    return true;
  });

  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminAuthEmail, setAdminAuthEmail] = useState('');
  const [adminAuthPassword, setAdminAuthPassword] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');

  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const [isAdmin, setIsAdmin] = useState(() => {
    const saved = localStorage.getItem('miti_user');
    const adminAuth = localStorage.getItem('gfx_admin_auth') === 'true';
    if (saved && adminAuth) {
      try {
        const u = JSON.parse(saved);
        return (u.email || '').toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase();
      } catch {}
    }
    return false;
  });

  const isDiptaAdmin = isAdmin && ((user?.email || '').toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase() || (user?.email || '').toLowerCase() === 'mirzapurit@gmail.com');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginError, setLoginError] = useState(null);

  const handleAdminLogin = (e) => {
    e.preventDefault();
    const emailClean = adminAuthEmail.trim().toLowerCase();
    const passClean = adminAuthPassword.trim();

    if (emailClean === ADMIN_CREDENTIALS.email.toLowerCase() && passClean === ADMIN_CREDENTIALS.password) {
      setIsAdmin(true);
      localStorage.setItem('gfx_admin_auth', 'true');
      setShowAdminLoginModal(false);
      setAdminAuthError('');
      setAdminAuthEmail('');
      setAdminAuthPassword('');
      setShowAdminPanel(true);

      const adminUser = {
        name: 'Dipta (Super Admin)',
        email: ADMIN_CREDENTIALS.email,
        avatar: null,
        role: 'super_admin'
      };
      setUser(adminUser);
      localStorage.setItem('miti_user', JSON.stringify(adminUser));
      statsTracker.recordLogin(adminUser);
    } else {
      setAdminAuthError('Invalid Admin ID or Password! Access denied.');
    }
  };

  useEffect(() => {
    if (user) {
      statsTracker.recordLogin(user);
    }
  }, []);

  const handleLoginSuccess = (credentialResponse) => {
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      const email = (decoded.email || '').toLowerCase();
      const isSuperAdmin = email === ADMIN_CREDENTIALS.email.toLowerCase() || email === 'mirzapurit@gmail.com';
      const googleUser = {
        name: decoded.name || (isSuperAdmin ? 'Admin User' : 'User'),
        email: decoded.email,
        avatar: decoded.picture || 'https://lh3.googleusercontent.com/a/default-user',
        role: isSuperAdmin ? 'super_admin' : 'member'
      };
      setUser(googleUser);
      setIsAdmin(isSuperAdmin);
      if (isSuperAdmin) {
        localStorage.setItem('gfx_admin_auth', 'true');
      } else {
        localStorage.removeItem('gfx_admin_auth');
      }
      localStorage.setItem('miti_user', JSON.stringify(googleUser));
      statsTracker.recordLogin(googleUser);
      setShowLoginModal(false);
      setLoginError(null);
    } catch (error) {
      console.error('Failed to decode Google JWT:', error);
      setLoginError('Could not process Google profile. Please try again.');
    }
  };

  const handleDirectGoogleLogin = (email = 'mirzapurit@gmail.com', name = 'Mirzapur IT', role = 'super_admin') => {
    const isSuperAdmin = email.toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase() || email.toLowerCase() === 'mirzapurit@gmail.com';
    const googleUser = {
      name: name,
      email: email,
      avatar: 'https://lh3.googleusercontent.com/a/default-user',
      role: isSuperAdmin ? 'super_admin' : role
    };
    setUser(googleUser);
    setIsAdmin(isSuperAdmin);
    if (isSuperAdmin) {
      localStorage.setItem('gfx_admin_auth', 'true');
    } else {
      localStorage.removeItem('gfx_admin_auth');
    }
    localStorage.setItem('miti_user', JSON.stringify(googleUser));
    statsTracker.recordLogin(googleUser);
    setShowLoginModal(false);
    setLoginError(null);
  };

  const handleEmailLogin = (e) => {
    e.preventDefault();
    if (!loginEmail.trim()) return;
    const cleanEmail = loginEmail.trim().toLowerCase();
    const isDipta = cleanEmail === ADMIN_CREDENTIALS.email.toLowerCase();

    if (isDipta) {
      if (adminAuthPassword.trim() === ADMIN_CREDENTIALS.password) {
        const adminUser = {
          name: 'Dipta (Super Admin)',
          email: ADMIN_CREDENTIALS.email,
          avatar: null,
          role: 'super_admin'
        };
        setUser(adminUser);
        setIsAdmin(true);
        localStorage.setItem('gfx_admin_auth', 'true');
        localStorage.setItem('miti_user', JSON.stringify(adminUser));
        statsTracker.recordLogin(adminUser);
        setShowLoginModal(false);
        setAdminAuthPassword('');
        setLoginEmail('');
        setLoginError(null);
      } else {
        setLoginError('Incorrect Admin Password for diptag22@gmail.com!');
      }
      return;
    }

    const username = cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail;
    const regularUser = {
      name: username.charAt(0).toUpperCase() + username.slice(1),
      email: cleanEmail.includes('@') ? cleanEmail : `${cleanEmail}@example.com`,
      avatar: null,
      role: 'member'
    };
    setUser(regularUser);
    setIsAdmin(false);
    localStorage.removeItem('gfx_admin_auth');
    localStorage.setItem('miti_user', JSON.stringify(regularUser));
    statsTracker.recordLogin(regularUser);
    setShowLoginModal(false);
    setLoginEmail('');
    setAdminAuthPassword('');
    setLoginError(null);
  };

  const DEFAULT_SETTINGS = {
    titleLen: [20, 200],
    descLen: [100, 150],
    keywordCount: [10, 50],
    isSingleKeyword: false,
    promptLen: [400, 600],
    prefixEnabled: false,
    prefixText: '',
    suffixEnabled: false,
    suffixText: ''
  };

  const resetSettingsToDefault = () => {
    localStorage.removeItem('gfx_user_settings');
    setTitleLen(DEFAULT_SETTINGS.titleLen);
    setDescLen(DEFAULT_SETTINGS.descLen);
    setKeywordCount(DEFAULT_SETTINGS.keywordCount);
    setIsSingleKeyword(DEFAULT_SETTINGS.isSingleKeyword);
    setPromptLen(DEFAULT_SETTINGS.promptLen);
    setPrefixEnabled(DEFAULT_SETTINGS.prefixEnabled);
    setPrefixText(DEFAULT_SETTINGS.prefixText);
    setSuffixEnabled(DEFAULT_SETTINGS.suffixEnabled);
    setSuffixText(DEFAULT_SETTINGS.suffixText);
  };

  const handleLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('gfx_admin_auth');
    setUser(null);
    localStorage.removeItem('miti_user');
    setShowAdminPanel(false);
    setShowAdminLoginModal(false);
    setShowLoginModal(true);
    resetSettingsToDefault();
  };

  const handleAdminLogout = () => {
    handleLogout();
  };

  // Settings with persistence until logout
  const [titleLen, setTitleLen] = useState(() => {
    try {
      const saved = localStorage.getItem('gfx_user_settings');
      if (saved) return JSON.parse(saved).titleLen || [20, 200];
    } catch {}
    return [20, 200];
  });
  const [descLen, setDescLen] = useState(() => {
    try {
      const saved = localStorage.getItem('gfx_user_settings');
      if (saved) return JSON.parse(saved).descLen || [100, 150];
    } catch {}
    return [100, 150];
  });
  const [keywordCount, setKeywordCount] = useState(() => {
    try {
      const saved = localStorage.getItem('gfx_user_settings');
      if (saved) return JSON.parse(saved).keywordCount || [10, 50];
    } catch {}
    return [10, 50];
  });
  const [isSingleKeyword, setIsSingleKeyword] = useState(() => {
    try {
      const saved = localStorage.getItem('gfx_user_settings');
      if (saved) return !!JSON.parse(saved).isSingleKeyword;
    } catch {}
    return false;
  });
  const [selectedModel, setSelectedModel] = useState("meta-llama/llama-4-scout-17b-16e-instruct");
  const [promptLen, setPromptLen] = useState(() => {
    try {
      const saved = localStorage.getItem('gfx_user_settings');
      if (saved) return JSON.parse(saved).promptLen || [400, 600];
    } catch {}
    return [400, 600];
  });

  // Prefix & Suffix Settings
  const [prefixEnabled, setPrefixEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('gfx_user_settings');
      if (saved) return !!JSON.parse(saved).prefixEnabled;
    } catch {}
    return false;
  });
  const [prefixText, setPrefixText] = useState(() => {
    try {
      const saved = localStorage.getItem('gfx_user_settings');
      if (saved) return JSON.parse(saved).prefixText || '';
    } catch {}
    return '';
  });
  const [suffixEnabled, setSuffixEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('gfx_user_settings');
      if (saved) return !!JSON.parse(saved).suffixEnabled;
    } catch {}
    return false;
  });
  const [suffixText, setSuffixText] = useState(() => {
    try {
      const saved = localStorage.getItem('gfx_user_settings');
      if (saved) return JSON.parse(saved).suffixText || '';
    } catch {}
    return '';
  });

  const [saveSettingsSuccess, setSaveSettingsSuccess] = useState(false);

  const handleSaveSettings = () => {
    const settingsToSave = {
      titleLen,
      descLen,
      keywordCount,
      isSingleKeyword,
      promptLen,
      prefixEnabled,
      prefixText,
      suffixEnabled,
      suffixText
    };
    localStorage.setItem('gfx_user_settings', JSON.stringify(settingsToSave));
    setSaveSettingsSuccess(true);
    setTimeout(() => {
      setSaveSettingsSuccess(false);
    }, 2000);
  };

  useEffect(() => {
    localStorage.setItem('dmatadata_keys_v2', JSON.stringify(apiKeys));
    localStorage.setItem('dmatadata_active_provider', activeProvider);
    groqService.setApiKeys(apiKeys.groq || []);
    geminiService.setApiKeys(apiKeys.gemini || []);
    
    // Ensure selected model belongs to active provider
    if (!providerModels[activeProvider].some(m => m.id === selectedModel)) {
        setSelectedModel(providerModels[activeProvider][0].id);
    }
  }, [apiKeys, activeProvider, selectedModel]);

  const handleFiles = async (rawFiles) => {
    if (!rawFiles || rawFiles.length === 0) return;
    if (!isLoggedIn) {
      setLoginError('Please sign in to upload media and generate metadata.');
      setShowLoginModal(true);
      return;
    }
    const files = Array.from(rawFiles);
    
    const videoFiles = [];
    const epsFiles = [];
    const rasterFiles = [];

    files.forEach(f => {
      if (isVideoFile(f)) {
        videoFiles.push(f);
      } else if (isEpsFile(f)) {
        epsFiles.push(f);
      } else {
        rasterFiles.push(f);
      }
    });

    const matchedRasterNames = new Set();
    const newItems = [];

    // Process Video files
    for (const vf of videoFiles) {
      const id = Math.random().toString(36).substr(2, 9);
      const videoBlobUrl = URL.createObjectURL(vf);
      newItems.push({
        id,
        file: vf,
        isVideo: true,
        isEps: false,
        previewFile: null,
        pairedWith: null,
        preview: null,
        previewDataUrl: null,
        videoUrl: videoBlobUrl,
        isExtractingPreview: true,
        videoInfo: null,
        status: 'pending',
        metadata: null,
        promptOutput: null,
        error: null
      });

      // Background video metadata & keyframe extraction
      extractVideoMetadataAndFrame(vf).then(res => {
        setImages(prev => prev.map(img => {
          if (img.id !== id) return img;
          return {
            ...img,
            preview: res.previewDataUrl,
            previewDataUrl: res.previewDataUrl,
            videoUrl: res.videoUrl || videoBlobUrl,
            videoInfo: res,
            isExtractingPreview: false
          };
        }));
      }).catch(err => {
        setImages(prev => prev.map(img => {
          if (img.id !== id) return img;
          return {
            ...img,
            isExtractingPreview: false,
            error: 'Video decode failed: ' + (err.message || 'unsupported format')
          };
        }));
      });
    }

    // Process EPS files first, checking for paired JPG/PNG previews
    for (const eps of epsFiles) {
      const epsBase = normalizeBaseFileName(eps.name);
      // Look for a raster file with matching base name (supports artboards like 'Tiny and Mighty-01.png' matching 'Tiny and Mighty.eps')
      const matchingRaster = rasterFiles.find(
        r => !matchedRasterNames.has(r.name) && (
          normalizeBaseFileName(r.name) === epsBase ||
          getBaseFileName(r.name).toLowerCase() === getBaseFileName(eps.name).toLowerCase()
        )
      );

      const id = Math.random().toString(36).substr(2, 9);

      if (matchingRaster) {
        matchedRasterNames.add(matchingRaster.name);
        const ext = matchingRaster.name.split('.').pop().toUpperCase();
        newItems.push({
          id,
          file: eps,
          isEps: true,
          previewFile: matchingRaster,
          pairedWith: matchingRaster.name,
          pairedType: ext,
          preview: URL.createObjectURL(matchingRaster),
          previewDataUrl: null,
          isExtractingPreview: false,
          status: 'pending',
          metadata: null,
          promptOutput: null,
          error: null
        });
      } else {
        // Standalone EPS: Add with extracting state, then extract asynchronously
        newItems.push({
          id,
          file: eps,
          isEps: true,
          previewFile: null,
          pairedWith: null,
          preview: null,
          previewDataUrl: null,
          isExtractingPreview: true,
          status: 'pending',
          metadata: null,
          promptOutput: null,
          error: null
        });

        // Run background extraction
        extractEpsPreview(eps).then(result => {
          setImages(prev => prev.map(img => {
            if (img.id !== id) return img;
            if (result.success && result.dataUrl) {
              return {
                ...img,
                preview: result.dataUrl,
                previewDataUrl: result.dataUrl,
                isExtractingPreview: false
              };
            } else {
              return {
                ...img,
                isExtractingPreview: false,
                epsError: result.message || 'No embedded preview in EPS'
              };
            }
          }));
        });
      }
    }

    // Process remaining raster files that were not paired with an EPS
    rasterFiles.forEach(rf => {
      if (!matchedRasterNames.has(rf.name)) {
        newItems.push({
          id: Math.random().toString(36).substr(2, 9),
          file: rf,
          isEps: false,
          previewFile: null,
          pairedWith: null,
          preview: URL.createObjectURL(rf),
          previewDataUrl: null,
          isExtractingPreview: false,
          status: 'pending',
          metadata: null,
          promptOutput: null,
          error: null
        });
      }
    });

    setImages(prev => [...prev, ...newItems]);
  };

  const handleFileUpload = (e) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
    e.target.value = '';
  };

  const handleAttachPreview = (imgId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setImages(prev => prev.map(img => {
      if (img.id !== imgId) return img;
      return {
        ...img,
        preview: previewUrl,
        previewFile: file,
        pairedWith: file.name,
        isExtractingPreview: false,
        epsError: null,
        error: null
      };
    }));
    e.target.value = '';
  };

  const getImageBase64 = async (img) => {
    if (img.previewDataUrl) {
      return img.previewDataUrl;
    }
    if (img.previewFile) {
      return await GroqService.fileToBase64(img.previewFile);
    }
    if (img.previewBlob) {
      return await GroqService.fileToBase64(img.previewBlob);
    }
    if (img.isEps && !img.preview) {
      throw new Error('This .eps vector has no preview image. Please click "Attach JPG" to attach a preview.');
    }
    if (img.isVideo && !img.previewDataUrl && !img.preview) {
      throw new Error('Video frame preview is still processing. Please wait a moment.');
    }
    return await GroqService.fileToBase64(img.file);
  };

  const addApiKey = (provider, key) => {
    if (key && !apiKeys[provider].includes(key)) {
      setApiKeys(prev => ({
        ...prev,
        [provider]: [...prev[provider], key]
      }));
    }
  };

  const removeApiKey = (provider, key) => {
    setApiKeys(prev => ({
      ...prev,
      [provider]: prev[provider].filter(k => k !== key)
    }));
  };

  const deleteImage = (id) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const generateSingle = async (imgId) => {
    if (!isLoggedIn) {
      setLoginError('Please sign in to generate metadata.');
      setShowLoginModal(true);
      return;
    }

    const currentKeys = apiKeys[activeProvider];
    if (!currentKeys || currentKeys.length === 0) {
      setShowModal(true);
      return;
    }

    const img = images.find(i => i.id === imgId);
    if (!img) return;

    if (img.isEps && !img.preview && !img.previewFile) {
      setImages(prev => prev.map(i => i.id === img.id ? { 
        ...i, 
        status: 'error', 
        error: 'No preview available for this EPS. Please click "Attach JPG" to attach a preview.' 
      } : i));
      return;
    }

    if (img.isVideo && !img.preview) {
      setImages(prev => prev.map(i => i.id === img.id ? { 
        ...i, 
        status: 'error', 
        error: 'Video preview frame is still extracting. Please wait a moment.' 
      } : i));
      return;
    }

    setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'generating', error: null } : i));

    const service = activeProvider === 'groq' ? groqService : geminiService;

    // Calculate Prefix/Suffix impact
    const preText = prefixEnabled ? prefixText.trim() : '';
    const sufText = suffixEnabled ? suffixText.trim() : '';
    const fixedLen = (preText ? preText.length + 1 : 0) + (sufText ? sufText.length + 1 : 0);
    
    // Adjust target length for AI (Give it a slightly tighter window so smart-truncation is safer)
    // Always aim slightly above the min to ensure complete sentence.
    const adjustedTitleLen = [
      Math.max(10, titleLen[0] - fixedLen + 5),
      Math.max(20, titleLen[1] - fixedLen)
    ];

    try {
      const base64 = await getImageBase64(img);
      
      let result;
        if (activeMode === 'metadata') {
           const isPng = img.previewFile ? (img.previewFile.type === 'image/png') : (img.file.type === 'image/png');
           result = await service.generateMetadata(base64, {
             titleLen: adjustedTitleLen,
             descLen,
             keywordCount,
             isSingleKeyword,
             isPng,
             isVideo: img.isVideo,
             videoInfo: img.videoInfo,
             model: selectedModel
           });

          // Apply Prefix and Suffix and ENFORCE STRICT LIMITS
          let finalTitle = (result.title || '').trim().replace(/\.+$/, '');
          if (preText) finalTitle = `${preText} ${finalTitle}`.trim();
          if (sufText) finalTitle = `${finalTitle} ${sufText}`.trim();

          // Extreme Truncation if still too long
          if (finalTitle.length > titleLen[1]) {
            let truncated = finalTitle.substring(0, titleLen[1]);
            
            // Try to truncate at the last punctuation mark to keep it sentence-like
            const lastPunc = Math.max(truncated.lastIndexOf(','), truncated.lastIndexOf(';'), truncated.lastIndexOf('-'));
            if (lastPunc > titleLen[0]) {
               truncated = truncated.substring(0, lastPunc);
            } else {
               // Fallback: Smart truncate to last complete word
               const lastSpaceIndex = truncated.lastIndexOf(' ');
               if (lastSpaceIndex > Math.max(0, titleLen[0] - 20)) {
                   truncated = truncated.substring(0, lastSpaceIndex);
               }
            }
            
            // remove trailing junk
            truncated = truncated.replace(/[,;\-\s.]+$/, '');
            finalTitle = truncated.trim();
          }
          
          // Ensure no trailing period
          finalTitle = finalTitle.replace(/\.+$/, '');
          // Padding if too short (extra spaces or dots as last resort, but AI should handle min)
          console.warn("Title below minimum", finalTitle.length, titleLen[0]);

          // Enforce Keyword Count
          let finalKeywords = result.keywords || [];
          if (finalKeywords.length > keywordCount[1]) {
            finalKeywords = finalKeywords.slice(0, keywordCount[1]);
          }

          // Enforce Description Length
          let finalDesc = result.description || '';
          if (finalDesc.length > descLen[1]) {
            finalDesc = finalDesc.substring(0, descLen[1]).trim();
          }

          setImages(prev => prev.map(i => i.id === img.id ? { 
            ...i, 
            status: 'done', 
            metadata: { 
              title: finalTitle,
              keywords: finalKeywords,
              description: finalDesc
            } 
          } : i));
        } else {
          result = await service.generatePrompt(base64, {
            model: selectedModel,
            promptLen,
            isVideo: img.isVideo,
            videoInfo: img.videoInfo
          });
          setImages(prev => prev.map(i => i.id === img.id ? { 
            ...i, 
            status: 'done', 
            promptOutput: result 
          } : i));
        }

        statsTracker.recordGeneration({
          user,
          provider: activeProvider,
          model: selectedModel,
          mode: activeMode,
          count: 1,
          success: true
        });
    } catch (error) {
      setImages(prev => prev.map(i => i.id === img.id ? { 
        ...i, 
        status: 'error', 
        error: error.message 
      } : i));
    }
  };

  const generateAll = async () => {
    if (!isLoggedIn) {
      setLoginError('Please sign in to generate metadata.');
      setShowLoginModal(true);
      return;
    }

    const currentKeys = apiKeys[activeProvider];
    if (!currentKeys || currentKeys.length === 0) {
      setShowModal(true);
      return;
    }

    setIsGenerating(true);
    const pendingImages = images.filter(img => img.status !== 'done');
    setStats({ total: pendingImages.length, completed: 0 });

    const service = activeProvider === 'groq' ? groqService : geminiService;

    // Calculate Prefix/Suffix impact
    const preText = prefixEnabled ? prefixText.trim() : '';
    const sufText = suffixEnabled ? suffixText.trim() : '';
    const fixedLen = (preText ? preText.length + 1 : 0) + (sufText ? sufText.length + 1 : 0);
    
    const adjustedTitleLen = [
      Math.max(10, titleLen[0] - fixedLen),
      Math.max(20, titleLen[1] - fixedLen)
    ];

    for (const img of pendingImages) {
      if (img.isEps && !img.preview) {
        setImages(prev => prev.map(i => i.id === img.id ? { 
          ...i, 
          status: 'error', 
          error: 'No preview image. Please attach a JPG preview.' 
        } : i));
        continue;
      }

      if (img.isVideo && !img.preview) {
        setImages(prev => prev.map(i => i.id === img.id ? { 
          ...i, 
          status: 'error', 
          error: 'Video preview frame is still extracting. Please wait a moment.' 
        } : i));
        continue;
      }

      setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'generating' } : i));

      try {
        const base64 = await getImageBase64(img);
        
        let result;
        if (activeMode === 'metadata') {
           const isPng = img.previewFile ? (img.previewFile.type === 'image/png') : (img.file.type === 'image/png');
           result = await service.generateMetadata(base64, {
             titleLen: adjustedTitleLen,
             descLen,
             keywordCount,
             isSingleKeyword,
             isPng,
             isVideo: img.isVideo,
             videoInfo: img.videoInfo,
             model: selectedModel
           });

            // Apply Prefix and Suffix and ENFORCE STRICT LIMITS
            let finalTitle = (result.title || '').trim().replace(/\.+$/, '');
            if (preText) finalTitle = `${preText} ${finalTitle}`.trim();
            if (sufText) finalTitle = `${finalTitle} ${sufText}`.trim();

            // Extreme Truncation if still too long
            if (finalTitle.length > titleLen[1]) {
              let truncated = finalTitle.substring(0, titleLen[1]);
              
              // Try to truncate at the last punctuation mark to keep it sentence-like
              const lastPunc = Math.max(truncated.lastIndexOf(','), truncated.lastIndexOf(';'), truncated.lastIndexOf('-'));
              if (lastPunc > titleLen[0]) {
                 truncated = truncated.substring(0, lastPunc);
              } else {
                 // Fallback: Smart truncate to last complete word
                 const lastSpaceIndex = truncated.lastIndexOf(' ');
                 if (lastSpaceIndex > Math.max(0, titleLen[0] - 20)) {
                     truncated = truncated.substring(0, lastSpaceIndex);
                 }
              }
              
              // remove trailing junk
              truncated = truncated.replace(/[,;\-\s.]+$/, '');
              finalTitle = truncated.trim();
            }
            
            // Ensure no trailing period
            finalTitle = finalTitle.replace(/\.+$/, '');

            // Enforce Keyword Count
            let finalKeywords = result.keywords || [];
            if (finalKeywords.length > keywordCount[1]) {
              finalKeywords = finalKeywords.slice(0, keywordCount[1]);
            }

            // Enforce Description Length
            let finalDesc = result.description || '';
            if (finalDesc.length > descLen[1]) {
              finalDesc = finalDesc.substring(0, descLen[1]).trim();
            }

          setImages(prev => prev.map(i => i.id === img.id ? { 
            ...i, 
            status: 'done', 
            metadata: { 
              title: finalTitle,
              keywords: finalKeywords,
              description: finalDesc
            } 
          } : i));
        } else {
           result = await service.generatePrompt(base64, {
            model: selectedModel,
            promptLen
          });
          setImages(prev => prev.map(i => i.id === img.id ? { 
            ...i, 
            status: 'done', 
            promptOutput: result 
          } : i));
        }
        
        setStats(prev => ({ ...prev, completed: prev.completed + 1 }));

        if (pendingImages.indexOf(img) < pendingImages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

      } catch (error) {
        setImages(prev => prev.map(i => i.id === img.id ? { 
          ...i, 
          status: 'error', 
          error: error.message 
        } : i));
      }
    }

    setIsGenerating(false);
    if (pendingImages.length > 0) {
      statsTracker.recordGeneration({
        user,
        provider: activeProvider,
        model: selectedModel,
        mode: activeMode,
        count: pendingImages.length,
        success: true
      });
    }
  };

  const exportCsv = () => {
    const processedImages = images.filter(img => img.status === 'done');
    
    if (processedImages.length === 0) {
      alert("No processed images to export.");
      return;
    }

    const data = processedImages.map(img => {
      const fileName = img.file.name;

      if (activeMode === 'metadata' && img.metadata) {
        return {
          Filename: fileName,
          Title: img.metadata.title,
          Keywords: img.metadata.keywords.join(', ')
        };
      } else if (activeMode === 'prompt' && img.promptOutput) {
        return {
          Filename: fileName,
          Generated_Prompt: img.promptOutput
        };
      }
      return null;
    }).filter(Boolean);

    try {
      const columns = activeMode === 'metadata' 
        ? ['Filename', 'Title', 'Keywords']
        : ['Filename', 'Generated_Prompt'];

      const csv = Papa.unparse(data, {
        columns: columns
      });
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "GFX_Metadata.csv");
      link.style.display = "none";
      document.body.appendChild(link);
      
      link.click();
      statsTracker.recordExport(user, processedImages.length);
      
      // Delay cleanup to ensure the browser has time to start the download with the correct filename
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 5000);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export CSV. Please check browser console.");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const totalImages = images.length;
  const completedImages = images.filter(i => i.status === 'done').length;
  const isAllDone = totalImages > 0 && (
    completedImages === totalImages || 
    (!isGenerating && completedImages > 0 && images.every(i => i.status === 'done' || i.status === 'error'))
  );

  let progressPercent = 0;
  if (totalImages > 0) {
    if (isAllDone) {
      progressPercent = 100;
    } else if (isGenerating) {
      const raw = (completedImages / totalImages) * 100;
      progressPercent = Math.max(raw, 4);
    } else {
      progressPercent = (completedImages / totalImages) * 100;
    }
  }

  return (
    <>
      {showLoginModal && (
        <div className="login-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="login-card" onClick={e => e.stopPropagation()}>
            <button 
              type="button" 
              className="admin-close-btn" 
              onClick={() => {
                setShowLoginModal(false);
                setLoginError(null);
              }}
              style={{ position: 'absolute', top: '16px', right: '16px' }}
              title="Close"
            >
              <X size={18} />
            </button>
            <div className="login-logo">
              <div style={{ background: 'rgba(236, 28, 36, 0.1)', padding: '1rem', borderRadius: '50%' }}>
                <img src="/logo.svg" alt="GFX Metadata" style={{ width: '48px', height: '48px' }} />
              </div>
              <h1 className="login-logo-text">GFX Metadata</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '-0.5rem' }}>
                Sign in with Google or Email
              </p>
            </div>

            <div className="google-login-wrapper">
              <GoogleLogin
                onSuccess={handleLoginSuccess}
                onError={() => {
                  console.error('Google Sign-In failed or blocked');
                  setLoginError('Google Sign-In failed. Please try again or use the quick sign-in below.');
                }}
                theme="filled_black"
                shape="pill"
                text="signin_with"
                width="320"
              />
            </div>

            <div className="login-divider">
              <span>Or continue with email</span>
            </div>
            
            <form onSubmit={handleEmailLogin} className="login-form">
              <div className="login-input-group">
                <label className="login-label">Email Address</label>
                <input 
                  type="email" 
                  className="login-input" 
                  placeholder="Enter your email" 
                  value={loginEmail}
                  onChange={(e) => {
                    setLoginEmail(e.target.value);
                    if (loginError) setLoginError(null);
                  }}
                  required
                />
              </div>

              {loginEmail.trim().toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase() && (
                <div className="login-input-group">
                  <label className="login-label">Admin Password</label>
                  <input 
                    type="password" 
                    className="login-input" 
                    placeholder="Enter admin password" 
                    value={adminAuthPassword}
                    onChange={(e) => {
                      setAdminAuthPassword(e.target.value);
                      if (loginError) setLoginError(null);
                    }}
                    required
                  />
                </div>
              )}

              <button type="submit" className="login-email-btn">
                {loginEmail.trim().toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase() ? 'Login as Admin' : 'Continue with Email'}
              </button>
            </form>

            <div className="quick-login-options">
              <div className="quick-login-label">Fast 1-Click Login:</div>
              <div className="quick-login-btns">
                <button 
                  type="button" 
                  className="quick-user-chip"
                  onClick={() => handleDirectGoogleLogin('mirzapurit@gmail.com', 'Mirzapur IT', 'super_admin')}
                  title="Sign in as Mirzapur IT"
                >
                  <img src="https://lh3.googleusercontent.com/a/default-user" alt="Mirzapur IT" className="chip-avatar" />
                  <span>Mirzapur IT</span>
                </button>
                <button 
                  type="button" 
                  className="quick-user-chip"
                  onClick={() => handleDirectGoogleLogin('diptag22@gmail.com', 'Dipta (Super Admin)', 'super_admin')}
                  title="Sign in as Dipta"
                >
                  <img src="https://lh3.googleusercontent.com/a/default-user" alt="Dipta" className="chip-avatar" />
                  <span>Dipta (Admin)</span>
                </button>
              </div>
            </div>

            {loginError && (
              <div className="login-error-alert">
                <AlertCircle size={16} />
                <span>{loginError}</span>
              </div>
            )}
          </div>
        </div>
      )}
      <div className={`app-container ${REQUIRE_LOGIN && !user ? 'blurred-auth' : ''}`}>
      <ApiKeysModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)}
        apiKeys={apiKeys}
        onAddKey={addApiKey}
        onRemoveKey={removeApiKey}
        activeProvider={activeProvider}
        setActiveProvider={setActiveProvider}
      />

      <DetailsModal 
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        image={selectedImage}
        activeMode={activeMode}
        activeProvider={activeProvider}
        onRegenerate={generateSingle}
      />

      {isDiptaAdmin && (
        <AdminPanel 
          isOpen={showAdminPanel} 
          onClose={() => setShowAdminPanel(false)} 
          currentUser={user} 
          onAdminLogout={handleAdminLogout}
        />
      )}

      {showAdminLoginModal && (
        <div className="admin-auth-overlay" onClick={() => setShowAdminLoginModal(false)}>
          <div className="admin-auth-card" onClick={e => e.stopPropagation()}>
            <div className="admin-auth-header">
              <div className="admin-auth-icon-wrap">
                <Lock size={22} color="#EC1C24" />
              </div>
              <div>
                <h3 style={{ color: '#fff', fontSize: '1.15rem', fontWeight: '700' }}>Admin Security Access</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>
                  Restricted to system administrators
                </p>
              </div>
              <button 
                type="button" 
                className="admin-close-btn" 
                onClick={() => setShowAdminLoginModal(false)}
                style={{ marginLeft: 'auto' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAdminLogin} className="admin-auth-form">
              <div className="admin-auth-input-group">
                <label>Admin User ID / Email</label>
                <input 
                  type="email" 
                  placeholder="Enter admin ID or email" 
                  value={adminAuthEmail}
                  autoComplete="off"
                  onChange={e => {
                    setAdminAuthEmail(e.target.value);
                    if (adminAuthError) setAdminAuthError('');
                  }}
                  required
                />
              </div>

              <div className="admin-auth-input-group">
                <label>Admin Password</label>
                <input 
                  type="password" 
                  placeholder="Enter admin password" 
                  value={adminAuthPassword}
                  onChange={e => {
                    setAdminAuthPassword(e.target.value);
                    if (adminAuthError) setAdminAuthError('');
                  }}
                  required
                />
              </div>

              {adminAuthError && (
                <div className="admin-auth-error-alert">
                  <AlertCircle size={16} />
                  <span>{adminAuthError}</span>
                </div>
              )}

              <div className="admin-auth-actions">
                <button 
                  type="button" 
                  className="admin-btn-secondary" 
                  onClick={() => setShowAdminLoginModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="admin-btn-accent"
                >
                  <Unlock size={15} /> Unlock Admin Panel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-card">
          <div className="logo">
            <img src="/logo.svg" alt="GFX Metadata" style={{ width: '28px', height: '28px' }} />
            GFX Metadata
          </div>

          {isDiptaAdmin && (
            <div className="sidebar-admin-section" onClick={() => setShowAdminPanel(true)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <ShieldCheck size={18} color="#EC1C24" />
                <span className="api-section-title">Admin Panel</span>
              </div>
              <span className="admin-sidebar-badge">ACTIVE</span>
            </div>
          )}

          <div className="sidebar-api-section" onClick={() => setShowModal(true)}>
            <div className="api-section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Key size={18} color="var(--text-secondary)" />
                  <span className="api-section-title">API Keys</span>
              </div>
              <div className={`api-provider-badge badge-${activeProvider}`}>
                  {activeProvider === 'groq' ? 'Groq' : 'Gemini'}
              </div>
            </div>
          </div>

          <div className="control-group-compact">
            <p className="section-title">Model Selection</p>
            <CustomSelect 
                  value={selectedModel} 
                  onChange={setSelectedModel}
                  options={providerModels[activeProvider]}
            />

            <div className="mode-toggle-group">
              <button 
                className={`mode-btn ${activeMode === 'metadata' ? 'active' : ''}`}
                onClick={() => setActiveMode('metadata')}
              >
                <Database size={16} /> Metadata
              </button>
              <button 
                className={`mode-btn ${activeMode === 'prompt' ? 'active' : ''}`}
                onClick={() => setActiveMode('prompt')}
              >
                <Sparkles size={16} /> Prompt
              </button>
            </div>
          </div>
        </div>

        <div className="sidebar-spacer" />

        <div className="sidebar-card">
          {activeMode === 'metadata' ? (
            <>
              <div className="control-group">
                  <p className="section-title">Length Constraints</p>
                  <RangeSlider 
                    label="Title Length" 
                    unit="chars" 
                    min={20} 
                    max={200} 
                    value={titleLen} 
                    onChange={setTitleLen} 
                  />
                  <RangeSlider 
                    label="Description Length" 
                    unit="chars" 
                    min={100} 
                    max={150} 
                    value={descLen} 
                    onChange={setDescLen} 
                  />
                  <RangeSlider 
                    label="Keyword Count" 
                    unit="words" 
                    min={10} 
                    max={50} 
                    value={keywordCount} 
                    onChange={setKeywordCount} 
                  />
              </div>
                  
                  <div className="control-item" style={{ marginTop: '1rem' }}>
                      <div className="control-label">
                          <span>Single Keywords</span>
                          <Switch enabled={isSingleKeyword} onChange={setIsSingleKeyword} />
                      </div>
                  </div>
  
                  <div className="prefix-suffix-container" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className="control-item">
                          <div className="control-label" style={{ marginBottom: '0.5rem' }}>
                              <span>Prefix</span>
                              <Switch enabled={prefixEnabled} onChange={setPrefixEnabled} />
                          </div>
                          {prefixEnabled && (
                              <div className="prefix-suffix-input-wrapper">
                                  <input 
                                      className="prefix-suffix-input"
                                      type="text" 
                                      placeholder="Add Before Title"
                                      style={{ borderColor: '#EC1C24' }}
                                      value={prefixText}
                                      onChange={(e) => setPrefixText(e.target.value)}
                                  />
                              </div>
                          )}
                      </div>
  
                      <div className="control-item">
                          <div className="control-label" style={{ marginBottom: '0.5rem' }}>
                              <span>Suffix</span>
                              <Switch enabled={suffixEnabled} onChange={setSuffixEnabled} />
                          </div>
                          {suffixEnabled && (
                              <div className="prefix-suffix-input-wrapper">
                                  <input 
                                      className="prefix-suffix-input"
                                      type="text" 
                                      placeholder="Add After Title"
                                      style={{ borderColor: '#EC1C24' }}
                                      value={suffixText}
                                      onChange={(e) => setSuffixText(e.target.value)}
                                  />
                              </div>
                          )}
                      </div>
                  </div>
            </>
          ) : (
            <>
              <div className="control-group">
                  <p className="section-title">Prompt Constraints</p>
                  <RangeSlider 
                    label="Prompt Length" 
                    unit="chars" 
                    min={400} 
                    max={600} 
                    value={promptLen} 
                    onChange={setPromptLen} 
                  />
              </div>
            </>
          )}

          <button 
            type="button" 
            className={`save-settings-btn ${saveSettingsSuccess ? 'saved' : ''}`}
            onClick={handleSaveSettings}
          >
            {saveSettingsSuccess ? (
              <>
                <CheckCircle2 size={18} color="#00e600" />
                <span>Settings Saved!</span>
              </>
            ) : (
              <>
                <Settings size={18} />
                <span>Save Settings</span>
              </>
            )}
          </button>
        </div>

        <div style={{ marginTop: '1rem' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                Powered by {activeProvider === 'groq' ? 'Groq Vision Llama 4' : 'Google Gemini 2.5/3.x'}
            </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="action-bar">
          <div className="stats" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {images.length > 0 && (
              <span>{images.length} images loaded • {images.filter(i => i.status === 'done').length} processed</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {isDiptaAdmin && (
              <button 
                className="admin-header-trigger"
                onClick={() => setShowAdminPanel(true)}
                title="Open Admin Statistics Panel"
              >
                <ShieldCheck size={16} color="#EC1C24" />
                <span>Admin Panel</span>
              </button>
            )}

            {!isLoggedIn ? (
              <button 
                className="header-google-login-btn"
                onClick={() => setShowLoginModal(true)}
                title="Sign in with Google"
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Google Login</span>
              </button>
            ) : (
              <div 
                className="user-profile-bar"
                title={user.name}
              >
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="user-avatar-small" />
                ) : (
                  <div className="user-avatar-initials-small">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <span className="user-name-small">{user.name}</span>
                {user.role === 'super_admin' && (
                  <span className="admin-badge-mini">ADMIN</span>
                )}
                <button 
                  className="logout-btn-minimal" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLogout();
                  }} 
                  title="Logout"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {images.length > 0 && (
              <button className="secondary" onClick={() => setImages([])}>
                <Trash2 size={18} /> Clear
              </button>
            )}
            <button 
                onClick={!isLoggedIn ? () => {
                  setLoginError('Please sign in to generate metadata.');
                  setShowLoginModal(true);
                } : generateAll} 
                disabled={isGenerating || (isLoggedIn && images.length === 0)}
                className={isGenerating ? 'generating-pulse' : ''}
                style={{ 
                  background: !isLoggedIn ? '#26282b' : '#EC1C24',
                  border: !isLoggedIn ? '1px solid rgba(236, 28, 36, 0.45)' : 'none',
                  color: !isLoggedIn ? '#ff6b70' : '#ffffff'
                }}
            >
              {isGenerating ? (
                <Loader2 className="animate-spin" size={18} />
              ) : !isLoggedIn ? (
                <Lock size={18} color="#EC1C24" />
              ) : (
                <Play size={18} />
              )}
              {isGenerating 
                ? `Generating (${stats.completed}/${stats.total})` 
                : !isLoggedIn 
                  ? 'Login to Generate' 
                  : (activeMode === 'metadata' ? 'Generate Metadata' : 'Generate Prompts')}
            </button>
            <button 
                className="secondary" 
                onClick={exportCsv}
                disabled={!images.some(img => img.status === 'done')}
            >
              <Download size={18} /> Export CSV
            </button>
          </div>
        </header>

        {images.length > 0 && (
          <div className="overall-progress-track">
            <div 
              className={`overall-progress-fill ${isAllDone ? 'completed' : ''}`}
              style={{ 
                width: `${progressPercent}%`,
                opacity: progressPercent > 0 ? 1 : 0
              }}
            />
          </div>
        )}

        {images.length === 0 ? (
          <label 
            className={`upload-zone ${isDragging ? 'dragging' : ''}`} 
            style={{ borderStyle: 'dotted', background: 'transparent' }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFiles(e.dataTransfer.files);
              }
            }}
          >
            <input type="file" multiple accept="image/*,.eps,application/postscript,video/*,.mp4,.mov,.webm,.m4v" onChange={handleFileUpload} style={{ display: 'none' }} />
            <div style={{ background: 'rgba(236, 28, 36, 0.1)', padding: '2rem', borderRadius: '50%', marginBottom: '1rem' }}>
              {!isLoggedIn ? <Lock size={48} color="#EC1C24" /> : <Upload size={48} color="#EC1C24" />}
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fff' }}>
              {!isLoggedIn ? 'Login Required to Generate Metadata' : 'Drop images, .EPS vectors, or videos here'}
            </h2>
            <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
              {!isLoggedIn 
                ? 'Please sign in with Google or Email to generate metadata' 
                : 'Supports JPG, PNG, WEBP, .EPS vectors, and MP4/MOV/WEBM video footage'}
            </p>
            {!isLoggedIn && (
              <button 
                type="button"
                className="upload-login-btn"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowLoginModal(true);
                }}
              >
                <Lock size={16} /> Sign In to Get Started
              </button>
            )}
          </label>
        ) : (
          <div className="image-grid">
            {images.map(img => (
              <div key={img.id} className="card-horizontal">
                {/* Left: Image Section */}
                <div className="card-left">
                  <div className="card-image-box">
                    {img.isExtractingPreview ? (
                      <div className="eps-loading-overlay">
                        <Loader2 className="animate-spin" size={24} color="#EC1C24" />
                        <span>{img.isVideo ? 'Reading Video...' : 'Reading EPS...'}</span>
                      </div>
                    ) : img.preview ? (
                      <>
                        <img src={img.preview} alt="Preview" className="card-img-main" onClick={() => setSelectedImage(img)} />
                        {img.isEps && (
                          <span className={`eps-badge ${img.pairedWith ? 'paired' : ''}`} title={img.pairedWith ? `Paired with ${img.pairedWith}` : 'EPS Vector'}>
                            {img.pairedWith ? `EPS + ${img.pairedType || 'JPG'}` : 'EPS Vector'}
                          </span>
                        )}
                        {img.isVideo && (
                          <span className="eps-badge video-badge" title={img.videoInfo ? `${img.videoInfo.formattedDuration} • ${img.videoInfo.resolutionLabel}` : 'Video'}>
                            <Play size={10} style={{ fill: '#fff', stroke: '#fff' }} /> {img.videoInfo?.formattedDuration || 'VIDEO'}
                          </span>
                        )}
                      </>
                    ) : (
                      <div className="no-preview-box">
                        <FileText size={24} color="#EC1C24" />
                        <span className="no-preview-text">No Preview Available</span>
                        <label className="attach-preview-btn">
                          <Paperclip size={12} /> Attach JPG
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleAttachPreview(img.id, e)} />
                        </label>
                      </div>
                    )}
                    <button className="card-delete-btn" onClick={() => deleteImage(img.id)} title="Delete Image">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="file-meta-info">
                    <p className="file-name-label" title={img.file.name}>
                      {img.file.name}
                      {img.isEps && <span className="vector-mini-pill">VECTOR</span>}
                      {img.isVideo && <span className="vector-mini-pill video-pill">VIDEO</span>}
                    </p>
                    <p className="file-size-label">
                      Size: {formatFileSize(img.file.size)} 
                      {img.pairedWith ? ' • Paired' : ''}
                      {img.videoInfo ? ` • ${img.videoInfo.resolutionLabel}` : ''}
                    </p>
                  </div>
                </div>

                {/* Right: Content Section */}
                <div className="card-right">
                  <div className="metadata-field">
                    <div className="field-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {activeMode === 'metadata' ? (
                              <Type size={14} color="var(--text-secondary)" />
                            ) : (
                              <div style={{ 
                                width: '14px', 
                                height: '14px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                fontSize: '12px', 
                                fontWeight: '900',
                                color: 'var(--text-secondary)'
                              }}>P</div>
                            )}
                            <span className="field-label">{activeMode === 'metadata' ? 'Title' : 'Prompt'}</span>
                        </div>
                        <span className="char-count">
                          {activeMode === 'metadata' 
                            ? (img.metadata?.title?.length || 0) 
                            : (img.promptOutput?.length || 0)
                          } characters
                        </span>
                    </div>
                    <div className="title-box-mockup">
                      {img.status === 'done' ? (
                        activeMode === 'metadata' ? img.metadata?.title : img.promptOutput
                      ) : img.status === 'error' ? (
                        <span style={{ color: '#ff6b70', fontWeight: '500' }}>⚠️ {img.error || 'Failed to generate metadata'}</span>
                      ) : (
                        <span style={{ color: '#666' }}>{img.status === 'generating' ? 'Analyzing...' : 'Waiting for generation...'}</span>
                      )}
                    </div>
                  </div>

                  {activeMode === 'metadata' && (
                    <div className="metadata-field">
                      <div className="field-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Database size={14} color="var(--text-secondary)" />
                              <span className="field-label">Keywords ({img.metadata?.keywords?.length || 0})</span>
                          </div>
                      </div>
                      <div className="keywords-cloud-mockup">
                        {img.status === 'done' && img.metadata?.keywords ? (
                          img.metadata.keywords.slice(0, 25).map((kw, i) => (
                             <span key={i} className="keyword-pill">{kw}</span>
                          ))
                        ) : (
                          <span style={{ color: '#444' }}>Keywords will appear here</span>
                        )}
                        {img.metadata?.keywords?.length > 25 && <span className="keyword-pill">+{img.metadata.keywords.length - 25} more</span>}
                      </div>
                    </div>
                  )}

                  <div className="card-actions-row">
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="action-btn-outline" onClick={() => copyToClipboard(activeMode === 'metadata' ? (img.metadata?.title || '') : (img.promptOutput || ''))}>
                            <Copy size={16} /> Copy {activeMode === 'metadata' ? 'Title' : 'Prompt'}
                        </button>
                        {activeMode === 'metadata' && (
                          <button className="action-btn-outline" onClick={() => copyToClipboard(img.metadata?.keywords?.join(', ') || '')}>
                              <Copy size={16} /> Copy Keywords
                          </button>
                        )}
                    </div>
                    <button className="action-btn-regen" onClick={() => generateSingle(img.id)}>
                        <Sparkles size={16} /> Regenerate
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <label className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderStyle: 'dashed', minHeight: '300px', background: 'rgba(255,255,255,0.01)' }}>
                <input type="file" multiple accept="image/*,.eps,application/postscript,video/*,.mp4,.mov,.webm,.m4v" onChange={handleFileUpload} style={{ display: 'none' }} />
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <Plus size={32} style={{ marginBottom: '0.5rem' }} />
                    <p>Add Media</p>
                </div>
            </label>
          </div>
        )}
      </main>
      </div>
    </>
  );
};

export default App;
