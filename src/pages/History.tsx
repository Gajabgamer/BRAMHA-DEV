import { motion } from "motion/react";
import { History as HistoryIcon, Clock, CheckCircle2, AlertCircle } from "lucide-react";

export default function History() {
  const historyItems = [
    { id: 1, name: "Project Alpha - auth.ts", date: "2 hours ago", risk: 75, status: "High Risk" },
    { id: 2, name: "Project Alpha - utils.js", date: "5 hours ago", risk: 12, status: "Low Risk" },
    { id: 3, name: "BugPredictor - geminiService.ts", date: "Yesterday", risk: 45, status: "Medium Risk" },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-12">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-headline font-bold tracking-tighter text-on-surface mb-2 flex items-center gap-4"
        >
          <HistoryIcon className="w-10 h-10 text-primary" />
          Analysis History
        </motion.h1>
        <p className="text-on-surface-variant font-body text-lg">
          Review your past forensic code analyses and vulnerability predictions.
        </p>
      </header>

      <div className="space-y-4">
        {historyItems.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-6 bg-surface-container hover:bg-surface-container-high transition-all rounded-xl border border-outline-variant/10 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                item.risk > 50 ? "bg-tertiary/10 text-tertiary" : "bg-primary/10 text-primary"
              }`}>
                {item.risk > 50 ? <AlertCircle /> : <CheckCircle2 />}
              </div>
              <div>
                <h3 className="font-headline font-bold text-on-surface">{item.name}</h3>
                <div className="flex items-center gap-2 text-xs text-on-surface-variant mt-1">
                  <Clock className="w-3 h-3" />
                  {item.date}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-headline font-bold ${
                item.risk > 50 ? "text-tertiary" : "text-primary"
              }`}>
                {item.risk}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                {item.status}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
