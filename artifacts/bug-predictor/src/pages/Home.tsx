import React, { useState, useRef, useEffect } from "react";
import {
  ShieldAlert, Play, Code2, AlertTriangle, FileCode2,
  CheckCircle2, ChevronRight, Copy, Check, Wrench, Terminal
} from "lucide-react";
import { useAnalyzeCode } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

const LANGUAGES = [
  { value: "auto", label: "Auto-detect" },
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
];

const SNIPPETS = [
  {
    name: "SQL Injection",
    lang: "python",
    code: `def get_user(username):\n    query = "SELECT * FROM users WHERE username = '" + username + "'"\n    cursor.execute(query)\n    return cursor.fetchone()`,
  },
  {
    name: "Insecure Eval",
    lang: "javascript",
    code: `app.post('/api/calculate', (req, res) => {\n  const { formula } = req.body;\n  const result = eval(formula);\n  res.json({ result });\n});`,
  },
  {
    name: "Buffer Overflow",
    lang: "c",
    code: `#include <stdio.h>\n#include <string.h>\n\nvoid vulnerable_function(char *input) {\n    char buffer[10];\n    strcpy(buffer, input);\n}\n\nint main(int argc, char *argv[]) {\n    vulnerable_function(argv[1]);\n    return 0;\n}`,
  },
];

/* ── Minimal code editor with line numbers ── */
function CodeEditor({
  value,
  onChange,
  placeholder,
  minLines = 14,
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  minLines?: number;
}) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const lines = value ? value.split("\n") : [];
  const lineCount = Math.max(lines.length, minLines);

  const sync = () => {
    if (gutterRef.current && taRef.current)
      gutterRef.current.scrollTop = taRef.current.scrollTop;
  };

  return (
    <div className="flex overflow-hidden h-full text-[13px] font-mono">
      {/* gutter */}
      <div
        ref={gutterRef}
        className="select-none overflow-hidden shrink-0 w-9 text-right bg-[#0d1117] border-r border-white/5 pt-3 pb-3"
        aria-hidden
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className="leading-[1.6rem] pr-2 text-white/20 text-[11px]">
            {i + 1}
          </div>
        ))}
      </div>
      {/* textarea */}
      <textarea
        ref={taRef}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        onScroll={sync}
        placeholder={placeholder}
        readOnly={!onChange}
        spellCheck={false}
        className="flex-1 resize-none border-0 outline-none bg-transparent text-white/85 placeholder:text-white/20 px-4 py-3 leading-[1.6rem] overflow-auto"
        style={{ fontFamily: "inherit" }}
      />
    </div>
  );
}

/* ── Severity helpers ── */
const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high:     "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low:      "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const VERDICT_STYLES: Record<string, string> = {
  red:    "text-red-400 border-red-500/40 bg-red-500/10",
  orange: "text-orange-400 border-orange-500/40 bg-orange-500/10",
  yellow: "text-yellow-400 border-yellow-500/40 bg-yellow-500/10",
  green:  "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
};

const SCORE_STROKE: Record<string, string> = {
  red:    "text-red-500",
  orange: "text-orange-500",
  yellow: "text-yellow-500",
  green:  "text-emerald-500",
};

function SeverityPill({ s }: { s: string }) {
  const cls = SEVERITY_STYLES[s.toLowerCase()] ?? "bg-white/10 text-white/60 border-white/20";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {s}
    </span>
  );
}

/* ═══════════════════════════════════════════ */
export default function Home() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("auto");
  const [fixedCode, setFixedCode] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const analyzeCode = useAnalyzeCode();

  useEffect(() => {
    if (analyzeCode.data?.fixed_code) setFixedCode(analyzeCode.data.fixed_code);
  }, [analyzeCode.data]);

  const handleAnalyze = () => {
    if (!code.trim()) return;
    analyzeCode.mutate(
      { data: { code, language: language === "auto" ? undefined : language } },
      {
        onError: (err) =>
          toast({
            variant: "destructive",
            title: "Analysis failed",
            description: (err as any)?.error ?? "Unexpected error",
          }),
      }
    );
  };

  const copyFixed = async () => {
    await navigator.clipboard.writeText(fixedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const data = analyzeCode.data;
  const verdictColor = data?.verdict_color?.toLowerCase() ?? "green";

  return (
    /* full-viewport dark shell */
    <div className="h-screen flex flex-col bg-[#0a0d12] text-white font-sans dark overflow-hidden">

      {/* ── Top bar ── */}
      <header className="shrink-0 h-12 border-b border-white/8 flex items-center justify-between px-5 bg-[#0d1117]">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-sm tracking-tight text-white">BugPredictor</span>
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-white/40">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Scanner ready
        </div>
      </header>

      {/* ── Two-column body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ╔══════════════ LEFT PANEL ══════════════╗ */}
        <div className="flex flex-col w-[48%] border-r border-white/8 overflow-hidden">

          {/* Editor toolbar */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-white/8 bg-[#0d1117]">
            <Terminal className="w-3.5 h-3.5 text-white/30" />
            <span className="text-[11px] font-mono text-white/30 flex-1">
              {language === "auto" ? "unknown.src" : `main.${language}`}
              {code ? ` · ${code.split("\n").length} lines` : ""}
            </span>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="h-7 w-[130px] text-[11px] bg-white/5 border-white/10 text-white/70 hover:bg-white/8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#161b22] border-white/10 text-white text-xs">
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value} className="text-xs hover:bg-white/5">
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAnalyze}
              disabled={!code.trim() || analyzeCode.isPending}
              size="sm"
              className="h-7 px-3 text-[11px] font-semibold gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-black disabled:opacity-40"
            >
              {analyzeCode.isPending ? (
                <><div className="w-2.5 h-2.5 border-2 border-black/50 border-t-black rounded-full animate-spin" /> Scanning</>
              ) : (
                <><Play className="w-3 h-3" fill="currentColor" /> Analyze</>
              )}
            </Button>
          </div>

          {/* Code editor — scrollable */}
          <div className="flex-1 overflow-auto bg-[#0d1117]">
            <CodeEditor
              value={code}
              onChange={(v) => { setCode(v); }}
              placeholder="Paste your source code here…"
            />
          </div>

          {/* Sample snippets (only when empty) */}
          {!code && !data && !analyzeCode.isPending && (
            <div className="shrink-0 px-4 py-3 border-t border-white/8 bg-[#0d1117]">
              <p className="text-[10px] uppercase tracking-wider text-white/25 mb-2">Try a sample</p>
              <div className="flex flex-wrap gap-1.5">
                {SNIPPETS.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => { setCode(s.code); setLanguage(s.lang); setFixedCode(""); }}
                    className="text-[11px] px-2.5 py-1 rounded border border-white/10 bg-white/4 text-white/50 hover:bg-white/8 hover:text-white/80 transition-colors"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fixed code panel */}
          {(data || fixedCode) && (
            <div className="shrink-0 flex flex-col border-t border-white/8 bg-[#0d1117]" style={{ maxHeight: "40%" }}>
              <div className="flex items-center gap-2 px-4 py-2 border-b border-white/8">
                <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] font-semibold text-emerald-400">Fixed Code</span>
                <span className="text-[10px] text-white/25 ml-1">editable</span>
                <button
                  onClick={copyFixed}
                  disabled={!fixedCode}
                  className="ml-auto flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 disabled:opacity-30 transition-colors"
                >
                  {copied ? <><Check className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">Copied</span></> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
              </div>
              <div className="overflow-auto flex-1">
                <CodeEditor value={fixedCode} onChange={setFixedCode} minLines={6} />
              </div>
            </div>
          )}
        </div>

        {/* ╔══════════════ RIGHT PANEL ══════════════╗ */}
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Panel header */}
          <div className="shrink-0 flex items-center justify-between px-5 py-2.5 border-b border-white/8 bg-[#0d1117]">
            <div className="flex items-center gap-2 text-[12px] text-white/40">
              <AlertTriangle className="w-3.5 h-3.5" />
              Analysis Report
            </div>
            {data && (
              <span className="text-[11px] font-mono text-white/25">
                {new Date(data.stats.analyzed_at).toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* ── Loading ── */}
          {analyzeCode.isPending && (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20" />
                <svg className="w-16 h-16 animate-spin" style={{ animationDuration: "2s" }}>
                  <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="40 100" className="text-cyan-400" />
                </svg>
                <ShieldAlert className="absolute inset-0 m-auto w-6 h-6 text-cyan-400/60" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/70">Running deep scan</p>
                <p className="text-[12px] text-white/30 mt-1">Checking security, bugs, complexity…</p>
              </div>
            </div>
          )}

          {/* ── Empty state ── */}
          {!analyzeCode.isPending && !data && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
              <div className="w-12 h-12 rounded-full border border-white/8 flex items-center justify-center bg-white/3">
                <ShieldAlert className="w-5 h-5 text-white/15" />
              </div>
              <p className="text-sm text-white/40">Awaiting target</p>
              <p className="text-[12px] text-white/20 max-w-[220px]">Paste code on the left and click Analyze</p>
            </div>
          )}

          {/* ── Results ── */}
          {!analyzeCode.isPending && data && (
            <div className="flex-1 flex flex-col overflow-hidden">

              {/* Score + verdict bar (fixed, never scrolls) */}
              <div className="shrink-0 px-5 py-4 border-b border-white/8 flex items-center gap-5">
                {/* Ring */}
                <div className="relative w-16 h-16 shrink-0">
                  <svg className="w-16 h-16 -rotate-90">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="5" className="text-white/8" />
                    <circle
                      cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="5"
                      strokeDasharray={175.9}
                      strokeDashoffset={175.9 - (175.9 * data.score) / 100}
                      className={`transition-all duration-700 ${SCORE_STROKE[verdictColor] ?? "text-cyan-400"}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-lg font-bold font-mono text-white">
                    {data.score}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${VERDICT_STYLES[verdictColor] ?? ""}`}>
                      {data.verdict}
                    </span>
                    <span className="text-[11px] text-white/30 font-mono ml-auto shrink-0">
                      {data.stats.language} · {data.stats.loc} loc
                    </span>
                  </div>
                  <p className="text-[12px] text-white/50 leading-relaxed line-clamp-2">{data.summary}</p>
                </div>
              </div>

              {/* Severity counts (fixed) */}
              <div className="shrink-0 grid grid-cols-4 gap-px border-b border-white/8 bg-white/5">
                {[
                  { label: "Critical", count: data.severity_counts.critical, cls: "text-red-400 bg-red-500/5" },
                  { label: "High",     count: data.severity_counts.high,     cls: "text-orange-400 bg-orange-500/5" },
                  { label: "Medium",   count: data.severity_counts.medium,   cls: "text-yellow-400 bg-yellow-500/5" },
                  { label: "Low",      count: data.severity_counts.low,      cls: "text-blue-400 bg-blue-500/5" },
                ].map(({ label, count, cls }) => (
                  <div key={label} className={`flex flex-col items-center py-3 ${cls} bg-[#0a0d12]`}>
                    <span className={`text-xl font-bold font-mono ${cls.split(" ")[0]}`}>{count}</span>
                    <span className="text-[9px] uppercase tracking-wider text-white/25 mt-0.5">{label}</span>
                  </div>
                ))}
              </div>

              {/* ── Issues list — THIS is the scrollable part ── */}
              <div className="flex-1 overflow-y-auto">
                {data.issues.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500/60" />
                    <p className="text-sm font-medium text-emerald-400">No issues found</p>
                    <p className="text-[12px] text-white/30">Code looks clean</p>
                  </div>
                ) : (
                  <div className="px-4 py-3 space-y-2">
                    {/* Issues header */}
                    <div className="flex items-center gap-2 pb-1">
                      <span className="text-[10px] uppercase tracking-wider text-white/25 font-semibold">
                        Detected Issues
                      </span>
                      <span className="ml-auto text-[10px] font-mono text-white/20">{data.total_issues} total</span>
                    </div>

                    {data.issues.map((issue, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-white/8 bg-white/[0.03] hover:bg-white/[0.05] transition-colors overflow-hidden"
                      >
                        {/* Issue row: number + severity + type + line */}
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/6 bg-white/[0.02]">
                          <span className="shrink-0 w-4 h-4 rounded-full border border-white/10 flex items-center justify-center text-[9px] font-bold text-white/30 font-mono">
                            {i + 1}
                          </span>
                          <SeverityPill s={issue.severity} />
                          <span className="text-[10px] font-mono uppercase tracking-wide text-white/30 border border-white/10 px-1.5 py-0.5 rounded bg-white/4">
                            {issue.type}
                          </span>
                          {issue.line != null && (
                            <span className="ml-auto text-[10px] font-mono text-white/25 shrink-0">
                              ln {issue.line}
                            </span>
                          )}
                        </div>

                        {/* Message */}
                        <div className="px-3 pt-2 pb-1">
                          <p className="text-[13px] text-white/75 leading-snug">{issue.message}</p>
                        </div>

                        {/* Fix block */}
                        <div className="mx-3 mb-2.5 mt-1.5 rounded border border-white/8 overflow-hidden bg-[#0d1117]">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 border-b border-white/6 bg-cyan-500/5">
                            <ChevronRight className="w-3 h-3 text-cyan-500/60 shrink-0" />
                            <span className="text-[9px] uppercase tracking-wider font-bold text-cyan-500/50">Fix</span>
                          </div>
                          <pre className="px-3 py-2 text-[11.5px] text-white/50 font-mono leading-relaxed whitespace-pre-wrap break-words">
                            {issue.suggestion}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
