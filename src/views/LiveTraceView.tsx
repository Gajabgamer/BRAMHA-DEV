import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, StepForward, Activity, Code, Terminal as TerminalIcon, AlertCircle, Info } from 'lucide-react';
import { TraceStep } from '../types';
import { useAuth } from '../contexts/AuthContext';

const LiveTraceView: React.FC<{ onNotify: (msg: string, type: 'success' | 'error' | 'info') => void }> = ({ onNotify }) => {
  const { token } = useAuth();
  const [code, setCode] = useState('');
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleTrace = async () => {
    if (!code.trim()) {
      onNotify('Please provide code to trace', 'error');
      return;
    }

    // Basic heuristic for JS detection in frontend
    const isJS = code.includes('function') || code.includes('=>') || code.includes('const ') || code.includes('let ') || code.includes('var ');
    if (!isJS) {
      onNotify('Live Trace supported for JavaScript only', 'info');
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/trace/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code })
      });

      if (res.ok) {
        const data = await res.json();
        setSteps(data);
        setCurrentStep(0);
        onNotify('Trace analysis complete', 'success');
      } else {
        onNotify('Failed to analyze trace', 'error');
      }
    } catch (err) {
      onNotify('An error occurred during trace', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const resetTrace = () => {
    setCurrentStep(0);
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-headline font-bold text-on-surface tracking-tight">Live Trace</h2>
          <p className="text-on-surface-variant font-body">Simulate execution flow and track variable states.</p>
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-bold text-primary uppercase tracking-widest">
            <Info className="w-3 h-3" />
            JavaScript Only
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleTrace}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {isAnalyzing ? <Activity className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Start Trace
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-surface-container rounded-2xl border border-white/5 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Source Code</span>
              </div>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste your JavaScript code here..."
              className="w-full h-[400px] bg-transparent p-6 font-mono text-sm text-on-surface resize-none focus:outline-none"
            />
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-surface-container rounded-2xl border border-white/5 p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <TerminalIcon className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Execution Timeline</span>
              </div>
              {steps.length > 0 && (
                <div className="text-[10px] text-on-surface-variant/60">
                  Step {currentStep + 1} of {steps.length}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {steps.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-on-surface-variant/40">
                  <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
                  <p>No trace data available. Start an analysis to see execution steps.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {steps.map((step, idx) => (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ 
                        opacity: idx <= currentStep ? 1 : 0.3,
                        x: 0,
                        scale: idx === currentStep ? 1.02 : 1
                      }}
                      className={`p-4 rounded-xl border ${
                        idx === currentStep 
                          ? 'bg-primary/10 border-primary/30' 
                          : 'bg-white/5 border-white/5'
                      } transition-all`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                          {step.action}
                        </span>
                        <span className="text-[10px] text-on-surface-variant/60">
                          Line {step.line}
                        </span>
                      </div>
                      <p className="text-sm text-on-surface mb-3">{step.details}</p>
                      
                      {Object.keys(step.variables).length > 0 && (
                        <div className="bg-black/20 rounded-lg p-3 space-y-1">
                          {Object.entries(step.variables).map(([key, val]) => (
                            <div key={key} className="flex justify-between text-[10px] font-mono">
                              <span className="text-on-surface-variant">{key}:</span>
                              <span className="text-primary">{JSON.stringify(val)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {steps.length > 0 && (
              <div className="mt-6 flex gap-3">
                <button
                  onClick={nextStep}
                  disabled={currentStep === steps.length - 1}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/10 text-on-surface rounded-xl font-bold hover:bg-white/20 transition-all disabled:opacity-30"
                >
                  <StepForward className="w-4 h-4" />
                  Next Step
                </button>
                <button
                  onClick={resetTrace}
                  className="px-4 py-3 bg-white/5 text-on-surface-variant rounded-xl font-bold hover:bg-white/10 transition-all"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveTraceView;
