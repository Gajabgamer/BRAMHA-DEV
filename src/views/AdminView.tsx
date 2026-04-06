import { useState, useEffect, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, Shield, Activity, FileText, Trash2, ShieldAlert, BarChart3, Clock, RefreshCw, ExternalLink, ShieldCheck, UserMinus, TrendingUp, AlertCircle, Search } from "lucide-react";
import { AdminStats, User, SystemLog, ToastType } from "../types";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { useAuth } from "../contexts/AuthContext";

interface AdminViewProps {
  onNotify: (message: string, type: ToastType) => void;
  defaultTab?: 'dashboard' | 'users' | 'analyses' | 'logs';
}

export default function AdminView({ onNotify, defaultTab = 'dashboard' }: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'analyses' | 'logs'>(defaultTab);
  const [stats, setStats] = useState<any | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [logFilter, setLogFilter] = useState({ user: '', action: '' });
  const [isLoading, setIsLoading] = useState(true);
  const { token } = useAuth();

  const filteredLogs = logs.filter(log => {
    const userMatch = !logFilter.user || (log.user_name || 'System').toLowerCase().includes(logFilter.user.toLowerCase());
    const actionMatch = !logFilter.action || log.action.toLowerCase().includes(logFilter.action.toLowerCase());
    return userMatch && actionMatch;
  });

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      if (activeTab === 'dashboard') {
        const res = await fetch('/api/admin/stats', { headers });
        setStats(await res.json());
      } else if (activeTab === 'users') {
        const res = await fetch('/api/admin/users', { headers });
        setUsers(await res.json());
      } else if (activeTab === 'analyses') {
        const res = await fetch('/api/admin/analyses', { headers });
        setAnalyses(await res.json());
      } else if (activeTab === 'logs') {
        const res = await fetch('/api/admin/logs', { headers });
        setLogs(await res.json());
      }
    } catch (err) {
      onNotify("Failed to fetch admin data", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== id));
        onNotify("User deleted successfully", "success");
      }
    } catch (err) {
      onNotify("Failed to delete user", "error");
    }
  };

  const handleDeleteAnalysis = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this analysis?")) return;
    try {
      const res = await fetch(`/api/admin/analyses/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setAnalyses(prev => prev.filter(a => a.id !== id));
        onNotify("Analysis deleted successfully", "success");
      }
    } catch (err) {
      onNotify("Failed to delete analysis", "error");
    }
  };

  const handleChangeRole = async (id: number, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/users/${id}/role`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole as any } : u));
        onNotify("User role updated", "success");
      }
    } catch (err) {
      onNotify("Failed to update role", "error");
    }
  };

  const renderDashboard = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={stats?.totalUsers || 0} icon={<Users className="w-5 h-5" />} />
        <StatCard title="Total Analyses" value={stats?.totalAnalyses || 0} icon={<FileText className="w-5 h-5" />} />
        <StatCard title="Avg Risk Score" value={stats?.avgRiskScore || 0} icon={<ShieldAlert className="w-5 h-5" />} />
        <StatCard title="Active Users (7d)" value={stats?.activeUsers || 0} icon={<Activity className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-surface-container rounded-2xl p-6 border border-white/5">
          <h3 className="text-lg font-headline font-bold mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            System Activity (Analyses per Day)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.riskTrends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="date" stroke="#ffffff40" fontSize={10} />
                <YAxis stroke="#ffffff40" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1c1e', border: '1px solid #ffffff10' }} />
                <Line type="monotone" dataKey="count" stroke="#00e5ff" strokeWidth={2} dot={{ fill: '#00e5ff' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface-container rounded-2xl p-6 border border-white/5">
          <h3 className="text-lg font-headline font-bold mb-6 flex items-center gap-2">
            <Shield className="w-5 h-5 text-secondary" />
            Risk Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.riskDistribution || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="name" stroke="#ffffff40" fontSize={12} />
                <YAxis stroke="#ffffff40" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1c1e', border: '1px solid #ffffff10' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {(stats?.riskDistribution || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#00e5ff' : index === 1 ? '#ffb74d' : '#ff5252'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="bg-surface-container rounded-2xl border border-white/5 overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant/60 border-b border-white/5">
            <th className="px-6 py-4 font-medium">User</th>
            <th className="px-6 py-4 font-medium">Email</th>
            <th className="px-6 py-4 font-medium">Role</th>
            <th className="px-6 py-4 font-medium">Joined</th>
            <th className="px-6 py-4 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {users.map(user => (
            <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              <td className="px-6 py-4 font-medium text-on-surface">{user.name}</td>
              <td className="px-6 py-4 text-on-surface-variant">{user.email}</td>
              <td className="px-6 py-4">
                <select 
                  value={user.role} 
                  onChange={(e) => handleChangeRole(user.id, e.target.value)}
                  className="bg-surface-container-highest text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-white/10 outline-none focus:border-primary/50"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td className="px-6 py-4 text-on-surface-variant/60">{new Date(user.created_at).toLocaleDateString()}</td>
              <td className="px-6 py-4 text-right">
                <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-on-surface-variant hover:text-tertiary transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderAnalyses = () => (
    <div className="bg-surface-container rounded-2xl border border-white/5 overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant/60 border-b border-white/5">
            <th className="px-6 py-4 font-medium">Project</th>
            <th className="px-6 py-4 font-medium">User</th>
            <th className="px-6 py-4 font-medium">Score</th>
            <th className="px-6 py-4 font-medium">Date</th>
            <th className="px-6 py-4 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {analyses.map(analysis => (
            <tr key={analysis.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              <td className="px-6 py-4 font-medium text-on-surface">{analysis.name}</td>
              <td className="px-6 py-4 text-on-surface-variant">{analysis.user_name}</td>
              <td className="px-6 py-4">
                <span className={`font-mono font-bold ${analysis.risk_score > 70 ? 'text-tertiary' : 'text-primary'}`}>
                  {analysis.risk_score}
                </span>
              </td>
              <td className="px-6 py-4 text-on-surface-variant/60">{new Date(analysis.created_at).toLocaleString()}</td>
              <td className="px-6 py-4 text-right">
                <button 
                  onClick={() => handleDeleteAnalysis(analysis.id)}
                  className="p-2 text-on-surface-variant hover:text-tertiary transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderLogs = () => (
    <div className="space-y-4">
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
          <input 
            type="text" 
            placeholder="Filter by user..." 
            value={logFilter.user}
            onChange={(e) => setLogFilter(prev => ({ ...prev, user: e.target.value }))}
            className="w-full bg-surface-container border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm text-on-surface focus:outline-none focus:border-primary/30"
          />
        </div>
        <div className="flex-1 relative">
          <Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
          <input 
            type="text" 
            placeholder="Filter by action..." 
            value={logFilter.action}
            onChange={(e) => setLogFilter(prev => ({ ...prev, action: e.target.value }))}
            className="w-full bg-surface-container border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm text-on-surface focus:outline-none focus:border-primary/30"
          />
        </div>
      </div>

      <div className="bg-surface-container rounded-2xl border border-white/5 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant/60 border-b border-white/5">
              <th className="px-6 py-4 font-medium">Action</th>
              <th className="px-6 py-4 font-medium">User</th>
              <th className="px-6 py-4 font-medium">Details</th>
              <th className="px-6 py-4 font-medium">IP</th>
              <th className="px-6 py-4 font-medium">Timestamp</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {filteredLogs.map(log => (
              <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 font-mono text-[10px] text-primary">{log.action}</td>
                <td className="px-6 py-4 text-on-surface-variant">{log.user_name || 'System'}</td>
                <td className="px-6 py-4 text-on-surface-variant/80">{log.details}</td>
                <td className="px-6 py-4 font-mono text-[10px] text-on-surface-variant/40">{log.ip}</td>
                <td className="px-6 py-4 text-on-surface-variant/60">{new Date(log.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-on-surface">
            {activeTab === 'logs' ? 'System Audit Logs' : 'Admin Command Center'}
          </h2>
          <p className="text-on-surface-variant">
            {activeTab === 'logs' ? 'Detailed record of all system activities and security events.' : 'System-wide monitoring and management dashboard.'}
          </p>
        </div>
        <div className="flex bg-surface-container p-1 rounded-xl border border-white/5">
          <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} label="Overview" icon={<Activity className="w-4 h-4" />} />
          <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} label="Users" icon={<Users className="w-4 h-4" />} />
          <TabButton active={activeTab === 'analyses'} onClick={() => setActiveTab('analyses')} label="Analyses" icon={<FileText className="w-4 h-4" />} />
          <TabButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} label="Logs" icon={<Clock className="w-4 h-4" />} />
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-primary opacity-50" />
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'analyses' && renderAnalyses()}
          {activeTab === 'logs' && renderLogs()}
        </div>
      )}
    </motion.div>
  );
}

function StatCard({ title, value, icon }: { title: string, value: string | number, icon: ReactNode }) {
  return (
    <div className="bg-surface-container p-6 rounded-2xl border border-white/5 hover:border-primary/20 transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-primary/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-on-primary transition-all">
          {icon}
        </div>
      </div>
      <div className="text-2xl font-headline font-bold text-on-surface mb-1">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-on-surface-variant/60">{title}</div>
    </div>
  );
}

function TabButton({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: ReactNode }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-headline font-bold transition-all ${
        active ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:text-on-surface'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
