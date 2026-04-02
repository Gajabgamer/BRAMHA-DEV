"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileCode2,
  GitBranch,
  GitPullRequest,
  PencilLine,
  ShieldAlert,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";
import DecisionFeedbackBar from "@/components/DecisionFeedbackBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  AgentConfidenceResult,
  CodeInsightPullRequestResult,
  CodeInsightResult,
  GitHubConnectionStatus,
  GitHubRepository,
  IssueDetail,
} from "@/lib/api";
import { api } from "@/lib/api";
import { toUserFacingError } from "@/lib/user-facing-errors";
import type { GitHubAssistantPrompt } from "@/components/GitHubAssistantPanel";

interface CodeInsightPanelProps {
  token: string | null | undefined;
  issue: IssueDetail;
  trustConfidence?: AgentConfidenceResult | null;
  repositoryOverride?: Pick<GitHubRepository, "owner" | "name" | "defaultBranch"> | null;
  codeInsightsEnabled?: boolean;
  onAskAssistant?: (prompt: GitHubAssistantPrompt) => void;
  onAnalysisChange?: (analysis: CodeInsightResult | null) => void;
}

type ToastTone = "success" | "neutral";
type PrStage = "branch" | "patch" | "pull-request" | null;

const GITHUB_STATUS_CACHE_KEY = "product-pulse:github-status";

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function safeSessionStorageGet(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionStorageSet(key: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Best effort only.
  }
}

function getConfidence(result: CodeInsightResult) {
  if (typeof result.patchConfidence === "number") {
    if (result.patchConfidence > 70) {
      return {
        label: "High",
        variant: "success" as const,
        tone: "text-emerald-300",
      };
    }

    if (result.patchConfidence >= 40) {
      return {
        label: "Medium",
        variant: "secondary" as const,
        tone: "text-amber-200",
      };
    }

    return {
      label: "Low",
      variant: "destructive" as const,
      tone: "text-rose-300",
    };
  }

  if (result.files.length >= 3 && result.totalLines >= 180) {
    return {
      label: "High",
      variant: "success" as const,
      tone: "text-emerald-300",
    };
  }

  if (result.files.length >= 2 && result.totalLines >= 100) {
    return {
      label: "Medium",
      variant: "secondary" as const,
      tone: "text-amber-200",
    };
  }

  return {
    label: "Low",
    variant: "destructive" as const,
    tone: "text-rose-300",
  };
}

function getRisk(changedLineCount: number, fileCount: number) {
  if (fileCount <= 1 && changedLineCount <= 8) {
    return {
      label: "Low Risk",
      variant: "success" as const,
      description: "Small change surface with one focused file.",
    };
  }

  if (fileCount <= 2 && changedLineCount <= 20) {
    return {
      label: "Medium Risk",
      variant: "secondary" as const,
      description: "Touches more than one area. Review before merging.",
    };
  }

  return {
    label: "High Risk",
    variant: "destructive" as const,
    description: "Broader patch footprint across multiple files or lines.",
  };
}

function getMatchStrength(result: CodeInsightResult) {
  const normalizedKeywords = result.keywords.map((keyword) =>
    keyword.toLowerCase()
  );
  const matchedKeywords = new Set<string>();

  result.files.forEach((file) => {
    const haystack = `${file.path}\n${file.snippet}`.toLowerCase();
    normalizedKeywords.forEach((keyword) => {
      if (keyword && haystack.includes(keyword)) {
        matchedKeywords.add(keyword);
      }
    });
  });

  const score = normalizedKeywords.length
    ? matchedKeywords.size / normalizedKeywords.length
    : 0;

  if (score >= 0.6) {
    return "strong";
  }

  if (score >= 0.3) {
    return "moderate";
  }

  return "light";
}

function getPrimaryFileUrl(result: CodeInsightResult) {
  const firstFile = result.files[0];
  if (!firstFile) {
    return null;
  }

  const { owner, name, defaultBranch } = result.repository;
  return `https://github.com/${owner}/${name}/blob/${defaultBranch}/${firstFile.path}`;
}

function getChangesOnlyLines(lines: string[]) {
  return lines.filter((line) => {
    if (
      line.startsWith("diff --git") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ") ||
      line.startsWith("@@")
    ) {
      return true;
    }

    return line.startsWith("+") || line.startsWith("-");
  });
}

function getLineClasses(line: string) {
  if (line.startsWith("+")) {
    return "bg-emerald-500/10 text-emerald-200";
  }

  if (line.startsWith("-")) {
    return "bg-rose-500/10 text-rose-200";
  }

  if (line.startsWith("@@")) {
    return "bg-indigo-500/10 text-indigo-200";
  }

  if (line.startsWith("diff --git") || line.startsWith("--- ") || line.startsWith("+++ ")) {
    return "bg-slate-800/80 text-slate-200";
  }

  return "text-slate-500";
}

export default function CodeInsightPanel({
  token,
  issue,
  trustConfidence,
  repositoryOverride,
  codeInsightsEnabled = true,
  onAskAssistant,
  onAnalysisChange,
}: CodeInsightPanelProps) {
  const [githubStatus, setGithubStatus] = useState<GitHubConnectionStatus | null>(
    null
  );
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [analysis, setAnalysis] = useState<CodeInsightResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [editingPatch, setEditingPatch] = useState(false);
  const [patchDraft, setPatchDraft] = useState("");
  const [prResult, setPrResult] = useState<CodeInsightPullRequestResult | null>(null);
  const [prStage, setPrStage] = useState<PrStage>(null);
  const [prError, setPrError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showChangesOnly, setShowChangesOnly] = useState(true);
  const [toast, setToast] = useState<{
    message: string;
    tone: ToastTone;
  } | null>(null);
  const lastActionAt = useRef(0);

  useEffect(() => {
    setStatusLoaded(false);
    setGithubStatus(null);
    setAnalysis(null);
    onAnalysisChange?.(null);
    setPatchDraft("");
    setEditingPatch(false);
    setPrResult(null);
    setPrStage(null);
    setPrError(null);
    setAnalysisError(null);
    setDismissed(false);
    setShowChangesOnly(true);
    setToast(null);
  }, [issue.id, onAnalysisChange, token]);

  useEffect(() => {
    if (!token || statusLoaded) {
      return;
    }

    const cachedStatus = safeSessionStorageGet(GITHUB_STATUS_CACHE_KEY);
    if (cachedStatus) {
      try {
        const parsed = JSON.parse(cachedStatus) as GitHubConnectionStatus;
        setGithubStatus(parsed);
        setStatusLoaded(true);
        return;
      } catch {
        // Ignore bad cache.
      }
    }

    let cancelled = false;
    void (async () => {
      try {
        const status = await api.github.status(token);
        if (!cancelled) {
          setGithubStatus(status);
          safeSessionStorageSet(GITHUB_STATUS_CACHE_KEY, JSON.stringify(status));
        }
      } catch {
        if (!cancelled) {
          setGithubStatus(null);
        }
      } finally {
        if (!cancelled) {
          setStatusLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [statusLoaded, token]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const confidence = analysis ? getConfidence(analysis) : null;
  const allPatchLines = useMemo(
    () => (patchDraft || analysis?.patch || "").split("\n"),
    [analysis?.patch, patchDraft]
  );
  const visiblePatchLines = useMemo(
    () => (showChangesOnly ? getChangesOnlyLines(allPatchLines) : allPatchLines),
    [allPatchLines, showChangesOnly]
  );
  const changedLineCount = useMemo(
    () =>
      allPatchLines.filter(
        (line) =>
          (line.startsWith("+") || line.startsWith("-")) &&
          !line.startsWith("+++ ") &&
          !line.startsWith("--- ")
      ).length,
    [allPatchLines]
  );
  const risk = analysis ? getRisk(changedLineCount, analysis.files.length) : null;
  const matchStrength = analysis ? getMatchStrength(analysis) : null;
  const primaryFile = analysis?.files[0] ?? null;
  const primaryFileUrl = analysis ? getPrimaryFileUrl(analysis) : null;
  const confidenceExplanation =
    analysis && matchStrength
      ? `Based on ${issue.reportCount} related report${
          issue.reportCount === 1 ? "" : "s"
        } across ${issue.sources.length} source${
          issue.sources.length === 1 ? "" : "s"
        } and ${matchStrength} match in ${
          primaryFile?.path?.split("/").slice(-2).join("/") ?? "relevant files"
        }${
          typeof analysis.rootCauseConfidence === "number"
            ? ` with ${analysis.rootCauseConfidence.toFixed(1)}% root-cause confidence`
            : ""
        }.`
      : null;
  const actionLabel =
    prStage === "branch"
      ? "Creating branch..."
      : prStage === "patch"
        ? "Applying patch..."
        : prStage === "pull-request"
          ? "Opening Pull Request..."
          : "Apply Fix (Create PR)";

  if (dismissed) {
    return null;
  }

  const runAnalysis = async () => {
    if (!token) {
      setAnalysisError("Sign in again to generate a code suggestion.");
      return;
    }

    setAnalyzing(true);
    setAnalysisError(null);
    setPrResult(null);
    setPrError(null);

    try {
      const result = await api.codeAgent.analyzeIssue(token, issue.id, {
        repoOwner: repositoryOverride?.owner,
        repoName: repositoryOverride?.name,
      });
      setAnalysis(result);
      onAnalysisChange?.(result);
      setPatchDraft(result.patch);
      setEditingPatch(false);
      setShowChangesOnly(true);

    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message.toLowerCase() : "";
      setAnalysis(null);
      onAnalysisChange?.(null);
      setPatchDraft("");
      setAnalysisError(
        rawMessage.includes("no relevant code files")
          ? "No relevant code match found for this issue."
          : toUserFacingError(error, "github-code-insight")
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const applyFix = async () => {
    if (!token || !analysis) {
      return;
    }

    const now = Date.now();
    if (now - lastActionAt.current < 900 || prStage) {
      return;
    }
    lastActionAt.current = now;

    setPrError(null);

    try {
      setPrStage("branch");
      await sleep(400);
      setPrStage("patch");
      await sleep(400);
      const result = await api.codeAgent.createPullRequest(token, issue.id, {
        patch: patchDraft,
        title: analysis.prDescription?.title,
        prDescription: analysis.prDescription,
        repoOwner: repositoryOverride?.owner || analysis.repository.owner,
        repoName: repositoryOverride?.name || analysis.repository.name,
      });
      setPrStage("pull-request");
      await sleep(400);
      setPrResult(result);
      setToast({
        message: "Suggestion applied successfully",
        tone: "success",
      });
    } catch (error) {
      setPrError(toUserFacingError(error, "github-create-pr"));
    } finally {
      setPrStage(null);
    }
  };

  const rejectSuggestion = () => {
    setAnalysis(null);
    setPatchDraft("");
    setPrError(null);
    setPrResult(null);
    setToast({
      message: "Feedback recorded. Improving future suggestions.",
      tone: "neutral",
    });
  };

  return (
    <section className="mt-12 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-[0_22px_60px_-36px_rgba(15,23,42,0.95)] transition-all duration-200 hover:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
            <GitBranch className="h-4 w-4" />
            AI Code Insight
          </div>
          <h2 className="text-2xl font-semibold text-white">
            Trace this issue into code and prepare a pull request
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Product Pulse searches only a few relevant files, drafts a minimal
            patch, and waits for your approval before opening a pull request.
          </p>
        </div>

        {githubStatus?.connected ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 transition-all duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              Connected as @{githubStatus.username}
            </div>
            {githubStatus.repository?.owner && githubStatus.repository?.name ? (
              <p className="mt-1 text-xs text-emerald-200/80">
                Repo: {githubStatus.repository.owner}/{githubStatus.repository.name}
              </p>
            ) : (
              <p className="mt-1 text-xs text-amber-100/80">
                Repository not selected yet
              </p>
            )}
          </div>
        ) : (
          <Link href="/dashboard/github">
            <Button
              variant="secondary"
              className="transition-all duration-200 hover:border-slate-500 hover:shadow-lg hover:shadow-slate-950/30"
            >
              Connect GitHub
            </Button>
          </Link>
        )}
      </div>

      {!statusLoaded ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-6 w-44 bg-slate-800" />
          <Skeleton className="h-28 w-full rounded-2xl bg-slate-950" />
          <Skeleton className="h-64 w-full rounded-2xl bg-slate-950/80" />
        </div>
      ) : null}

      {statusLoaded && !codeInsightsEnabled ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 px-5 py-6 text-sm text-slate-400">
          <p className="font-medium text-slate-200">
            Code insights are currently disabled
          </p>
          <p className="mt-2 max-w-2xl">
            Turn on the Code Insights toggle in GitHub Workspace to analyze code,
            generate patch suggestions, and open pull requests.
          </p>
        </div>
      ) : null}

      {statusLoaded &&
      (!githubStatus?.connected || !githubStatus.repository?.owner || !githubStatus.repository?.name) ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 px-5 py-6 text-sm text-slate-400">
          <p className="font-medium text-slate-200">
            Connect GitHub to enable code insights
          </p>
          <p className="mt-2 max-w-2xl">
            Choose a repository in GitHub Workspace so Product Pulse can match issue
            patterns against real code and open a pull request for your approval.
          </p>
          <Link href="/dashboard/github" className="mt-4 inline-flex">
            <Button variant="secondary">Open GitHub Integration</Button>
          </Link>
        </div>
      ) : null}

      {codeInsightsEnabled &&
      githubStatus?.connected &&
      githubStatus.repository?.owner &&
      githubStatus.repository?.name ? (
        <div className="mt-6">
          {!analysis && !analyzing ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 px-5 py-6">
              <p className="text-sm text-slate-400">
                No relevant code suggestion found yet. Run analysis to inspect the
                connected repository for a minimal fix.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={runAnalysis}
                  className="w-full transition-all duration-200 hover:shadow-lg hover:shadow-indigo-950/40 sm:w-auto"
                >
                  <WandSparkles className="h-4 w-4" />
                  Generate Suggestion
                </Button>
                <Link href="/dashboard/github" className="w-full sm:w-auto">
                  <Button variant="secondary" className="w-full sm:w-auto">
                    Change Repository
                  </Button>
                </Link>
              </div>
            </div>
          ) : null}

          {analyzing ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <p className="mb-4 text-sm text-slate-400">
                  Searching relevant files and preparing a patch...
                </p>
                <Skeleton className="h-5 w-48 bg-slate-800" />
                <Skeleton className="mt-3 h-20 w-full rounded-2xl bg-slate-800/80" />
              </div>
              <Skeleton className="h-72 w-full rounded-2xl bg-slate-950" />
            </div>
          ) : null}

          {analysisError ? (
            <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {analysisError}
            </div>
          ) : null}

          {analysis ? (
            <div className="space-y-5 transition-all duration-200">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px_240px]">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">
                    <Sparkles className="h-4 w-4" />
                    Root Cause
                  </div>
                  <p className="text-sm leading-6 text-slate-300">
                    {analysis.selectedRootCause || analysis.rootCause}
                  </p>
                  {analysis.reasoningSummary ? (
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      {analysis.reasoningSummary}
                    </p>
                  ) : null}
                  {analysis.possibleCauses?.length ? (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Considered Causes
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {analysis.possibleCauses.map((cause) => (
                          <Badge key={cause} variant="outline">
                            {cause}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                  <div className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Confidence
                  </div>
                  {confidence ? (
                    <div>
                      <Badge variant={confidence.variant}>
                        {typeof analysis.patchConfidence === "number"
                          ? `${analysis.patchConfidence.toFixed(1)}% ${confidence.label}`
                          : confidence.label}
                      </Badge>
                      {typeof analysis.rootCauseConfidence === "number" ? (
                        <p className="mt-3 text-xs text-slate-400">
                          Root cause confidence:{" "}
                          {analysis.rootCauseConfidence.toFixed(1)}%
                        </p>
                      ) : null}
                      {confidence.label === "Low" ? (
                        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          Low confidence suggestion. Review carefully.
                        </div>
                      ) : null}
                      {confidenceExplanation ? (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Based on
                          </p>
                          <p className={`text-sm leading-6 ${confidence.tone}`}>
                            {confidenceExplanation}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    <ShieldAlert className="h-4 w-4" />
                    Risk
                  </div>
                  {risk ? (
                    <>
                      <Badge variant={risk.variant}>{risk.label}</Badge>
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        {risk.description}
                      </p>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Affected File
                  </p>
                  {primaryFile ? (
                    <a
                      href={primaryFileUrl ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 transition-all duration-200 hover:border-slate-500 hover:bg-slate-800"
                    >
                      <FileCode2 className="h-4 w-4 text-slate-400" />
                      {primaryFile.path}
                      <ExternalLink className="h-4 w-4 text-slate-500" />
                    </a>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">
                      No primary file identified.
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Patch Footprint
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline">
                      {analysis.changedFileCount ?? analysis.files.length} file
                      {(analysis.changedFileCount ?? analysis.files.length) === 1
                        ? ""
                        : "s"}
                    </Badge>
                    <Badge variant="outline">
                      {analysis.changedLineCount ?? changedLineCount} changed line
                      {(analysis.changedLineCount ?? changedLineCount) === 1 ? "" : "s"}
                    </Badge>
                    <Badge variant="outline">
                      {analysis.totalLines} lines reviewed
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70">
                <div className="flex flex-col gap-3 border-b border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Suggested patch</p>
                    <p className="text-xs text-slate-500">
                      Generated against {analysis.repository.owner}/
                      {analysis.repository.name}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowChangesOnly((current) => !current)}
                    >
                      {showChangesOnly ? "View Full File" : "View Changes Only"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditingPatch((current) => !current)}
                    >
                      <PencilLine className="h-4 w-4" />
                      {editingPatch ? "Preview Diff" : "Edit Suggestion"}
                    </Button>
                    {onAskAssistant ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          onAskAssistant({
                            message: "Explain this change in technical terms and tell me what to verify.",
                            action: "explain_patch",
                          })
                        }
                      >
                        <Sparkles className="h-4 w-4" />
                        Explain this change
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hover:bg-rose-500/10 hover:text-rose-300"
                      onClick={rejectSuggestion}
                    >
                      Reject
                    </Button>
                  </div>
                </div>

                {editingPatch ? (
                  <div className="p-5">
                    <textarea
                      value={patchDraft}
                      onChange={(event) => setPatchDraft(event.target.value)}
                      rows={18}
                      className="min-h-[360px] w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-sm leading-6 text-slate-200 outline-none transition-all duration-200 focus:border-slate-600 focus:ring-2 focus:ring-slate-500/30"
                    />
                  </div>
                ) : (
                  <div className="max-h-[460px] overflow-auto p-5 font-mono text-sm">
                    <div className="min-w-full rounded-2xl border border-slate-800 bg-[#070b16] p-4 transition-all duration-200">
                      {visiblePatchLines.map((line, index) => (
                        <div
                          key={`${index}-${line}`}
                          className={`rounded-md px-3 py-1.5 leading-6 transition-colors duration-200 ${getLineClasses(
                            line
                          )}`}
                        >
                          <span className="mr-4 inline-block w-7 select-none text-right text-slate-500">
                            {index + 1}
                          </span>
                          <span>{line || " "}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="sticky bottom-4 z-10 rounded-2xl border border-slate-800 bg-slate-900/95 p-3 shadow-2xl shadow-slate-950/40 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <Button
                    onClick={applyFix}
                    disabled={Boolean(prStage)}
                    className="w-full transition-all duration-200 hover:shadow-lg hover:shadow-indigo-950/40 sm:w-auto"
                  >
                    <GitPullRequest className="h-4 w-4" />
                    {actionLabel}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={runAnalysis}
                    disabled={analyzing}
                    className="w-full sm:w-auto"
                  >
                    Regenerate
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full hover:bg-slate-800 sm:w-auto"
                    onClick={() => setDismissed(true)}
                  >
                    Hide Panel
                  </Button>
                </div>
              </div>

              {trustConfidence?.issue_type ? (
                <DecisionFeedbackBar
                  token={token}
                  issueType={trustConfidence.issue_type}
                  compact
                />
              ) : null}

              {prError ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {prError}
                </div>
              ) : null}

              {prResult ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-100">
                        Pull Request Created
                      </p>
                      <p className="mt-1 text-sm text-emerald-200/90">
                        {prResult.pullRequest?.title || prResult.prTitle}
                      </p>
                      <p className="mt-1 text-xs text-emerald-100/75">
                        Branch: {prResult.branchName}
                      </p>
                      <a
                        href={prResult.pullRequest?.url || prResult.prUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-100 transition-all duration-200 hover:text-white"
                      >
                        View on GitHub
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Relevant files
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {analysis.files.map((file) => (
                    <button
                      key={file.path}
                      type="button"
                      onClick={() =>
                        onAskAssistant?.({
                          message: `Explain why ${file.path} matters for this issue and what I should inspect first.`,
                          action: "explain_file",
                          filePath: file.path,
                        })
                      }
                      className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
                    >
                      {file.path}
                    </button>
                  ))}
                </div>
              </div>

              {analysis.alternativeFixes?.length ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Alternative Fixes
                    </p>
                    <p className="text-xs text-slate-500">
                      Ranked safest-first
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {analysis.alternativeFixes.map((option) => (
                      <div
                        key={`${option.rank}-${option.title}`}
                        className={`rounded-2xl border p-4 ${
                          option.recommended
                            ? "border-emerald-500/20 bg-emerald-500/5"
                            : "border-slate-800 bg-slate-900/70"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-100">
                            {option.title}
                          </p>
                          <Badge variant={option.recommended ? "success" : "outline"}>
                            #{option.rank}
                          </Badge>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-400">
                          {option.summary}
                        </p>
                        {option.pros.length ? (
                          <p className="mt-3 text-xs text-emerald-200">
                            Pros: {option.pros.join(" • ")}
                          </p>
                        ) : null}
                        {option.cons.length ? (
                          <p className="mt-2 text-xs text-rose-200/80">
                            Cons: {option.cons.join(" • ")}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {analysis.prDescription ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Pull Request Draft
                  </p>
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-semibold text-white">
                      {analysis.prDescription.title}
                    </p>
                    <p className="text-sm leading-6 text-slate-400">
                      {analysis.prDescription.summary}
                    </p>
                    <p className="text-sm leading-6 text-slate-300">
                      Root cause: {analysis.prDescription.rootCause}
                    </p>
                    {analysis.prDescription.changes.length ? (
                      <ul className="space-y-2 text-sm text-slate-400">
                        {analysis.prDescription.changes.map((change) => (
                          <li key={change}>- {change}</li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="text-sm text-slate-400">
                      Impact: {analysis.prDescription.impact}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {toast ? (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-2xl border px-4 py-3 text-sm shadow-2xl transition-all duration-200 ${
            toast.tone === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
              : "border-slate-700 bg-slate-900 text-slate-200"
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </section>
  );
}
