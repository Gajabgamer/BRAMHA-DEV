import { motion } from "motion/react";
import { Construction } from "lucide-react";

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="max-w-6xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-8"
      >
        <Construction className="w-12 h-12 text-primary" />
      </motion.div>
      <h1 className="text-4xl font-headline font-bold text-on-surface mb-4">{title}</h1>
      <p className="text-on-surface-variant max-w-md">
        This forensic module is currently under development. Our AI is training on new datasets to provide deeper insights for this section.
      </p>
    </div>
  );
}
