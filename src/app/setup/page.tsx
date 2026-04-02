"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  GitBranch,
  Loader2,
  Package2,
  Sparkles,
} from "lucide-react";
import GitHubRepoModal from "@/components/GitHubRepoModal";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type GitHubRepository } from "@/lib/api";
import { toUserFacingError } from "@/lib/user-facing-errors";
import { useAuth } from "@/providers/AuthProvider";
import { useSetup } from "@/providers/SetupProvider";

function buildFriendlyName(owner: string | null | undefined, repo: string | null | undefined) {
  const source = String(repo || owner || "")
    .replace(/[-_]+/g, " ")
    .trim();

  if (!source) return "";

  return source.replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function SetupPage() {
  return (
    <ProtectedRoute requireSetup={false}>
      <SetupPageContent />
    </ProtectedRoute>
  );
}

function SetupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const { status, loading, refreshSetup } = useSetup();

  const [productName, setProductName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [repoModalOpen, setRepoModalOpen] = useState(false);
  const [repos, setRepos] = useState<GitHubRepository[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [repoSaving, setRepoSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);

  useEffect(() => {
    if (!loading && status?.complete) {
      router.replace("/dashboard");
    }
  }, [loading, router, status?.complete]);

  useEffect(() => {
    if (!status) return;
    setProductName((current) => current || status.productName || status.suggestedProductName || "");
  }, [status]);

  useEffect(() => {
    const githubState = searchParams.get("github");
    const nextMessage = searchParams.get("message");

    if (githubState === "connected") {
      setMessage(nextMessage || "GitHub connected successfully. Select your primary repository to continue.");
      void refreshSetup();
    } else if (githubState === "error") {
      setError(nextMessage || "Failed to connect GitHub.");
    }
  }, [refreshSetup, searchParams]);

  const canContinue = Boolean(
    productName.trim() && status?.repository?.owner && status?.repository?.name
  );

  const suggestedName = useMemo(
    () =>
      status?.suggestedProductName ||
      buildFriendlyName(status?.repository?.owner, status?.repository?.name),
    [status?.repository?.name, status?.repository?.owner, status?.suggestedProductName]
  );

  const selectedRepoFullName =
    status?.repository?.owner && status?.repository?.name
      ? `${status.repository.owner}/${status.repository.name}`
      : null;

  const fetchRepos = async () => {
    if (!session?.access_token) return;
    setReposLoading(true);
    setError(null);
    try {
      const response = await api.github.repos(session.access_token);
      setRepos(response.repos);
    } catch (err) {
      setError(toUserFacingError(err, "github-connect"));
    } finally {
      setReposLoading(false);
    }
  };

  const handleConnectGitHub = async () => {
    if (!session?.access_token) return;
    setConnectLoading(true);
    setError(null);
    try {
      const { authUrl } = await api.github.start(
        session.access_token,
        `${window.location.origin}/setup`
      );
      window.location.href = authUrl;
    } catch (err) {
      setError(toUserFacingError(err, "github-connect"));
      setConnectLoading(false);
    }
  };

  const handleOpenRepoModal = async () => {
    if (!status?.githubConnected) return;
    setRepoModalOpen(true);
    if (repos.length === 0) {
      await fetchRepos();
    }
  };

  const handleSaveRepo = async (repo: GitHubRepository) => {
    if (!session?.access_token) return;
    setRepoSaving(true);
    setError(null);
    try {
      await api.github.selectRepo(session.access_token, repo.owner, repo.name);
      await refreshSetup();
      setMessage(`Primary repository set to ${repo.fullName}.`);
      setRepoModalOpen(false);
    } catch (err) {
      setError(toUserFacingError(err, "github-connect"));
    } finally {
      setRepoSaving(false);
    }
  };

  const handleContinue = async () => {
    if (!session?.access_token || !status?.repository) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.setup.complete(session.access_token, {
        productName: productName.trim(),
        repoOwner: status.repository.owner,
        repoName: status.repository.name,
      });
      await refreshSetup();
      router.replace("/dashboard");
    } catch (err) {
      setError(toUserFacingError(err, "github-connect"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-3">
          <Badge variant="secondary" className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-indigo-200">
            <Sparkles className="h-3.5 w-3.5" />
            Mandatory setup
          </Badge>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Set up your product workspace</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Before you enter the dashboard, tell Product Pulse what product it is monitoring and which GitHub repository should power code insights.
            </p>
          </div>
        </div>

        {message ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <Card className="rounded-[28px] border border-slate-800 bg-slate-900/70 shadow-[0_18px_60px_rgba(15,23,42,0.22)]">
              <CardHeader className="border-b border-slate-800/90 pb-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/70 text-slate-100">
                    <Package2 className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Step 1 — Product name</CardTitle>
                    <p className="mt-1 text-sm text-slate-400">
                      This becomes the product context used in insights, AI prompts, and agent responses.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pb-6 pt-5">
                {loading ? (
                  <Skeleton className="h-12 w-full bg-slate-800" />
                ) : (
                  <>
                    <Input
                      value={productName}
                      onChange={(event) => setProductName(event.target.value)}
                      placeholder="Enter your product name"
                      className="h-12 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 placeholder:text-slate-500"
                    />
                    {suggestedName && productName.trim() !== suggestedName ? (
                      <button
                        type="button"
                        onClick={() => setProductName(suggestedName)}
                        className="text-sm text-indigo-300 transition hover:text-indigo-200"
                      >
                        Use suggested name: {suggestedName}
                      </button>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border border-slate-800 bg-slate-900/70 shadow-[0_18px_60px_rgba(15,23,42,0.22)]">
              <CardHeader className="border-b border-slate-800/90 pb-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/70 text-slate-100">
                    <GitBranch className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Step 2 — Primary GitHub repo</CardTitle>
                    <p className="mt-1 text-sm text-slate-400">
                      Connect GitHub once, then choose the main codebase your issue routing and patch suggestions should target.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pb-6 pt-5">
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-11 w-44 bg-slate-800" />
                    <Skeleton className="h-16 w-full bg-slate-800" />
                  </div>
                ) : !status?.githubConnected ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-400">
                      GitHub is not connected yet.
                    </div>
                    <Button onClick={handleConnectGitHub} disabled={connectLoading}>
                      {connectLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />}
                      {connectLoading ? "Connecting..." : "Connect GitHub"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-emerald-200">
                        <CheckCircle2 className="h-4 w-4" />
                        GitHub connected
                      </div>
                      <p className="mt-2 text-sm text-slate-200">
                        {selectedRepoFullName || "No primary repository selected yet."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button variant="secondary" onClick={() => void handleOpenRepoModal()}>
                        <GitBranch className="h-4 w-4" />
                        {selectedRepoFullName ? "Change repository" : "Select repository"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-[28px] border border-slate-800 bg-slate-900/70 shadow-[0_18px_60px_rgba(15,23,42,0.22)]">
            <CardHeader className="border-b border-slate-800/90 pb-5">
              <CardTitle className="text-white">Setup checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pb-6 pt-5">
              <ChecklistRow
                complete={Boolean(productName.trim())}
                title="Product name"
                description="Used across agent reasoning, summaries, and assistant replies."
              />
              <ChecklistRow
                complete={Boolean(status?.githubConnected)}
                title="GitHub connected"
                description="Required before Product Pulse can select a codebase."
              />
              <ChecklistRow
                complete={Boolean(status?.repository?.owner && status?.repository?.name)}
                title="Primary repository selected"
                description="The default repo for code insights and patch suggestions."
              />

              <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4 text-sm text-slate-400">
                Product Pulse will use your product name and selected repository as the base context for issue routing, AI prompts, insights, and chat responses.
              </div>

              <Button
                className="w-full"
                onClick={handleContinue}
                disabled={!canContinue || submitting}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {submitting ? "Finishing setup..." : "Continue to Dashboard"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <GitHubRepoModal
        open={repoModalOpen}
        repos={repos}
        loading={reposLoading}
        saving={repoSaving}
        selectedRepoFullName={selectedRepoFullName}
        error={error}
        onClose={() => setRepoModalOpen(false)}
        onRefresh={() => void fetchRepos()}
        onSave={(repo) => void handleSaveRepo(repo)}
      />
    </div>
  );
}

function ChecklistRow({
  complete,
  title,
  description,
}: {
  complete: boolean;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
      <div
        className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border ${
          complete
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : "border-slate-800 bg-slate-900 text-slate-500"
        }`}
      >
        <CheckCircle2 className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
    </div>
  );
}
