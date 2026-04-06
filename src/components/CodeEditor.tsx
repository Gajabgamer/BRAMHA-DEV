import { Brain } from "lucide-react";
import { motion } from "motion/react";

interface CodeEditorProps {
  code: string;
  setCode: (code: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  language: string;
  setLanguage: (lang: string) => void;
}

export default function CodeEditor({ code, setCode, onAnalyze, isAnalyzing, language, setLanguage }: CodeEditorProps) {
  const lineNumbers = Array.from({ length: 15 }, (_, i) => i + 1);

  return (
    <div className="mb-8">
      <div className="relative group mb-8">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-primary/20 rounded-xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
        <div className="relative bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant/10">
          <div className="flex items-center justify-between px-4 py-2 bg-surface-container-highest/50 border-b border-outline-variant/10">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-tertiary-dim/50"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-secondary/50"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-primary/50"></div>
            </div>
            <div className="flex items-center gap-4">
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-transparent text-[10px] font-mono text-on-surface-variant/60 uppercase tracking-widest outline-none border-none cursor-pointer hover:text-primary transition-colors"
              >
                <option value="" className="bg-surface-container-high">Auto-detect</option>
                <option value="JavaScript" className="bg-surface-container-high">JavaScript</option>
                <option value="Python" className="bg-surface-container-high">Python</option>
                <option value="Java" className="bg-surface-container-high">Java</option>
                <option value="C++" className="bg-surface-container-high">C++</option>
              </select>
              <button className="text-primary text-xs font-headline font-medium hover:brightness-125 transition-all">
                Example Code
              </button>
            </div>
          </div>

          <div className="relative flex">
            <div className="w-12 bg-surface-container-lowest/30 flex flex-col items-center pt-4 font-mono text-xs text-outline-variant select-none">
              {lineNumbers.map((n) => (
                <span key={n}>{n}</span>
              ))}
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-80 bg-surface-container-lowest border-none focus:ring-0 font-mono text-sm p-4 text-primary-dim placeholder:text-on-surface-variant/30 resize-none"
              placeholder="Paste your code here... // Let BugPredictor find the hidden risks"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-center mb-16">
        <button
          onClick={onAnalyze}
          disabled={isAnalyzing}
          className="relative group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="absolute -inset-1 bg-primary/20 rounded-lg blur group-hover:blur-md transition-all"></div>
          <div className="relative flex items-center gap-2 bg-primary text-on-primary font-headline font-bold px-8 py-4 rounded-lg active:scale-95 transition-transform">
            {isAnalyzing ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              >
                <Brain className="w-5 h-5" />
              </motion.div>
            ) : (
              <Brain className="w-5 h-5" />
            )}
            {isAnalyzing ? "Analyzing..." : "Analyze Code"}
          </div>
        </button>
      </div>
    </div>
  );
}
