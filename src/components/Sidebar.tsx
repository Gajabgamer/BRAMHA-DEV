import { 
  Shield, 
  LayoutDashboard, 
  Activity, 
  Lock, 
  GitBranch, 
  FileText, 
  HelpCircle, 
  Terminal,
  ShieldCheck
} from "lucide-react";
import { View } from "../types";
import { useAuth } from "../contexts/AuthContext";

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

export default function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const { user } = useAuth();
  
  const navItems = [
    { icon: LayoutDashboard, label: "Overview" as View },
    { icon: Activity, label: "Live Trace" as View },
    { icon: Lock, label: "Vulnerabilities" as View },
    { icon: GitBranch, label: "Dependency Tree" as View },
    { icon: FileText, label: "Audit Logs" as View },
  ];

  if (user?.role === 'admin') {
    navItems.push({ icon: ShieldCheck, label: "Admin" as View });
  }

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 border-r border-white/5 bg-slate-900 hidden lg:flex flex-col py-6 z-40">
      <div className="mt-16 px-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-primary font-headline font-bold text-sm tracking-tight">Project Alpha</h3>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Forensic Mode Active</p>
          </div>
        </div>
        <button 
          onClick={() => onViewChange('Dashboard')}
          className="w-full bg-white/5 hover:bg-white/10 text-primary border border-primary/20 py-2 rounded-lg text-sm font-headline transition-all mb-8"
        >
          + New Analysis
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => onViewChange(item.label)}
            className={`w-full flex items-center gap-3 px-4 py-3 transition-all ${
              currentView === item.label
                ? "text-primary bg-primary/10 border-r-2 border-primary"
                : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-sans text-sm">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="px-4 mt-auto pt-4 border-t border-white/5">
        <button 
          onClick={() => onViewChange('Support')}
          className={`w-full flex items-center gap-3 px-4 py-3 transition-all ${
            currentView === 'Support' ? 'text-primary' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <HelpCircle className="w-5 h-5" />
          <span className="font-sans text-sm">Support</span>
        </button>
        <button 
          onClick={() => onViewChange('Terminal')}
          className={`w-full flex items-center gap-3 px-4 py-3 transition-all ${
            currentView === 'Terminal' ? 'text-primary' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Terminal className="w-5 h-5" />
          <span className="font-sans text-sm">Terminal</span>
        </button>
      </div>
    </aside>
  );
}
