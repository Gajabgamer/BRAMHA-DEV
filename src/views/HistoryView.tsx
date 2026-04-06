import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Clock, Search, ExternalLink, Trash2, Filter, ChevronRight, RefreshCw } from "lucide-react";
import { HistoryItem, ToastType } from "../types";
import { useAuth } from "../contexts/AuthContext";

interface HistoryViewProps {
  onNotify: (message: string, type: ToastType) => void;
}

export default function HistoryView({ onNotify }: HistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { token } = useAuth();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/history", {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch history");
      const data = await response.json();
      setItems(data);
    } catch (err) {
      onNotify("Failed to fetch history.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/history/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setItems(prev => prev.filter(item => item.id !== id));
        onNotify("Analysis record deleted.", "success");
      }
    } catch (err) {
      onNotify("Failed to delete record.", "error");
    }
  };

  const handleViewDetails = (item: HistoryItem) => {
    onNotify(`Opening forensic details for: ${item.name}`, "success");
    // In a real app, this would navigate to a detailed view or populate the dashboard
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(items, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "bugpredictor_history.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    onNotify("Exporting history as JSON...", "success");
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-on-surface">Analysis History</h2>
          <p className="text-on-surface-variant">Review your previous forensic scans and track progress.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchHistory}
            className="p-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-lg border border-outline-variant/10 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface text-sm font-headline font-bold rounded-lg border border-outline-variant/10 transition-all">
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button 
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary text-sm font-headline font-bold rounded-lg hover:brightness-110 transition-all"
          >
            Export JSON
          </button>
        </div>
      </header>

      <div className="bg-surface-container rounded-xl border border-outline-variant/10 overflow-hidden">
        <div className="p-4 bg-surface-container-highest/50 border-b border-outline-variant/10 flex justify-between items-center">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search scans..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-surface-container-lowest border-none rounded-md pl-10 pr-4 py-1.5 text-sm focus:ring-1 focus:ring-primary/30 w-full md:w-64 outline-none text-on-surface"
            />
          </div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
            {filteredItems.length} Records Found
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-slate-500 border-b border-white/5">
                <th className="px-6 py-4 font-medium">Project Name</th>
                <th className="px-6 py-4 font-medium">Scan Date</th>
                <th className="px-6 py-4 font-medium">Risk Score</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary opacity-50" />
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {filteredItems.map((item) => (
                    <motion.tr 
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                    >
                      <td className="px-6 py-4 font-medium text-on-surface">
                        <div className="flex items-center gap-2">
                          <ChevronRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 -ml-6 transition-all" />
                          {item.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-400">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          {item.date}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-mono font-bold ${
                          item.score > 80 ? 'text-tertiary' : item.score > 50 ? 'text-secondary' : 'text-primary'
                        }`}>
                          {item.score}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          item.status === 'High' ? 'border-tertiary text-tertiary bg-tertiary/5' : 
                          item.status === 'Medium' ? 'border-secondary text-secondary bg-secondary/5' : 
                          'border-primary text-primary bg-primary/5'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleViewDetails(item)}
                            title="View Details"
                            className="p-2 text-slate-500 hover:text-primary transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => onNotify("Re-running analysis...", "info")}
                            title="Re-run Analysis"
                            className="p-2 text-slate-500 hover:text-primary transition-colors"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(item.id)}
                            title="Delete Record"
                            className="p-2 text-slate-500 hover:text-tertiary transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
              {!isLoading && filteredItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                    No matching analysis records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
