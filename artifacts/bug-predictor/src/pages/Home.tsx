import React, { useState, useRef, useEffect } from "react";
import { ShieldAlert, Play, Code2, AlertTriangle, FileCode2, CheckCircle2, ChevronRight, Copy, Check, Wrench } from "lucide-react";
import { useAnalyzeCode } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    name: "SQL Injection (Python)",
    code: `def get_user(username):\n    query = "SELECT * FROM users WHERE username = '" + username + "'"\n    cursor.execute(query)\n    return cursor.fetchone()`,
    lang: "python"
  },
  {
    name: "Insecure Eval (JS)",
    code: `app.post('/api/calculate', (req, res) => {\n  const { formula } = req.body;\n  // Evaluate user input directly\n  const result = eval(formula);\n  res.json({ result });\n});`,
    lang: "javascript"
  },
  {
    name: "Buffer Overflow (C)",
    code: `#include <stdio.h>\n#include <string.h>\n\nvoid vulnerable_function(char *input) {\n    char buffer[10];\n    strcpy(buffer, input);\n}\n\nint main(int argc, char *argv[]) {\n    vulnerable_function(argv[1]);\n    return 0;\n}`,
    lang: "c"
  }
];

function CodeEditorWithLineNumbers({
  value,
  onChange,
  placeholder,
  readOnly = false,
}: {
  value: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lines = value.split("\n");
  const lineCount = Math.max(lines.length, 1);

  const syncScroll = () => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden font-mono text-sm leading-relaxed">
      {/* Line numbers */}
      <div
        ref={lineNumbersRef}
        className="shrink-0 w-10 overflow-hidden bg-muted/20 border-r border-border/40 text-right select-none"
        style={{ paddingTop: "1rem", paddingBottom: "1rem" }}
        aria-hidden="true"
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div
            key={i + 1}
            className="text-muted-foreground/40 text-xs leading-relaxed pr-2"
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* Code textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        onScroll={syncScroll}
        placeholder={placeholder}
        readOnly={readOnly}
        spellCheck={false}
        className="flex-1 resize-none border-0 outline-none bg-transparent text-foreground/90 placeholder:text-muted-foreground/40 p-4 leading-relaxed"
        style={{ fontFamily: "inherit" }}
      />
    </div>
  );
}

export default function Home() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("auto");
  const [fixedCode, setFixedCode] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const analyzeCode = useAnalyzeCode();

  useEffect(() => {
    if (analyzeCode.data?.fixed_code) {
      setFixedCode(analyzeCode.data.fixed_code);
    }
  }, [analyzeCode.data]);

  const handleAnalyze = () => {
    if (!code.trim()) return;
    analyzeCode.mutate(
      {
        data: {
          code,
          language: language === "auto" ? undefined : language
        }
      },
      {
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Analysis Failed",
            description: (err as any)?.error || "An unexpected error occurred during analysis."
          });
        }
      }
    );
  };

  const applySnippet = (snippet: typeof SNIPPETS[0]) => {
    setCode(snippet.code);
    setLanguage(snippet.lang);
    setFixedCode("");
  };

  const handleCopyFixed = async () => {
    if (!fixedCode) return;
    await navigator.clipboard.writeText(fixedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getVerdictColor = (color: string) => {
    switch (color.toLowerCase()) {
      case 'red': return 'text-red-500 border-red-500 bg-red-500/10';
      case 'orange': return 'text-orange-500 border-orange-500 bg-orange-500/10';
      case 'yellow': return 'text-yellow-500 border-yellow-500 bg-yellow-500/10';
      case 'green': return 'text-emerald-500 border-emerald-500 bg-emerald-500/10';
      default: return 'text-primary border-primary bg-primary/10';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return <Badge variant="destructive" className="bg-red-500 hover:bg-red-600 uppercase text-[10px] font-bold">Critical</Badge>;
      case 'high': return <Badge variant="destructive" className="bg-orange-500 hover:bg-orange-600 uppercase text-[10px] font-bold">High</Badge>;
      case 'medium': return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 uppercase text-[10px] font-bold border-yellow-500/50">Medium</Badge>;
      case 'low': return <Badge variant="secondary" className="bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 uppercase text-[10px] font-bold border-blue-500/50">Low</Badge>;
      default: return <Badge variant="outline" className="uppercase text-[10px] font-bold">{severity}</Badge>;
    }
  };

  const scoreCircleColor = (score: number) => {
    if (score > 80) return 'text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]';
    if (score > 60) return 'text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]';
    if (score > 40) return 'text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]';
    return 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]';
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans dark">
      <header className="border-b border-border/40 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" />
            <span className="font-bold tracking-tight">BugPredictor</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Scanner Ready</span>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 grid lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Editor + Fixed Code */}
        <div className="flex flex-col gap-4">
          {/* Editor Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Code2 className="w-5 h-5 text-muted-foreground" />
              Source Target
            </h2>
            <div className="flex items-center gap-3">
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-[140px] h-8 text-xs bg-card border-border/50">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(lang => (
                    <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAnalyze}
                disabled={!code.trim() || analyzeCode.isPending}
                size="sm"
                className="h-8 gap-1.5 font-semibold"
              >
                {analyzeCode.isPending ? (
                  <>
                    <div className="w-3 h-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" fill="currentColor" />
                    Analyze
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Code Editor with Line Numbers */}
          <div className="border border-border/50 rounded-lg overflow-hidden bg-card/30 flex flex-col focus-within:border-primary/50 transition-colors shadow-sm min-h-[320px]">
            <div className="bg-muted/30 border-b border-border/50 px-4 py-2 flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span className="flex items-center gap-2">
                <FileCode2 className="w-3.5 h-3.5" />
                {language === 'auto' ? 'unknown.src' : `main.${language}`}
              </span>
              {code && <span>{code.split('\n').length} lines</span>}
            </div>
            <CodeEditorWithLineNumbers
              value={code}
              onChange={setCode}
              placeholder="Paste your source code here for static analysis..."
            />
          </div>

          {/* Test Snippets */}
          {!code && !analyzeCode.data && !analyzeCode.isPending && (
            <div className="bg-card/30 border border-border/50 rounded-lg p-4 shadow-sm">
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">Test Targets</h3>
              <div className="flex flex-wrap gap-2">
                {SNIPPETS.map((snippet, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="text-xs bg-background/50 border-border/50 hover:bg-muted/50 hover:text-primary transition-colors"
                    onClick={() => applySnippet(snippet)}
                  >
                    <FileCode2 className="w-3.5 h-3.5 mr-1.5 opacity-70" />
                    {snippet.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Fixed Code Section */}
          {(analyzeCode.data || fixedCode) && (
            <div className="border border-border/50 rounded-lg overflow-hidden bg-card/30 flex flex-col shadow-sm animate-in slide-in-from-bottom-2 duration-400">
              <div className="bg-muted/30 border-b border-border/50 px-4 py-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <Wrench className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-500 font-semibold">Fixed Code</span>
                  <span className="text-muted-foreground/50">— editable</span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleCopyFixed}
                  disabled={!fixedCode}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-500">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              {analyzeCode.isPending ? (
                <div className="flex items-center justify-center p-8 text-sm text-muted-foreground gap-2">
                  <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Generating fixed code...
                </div>
              ) : (
                <CodeEditorWithLineNumbers
                  value={fixedCode}
                  onChange={setFixedCode}
                />
              )}
            </div>
          )}
        </div>

        {/* Right Column: Analysis Report */}
        <div className="bg-card border border-border/50 rounded-lg overflow-hidden flex flex-col shadow-sm">
          <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/20">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-muted-foreground" />
              Analysis Report
            </h2>
            {analyzeCode.data && (
              <span className="text-xs font-mono text-muted-foreground">
                {analyzeCode.data.stats.analyzed_at && new Date(analyzeCode.data.stats.analyzed_at).toLocaleTimeString()}
              </span>
            )}
          </div>

          <ScrollArea className="flex-1 max-h-[calc(100vh-10rem)]">
            {analyzeCode.isPending ? (
              <div className="p-12 flex flex-col items-center justify-center text-center space-y-6 min-h-[400px] animate-in fade-in duration-500">
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-primary/20 rounded-full flex items-center justify-center bg-card shadow-inner">
                    <ShieldAlert className="w-10 h-10 text-primary animate-pulse" />
                  </div>
                  <svg className="absolute inset-0 w-24 h-24 animate-spin" style={{ animationDuration: '3s' }}>
                    <circle cx="48" cy="48" r="46" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="60 200" className="text-primary drop-shadow-[0_0_8px_rgba(0,188,212,0.8)]" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg text-foreground">Running Deep Scan</h3>
                  <p className="text-sm text-muted-foreground max-w-[280px]">
                    Analyzing control flow, checking for security vulnerabilities, and evaluating code quality...
                  </p>
                </div>
              </div>
            ) : analyzeCode.data ? (
              <div className="p-6 space-y-8 animate-in slide-in-from-bottom-4 duration-500">

                {/* Score Header */}
                <div className="flex items-center gap-6">
                  <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90 drop-shadow-md">
                      <circle cx="56" cy="56" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                      <circle
                        cx="56" cy="56" r="52" fill="none" stroke="currentColor" strokeWidth="8"
                        strokeDasharray={326.7}
                        strokeDashoffset={326.7 - (326.7 * analyzeCode.data.score) / 100}
                        className={`transition-all duration-1000 ease-out ${scoreCircleColor(analyzeCode.data.score)}`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold font-mono tracking-tighter text-foreground">{analyzeCode.data.score}</span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={`px-3 py-1 text-xs uppercase tracking-wider font-bold ${getVerdictColor(analyzeCode.data.verdict_color)}`}>
                        {analyzeCode.data.verdict}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded border border-border/50">
                        {analyzeCode.data.total_issues} issues found
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {analyzeCode.data.summary}
                    </p>
                  </div>
                </div>

                {/* Severity Breakdown */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 flex flex-col items-center justify-center transition-colors hover:bg-red-500/10">
                    <span className="text-2xl font-bold font-mono text-red-500">{analyzeCode.data.severity_counts.critical}</span>
                    <span className="text-[10px] uppercase font-bold text-red-500/70 tracking-wider mt-1">Critical</span>
                  </div>
                  <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3 flex flex-col items-center justify-center transition-colors hover:bg-orange-500/10">
                    <span className="text-2xl font-bold font-mono text-orange-500">{analyzeCode.data.severity_counts.high}</span>
                    <span className="text-[10px] uppercase font-bold text-orange-500/70 tracking-wider mt-1">High</span>
                  </div>
                  <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3 flex flex-col items-center justify-center transition-colors hover:bg-yellow-500/10">
                    <span className="text-2xl font-bold font-mono text-yellow-500">{analyzeCode.data.severity_counts.medium}</span>
                    <span className="text-[10px] uppercase font-bold text-yellow-500/70 tracking-wider mt-1">Medium</span>
                  </div>
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 flex flex-col items-center justify-center transition-colors hover:bg-blue-500/10">
                    <span className="text-2xl font-bold font-mono text-blue-500">{analyzeCode.data.severity_counts.low}</span>
                    <span className="text-[10px] uppercase font-bold text-blue-500/70 tracking-wider mt-1">Low</span>
                  </div>
                </div>

                <Separator className="bg-border/50" />

                {/* Issues List */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Detected Issues
                  </h3>

                  {analyzeCode.data.issues.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                      <h4 className="font-semibold text-emerald-500">Clean Code</h4>
                      <p className="text-sm text-emerald-500/70 mt-1">No significant issues detected in the analysis.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {analyzeCode.data.issues.map((issue, i) => (
                        <div key={i} className="group bg-card/50 border border-border/60 rounded-lg overflow-hidden transition-all hover:border-primary/40 hover:shadow-sm">
                          <div className="p-3 border-b border-border/40 bg-muted/10 flex items-start gap-3">
                            <div className="mt-0.5">{getSeverityBadge(issue.severity)}</div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1.5">
                                <Badge variant="outline" className="text-[9px] rounded font-mono bg-background/50 text-muted-foreground uppercase tracking-wide">
                                  {issue.type}
                                </Badge>
                                {issue.line && (
                                  <span className="text-[11px] font-mono text-muted-foreground ml-auto bg-muted/30 px-1.5 py-0.5 rounded">
                                    Line {issue.line}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-medium leading-snug text-foreground/90">{issue.message}</p>
                            </div>
                          </div>
                          <div className="p-3 bg-muted/5 flex items-start gap-2 group-hover:bg-primary/5 transition-colors">
                            <ChevronRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <p className="text-sm text-muted-foreground/90 leading-relaxed font-mono text-[13px]">{issue.suggestion}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
                <div className="w-16 h-16 rounded-full bg-card border border-border/50 flex items-center justify-center mb-4 shadow-sm">
                  <ShieldAlert className="w-8 h-8 text-muted-foreground/30" />
                </div>
                <h3 className="text-lg font-medium text-foreground">Awaiting Target</h3>
                <p className="text-sm text-muted-foreground/70 max-w-[280px] mt-2">
                  Paste your source code and initialize the scanner to detect security vulnerabilities and logic flaws.
                </p>
              </div>
            )}
          </ScrollArea>
        </div>
      </main>
    </div>
  );
}
