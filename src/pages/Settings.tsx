import { motion } from "motion/react";
import { Settings as SettingsIcon, User, Shield, Bell, Key } from "lucide-react";

export default function Settings() {
  const settingsSections = [
    { icon: User, title: "Profile", description: "Manage your account information and preferences." },
    { icon: Shield, title: "Security", description: "Configure your security settings and two-factor authentication." },
    { icon: Bell, title: "Notifications", description: "Choose how you want to be notified about analysis results." },
    { icon: Key, title: "API Keys", description: "Generate and manage your API keys for forensic access." },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-12">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-headline font-bold tracking-tighter text-on-surface mb-2 flex items-center gap-4"
        >
          <SettingsIcon className="w-10 h-10 text-primary" />
          Settings
        </motion.h1>
        <p className="text-on-surface-variant font-body text-lg">
          Configure your BugPredictor account and forensic analysis preferences.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {settingsSections.map((section) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-8 bg-surface-container hover:bg-surface-container-high transition-all rounded-xl border border-outline-variant/10 group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <section.icon className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-headline font-bold text-on-surface mb-2">{section.title}</h3>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              {section.description}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
