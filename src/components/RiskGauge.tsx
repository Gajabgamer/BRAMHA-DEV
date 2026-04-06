import { Radar } from "lucide-react";
import { motion } from "motion/react";

interface RiskGaugeProps {
  score: number;
  level: string;
  criticalCount: number;
  minorCount: number;
  breakdown?: {
    security: number;
    complexity: number;
    maintainability: number;
  };
}

export default function RiskGauge({ score, level, criticalCount, minorCount, breakdown }: RiskGaugeProps) {
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getLevelColor = (lvl: string) => {
    switch (lvl.toLowerCase()) {
      case 'high': return 'text-tertiary';
      case 'medium': return 'text-secondary';
      case 'low': return 'text-primary';
      default: return 'text-on-surface';
    }
  };

  return (
    <div className="md:col-span-4 flex flex-col items-center justify-center p-8 bg-surface-container rounded-xl border border-outline-variant/10 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Radar className="w-16 h-16 text-on-surface" />
      </div>
      <h3 className="text-on-surface-variant font-headline text-xs uppercase tracking-[0.2em] mb-6">Risk Quotient</h3>
      
      <div className="relative w-48 h-48 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            className="text-surface-container-highest"
            cx="96"
            cy="96"
            fill="transparent"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
          />
          <motion.circle
            className={getLevelColor(level)}
            cx="96"
            cy="96"
            fill="transparent"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-6xl font-headline font-extrabold tracking-tighter text-on-surface"
          >
            {score}
          </motion.span>
          <span className={`text-[10px] font-headline font-bold uppercase ${getLevelColor(level)}`}>
            {level} Risk
          </span>
        </div>
      </div>
      
      <p className="mt-8 text-center text-xs text-on-surface-variant font-body leading-relaxed">
        Forensic scan complete. Detected <span className="text-tertiary font-bold">{criticalCount} critical</span> and <span className="text-secondary font-bold">{minorCount} minor</span> architectural flaws.
      </p>

      {breakdown && (
        <div className="mt-8 w-full space-y-3">
          {[
            { label: 'Security', value: breakdown.security, color: 'bg-tertiary' },
            { label: 'Complexity', value: breakdown.complexity, color: 'bg-secondary' },
            { label: 'Maintainability', value: breakdown.maintainability, color: 'bg-primary' },
          ].map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex justify-between text-[10px] uppercase font-headline font-bold text-on-surface-variant">
                <span>{item.label}</span>
                <span>{item.value} pts</span>
              </div>
              <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((item.value / 60) * 100, 100)}%` }}
                  className={`h-full ${item.color}`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
