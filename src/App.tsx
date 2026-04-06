import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import CodeEditor from "./components/CodeEditor";
import RiskGauge from "./components/RiskGauge";
import AnomalyCard from "./components/AnomalyCard";
import HistoryView from "./views/HistoryView";
import SettingsView from "./views/SettingsView";
import PlaceholderView from "./views/PlaceholderView";
import DocsView from "./views/DocsView";
import AdminView from "./views/AdminView";
import AuthView from "./views/AuthView";
import LiveTraceView from "./views/LiveTraceView";
import DependencyTreeView from "./views/DependencyTreeView";
import Toast from "./components/Toast";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AnalysisResult, View, ToastType, Notification } from "./types";
import { Bell, Check, AlertCircle, Info, Trash2 } from "lucide-react";

const EXAMPLE_CODE = `function processData(data) {
  if (data) {
    if (data.items) {
      data.items.forEach(item => {
        if (item.active) {
          if (item.config) {
            if (item.config.enabled) {
              console.log(item.id);
            }
          }
        }
      });
    }
  }
  
  const cacheInvalidationToken = "xyz-123";
  // TODO: Implement cache logic
  
  return data;
}

/**
 * Initializes the connection
 * @param {string} url - The server URL
 */
function initConnection(host, port) {
  // Connection logic
  var legacyVar = true;
  eval("console.log('dangerous')");
}`;

function AppContent() {
  const { user, token, loading, logout } = useAuth();
  const [currentView, setCurrentView] = useState<View>('Dashboard');
  const [code, setCode] = useState(EXAMPLE_CODE);
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean }>({
    message: "",
    type: "success",
    isVisible: false
  });

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
      return () => clearInterval(interval);
    }
  }, [user, fetchNotifications]);

  const markNotificationsRead = async () => {
    if (!token) return;
    try {
      await fetch('/api/notifications/read', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchNotifications();
    } catch (err) {
      console.error("Failed to mark notifications read:", err);
    }
  };

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    setToast({ message, type, isVisible: true });
  }, []);

  const handleUnauthorized = useCallback(() => {
    showToast("Session expired, please login again", "error");
    logout();
  }, [logout, showToast]);

  const pollJobStatus = async (jobId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/analyze/status/${jobId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status === 401 || response.status === 403) {
          handleUnauthorized();
          return;
        }
        if (!response.ok) throw new Error("Failed to poll status");
        const data = await response.json();
        
        if (data.status === 'completed') {
          setResult(data.result);
          setIsAnalyzing(false);
          showToast("Forensic analysis complete.", "success");
        } else {
          // Poll again after 1 second
          setTimeout(poll, 1000);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Polling failed");
        setIsAnalyzing(false);
        showToast("Analysis failed during polling.", "error");
      }
    };
    poll();
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      // Using async: true for background processing
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          code, 
          language: selectedLanguage || undefined,
          async: true 
        })
      });
      
      if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Analysis failed");
      }

      const data = await response.json();
      if (data.jobId) {
        showToast("Analysis started in background...", "info");
        pollJobStatus(data.jobId);
      } else {
        setResult(data);
        setIsAnalyzing(false);
        showToast("Forensic analysis complete.", "success");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      showToast("Analysis failed.", "error");
      setIsAnalyzing(false);
    }
  };

  const handleViewChange = (view: View) => {
    setCurrentView(view);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AuthView onNotify={showToast} />
        <Toast 
          message={toast.message} 
          type={toast.type} 
          isVisible={toast.isVisible} 
          onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} 
        />
      </>
    );
  }

  const criticalCount = result?.issues.filter(a => a.severity === 'High').length || 0;
  const minorCount = result?.issues.filter(a => a.severity === 'Low').length || 0;

  const renderView = () => {
    switch (currentView) {
      case 'Dashboard':
      case 'Overview':
        return (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <header className="mb-12 text-center">
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl md:text-6xl font-headline font-bold tracking-tighter text-on-surface mb-4"
              >
                Analyze. <span className="text-primary">Predict.</span> Secure.
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-on-surface-variant max-w-xl mx-auto font-body text-lg"
              >
                Welcome back, <span className="text-primary font-bold">{user.name}</span>. Paste your source code below for a deep forensic analysis.
              </motion.p>
            </header>

            <CodeEditor 
              code={code} 
              setCode={setCode} 
              onAnalyze={handleAnalyze} 
              isAnalyzing={isAnalyzing}
              language={selectedLanguage}
              setLanguage={setSelectedLanguage}
            />

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-8 p-4 bg-tertiary/10 border border-tertiary/20 rounded-lg text-tertiary text-sm text-center"
                >
                  {error}
                </motion.div>
              )}

              {result && (
                <motion.section 
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  {result.warning && (
                    <div className="p-4 bg-tertiary/10 border border-tertiary/20 rounded-xl flex items-center gap-3 text-tertiary">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <p className="text-sm font-medium">{result.warning}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-4 items-center justify-between bg-surface-container-low p-4 rounded-xl border border-white/5">
                    <div className="flex items-center gap-6">
                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-on-surface-variant/40 block mb-1">Detected Language</span>
                        <span className="text-sm font-bold text-primary">{result.language}</span>
                      </div>
                      <div className="w-px h-8 bg-white/5"></div>
                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-on-surface-variant/40 block mb-1">Confidence Score</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${
                            result.confidence_score > 80 ? 'text-primary' : 
                            result.confidence_score > 50 ? 'text-secondary' : 'text-tertiary'
                          }`}>
                            {result.confidence_score}%
                          </span>
                          <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-1000 ${
                                result.confidence_score > 80 ? 'bg-primary' : 
                                result.confidence_score > 50 ? 'bg-secondary' : 'bg-tertiary'
                              }`}
                              style={{ width: `${result.confidence_score}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-widest text-on-surface-variant/40 block mb-1">Lines Analyzed</span>
                      <span className="text-sm font-mono text-on-surface-variant">{result.metadata?.linesAnalyzed || 0}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    <RiskGauge 
                      score={result.risk_score} 
                      level={result.riskLevel} 
                      criticalCount={criticalCount}
                      minorCount={minorCount}
                      breakdown={result.breakdown}
                    />

                    <div className="md:col-span-8 space-y-4">
                      <h3 className="text-on-surface-variant font-headline text-xs uppercase tracking-[0.2em] mb-4">
                        Detected Issues
                      </h3>
                      <div className="space-y-4">
                        {result.issues.map((issue) => (
                          <AnomalyCard key={issue.id} anomaly={issue} />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          </motion.div>
        );
      case 'History':
        return <HistoryView onNotify={showToast} />;
      case 'Settings':
        return <SettingsView onNotify={showToast} />;
      case 'Live Trace':
        return <LiveTraceView onNotify={showToast} />;
      case 'Dependency Tree':
      case 'Vulnerabilities':
        return <DependencyTreeView onNotify={showToast} />;
      case 'Admin':
        return <AdminView onNotify={showToast} defaultTab="dashboard" />;
      case 'Audit Logs':
        return <AdminView onNotify={showToast} defaultTab="logs" />;
      case 'Docs':
        return <DocsView onBack={() => setCurrentView('Dashboard')} />;
      default:
        return <PlaceholderView view={currentView} onBack={() => setCurrentView('Dashboard')} />;
    }
  };

  const unreadCount = notifications.filter(n => !n.read_status).length;

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans selection:bg-primary/30">
      <Navbar currentView={currentView} onViewChange={handleViewChange} />
      <Sidebar currentView={currentView} onViewChange={handleViewChange} />

      {/* Notification Bell */}
      <div className="fixed top-6 right-8 z-50">
        <button 
          onClick={() => {
            setShowNotifications(!showNotifications);
            if (!showNotifications && unreadCount > 0) markNotificationsRead();
          }}
          className="relative p-3 bg-surface-container rounded-full border border-white/5 hover:bg-white/5 transition-all group"
        >
          <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-primary animate-pulse' : 'text-on-surface-variant'}`} />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 w-4 h-4 bg-tertiary text-on-tertiary text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-surface">
              {unreadCount}
            </span>
          )}
        </button>

        <AnimatePresence>
          {showNotifications && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute top-14 right-0 w-80 bg-surface-container-high border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[60]"
            >
              <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] text-primary font-bold">{unreadCount} New</span>
                )}
              </div>
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-12 text-center text-on-surface-variant/40">
                    <Info className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-xs">No notifications yet</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className={`p-4 border-b border-white/5 hover:bg-white/5 transition-colors ${!n.read_status ? 'bg-primary/5' : ''}`}>
                      <div className="flex gap-3">
                        <div className={`mt-1 p-1.5 rounded-lg ${
                          n.type === 'error' ? 'bg-tertiary/20 text-tertiary' : 
                          n.type === 'warning' ? 'bg-tertiary/20 text-tertiary' :
                          n.type === 'success' ? 'bg-primary/20 text-primary' : 'bg-white/10 text-on-surface-variant'
                        }`}>
                          {n.type === 'success' ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-on-surface leading-relaxed">{n.message}</p>
                          <span className="text-[10px] text-on-surface-variant/40 mt-1 block">
                            {new Date(n.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <main className="lg:ml-64 pt-24 px-8 pb-20 max-w-6xl mx-auto relative min-h-[calc(100vh-64px)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>

        <div className="fixed right-0 top-0 w-2 h-full risk-horizon-glow pointer-events-none z-10"></div>
      </main>

      <Toast 
        message={toast.message} 
        type={toast.type} 
        isVisible={toast.isVisible} 
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} 
      />

      <footer className="lg:ml-64 py-12 px-8 border-t border-white/5 bg-surface-container-low/30">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
            <span className="text-[10px] font-mono text-on-surface-variant/40 uppercase tracking-[0.3em]">
              Predictive Engine v5.0.0-enterprise
            </span>
          </div>
          <div className="flex gap-8">
            <button onClick={() => setCurrentView('Docs')} className="text-[10px] font-headline font-bold text-on-surface-variant hover:text-primary transition-colors tracking-widest uppercase">Privacy Policy</button>
            <button onClick={() => setCurrentView('Audit Logs')} className="text-[10px] font-headline font-bold text-on-surface-variant hover:text-primary transition-colors tracking-widest uppercase">Security Audit</button>
            <button onClick={() => setCurrentView('Terminal')} className="text-[10px] font-headline font-bold text-on-surface-variant hover:text-primary transition-colors tracking-widest uppercase">API Access</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
