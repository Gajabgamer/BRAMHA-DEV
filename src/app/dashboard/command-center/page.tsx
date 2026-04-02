"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  AudioLines,
  BellRing,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCode2,
  GitPullRequestArrow,
  Loader2,
  MessageSquareText,
  Mic,
  PauseCircle,
  RefreshCw,
  SendHorizonal,
  Sparkles,
  Ticket,
  Volume2,
  Download,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  api,
  type AgentAction,
  type AgentAnomaly,
  type AgentChatResponse,
  type AgentExecutiveSummary,
  type AgentMemoryHighlight,
  type AgentPrediction,
  type AgentPriorityResult,
  type AgentTrend,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { toUserFacingError } from "@/lib/user-facing-errors";
import { useAgent } from "@/providers/AgentProvider";
import { useAuth } from "@/providers/AuthProvider";
import {
  speakText,
  startVoiceRecognition,
  stopSpeaking,
  supportsVoiceInput,
} from "@/services/voiceClient";

type CommandFilter = "all" | "critical" | "actions" | "insights";

type CommandMessage =
  | {
      id: string;
      role: "assistant";
      text: string;
      meta?: AgentChatResponse;
    }
  | {
      id: string;
      role: "user";
      text: string;
    };

const FILTERS: Array<{ id: CommandFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "critical", label: "Critical" },
  { id: "actions", label: "Actions" },
  { id: "insights", label: "Insights" },
];

const QUICK_PROMPTS = [
  "Show critical issues",
  "Explain last action",
  "What needs attention?",
];

function getActionIssueId(action: AgentAction | null) {
  if (!action) {
    return null;
  }

  const linkedIssueId = action.metadata?.linkedIssueId;
  if (typeof linkedIssueId === "string" && linkedIssueId) {
    return linkedIssueId;
  }

  const issueId = action.metadata?.issueId;
  if (typeof issueId === "string" && issueId && !issueId.includes(":")) {
    return issueId;
  }

  return null;
}

function getActionConfidence(action: AgentAction | null) {
  const value = Number(action?.metadata?.confidenceScore ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function getConfidenceVariant(score: number) {
  if (score > 70) return "success";
  if (score >= 40) return "default";
  return "destructive";
}

function getActionVariant(action: AgentAction) {
  if (
    action.actionType === "ticket_created" ||
    action.actionType === "reminder_created" ||
    action.actionType === "calendar_event_created" ||
    action.actionType === "pr_created"
  ) {
    return "actions" as const;
  }

  return "insights" as const;
}

function getActionSeverity(action: AgentAction) {
  const priorityLevel = String(action.metadata?.priorityLevel || "").toLowerCase();
  const confidence = getActionConfidence(action);

  if (
    priorityLevel === "critical" ||
    priorityLevel === "high" ||
    action.actionType === "predictive_alert" ||
    (action.actionType === "spike_detected" &&
      String(action.metadata?.spikeLevel || "").toLowerCase() === "high")
  ) {
    return "critical";
  }

  if (confidence >= 70) {
    return "high";
  }

  return "normal";
}

function formatActionTitle(action: AgentAction) {
  switch (action.actionType) {
    case "issue_detected":
      return "Issue detected";
    case "spike_detected":
      return "Spike detected";
    case "predictive_alert":
      return "Predictive alert";
    case "ticket_created":
      return "Ticket created";
    case "reminder_created":
      return "Reminder scheduled";
    case "calendar_event_created":
      return "Calendar event scheduled";
    case "calendar_event_skipped":
      return "Calendar action skipped";
    case "action_suggested":
      return "Suggested action ready";
    case "email_reply_sent":
      return "Auto reply sent";
    case "email_reply_skipped":
      return "Auto reply skipped";
    case "patch_suggested":
      return "Patch suggested";
    case "pr_created":
      return "Pull request created";
    default:
      return action.actionType
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}

function getActionIcon(action: AgentAction) {
  switch (action.actionType) {
    case "issue_detected":
      return BrainCircuit;
    case "spike_detected":
    case "predictive_alert":
      return BellRing;
    case "ticket_created":
      return Ticket;
    case "reminder_created":
    case "calendar_event_created":
      return Clock3;
    case "patch_suggested":
      return FileCode2;
    case "pr_created":
      return GitPullRequestArrow;
    default:
      return Zap;
  }
}

function getActionBullets(action: AgentAction | null, priority: AgentPriorityResult | null) {
  if (!action) {
    return [];
  }

  const bullets: string[] = [];
  const confidenceReasoning = String(action.metadata?.confidenceReasoning || "");
  const plannerReasoning = String(action.metadata?.plannerReasoning || "");
  const predictionText = String(
    (action.metadata?.prediction as { prediction?: string } | undefined)?.prediction ||
      ""
  );

  if (confidenceReasoning) {
    bullets.push(
      ...confidenceReasoning
        .split("\n")
        .map((line) => line.replace(/^- /, "").trim())
        .filter(
          (line) =>
            line &&
            !line.toLowerCase().startsWith("confidence:") &&
            line.toLowerCase() !== "based on:"
        )
    );
  }

  if (plannerReasoning) {
    bullets.push(plannerReasoning);
  }

  if (predictionText) {
    bullets.push(predictionText);
  }

  if (priority?.reasoning) {
    bullets.push(priority.reasoning);
  }

  if (bullets.length === 0 && action.reason) {
    bullets.push(action.reason);
  }

  return [...new Set(bullets)].slice(0, 5);
}

function matchesFilter(action: AgentAction, filter: CommandFilter) {
  if (filter === "all") return true;
  if (filter === "critical") return getActionSeverity(action) === "critical";
  return getActionVariant(action) === filter;
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));

  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
}

function StatusMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function buildProactiveInsights(
  predictions: AgentPrediction[],
  anomalies: AgentAnomaly[],
  summary: AgentExecutiveSummary | null
) {
  const insights = [
    ...predictions.slice(0, 2).map((entry) => ({
      id: `prediction-${entry.issue_type}`,
      text: entry.prediction,
      type: "prediction" as const,
    })),
    ...anomalies.slice(0, 2).map((entry) => ({
      id: `anomaly-${entry.issue_type}`,
      text: `${entry.issue_type_label} is showing a ${entry.spike_level} anomaly spike.`,
      type: "anomaly" as const,
    })),
    ...(summary?.recommendations || []).slice(0, 2).map((text, index) => ({
      id: `recommendation-${index}`,
      text,
      type: "recommendation" as const,
    })),
  ];

  return insights.slice(0, 4);
}

function getTimelineActions(actions: AgentAction[], selectedAction: AgentAction | null) {
  const issueId = getActionIssueId(selectedAction);
  const relevant = issueId
    ? actions.filter((action) => getActionIssueId(action) === issueId)
    : selectedAction
      ? [selectedAction]
      : [];

  return [...relevant]
    .sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    )
    .slice(-5);
}

function summarizeMemory(memory: AgentMemoryHighlight) {
  const content = memory.content || {};
  const summary = content.summary;
  if (typeof summary === "string" && summary.trim()) {
    return summary.trim();
  }

  const reason = content.reason;
  if (typeof reason === "string" && reason.trim()) {
    return reason.trim();
  }

  const question = content.question;
  const answer = content.answer;
  if (typeof question === "string" && typeof answer === "string") {
    return `${question} ${answer}`.trim();
  }

  return "Stored context from a previous important system moment.";
}

function getMemoryTone(memoryType: string) {
  switch (memoryType) {
    case "issue":
      return "Issue memory";
    case "action":
      return "Action memory";
    case "decision":
      return "User decision";
    case "chat":
      return "Conversation";
    default:
      return "Memory";
  }
}

export default function CommandCenterPage() {
  const { session } = useAuth();
  const { status, actions, loading, error, refreshAgent } = useAgent();
  const [filter, setFilter] = useState<CommandFilter>("all");
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [anomalies, setAnomalies] = useState<AgentAnomaly[]>([]);
  const [predictions, setPredictions] = useState<AgentPrediction[]>([]);
  const [trends, setTrends] = useState<AgentTrend[]>([]);
  const [intelLoading, setIntelLoading] = useState(true);
  const [intelError, setIntelError] = useState<string | null>(null);
  const [priority, setPriority] = useState<AgentPriorityResult | null>(null);
  const [priorityLoading, setPriorityLoading] = useState(false);
  const [executiveSummary, setExecutiveSummary] = useState<AgentExecutiveSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [messages, setMessages] = useState<CommandMessage[]>([
    {
      id: "command-center-welcome",
      role: "assistant",
      text:
        "I can explain what the agent is doing, what is escalating, and what needs attention first.",
    },
  ]);
  const voiceEnabled = supportsVoiceInput();

  useEffect(() => {
    if (!session?.access_token) {
      setAnomalies([]);
      setPredictions([]);
      setTrends([]);
      setIntelLoading(false);
      setIntelError(null);
      return;
    }

    let cancelled = false;

    const loadIntel = async (showLoading = true) => {
      if (showLoading) setIntelLoading(true);
      setIntelError(null);

      try {
        const [nextAnomalies, nextPredictions, nextTrends] = await Promise.all([
          api.agent.anomalies(session.access_token),
          api.agent.predictions(session.access_token),
          api.agent.trends(session.access_token),
        ]);

        if (cancelled) return;
        setAnomalies(nextAnomalies);
        setPredictions(nextPredictions);
        setTrends(nextTrends);
      } catch (err) {
        if (!cancelled) {
          setIntelError(toUserFacingError(err, "agent-load"));
        }
      } finally {
        if (!cancelled) {
          setIntelLoading(false);
        }
      }
    };

    void loadIntel();
    const timer = window.setInterval(() => {
      void loadIntel(false);
    }, 12000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [session?.access_token]);

  useEffect(() => {
    if (!session?.access_token) {
      setExecutiveSummary(null);
      setSummaryLoading(false);
      setSummaryError(null);
      return;
    }

    let cancelled = false;

    const loadSummary = async (showLoading = true) => {
      if (showLoading) setSummaryLoading(true);
      setSummaryError(null);

      try {
        const nextSummary = await api.agent.executiveSummary(session.access_token);
        if (!cancelled) {
          setExecutiveSummary(nextSummary);
        }
      } catch (err) {
        if (!cancelled) {
          setSummaryError(toUserFacingError(err, "agent-load"));
        }
      } finally {
        if (!cancelled) {
          setSummaryLoading(false);
        }
      }
    };

    void loadSummary();
    const timer = window.setInterval(() => {
      void loadSummary(false);
    }, 18000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [session?.access_token]);

  const filteredActions = useMemo(
    () => actions.filter((action) => matchesFilter(action, filter)),
    [actions, filter]
  );

  useEffect(() => {
    if (!selectedActionId || !filteredActions.some((action) => action.id === selectedActionId)) {
      setSelectedActionId(filteredActions[0]?.id ?? null);
    }
  }, [filteredActions, selectedActionId]);

  const selectedAction = useMemo(
    () =>
      filteredActions.find((action) => action.id === selectedActionId) ||
      filteredActions[0] ||
      null,
    [filteredActions, selectedActionId]
  );

  useEffect(() => {
    if (!session?.access_token) {
      setPriority(null);
      setPriorityLoading(false);
      return;
    }

    const issueId = getActionIssueId(selectedAction);
    if (!issueId) {
      setPriority(null);
      setPriorityLoading(false);
      return;
    }

    let cancelled = false;

    const loadPriority = async () => {
      setPriorityLoading(true);
      try {
        const nextPriority = await api.agent.priority(session.access_token, issueId);
        if (!cancelled) {
          setPriority(nextPriority);
        }
      } catch {
        if (!cancelled) {
          setPriority(null);
        }
      } finally {
        if (!cancelled) {
          setPriorityLoading(false);
        }
      }
    };

    void loadPriority();

    return () => {
      cancelled = true;
    };
  }, [selectedAction, session?.access_token]);

  const issuesDetectedToday = useMemo(
    () =>
      actions.filter((action) => {
        if (action.actionType !== "issue_detected") return false;
        return new Date(action.createdAt).toDateString() === new Date().toDateString();
      }).length,
    [actions]
  );

  const actionsTakenToday = useMemo(
    () =>
      actions.filter((action) => {
        if (
          !["ticket_created", "reminder_created", "calendar_event_created", "predictive_alert"].includes(
            action.actionType
          )
        ) {
          return false;
        }
        return new Date(action.createdAt).toDateString() === new Date().toDateString();
      }).length,
    [actions]
  );

  const accuracyScore = useMemo(() => {
    const scores = actions
      .map((action) => Number(action.metadata?.confidenceScore ?? 0))
      .filter((score) => Number.isFinite(score) && score > 0);

    if (scores.length === 0) return 81;
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }, [actions]);

  const selectedConfidence =
    priority?.confidence.score || getActionConfidence(selectedAction || null);
  const selectedBullets = getActionBullets(selectedAction, priority);
  const selectedIcon = selectedAction ? getActionIcon(selectedAction) : BrainCircuit;
  const proactiveInsights = buildProactiveInsights(
    predictions,
    anomalies,
    executiveSummary
  );
  const decisionTimeline = getTimelineActions(actions, selectedAction);

  const submitChat = async (message: string) => {
    const trimmed = message.trim();
    if (!session?.access_token || !trimmed) return;

    setChatError(null);
    setChatLoading(true);
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", text: trimmed },
    ]);
    setChatInput("");
    setChatOpen(true);

    try {
      const response = await api.agent.chat(session.access_token, trimmed);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: response.answer,
          meta: response,
        },
      ]);
      speakText(response.answer);
      setVoiceSpeaking(true);
      window.setTimeout(() => {
        setVoiceSpeaking(false);
      }, Math.min(8000, Math.max(2000, response.answer.length * 45)));
    } catch (err) {
      setChatError(toUserFacingError(err, "ai-helper"));
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await submitChat(chatInput);
  };

  const handleVoiceInput = async () => {
    if (!voiceEnabled || voiceListening) {
      return;
    }

    setChatError(null);
    setVoiceListening(true);
    try {
      const result = await startVoiceRecognition();
      if (result.text) {
        setChatInput(result.text);
        await submitChat(result.text);
      }
    } catch (err) {
      setChatError(toUserFacingError(err, "ai-helper"));
    } finally {
      setVoiceListening(false);
    }
  };

  const handleDownloadReport = () => {
    if (!executiveSummary) {
      return;
    }

    const lines = [
      "Product Pulse Executive Summary",
      `Generated: ${new Date(executiveSummary.generatedAt).toLocaleString()}`,
      "",
      executiveSummary.summary,
      "",
      "Top Issues:",
      ...executiveSummary.topIssues.map(
        (issue) =>
          `- ${issue.title} (${issue.priority}, ${issue.reportCount} reports, ${issue.trendPercent}% trend)`
      ),
      "",
      "Risks:",
      ...executiveSummary.risks.map((risk) => `- ${risk}`),
      "",
      "Recommendations:",
      ...executiveSummary.recommendations.map((item) => `- ${item}`),
    ].join("\n");

    const blob = new Blob([lines], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "product-pulse-executive-summary.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateSummary = async () => {
    if (!session?.access_token) {
      return;
    }

    setSummaryError(null);
    setSummaryLoading(true);
    try {
      const nextSummary = await api.agent.executiveSummary(session.access_token);
      setExecutiveSummary(nextSummary);
    } catch (err) {
      setSummaryError(toUserFacingError(err, "agent-load"));
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <TooltipProvider delay={120}>
      <div className="space-y-6">
        <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
          <Card className="rounded-[28px] border border-slate-800 bg-slate-900/70 shadow-[0_18px_60px_rgba(15,23,42,0.22)]">
            <CardHeader className="border-b border-slate-800/90 pb-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-white">Executive Summary</CardTitle>
                  <p className="mt-1 text-sm text-slate-400">
                    Auto-generated leadership view of issues, actions, risks, and recommendations.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleGenerateSummary()}
                    disabled={!session?.access_token || summaryLoading}
                  >
                    {summaryLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Generate Summary
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadReport}
                    disabled={!executiveSummary}
                  >
                    <Download className="h-4 w-4" />
                    Download Report
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pb-6 pt-5">
              {summaryLoading ? (
                <>
                  <Skeleton className="h-5 w-2/3 bg-slate-800" />
                  <Skeleton className="h-20 w-full bg-slate-800" />
                </>
              ) : executiveSummary ? (
                <>
                  <p className="text-sm leading-7 text-slate-300">{executiveSummary.summary}</p>
                  {summaryError ? (
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                      {summaryError}
                    </div>
                  ) : null}
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                        Top Issues
                      </p>
                      <div className="mt-3 space-y-2">
                        {executiveSummary.topIssues.slice(0, 2).map((issue) => (
                          <p key={issue.id} className="text-sm text-slate-200">
                            {issue.title}
                          </p>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                        Risks
                      </p>
                      <div className="mt-3 space-y-2">
                        {executiveSummary.risks.slice(0, 2).map((risk, index) => (
                          <p key={index} className="text-sm text-slate-200">
                            {risk}
                          </p>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                        Recommendations
                      </p>
                      <div className="mt-3 space-y-2">
                        {executiveSummary.recommendations.slice(0, 2).map((item, index) => (
                          <p key={index} className="text-sm text-slate-200">
                            {item}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                  {executiveSummary.memoryHighlights.length > 0 ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-white">
                        <AudioLines className="h-4 w-4 text-indigo-300" />
                        Memory Highlights
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {executiveSummary.memoryHighlights.slice(0, 4).map((memory) => (
                          <div
                            key={memory.id}
                            className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
                          >
                            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                              {getMemoryTone(memory.memoryType)}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-300">
                              {summarizeMemory(memory)}
                            </p>
                            <p className="mt-3 text-xs text-slate-500">
                              {formatRelativeTime(memory.createdAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-5 text-sm text-slate-400">
                  {summaryError || "Executive summary is not available yet."}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border border-slate-800 bg-slate-900/70 shadow-[0_18px_60px_rgba(15,23,42,0.22)]">
            <CardHeader className="border-b border-slate-800/90 pb-5">
              <CardTitle className="text-white">Proactive Insights</CardTitle>
              <p className="mt-1 text-sm text-slate-400">
                Signals the system thinks are likely to need attention next.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pb-6 pt-5">
              {proactiveInsights.length > 0 ? (
                proactiveInsights.map((insight) => (
                  <div
                    key={insight.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4 transition-all duration-200 hover:border-slate-700"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-200">
                        {insight.type === "prediction" ? (
                          <BellRing className="h-4 w-4" />
                        ) : insight.type === "anomaly" ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                      </div>
                      <p className="text-sm leading-6 text-slate-300">{insight.text}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-5 text-sm text-slate-400">
                  No proactive insight is active right now.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatusMetric
            label="System Status"
            value={
              status.state === "processing"
                ? "Processing"
                : status.state === "active"
                  ? "Active"
                  : "Idle"
            }
          />
          <StatusMetric label="Issues Detected Today" value={issuesDetectedToday} />
          <StatusMetric label="Actions Taken" value={actionsTakenToday} />
          <StatusMetric label="Accuracy" value={`${accuracyScore}%`} />
        </section>

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
          <Card className="rounded-[28px] border border-slate-800 bg-slate-900/70 shadow-[0_18px_60px_rgba(15,23,42,0.22)]">
            <CardHeader className="border-b border-slate-800/90 pb-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-white">Agent Activity</CardTitle>
                  <p className="mt-1 text-sm text-slate-400">
                    Live autonomous decisions, alerts, and agent insights.
                  </p>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => void refreshAgent()}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFilter(item.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200",
                      filter === item.id
                        ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-200"
                        : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="max-h-[66vh] space-y-3 overflow-y-auto pb-6 pt-5">
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4"
                  >
                    <Skeleton className="h-4 w-2/3 bg-slate-800" />
                    <Skeleton className="mt-3 h-3 w-1/2 bg-slate-800" />
                  </div>
                ))
              ) : filteredActions.length > 0 ? (
                filteredActions.map((action) => {
                  const Icon = getActionIcon(action);
                  const score = getActionConfidence(action);
                  const issueId = getActionIssueId(action);

                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => setSelectedActionId(action.id)}
                      className={cn(
                        "w-full rounded-2xl border p-4 text-left transition-all duration-200",
                        selectedAction?.id === action.id
                          ? "border-indigo-500/30 bg-indigo-500/10 shadow-[0_14px_40px_rgba(99,102,241,0.12)]"
                          : "border-slate-800 bg-slate-950/55 hover:border-slate-700 hover:bg-slate-950/80"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-200">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {formatActionTitle(action)}
                            </p>
                            <p className="mt-1 line-clamp-2 text-sm text-slate-400">
                              {action.reason}
                            </p>
                          </div>
                        </div>
                        {score > 0 ? (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge
                                variant={getConfidenceVariant(score)}
                                className="border-none"
                              >
                                {score}%
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              How confident the system is in this decision
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
                        <span>{formatRelativeTime(action.createdAt)}</span>
                        {issueId ? (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            View issue
                            <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-5 text-sm text-slate-400">
                  {error || "No agent activity matches this filter yet."}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="rounded-[28px] border border-slate-800 bg-slate-900/70 shadow-[0_18px_60px_rgba(15,23,42,0.22)]">
            <CardHeader className="border-b border-slate-800/90 pb-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/70 text-indigo-300">
                    {(() => {
                      const Icon = selectedIcon;
                      return <Icon className="h-5 w-5" />;
                    })()}
                  </div>
                  <div>
                    <CardTitle className="text-white">
                      {selectedAction
                        ? selectedAction.reason.split(".")[0]
                        : "Decision Details"}
                    </CardTitle>
                    <p className="mt-1 text-sm text-slate-400">
                      Why the system decided this, what it did, and what happens next.
                    </p>
                  </div>
                </div>
                {selectedConfidence > 0 ? (
                  <Badge
                    variant={getConfidenceVariant(selectedConfidence)}
                    className="w-fit border-none px-3 py-1.5 text-sm"
                  >
                    {selectedConfidence}% Confidence
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pb-6 pt-5">
              {selectedAction ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                        Status
                      </p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {selectedAction.actionType === "ticket_created" ||
                        selectedAction.actionType === "reminder_created"
                          ? "In Progress"
                          : "Monitoring"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                        Risk Level
                      </p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {priorityLoading
                          ? "Loading..."
                          : priority?.priority_level
                            ? `${priority.priority_level[0].toUpperCase()}${priority.priority_level.slice(1)}`
                            : getActionSeverity(selectedAction) === "critical"
                              ? "High"
                              : "Medium"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                        Timestamp
                      </p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {new Date(selectedAction.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-800 bg-slate-950/55 p-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <Sparkles className="h-4 w-4 text-indigo-300" />
                      Why this decision?
                    </div>
                    <div className="mt-4 space-y-3">
                      {selectedBullets.map((bullet, index) => (
                        <div key={`${selectedAction.id}-${index}`} className="flex gap-3">
                          <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-400" />
                          <p className="text-sm leading-6 text-slate-300">{bullet}</p>
                        </div>
                      ))}
                    </div>
                    {priority?.confidence.reasoning ? (
                      <p className="mt-4 text-xs text-slate-500">
                        System accuracy for this issue type:{" "}
                        {Math.round(priority.confidence.score)}%
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
                    <div className="rounded-3xl border border-slate-800 bg-slate-950/55 p-5">
                      <div className="flex items-center gap-2 text-sm font-medium text-white">
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        Actions Taken
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(priority?.actions.length
                          ? priority.actions
                          : [selectedAction.actionType]
                        ).map((actionLabel) => (
                          <Badge key={actionLabel} variant="outline" className="text-slate-300">
                            {actionLabel.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>

                      {getActionIssueId(selectedAction) ? (
                        <div className="mt-5 flex flex-wrap gap-3">
                          <Link
                            href={`/dashboard/issues/${getActionIssueId(selectedAction)}`}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 transition hover:border-indigo-500/40 hover:text-white"
                          >
                            Open issue
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-3xl border border-slate-800 bg-slate-950/55 p-5">
                      <div className="flex items-center gap-2 text-sm font-medium text-white">
                        <AlertTriangle className="h-4 w-4 text-amber-300" />
                        Live Signals
                      </div>
                      <div className="mt-4 space-y-3">
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                            Anomalies
                          </p>
                          <p className="mt-2 text-sm text-slate-200">{anomalies.length}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                            Predictions
                          </p>
                          <p className="mt-2 text-sm text-slate-200">{predictions.length}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                            Trend Direction
                          </p>
                          <p className="mt-2 text-sm text-slate-200">
                            {priority?.trend.trend_direction ||
                              trends[0]?.trend_direction ||
                              "stable"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-800 bg-slate-950/55 p-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <Sparkles className="h-4 w-4 text-sky-300" />
                      Timeline Snapshot
                    </div>
                    <div className="mt-5 flex items-end gap-2">
                      {(trends.slice(0, 6).length
                        ? trends.slice(0, 6)
                        : [{ summary: "No trend data yet", trend_growth_percent: 0 } as AgentTrend]
                      ).map((trend, index) => (
                        <div key={`${trend.issue_type || index}`} className="flex-1">
                          <div
                            className={cn(
                              "rounded-t-2xl transition-all duration-200",
                              Number(trend.trend_growth_percent) >= 12
                                ? "bg-rose-400/70"
                                : Number(trend.trend_growth_percent) <= -12
                                  ? "bg-emerald-400/70"
                                  : "bg-slate-700"
                            )}
                            style={{
                              height: `${Math.max(
                                22,
                                Math.min(
                                  96,
                                  Math.abs(Number(trend.trend_growth_percent || 0)) + 24
                                )
                              )}px`,
                            }}
                          />
                          <p className="mt-2 truncate text-[11px] text-slate-500">
                            {trend.issue_type_label || "Trend"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-800 bg-slate-950/55 p-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <Clock3 className="h-4 w-4 text-cyan-300" />
                      Decision Timeline
                    </div>
                    <div className="mt-5 space-y-4">
                      {decisionTimeline.length > 0 ? (
                        decisionTimeline.map((action, index) => {
                          const Icon = getActionIcon(action);
                          return (
                            <div key={action.id} className="flex gap-4">
                              <div className="flex flex-col items-center">
                                <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-200">
                                  <Icon className="h-4 w-4" />
                                </div>
                                {index < decisionTimeline.length - 1 ? (
                                  <div className="mt-2 h-10 w-px bg-slate-800" />
                                ) : null}
                              </div>
                              <div className="flex-1 pb-2">
                                <p className="text-sm font-medium text-white">
                                  {formatActionTitle(action)}
                                </p>
                                <p className="mt-1 text-sm leading-6 text-slate-400">
                                  {action.reason}
                                </p>
                                <p className="mt-2 text-xs text-slate-500">
                                  {new Date(action.createdAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-slate-400">
                          No linked timeline events are available for this decision yet.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : loading || intelLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-28 rounded-3xl bg-slate-800" />
                  <Skeleton className="h-40 rounded-3xl bg-slate-800" />
                  <Skeleton className="h-32 rounded-3xl bg-slate-800" />
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                  {intelError || "Select an agent log to inspect its decision details."}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="rounded-[28px] border border-slate-800 bg-slate-900/70 shadow-[0_18px_60px_rgba(15,23,42,0.22)]">
            <CardHeader className="border-b border-slate-800/90 pb-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/70 text-indigo-300">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Ask your system</CardTitle>
                    <p className="mt-1 text-sm text-slate-400">
                      Chat with the live agent state, issues, and decisions.
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="xl:hidden"
                  onClick={() => setChatOpen((current) => !current)}
                >
                  {chatOpen ? "Hide" : "Open"}
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void submitChat(prompt)}
                    className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleVoiceInput()}
                  disabled={!voiceEnabled || voiceListening || chatLoading}
                  className="transition-all duration-200 hover:shadow-[0_0_24px_rgba(99,102,241,0.18)]"
                >
                  {voiceListening ? (
                    <AudioLines className="h-4 w-4 animate-pulse" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                  {voiceListening ? "Listening..." : "Voice Input"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    stopSpeaking();
                    setVoiceSpeaking(false);
                  }}
                  disabled={!voiceSpeaking}
                >
                  <PauseCircle className="h-4 w-4" />
                  Stop Voice
                </Button>
                <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-400">
                  <Volume2 className="h-3.5 w-3.5 text-indigo-300" />
                  {voiceListening ? (
                    <span className="inline-flex items-center gap-1">
                      Listening
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-300" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-300 [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-300 [animation-delay:240ms]" />
                    </span>
                  ) : voiceSpeaking ? (
                    <span className="inline-flex items-center gap-1">
                      Speaking
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300 [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300 [animation-delay:240ms]" />
                    </span>
                  ) : voiceEnabled ? (
                    "Voice ready"
                  ) : (
                    "Voice unavailable"
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent
              className={cn(
                "space-y-4 pb-0 pt-5",
                chatOpen ? "block" : "hidden xl:block"
              )}
            >
              <div className="max-h-[54vh] space-y-4 overflow-y-auto pr-1">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "max-w-[92%]",
                      message.role === "user" ? "ml-auto" : "mr-auto"
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-3xl px-4 py-3 text-sm transition-all duration-200",
                        message.role === "user"
                          ? "rounded-br-md bg-indigo-500 text-white shadow-[0_16px_35px_rgba(99,102,241,0.3)]"
                          : "rounded-bl-md border border-slate-800 bg-slate-950/70 text-slate-200"
                      )}
                    >
                      {message.text}
                    </div>
                    {message.role === "assistant" && message.meta ? (
                      <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                          <MessageSquareText className="h-3.5 w-3.5 text-indigo-300" />
                          Suggested next steps
                        </div>
                        <div className="mt-3 space-y-2">
                          {message.meta.suggestedActions.map((action, index) => (
                            <p key={`${message.id}-${index}`} className="text-sm text-slate-300">
                              {index + 1}. {action}
                            </p>
                          ))}
                        </div>
                        {message.meta.suggestedIssueIds.length > 0 ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {message.meta.suggestedIssueIds.map((issueId) => (
                              <Link
                                key={issueId}
                                href={`/dashboard/issues/${issueId}`}
                                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300 transition hover:border-indigo-500/40 hover:text-white"
                              >
                                Open issue
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
                {chatLoading ? (
                  <div className="mr-auto max-w-[92%] rounded-3xl rounded-bl-md border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-300" />
                      The system is reasoning through live signals...
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="sticky bottom-0 border-t border-slate-800/90 bg-slate-900/95 py-5 backdrop-blur">
                {chatError ? (
                  <div className="mb-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                    {chatError}
                  </div>
                ) : null}
                <form onSubmit={handleChatSubmit} className="space-y-3">
                  <Input
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    placeholder="Ask why a ticket was created, what is escalating, or what to fix first..."
                    className="h-12 rounded-2xl border-slate-800 bg-slate-950/70 text-slate-100 placeholder:text-slate-500"
                  />
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleVoiceInput()}
                      disabled={!voiceEnabled || voiceListening || chatLoading}
                      className="h-12 rounded-2xl sm:w-[160px]"
                    >
                      {voiceListening ? (
                        <AudioLines className="mr-2 h-4 w-4 animate-pulse" />
                      ) : (
                        <Mic className="mr-2 h-4 w-4" />
                      )}
                      {voiceListening ? "Listening" : "Speak"}
                    </Button>
                    <Button
                      type="submit"
                      disabled={chatLoading || !chatInput.trim() || !session?.access_token}
                      className="h-12 w-full rounded-2xl bg-[linear-gradient(90deg,#61d5da_0%,#7599f8_38%,#b04cf2_70%,#eb2ee9_100%)] text-white hover:brightness-105"
                    >
                      <SendHorizonal className="mr-2 h-4 w-4" />
                      Send to Command Center
                    </Button>
                  </div>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}
