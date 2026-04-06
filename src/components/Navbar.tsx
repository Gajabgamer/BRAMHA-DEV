import { Bell, Terminal, User, LogOut, ShieldCheck } from "lucide-react";
import { View } from "../types";
import { useAuth } from "../contexts/AuthContext";

interface NavbarProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

export default function Navbar({ currentView, onViewChange }: NavbarProps) {
  const { user, logout } = useAuth();
  
  const navLinks: { label: View; href: string }[] = [
    { label: "Dashboard", href: "#" },
    { label: "History", href: "#" },
    { label: "Settings", href: "#" },
    { label: "Docs", href: "#" },
  ];

  if (user?.role === 'admin') {
    navLinks.push({ label: "Admin", href: "#" });
  }

  return (
    <nav className="fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 flex justify-between items-center px-8 h-16 shadow-2xl shadow-emerald-900/10">
      <div className="flex items-center gap-8">
        <button 
          onClick={() => onViewChange('Dashboard')}
          className="text-xl font-bold text-primary tracking-wider font-headline"
        >
          BugPredictor
        </button>
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => onViewChange(link.label)}
              className={`font-headline tracking-tight text-sm transition-colors ${
                currentView === link.label
                  ? "text-primary border-b-2 border-primary pb-1"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          <button className="p-2 text-slate-400 hover:bg-white/5 rounded-md transition-all duration-300 active:scale-95">
            <Bell className="w-5 h-5" />
          </button>
          <button 
            onClick={() => onViewChange('Terminal')}
            className={`p-2 rounded-md transition-all duration-300 active:scale-95 ${
              currentView === 'Terminal' ? 'text-primary bg-white/5' : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            <Terminal className="w-5 h-5" />
          </button>
        </div>
        <button 
          onClick={logout}
          className="flex items-center gap-2 bg-tertiary/10 text-tertiary px-4 py-2 rounded-lg font-headline font-bold text-sm hover:bg-tertiary hover:text-on-tertiary transition-all active:scale-95"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
        <button 
          onClick={() => onViewChange('Settings')}
          className="w-8 h-8 rounded-full bg-surface-container-high overflow-hidden border border-outline-variant/30 flex items-center justify-center hover:border-primary transition-all"
        >
          <User className="w-5 h-5 text-slate-400" />
        </button>
      </div>
    </nav>
  );
}
