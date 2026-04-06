import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  User, 
  Shield, 
  Bell, 
  Key, 
  Globe, 
  Database, 
  Save, 
  RefreshCw, 
  Copy, 
  Check, 
  Trash2, 
  AlertTriangle, 
  ArrowLeft,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { UserSettings, ToastType } from "../types";
import { useAuth } from "../contexts/AuthContext";

interface SettingsViewProps {
  onNotify: (message: string, type: ToastType) => void;
}

type SettingsSection = 'Overview' | 'Profile' | 'Security' | 'API Keys';

export default function SettingsView({ onNotify }: SettingsViewProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('Overview');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState(false);
  const { token } = useAuth();

  // Unified Settings State
  const [settings, setSettings] = useState<UserSettings>({
    profile: { name: "", email: "", bio: "" },
    security: { twoFactor: false, biometric: false, sessionTimeout: "30m" },
    apiKeys: []
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/settings", {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch settings");
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      onNotify("Failed to fetch settings.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (updatedSettings: UserSettings) => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(updatedSettings),
      });
      if (response.ok) {
        onNotify("Settings saved successfully.", "success");
      }
    } catch (err) {
      onNotify("Failed to save settings.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings.profile.name.trim() || !settings.profile.email.trim()) {
      onNotify("Name and email are required.", "error");
      return;
    }
    await saveSettings(settings);
    setActiveSection('Overview');
  };

  const handleToggleSecurity = async (key: keyof UserSettings['security']) => {
    const newVal = !settings.security[key];
    const updated = {
      ...settings,
      security: { ...settings.security, [key]: newVal }
    };
    setSettings(updated);
    await saveSettings(updated);
    const keyStr = String(key);
    onNotify(`${keyStr.charAt(0).toUpperCase() + keyStr.slice(1)} ${newVal ? 'enabled' : 'disabled'}.`, "success");
  };

  const handleRegenerateKey = async (id: string) => {
    const newKey = `bp_${Math.random().toString(36).substring(7)}...${Math.random().toString(36).substring(7)}`;
    const updated = {
      ...settings,
      apiKeys: settings.apiKeys.map(k => k.id === id ? { ...k, key: newKey } : k)
    };
    setSettings(updated);
    await saveSettings(updated);
    onNotify("API key regenerated successfully.", "success");
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    onNotify("API key copied to clipboard.", "success");
    setTimeout(() => setCopiedKey(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary opacity-50" />
      </div>
    );
  }

  const renderOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {[
        { id: 'Profile', icon: User, title: "Profile", description: "Manage your personal information and preferences." },
        { id: 'Security', icon: Shield, title: "Security", description: "Configure multi-factor authentication and access logs." },
        { id: 'API Keys', icon: Key, title: "API Keys", description: "Generate and manage keys for CI/CD integration." },
        { id: 'Overview', icon: Bell, title: "Notifications", description: "Stay updated on critical vulnerability reports." },
        { id: 'Overview', icon: Globe, title: "Network", description: "Configure proxy settings and allowed domains." },
        { id: 'Overview', icon: Database, title: "Data Management", description: "Export or purge your analysis history." },
      ].map((section) => (
        <button 
          key={section.title}
          onClick={() => section.id !== 'Overview' && setActiveSection(section.id as SettingsSection)}
          className="flex items-start gap-4 p-6 bg-surface-container hover:bg-surface-container-high transition-all rounded-xl border border-outline-variant/10 group text-left"
        >
          <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary transition-all">
            <section.icon className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-headline font-bold text-on-surface mb-1">{section.title}</h3>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              {section.description}
            </p>
          </div>
        </button>
      ))}
    </div>
  );

  const renderProfile = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setActiveSection('Overview')} className="p-2 hover:bg-white/5 rounded-full text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h3 className="text-xl font-headline font-bold text-on-surface">Edit Profile</h3>
      </div>
      
      <form onSubmit={handleSaveProfile} className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-headline font-bold text-on-surface-variant uppercase tracking-widest">Full Name</label>
          <input 
            type="text" 
            value={settings.profile.name}
            onChange={e => setSettings(s => ({ ...s, profile: { ...s.profile, name: e.target.value } }))}
            className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-3 text-on-surface focus:ring-1 focus:ring-primary/30 outline-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-headline font-bold text-on-surface-variant uppercase tracking-widest">Email Address</label>
          <input 
            type="email" 
            value={settings.profile.email}
            onChange={e => setSettings(s => ({ ...s, profile: { ...s.profile, email: e.target.value } }))}
            className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-3 text-on-surface focus:ring-1 focus:ring-primary/30 outline-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-headline font-bold text-on-surface-variant uppercase tracking-widest">Bio</label>
          <textarea 
            value={settings.profile.bio}
            onChange={e => setSettings(s => ({ ...s, profile: { ...s.profile, bio: e.target.value } }))}
            className="w-full h-32 bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-3 text-on-surface focus:ring-1 focus:ring-primary/30 outline-none resize-none"
          />
        </div>
        
        <button 
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 bg-primary text-on-primary font-headline font-bold px-8 py-3 rounded-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </form>
    </motion.div>
  );

  const renderSecurity = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setActiveSection('Overview')} className="p-2 hover:bg-white/5 rounded-full text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h3 className="text-xl font-headline font-bold text-on-surface">Security Settings</h3>
      </div>

      <div className="space-y-4">
        {[
          { key: 'twoFactor' as const, title: "Two-Factor Authentication", desc: "Add an extra layer of security to your account." },
          { key: 'biometric' as const, title: "Biometric Login", desc: "Use FaceID or TouchID for faster access." },
        ].map(item => (
          <div key={item.key} className="flex items-center justify-between p-6 bg-surface-container rounded-xl border border-outline-variant/10">
            <div>
              <h4 className="font-headline font-bold text-on-surface mb-1">{item.title}</h4>
              <p className="text-sm text-on-surface-variant">{item.desc}</p>
            </div>
            <button onClick={() => handleToggleSecurity(item.key)} className="text-primary hover:brightness-110 transition-all">
              {settings.security[item.key] ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10 text-slate-600" />}
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );

  const renderAPIKeys = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setActiveSection('Overview')} className="p-2 hover:bg-white/5 rounded-full text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h3 className="text-xl font-headline font-bold text-on-surface">API Keys</h3>
      </div>

      <div className="space-y-4">
        {settings.apiKeys.map(key => (
          <div key={key.id} className="p-6 bg-surface-container rounded-xl border border-outline-variant/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="font-headline font-bold text-on-surface mb-1">{key.name}</h4>
              <div className="flex items-center gap-2 font-mono text-xs text-primary bg-surface-container-lowest px-3 py-1.5 rounded border border-white/5">
                {key.key}
                <button onClick={() => handleCopyKey(key.key)} className="hover:text-white transition-colors">
                  {copiedKey ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-widest">Created on {key.created}</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => handleRegenerateKey(key.id)}
                disabled={isSaving}
                className="p-2 text-slate-400 hover:text-primary hover:bg-white/5 rounded-lg transition-all"
              >
                <RefreshCw className={`w-5 h-5 ${isSaving ? 'animate-spin' : ''}`} />
              </button>
              <button className="p-2 text-slate-400 hover:text-tertiary hover:bg-white/5 rounded-lg transition-all">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
        <button 
          onClick={() => onNotify("API key generation is limited in this preview.", "info")}
          className="w-full py-4 border-2 border-dashed border-outline-variant/20 rounded-xl text-slate-500 hover:text-primary hover:border-primary/50 transition-all font-headline font-bold"
        >
          + Generate New API Key
        </button>
      </div>
    </motion.div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header>
        <h2 className="text-3xl font-headline font-bold text-on-surface">Settings</h2>
        <p className="text-on-surface-variant">Configure your forensic environment and account preferences.</p>
      </header>

      <AnimatePresence mode="wait">
        {activeSection === 'Overview' && renderOverview()}
        {activeSection === 'Profile' && renderProfile()}
        {activeSection === 'Security' && renderSecurity()}
        {activeSection === 'API Keys' && renderAPIKeys()}
      </AnimatePresence>

      <div className="p-8 bg-tertiary/5 border border-tertiary/20 rounded-xl">
        <h3 className="text-tertiary font-headline font-bold mb-2 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Danger Zone
        </h3>
        <p className="text-sm text-on-surface-variant mb-4">Deleting your account will permanently remove all analysis history and API keys.</p>
        <button 
          onClick={() => onNotify("Account deletion requires manual verification.", "error")}
          className="px-6 py-2 bg-tertiary text-on-tertiary font-headline font-bold rounded-lg hover:brightness-110 transition-all"
        >
          Delete Account
        </button>
      </div>
    </motion.div>
  );
}
