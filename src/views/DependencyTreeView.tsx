import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Package, AlertTriangle, CheckCircle, Search, ChevronRight, ChevronDown, Activity, Code, Info } from 'lucide-react';
import { Dependency } from '../types';
import { useAuth } from '../contexts/AuthContext';

const DependencyTreeView: React.FC<{ onNotify: (msg: string, type: 'success' | 'error' | 'info') => void }> = ({ onNotify }) => {
  const { token } = useAuth();
  const [packageJson, setPackageJson] = useState('');
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    if (!packageJson.trim()) {
      onNotify('Please provide a package.json content', 'error');
      return;
    }

    try {
      const parsed = JSON.parse(packageJson);
      if (!parsed.dependencies && !parsed.devDependencies) {
        onNotify('No dependency data available', 'info');
        return;
      }
    } catch (e) {
      onNotify('Invalid JSON format. Please provide a valid package.json', 'error');
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/dependencies/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ packageJson })
      });

      if (res.ok) {
        const data = await res.json();
        setDependencies(data);
        onNotify('Dependency analysis complete', 'success');
      } else {
        const err = await res.json();
        onNotify(err.error || 'Failed to analyze dependencies', 'error');
      }
    } catch (err) {
      onNotify('An error occurred during analysis', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderDependency = (dep: Dependency, depth = 0) => {
    const hasVuln = !!dep.vulnerability;
    const vulnLevel = dep.vulnerability?.level || 'None';

    return (
      <motion.div
        key={dep.name}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className={`p-4 rounded-xl border ${
          hasVuln ? 'bg-tertiary/10 border-tertiary/30' : 'bg-white/5 border-white/5'
        } mb-3`}
        style={{ marginLeft: `${depth * 24}px` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className={`w-4 h-4 ${hasVuln ? 'text-tertiary' : 'text-primary'}`} />
            <div>
              <h4 className="text-sm font-bold text-on-surface">{dep.name}</h4>
              <p className="text-[10px] text-on-surface-variant/60">Version: {dep.version}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {hasVuln ? (
              <div className="flex items-center gap-2 px-3 py-1 bg-tertiary/20 text-tertiary rounded-full text-[10px] font-bold uppercase tracking-widest">
                <AlertTriangle className="w-3 h-3" />
                {vulnLevel} Risk
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1 bg-primary/20 text-primary rounded-full text-[10px] font-bold uppercase tracking-widest">
                <CheckCircle className="w-3 h-3" />
                Secure
              </div>
            )}
          </div>
        </div>

        {dep.vulnerability && (
          <div className="mt-4 p-3 bg-black/20 rounded-lg space-y-2">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-on-surface-variant">CVE:</span>
              <span className="text-tertiary">{dep.vulnerability.cve}</span>
            </div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-on-surface-variant">Fix:</span>
              <span className="text-primary">{dep.vulnerability.suggestion}</span>
            </div>
          </div>
        )}

        {dep.dependencies?.map(child => renderDependency(child, depth + 1))}
      </motion.div>
    );
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-headline font-bold text-on-surface tracking-tight">Dependency Tree</h2>
          <p className="text-on-surface-variant font-body">Analyze package dependencies and detect known vulnerabilities.</p>
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-bold text-primary uppercase tracking-widest">
            <Info className="w-3 h-3" />
            Node.js (package.json) Only
          </div>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
        >
          {isAnalyzing ? <Activity className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
          Scan Dependencies
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-surface-container rounded-2xl border border-white/5 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">package.json</span>
              </div>
            </div>
            <textarea
              value={packageJson}
              onChange={(e) => setPackageJson(e.target.value)}
              placeholder="Paste your package.json content here..."
              className="w-full h-[400px] bg-transparent p-6 font-mono text-sm text-on-surface resize-none focus:outline-none"
            />
          </div>
        </div>

        <div className="lg:col-span-6 space-y-4">
          <div className="bg-surface-container rounded-2xl border border-white/5 p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Vulnerability Report</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {dependencies.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-on-surface-variant/40">
                  <Package className="w-12 h-12 mb-4 opacity-20" />
                  <p>No dependency data available. Scan a package.json to see the tree.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {dependencies.map(dep => renderDependency(dep))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DependencyTreeView;
