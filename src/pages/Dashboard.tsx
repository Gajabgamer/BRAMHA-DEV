import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import CodeEditor from "../components/CodeEditor";
import RiskGauge from "../components/RiskGauge";
import AnomalyCard from "../components/AnomalyCard";
import { analyzeCode } from "../services/geminiService";
import { AnalysisResult } from "../types";

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
 * @param {string} host - The server host
 * @param {number} port - The server port
 */
function initConnection(host, port) {
  // Connection logic
}`;

export default function Dashboard() {
  const [code, setCode] = useState(EXAMPLE_CODE);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const analysisResult = await analyzeCode(code);
      setResult(analysisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const criticalCount = result?.anomalies.filter(a => a.severity === 'critical').length || 0;
  const minorCount = result?.anomalies.filter(a => a.severity === 'minor').length || 0;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header Section */}
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
          Paste your source code below for a deep forensic analysis. Our AI predicts vulnerabilities before they reach production.
        </motion.p>
      </header>

      <CodeEditor 
        code={code} 
        setCode={setCode} 
        onAnalyze={handleAnalyze} 
        isAnalyzing={isAnalyzing} 
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
            className="grid grid-cols-1 md:grid-cols-12 gap-8"
          >
            <RiskGauge 
              score={result.riskScore} 
              level={result.riskLevel} 
              criticalCount={criticalCount}
              minorCount={minorCount}
            />

            <div className="md:col-span-8 space-y-4">
              <h3 className="text-on-surface-variant font-headline text-xs uppercase tracking-[0.2em] mb-4">
                Detected Anomalies
              </h3>
              <div className="space-y-4">
                {result.anomalies.map((anomaly) => (
                  <AnomalyCard key={anomaly.id} anomaly={anomaly} />
                ))}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
