import React from "react";
import { 
  AlertTriangle, 
  Trash2, 
  History, 
  ShieldAlert, 
  Search 
} from "lucide-react";
import { Anomaly } from "../types";

interface AnomalyCardProps {
  anomaly: Anomaly;
}

const AnomalyCard: React.FC<AnomalyCardProps> = ({ anomaly }) => {
  const getIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('nesting') || cat.includes('complexity')) return AlertTriangle;
    if (cat.includes('unused') || cat.includes('optimization')) return Trash2;
    if (cat.includes('stale') || cat.includes('maintenance')) return History;
    if (cat.includes('security') || cat.includes('vulnerability')) return ShieldAlert;
    return Search;
  };

  const Icon = getIcon(anomaly.category);

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high': return 'border-tertiary text-tertiary bg-tertiary/10';
      case 'medium': return 'border-secondary text-secondary bg-secondary/10';
      case 'low': return 'border-primary text-primary bg-primary/10';
      default: return 'border-outline text-on-surface-variant bg-surface-container-high';
    }
  };

  const severityStyles = getSeverityColor(anomaly.severity);

  return (
    <div className={`group flex items-start gap-6 p-6 bg-surface-container hover:bg-surface-container-high transition-all rounded-xl border-l-4 ${severityStyles.split(' ')[0]}`}>
      <div className={`mt-1 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${severityStyles.split(' ').slice(2).join(' ')}`}>
        <Icon className={`w-6 h-6 ${severityStyles.split(' ')[1]}`} />
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-3">
            <h4 className="font-headline font-bold text-on-surface">{anomaly.title}</h4>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${severityStyles.split(' ').slice(0, 2).join(' ')}`}>
              {anomaly.severity}
            </span>
          </div>
          <span className="text-[10px] font-mono text-on-surface-variant/40 uppercase tracking-widest">
            {anomaly.category}
          </span>
        </div>
        
        <div className="space-y-3">
          <div>
            <p className="text-sm text-on-surface leading-relaxed font-medium">
              {anomaly.explanation}
              {anomaly.codeSnippet && (
                <code className="bg-surface-container-lowest px-1 text-primary ml-1 font-mono">
                  {anomaly.codeSnippet}
                </code>
              )}
            </p>
          </div>

          <div className="flex gap-2 items-start">
            <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider mt-0.5">Impact:</span>
            <p className="text-xs text-on-surface-variant leading-relaxed italic">
              {anomaly.impact}
            </p>
          </div>
        </div>

        {anomaly.suggestion && (
          <div className="mt-4 p-3 bg-primary/5 border border-primary/10 rounded-lg flex items-start gap-3">
            <div className="mt-0.5 w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-primary">!</span>
            </div>
            <p className="text-xs text-on-surface font-medium">
              <span className="text-primary font-bold mr-1">Fix:</span>
              {anomaly.suggestion}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnomalyCard;
