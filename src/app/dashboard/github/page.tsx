"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  GitBranch,
  Loader2,
  Search,
  ShieldCheck,
  ShieldOff,
  Unplug,
} from "lucide-react";
import CodeInsightPanel from "@/components/CodeInsightPanel";
import GitHubAssistantPanel, {
  type GitHubAssistantPrompt,
} from "@/components/GitHubAssistantPanel";
import GitHubRepoModal from "@/components/GitHubRepoModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  api,
  type CodeInsightResult,
  type Connection,
  type GitHubConnectionStatus,
  type GitHubRepository,
  type GitHubWorkspaceSettings,
  type Issue,
  type IssueDetail,
  type RepoMapping,
} from "@/lib/api";
import { toUserFacingError } from "@/lib/user-facing-errors";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";

function toSlug(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export default function GitHubWorkspacePage() {
  const { session } = useAuth();
  const searchParams = useSearchParams();
  const requestedIssueId = searchParams.get("issueId");

  const [connections, setConnections] = useState<Connection[]>([]);
  const [githubStatus, setGithubStatus] = useState<GitHubConnectionStatus | null>(null);
  const [settings, setSettings] = useState<GitHubWorkspaceSettings>({
    codeInsightsEnabled: true,
  });
  const [mappings, setMappings] = useState<RepoMapping[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [githubRepos, setGithubRepos] = useState<GitHubRepository[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<IssueDetail | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<CodeInsightResult | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [selectedIssueOverride, setSelectedIssueOverride] = useState("");
  const [assistantPrompt, setAssistantPrompt] = useState<GitHubAssistantPrompt | null>(
    null
  );
  const [issueSearch, setIssueSearch] = useState("");
  const [mappingDraft, setMappingDraft] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [issueDetailLoading, setIssueDetailLoading] = useState(false);
  const [repoModalOpen, setRepoModalOpen] = useState(false);
  const [githubLoadingRepos, setGithubLoadingRepos] = useState(false);
  const [githubSavingRepo, setGithubSavingRepo] = useState(false);
  const [githubRepoError, setGithubRepoError] = useState<string | null>(null);
  const [connectingGitHub, setConnectingGitHub] = useState(false);
  const [disconnectingGitHub, setDisconnectingGitHub] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingMappingKey, setSavingMappingKey] = useState<string | null>(null);
  const [removingMappingKey, setRemovingMappingKey] = useState<string | null>(null);

  const githubConnection = useMemo(
    () => connections.find((entry) => entry.provider === "github") ?? null,
    [connections]
  );

  const effectiveStatus = useMemo(() => {
    if (githubStatus) return githubStatus;
    if (!githubConnection) return null;
    return {
      connected: true,
      username:
        (githubConnection.metadata?.username as string | null | undefined) ?? null,
      name: (githubConnection.metadata?.name as string | null | undefined) ?? null,
      avatarUrl:
        (githubConnection.metadata?.avatar_url as string | null | undefined) ?? null,
      codeInsightsEnabled: true,
      repository: {
        owner:
          (githubConnection.metadata?.repo_owner as string | null | undefined) ?? null,
        name:
          (githubConnection.metadata?.repo_name as string | null | undefined) ?? null,
        defaultBranch:
          (githubConnection.metadata?.default_branch as
            | string
            | null
            | undefined) ?? null,
      },
      connectedAt:
        (githubConnection.metadata?.connectedAt as string | null | undefined) ?? null,
    };
  }, [githubConnection, githubStatus]);

  const repoFullName =
    effectiveStatus?.repository?.owner && effectiveStatus.repository.name
      ? `${effectiveStatus.repository.owner}/${effectiveStatus.repository.name}`
      : null;

  const filteredIssues = useMemo(() => {
    const normalized = issueSearch.trim().toLowerCase();
    if (!normalized) return issues;
    return issues.filter((issue) =>
      [issue.title, issue.category, ...issue.sources].some((value) =>
        String(value || "").toLowerCase().includes(normalized)
      )
    );
  }, [issueSearch, issues]);

  const issuePatternOptions = useMemo(() => {
    const seen = new Set<string>();
    return issues
      .map((issue) => ({
        key: issue.id,
        raw: issue.title,
        slug: toSlug(issue.title),
        label: issue.category ? `${issue.category}: ${issue.title}` : issue.title,
      }))
      .filter((item) => {
        if (!item.slug || seen.has(item.slug)) return false;
        seen.add(item.slug);
        return true;
      })
      .slice(0, 8);
  }, [issues]);

  const selectedOverrideRepo = useMemo(
    () =>
      selectedIssueOverride
        ? githubRepos.find((repo) => repo.fullName === selectedIssueOverride) ?? null
        : null,
    [githubRepos, selectedIssueOverride]
  );

  const loadWorkspace = useCallback(async () => {
    if (!session?.access_token) {
      setConnections([]);
      setIssues([]);
      setMappings([]);
      setConnectionsLoading(false);
      setIssuesLoading(false);
      return;
    }

    setConnectionsLoading(true);
    setIssuesLoading(true);
    setError(null);

    try {
      const [nextConnections, nextStatus, nextIssues, mappingResponse] =
        await Promise.all([
          api.connections.list(session.access_token),
          api.github.status(session.access_token).catch(() => null),
          api.issues.list(session.access_token),
          api.github.mappings(session.access_token).catch(() => ({
            mappings: [],
            settings: { codeInsightsEnabled: true },
          })),
        ]);

      setConnections(nextConnections);
      setGithubStatus(nextStatus);
      setIssues(nextIssues);
      setMappings(mappingResponse.mappings);
      setSettings(mappingResponse.settings);
    } catch (err) {
      setError(toUserFacingError(err, "github-connect"));
    } finally {
      setConnectionsLoading(false);
      setIssuesLoading(false);
    }
  }, [session?.access_token]);

  const loadRepos = useCallback(async () => {
    if (!session?.access_token) return;
    setGithubLoadingRepos(true);
    setGithubRepoError(null);
    try {
      const response = await api.github.repos(session.access_token);
      setGithubRepos(response.repos);
    } catch (err) {
      setGithubRepoError(toUserFacingError(err, "github-connect"));
    } finally {
      setGithubLoadingRepos(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const githubState = params.get("github");
    const nextMessage = params.get("message");

    if (githubState === "connected") {
      setMessage(nextMessage || "GitHub connected successfully.");
    } else if (githubState === "error") {
      setMessage(nextMessage || "Connection failed. Retry.");
    }

    if (githubState || nextMessage) {
      params.delete("github");
      params.delete("message");
      const nextUrl = `${window.location.pathname}${
        params.toString() ? `?${params.toString()}` : ""
      }`;
      window.history.replaceState({}, "", nextUrl);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (effectiveStatus?.connected && githubRepos.length === 0) {
      void loadRepos();
    }
  }, [effectiveStatus?.connected, githubRepos.length, loadRepos]);

  useEffect(() => {
    if (requestedIssueId) {
      setSelectedIssueId(requestedIssueId);
    }
  }, [requestedIssueId]);

  useEffect(() => {
    if (!selectedIssueId && issues.length > 0) {
      setSelectedIssueId(issues[0].id);
    }
  }, [issues, selectedIssueId]);

  useEffect(() => {
    if (!session?.access_token || !selectedIssueId) {
      setSelectedIssue(null);
      setLatestAnalysis(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setIssueDetailLoading(true);
      try {
        const nextIssue = await api.issues.getById(session.access_token, selectedIssueId);
        if (!cancelled) {
          setSelectedIssue(nextIssue);
          setLatestAnalysis(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(toUserFacingError(err, "issue-detail-load"));
          setSelectedIssue(null);
        }
      } finally {
        if (!cancelled) {
          setIssueDetailLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedIssueId, session?.access_token]);

  useEffect(() => {
    if (!selectedIssue) {
      setSelectedIssueOverride("");
      return;
    }

    const mapped = mappings.find(
      (mapping) => mapping.issue_type === toSlug(selectedIssue.title)
    );
    setSelectedIssueOverride(
      mapped ? `${mapped.repo_owner}/${mapped.repo_name}` : ""
    );
  }, [mappings, selectedIssue]);

  const connectGitHub = async () => {
    if (!session?.access_token) {
      setMessage("Please sign in before connecting GitHub.");
      return;
    }

    setConnectingGitHub(true);
    try {
      const { authUrl } = await api.github.start(session.access_token);
      window.location.href = authUrl;
    } catch (err) {
      setMessage(toUserFacingError(err, "github-connect"));
      setConnectingGitHub(false);
    }
  };

  const disconnectGitHub = async () => {
    if (!session?.access_token || !githubConnection?.id) return;
    setDisconnectingGitHub(true);
    try {
      await api.connections.disconnect(session.access_token, githubConnection.id);
      setGithubStatus(null);
      setConnections((current) => current.filter((entry) => entry.id !== githubConnection.id));
      setMappings([]);
      setGithubRepos([]);
      setSelectedIssue(null);
      setMessage("GitHub disconnected.");
    } catch (err) {
      setMessage(toUserFacingError(err, "github-connect"));
    } finally {
      setDisconnectingGitHub(false);
    }
  };

  const savePrimaryRepo = async (repo: GitHubRepository) => {
    if (!session?.access_token) return;
    setGithubSavingRepo(true);
    setGithubRepoError(null);
    try {
      await api.github.selectRepo(session.access_token, repo.owner, repo.name);
      setGithubStatus((current) =>
        current
          ? {
              ...current,
              repository: {
                owner: repo.owner,
                name: repo.name,
                defaultBranch: repo.defaultBranch,
              },
            }
          : current
      );
      setConnections((current) =>
        current.map((entry) =>
          entry.provider === "github"
            ? {
                ...entry,
                metadata: {
                  ...(entry.metadata || {}),
                  repo_owner: repo.owner,
                  repo_name: repo.name,
                  default_branch: repo.defaultBranch,
                },
              }
            : entry
        )
      );
      setRepoModalOpen(false);
      setMessage(`Primary repository set to ${repo.fullName}.`);
    } catch (err) {
      setGithubRepoError(toUserFacingError(err, "github-connect"));
    } finally {
      setGithubSavingRepo(false);
    }
  };

  const toggleCodeInsights = async () => {
    if (!session?.access_token) return;
    setSavingSettings(true);
    try {
      const response = await api.github.updateSettings(
        session.access_token,
        !settings.codeInsightsEnabled
      );
      setSettings(response.settings);
      setGithubStatus((current) =>
        current ? { ...current, codeInsightsEnabled: response.settings.codeInsightsEnabled } : current
      );
      setMessage(
        response.settings.codeInsightsEnabled
          ? "Code insights enabled."
          : "Code insights disabled."
      );
    } catch (err) {
      setMessage(toUserFacingError(err, "github-connect"));
    } finally {
      setSavingSettings(false);
    }
  };

  const saveMapping = async (slug: string, rawIssueType: string) => {
    if (!session?.access_token) return;
    const fullName = mappingDraft[slug];
    const repo = githubRepos.find((entry) => entry.fullName === fullName);
    if (!repo) return;

    setSavingMappingKey(slug);
    try {
      const response = await api.github.saveMapping(
        session.access_token,
        rawIssueType,
        repo.owner,
        repo.name
      );
      setMappings((current) => {
        const next = current.filter((entry) => entry.issue_type !== response.mapping.issue_type);
        return [...next, response.mapping].sort((a, b) =>
          a.issue_type.localeCompare(b.issue_type)
        );
      });
      setMessage(`Routing updated for ${slug}.`);
    } catch (err) {
      setMessage(toUserFacingError(err, "github-connect"));
    } finally {
      setSavingMappingKey(null);
    }
  };

  const removeMapping = async (slug: string) => {
    if (!session?.access_token) return;
    setRemovingMappingKey(slug);
    try {
      await api.github.deleteMapping(session.access_token, slug);
      setMappings((current) => current.filter((entry) => entry.issue_type !== slug));
      setMessage(`Removed mapping for ${slug}.`);
    } catch (err) {
      setMessage(toUserFacingError(err, "github-connect"));
    } finally {
      setRemovingMappingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      {message ? (
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-100">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <Card className="rounded-[28px] border border-slate-800 bg-slate-900/70 shadow-[0_18px_60px_rgba(15,23,42,0.22)]">
        <CardHeader className="border-b border-slate-800/90 pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/70 text-slate-100">
                <GitBranch className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-white">GitHub Workspace</CardTitle>
                <p className="mt-1 max-w-2xl text-sm text-slate-400">
                  Connect GitHub, pick one primary repo, route issue types safely,
                  and keep pull requests under your control.
                </p>
              </div>
            </div>
            {effectiveStatus?.connected ? (
              <Badge variant="success" className="border-none">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Connected
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 pb-6 pt-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          {connectionsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-56 bg-slate-800" />
              <Skeleton className="h-12 w-full bg-slate-800" />
            </div>
          ) : effectiveStatus?.connected ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-medium text-white">
                  @{effectiveStatus.username ?? "github-user"}
                </p>
                <span className="text-sm text-slate-500">
                  {effectiveStatus.name || "GitHub account connected"}
                </span>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Safety Layer
                </p>
                <p className="mt-2 text-sm text-slate-200">
                  Max 5 files, max 500 lines total, secret redaction on snippets,
                  and no direct commits to main.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                Connect GitHub to begin tracing issues into code and generating
                reviewable pull requests.
              </p>
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-500">
                No GitHub account connected yet.
              </div>
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void toggleCodeInsights()}
              disabled={!effectiveStatus?.connected || savingSettings}
              className={cn(
                "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all duration-200",
                settings.codeInsightsEnabled
                  ? "border-emerald-500/25 bg-emerald-500/10"
                  : "border-slate-800 bg-slate-950/60"
              )}
            >
              <div>
                <p className="text-sm font-medium text-white">Enable Code Insights</p>
                <p className="mt-1 text-xs text-slate-400">
                  Disable analysis entirely whenever you want full manual control.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-200">
                {savingSettings ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : settings.codeInsightsEnabled ? (
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                ) : (
                  <ShieldOff className="h-4 w-4 text-slate-500" />
                )}
                {settings.codeInsightsEnabled ? "On" : "Off"}
              </div>
            </button>

            {!effectiveStatus?.connected ? (
              <Button
                onClick={connectGitHub}
                disabled={connectingGitHub || !session?.access_token}
              >
                {connectingGitHub ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GitBranch className="h-4 w-4" />
                )}
                Connect GitHub
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={disconnectGitHub}
                disabled={disconnectingGitHub}
              >
                <Unplug className="h-4 w-4" />
                {disconnectingGitHub ? "Disconnecting..." : "Disconnect"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border border-slate-800 bg-slate-900/70 shadow-[0_18px_60px_rgba(15,23,42,0.22)]">
        <CardHeader className="border-b border-slate-800/90 pb-5">
          <CardTitle className="text-white">Repo Routing</CardTitle>
          <p className="mt-1 text-sm text-slate-400">
            Map issue patterns to a repo. If no mapping exists, Product Pulse falls
            back to the primary repository.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pb-6 pt-5">
          {!effectiveStatus?.connected ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-5 text-sm text-slate-400">
              Connect GitHub first to manage repo routing.
            </div>
          ) : issuePatternOptions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-5 text-sm text-slate-400">
              No issue patterns are available yet. Sync feedback sources first.
            </div>
          ) : (
            <div className="space-y-4">
              {issuePatternOptions.map((option) => {
                const currentMapping = mappings.find(
                  (mapping) => mapping.issue_type === option.slug
                );
                const currentValue =
                  mappingDraft[option.slug] ||
                  (currentMapping
                    ? `${currentMapping.repo_owner}/${currentMapping.repo_name}`
                    : "");

                return (
                  <div
                    key={option.key}
                    className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{option.label}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Route key: {option.slug}
                        </p>
                      </div>
                      <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
                        <select
                          value={currentValue}
                          onChange={(event) =>
                            setMappingDraft((current) => ({
                              ...current,
                              [option.slug]: event.target.value,
                            }))
                          }
                          className="h-11 min-w-[240px] rounded-2xl border border-slate-800 bg-slate-950 px-4 text-sm text-slate-100 outline-none"
                        >
                          <option value="">Use primary repository</option>
                          {githubRepos.map((repo) => (
                            <option key={repo.id} value={repo.fullName}>
                              {repo.fullName}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => void saveMapping(option.slug, option.raw)}
                            disabled={!currentValue || savingMappingKey === option.slug}
                          >
                            {savingMappingKey === option.slug ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void removeMapping(option.slug)}
                            disabled={
                              !currentMapping || removingMappingKey === option.slug
                            }
                          >
                            {removingMappingKey === option.slug ? "Removing..." : "Clear"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border border-slate-800 bg-slate-900/70 shadow-[0_18px_60px_rgba(15,23,42,0.22)]">
        <CardHeader className="border-b border-slate-800/90 pb-5">
          <CardTitle className="text-white">Repo Routing</CardTitle>
          <p className="mt-1 text-sm text-slate-400">
            Map issue patterns to a repo. If no mapping exists, Product Pulse falls
            back to the primary repository.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pb-6 pt-5">
          {!effectiveStatus?.connected ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-5 text-sm text-slate-400">
              Connect GitHub first to manage repo routing.
            </div>
          ) : issuePatternOptions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-5 text-sm text-slate-400">
              No issue patterns are available yet. Sync feedback sources first.
            </div>
          ) : (
            <div className="space-y-4">
              {issuePatternOptions.map((option) => {
                const currentMapping = mappings.find(
                  (mapping) => mapping.issue_type === option.slug
                );
                const currentValue =
                  mappingDraft[option.slug] ||
                  (currentMapping
                    ? `${currentMapping.repo_owner}/${currentMapping.repo_name}`
                    : "");

                return (
                  <div
                    key={option.key}
                    className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{option.label}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Route key: {option.slug}
                        </p>
                      </div>
                      <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
                        <select
                          value={currentValue}
                          onChange={(event) =>
                            setMappingDraft((current) => ({
                              ...current,
                              [option.slug]: event.target.value,
                            }))
                          }
                          className="h-11 min-w-[240px] rounded-2xl border border-slate-800 bg-slate-950 px-4 text-sm text-slate-100 outline-none"
                        >
                          <option value="">Use primary repository</option>
                          {githubRepos.map((repo) => (
                            <option key={repo.id} value={repo.fullName}>
                              {repo.fullName}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => void saveMapping(option.slug, option.raw)}
                            disabled={!currentValue || savingMappingKey === option.slug}
                          >
                            {savingMappingKey === option.slug ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void removeMapping(option.slug)}
                            disabled={
                              !currentMapping || removingMappingKey === option.slug
                            }
                          >
                            {removingMappingKey === option.slug ? "Removing..." : "Clear"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <Card className="rounded-[28px] border border-slate-800 bg-slate-900/70 shadow-[0_18px_60px_rgba(15,23,42,0.22)]">
          <CardHeader className="border-b border-slate-800/90 pb-5">
            <CardTitle className="text-white">Issue-to-Code Queue</CardTitle>
            <p className="mt-1 text-sm text-slate-400">
              Pick an issue, then review or override the repo before generating a patch.
            </p>
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={issueSearch}
                onChange={(event) => setIssueSearch(event.target.value)}
                placeholder="Search issues"
                className="h-11 rounded-2xl border-slate-800 bg-slate-950 pl-11 text-sm text-slate-100 placeholder:text-slate-500"
              />
            </div>
          </CardHeader>
          <CardContent className="max-h-[68vh] space-y-3 overflow-y-auto pb-6 pt-5">
            {issuesLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4"
                >
                  <Skeleton className="h-4 w-2/3 bg-slate-800" />
                  <Skeleton className="mt-3 h-3 w-1/2 bg-slate-800" />
                </div>
              ))
            ) : !effectiveStatus?.connected ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-5 text-sm text-slate-400">
                Connect GitHub to begin.
              </div>
            ) : !repoFullName ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-5 text-sm text-slate-400">
                No primary repository selected.
              </div>
            ) : filteredIssues.length > 0 ? (
              filteredIssues.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => setSelectedIssueId(issue.id)}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left transition-all duration-200",
                    selectedIssueId === issue.id
                      ? "border-indigo-500/30 bg-indigo-500/10 shadow-[0_14px_40px_rgba(99,102,241,0.12)]"
                      : "border-slate-800 bg-slate-950/55 hover:border-slate-700 hover:bg-slate-950/80"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">{issue.title}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {issue.reportCount} reports across {issue.sources.length} sources
                      </p>
                    </div>
                    <Badge
                      variant={
                        issue.priority === "HIGH"
                          ? "destructive"
                          : issue.priority === "MEDIUM"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {issue.priority}
                    </Badge>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-5 text-sm text-slate-400">
                No issues matched your search.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {selectedIssue && effectiveStatus?.connected && repoFullName ? (
            <Card className="rounded-[28px] border border-slate-800 bg-slate-900/70 shadow-[0_18px_60px_rgba(15,23,42,0.22)]">
              <CardHeader className="border-b border-slate-800/90 pb-5">
                <CardTitle className="text-white">Routing + Override</CardTitle>
                <p className="mt-1 text-sm text-slate-400">
                  Use the mapped repo automatically or override this issue manually.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 pb-6 pt-5">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Current Route
                  </p>
                  <p className="mt-2 text-sm text-white">
                    {selectedIssueOverride || repoFullName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedIssueOverride
                      ? "Manual override is active for this issue."
                      : "Using mapped or primary repository fallback."}
                  </p>
                </div>
                <select
                  value={selectedIssueOverride}
                  onChange={(event) => setSelectedIssueOverride(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 text-sm text-slate-100 outline-none"
                >
                  <option value="">Use mapped or primary repository</option>
                  {githubRepos.map((repo) => (
                    <option key={repo.id} value={repo.fullName}>
                      {repo.fullName}
                    </option>
                  ))}
                </select>
              </CardContent>
            </Card>
          ) : null}

          {!effectiveStatus?.connected ? (
            <Card className="rounded-[28px] border border-slate-800 bg-slate-900/70 shadow-[0_18px_60px_rgba(15,23,42,0.22)]">
              <CardContent className="p-8">
                <p className="text-lg font-medium text-white">Connect GitHub to begin</p>
                <p className="mt-2 text-sm text-slate-400">
                  Once connected, this workspace will route issues into the right
                  repository and keep patch creation under your approval.
                </p>
              </CardContent>
            </Card>
          ) : !repoFullName ? (
            <Card className="rounded-[28px] border border-slate-800 bg-slate-900/70 shadow-[0_18px_60px_rgba(15,23,42,0.22)]">
              <CardContent className="p-8">
                <p className="text-lg font-medium text-white">No primary repository selected</p>
                <p className="mt-2 text-sm text-slate-400">
                  Select a primary repository above to unlock routing and code insight.
                </p>
              </CardContent>
            </Card>
          ) : issueDetailLoading ? (
            <Card className="rounded-[28px] border border-slate-800 bg-slate-900/70 shadow-[0_18px_60px_rgba(15,23,42,0.22)]">
              <CardContent className="space-y-4 p-6">
                <Skeleton className="h-8 w-56 bg-slate-800" />
                <Skeleton className="h-24 w-full bg-slate-800" />
                <Skeleton className="h-64 w-full bg-slate-800" />
              </CardContent>
            </Card>
          ) : selectedIssue ? (
            <CodeInsightPanel
              token={session?.access_token}
              issue={selectedIssue}
              codeInsightsEnabled={settings.codeInsightsEnabled}
              repositoryOverride={selectedOverrideRepo}
              onAskAssistant={(prompt) => setAssistantPrompt(prompt)}
              onAnalysisChange={setLatestAnalysis}
            />
          ) : (
            <Card className="rounded-[28px] border border-slate-800 bg-slate-900/70 shadow-[0_18px_60px_rgba(15,23,42,0.22)]">
              <CardContent className="p-8">
                <p className="text-lg font-medium text-white">
                  Select an issue to generate code insight
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Choose any issue from the queue to inspect relevant code, review
                  a patch, and create a pull request.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <GitHubAssistantPanel
          token={session?.access_token}
          issue={selectedIssue}
          analysis={latestAnalysis}
          repositoryOverride={selectedOverrideRepo}
          incomingPrompt={assistantPrompt}
          onPromptHandled={() => setAssistantPrompt(null)}
        />
      </div>

      <GitHubRepoModal
        open={repoModalOpen}
        repos={githubRepos}
        loading={githubLoadingRepos}
        saving={githubSavingRepo}
        selectedRepoFullName={repoFullName}
        error={githubRepoError}
        onClose={() => {
          setRepoModalOpen(false);
          setGithubRepoError(null);
        }}
        onRefresh={() => void loadRepos()}
        onSave={(repo) => void savePrimaryRepo(repo)}
      />
    </div>
  );
}
