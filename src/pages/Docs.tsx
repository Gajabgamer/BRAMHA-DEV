import { motion } from "motion/react";
import { FileText, Book, Code, Terminal, Shield } from "lucide-react";

export default function Docs() {
  const docSections = [
    { icon: Book, title: "Getting Started", items: ["Introduction", "Quick Start Guide", "Installation"] },
    { icon: Code, title: "API Reference", items: ["Authentication", "Analysis Endpoint", "Webhooks"] },
    { icon: Terminal, title: "CLI Tool", items: ["CLI Installation", "Command Reference", "Configuration"] },
    { icon: Shield, title: "Security", items: ["Data Privacy", "Vulnerability Database", "Compliance"] },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-12">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-headline font-bold tracking-tighter text-on-surface mb-2 flex items-center gap-4"
        >
          <FileText className="w-10 h-10 text-primary" />
          Documentation
        </motion.h1>
        <p className="text-on-surface-variant font-body text-lg">
          Learn how to integrate BugPredictor into your development workflow.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {docSections.map((section) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 bg-surface-container hover:bg-surface-container-high transition-all rounded-xl border border-outline-variant/10 group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <section.icon className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-headline font-bold text-on-surface mb-4">{section.title}</h3>
            <ul className="space-y-2">
              {section.items.map((item) => (
                <li key={item} className="text-sm text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
