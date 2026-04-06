import { motion } from "motion/react";
import { Book, Shield, Zap, Code, AlertCircle, Info } from "lucide-react";

interface DocsViewProps {
  onBack: () => void;
}

export default function DocsView({ onBack }: DocsViewProps) {
  const sections = [
    {
      title: "How Risk Scoring Works",
      icon: Zap,
      content: "BugPredictor uses a deterministic forensic engine to calculate a risk score from 0 to 100. The score is calculated by summing issue weights: \n\n- High (20 points): Critical security risks (e.g., 'eval'), infinite loops, or major logic flaws.\n- Medium (10 points): Excessive complexity, constant conditionals, or significant maintainability issues.\n- Low (5 points): Unused variables, legacy syntax, or minor optimizations.\n\nNote: A 1.2x multiplier is applied if 2 or more High severity issues are detected. The final score is clamped between 0 and 100."
    },
    {
      title: "Multi-Language Forensic Engine",
      icon: AlertCircle,
      content: "Our engine supports multiple programming languages with varying levels of confidence:\n\n- JavaScript (85-95%): Full AST-based analysis with context tracking and control flow awareness.\n- Python/Java/C++ (60-80%): Rule-based analysis for common bug patterns and security risks.\n- Fallback (30-50%): Heuristic pattern matching for unsupported languages or parsing failures."
    },
    {
      title: "Usage Guide for Developers",
      icon: Code,
      content: "To get the most out of BugPredictor:\n\n1. Paste your source code into the editor.\n2. Select the language or let the engine auto-detect it.\n3. Click 'Analyze Code' to trigger the forensic scan.\n4. Review the Confidence Score to understand the depth of analysis.\n5. Examine Issue Cards for precise explanations, impacts, and fix suggestions."
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-4xl mx-auto"
    >
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-headline font-bold text-on-surface">Documentation</h2>
          <p className="text-on-surface-variant">Learn how to use BugPredictor and understand our forensic engine.</p>
        </div>
        <button 
          onClick={onBack}
          className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface text-sm font-headline font-bold rounded-lg border border-outline-variant/10 transition-all"
        >
          Back to Dashboard
        </button>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {sections.map((section) => (
          <div key={section.title} className="p-8 bg-surface-container rounded-xl border border-outline-variant/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <section.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-headline font-bold text-on-surface">{section.title}</h3>
            </div>
            <div className="text-on-surface-variant leading-relaxed whitespace-pre-wrap">
              {section.content}
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 bg-primary/5 border border-primary/20 rounded-xl flex gap-4 items-start">
        <Info className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
        <div>
          <h4 className="font-headline font-bold text-on-surface mb-1">Pro Tip</h4>
          <p className="text-sm text-on-surface-variant">Integrate BugPredictor into your CI/CD pipeline using our API keys for automated forensic scans on every pull request.</p>
        </div>
      </div>
    </motion.div>
  );
}
