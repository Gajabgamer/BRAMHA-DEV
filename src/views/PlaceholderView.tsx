import { motion } from "motion/react";
import { Search, Construction, ArrowLeft } from "lucide-react";
import { View } from "../types";

interface PlaceholderViewProps {
  view: View;
  onBack: () => void;
}

export default function PlaceholderView({ view, onBack }: PlaceholderViewProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="relative mb-8">
        <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl animate-pulse"></div>
        <div className="relative w-24 h-24 rounded-full bg-surface-container flex items-center justify-center border border-primary/30">
          <Construction className="w-12 h-12 text-primary" />
        </div>
      </div>

      <h2 className="text-4xl font-headline font-bold text-on-surface mb-4">{view}</h2>
      <p className="text-on-surface-variant max-w-md mx-auto mb-8">
        This forensic module is currently being calibrated. Our predictive engine will soon support deep {view.toLowerCase()} analysis.
      </p>

      <div className="flex gap-4">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-3 bg-surface-container hover:bg-surface-container-high text-on-surface font-headline font-bold rounded-lg transition-all border border-outline-variant/10"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <button className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary font-headline font-bold rounded-lg hover:brightness-110 transition-all">
          <Search className="w-4 h-4" />
          Request Access
        </button>
      </div>
    </motion.div>
  );
}
