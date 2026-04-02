"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  GitPullRequestArrow,
  RefreshCw,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  api,
  type ApprovalRequest,
  type WorkspaceDashboard,
  type WorkspaceMember,
  type WorkspaceRole,
} from "@/lib/api";
import { toUserFacingError } from "@/lib/user-facing-errors";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkspace } from "@/providers/WorkspaceProvider";

function approvalVariant(status: string) {
  if (status === "approved") return "success";
  if (status === "rejected") return "destructive";
  return "secondary";
}

export default function WorkspacePage() {
  const { session } = useAuth();
  const {
    activeWorkspace,
    loading: workspaceLoading,
    refreshWorkspaces,
    setActiveWorkspaceId,
    workspaces,
  } = useWorkspace();
  const [data, setData] = useState<WorkspaceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [approvalLoadingId, setApprovalLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const token = session?.access_token;
    const workspaceId = activeWorkspace?.workspace.id;
    if (!token || !workspaceId) {
      setLoading(false);
      return;
    }

    const safeToken: string = token;
    const safeWorkspaceId: string = workspaceId;

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const next = await api.collaboration.dashboard(safeToken, safeWorkspaceId);
        if (!cancelled) {
          setData(next);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(toUserFacingError(err, "issues-load"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeWorkspace?.workspace.id, session?.access_token]);

  const handleCreateWorkspace = async () => {
    if (!session?.access_token || !workspaceName.trim()) return;
    setBusy(true);
    try {
      const response = await api.collaboration.createWorkspace(
        session.access_token,
        workspaceName.trim()
      );
      await refreshWorkspaces();
      setActiveWorkspaceId(response.workspace.id);
      setWorkspaceName("");
    } catch (err) {
      setError(toUserFacingError(err, "issues-load"));
    } finally {
      setBusy(false);
    }
  };

  const handleJoinWorkspace = async () => {
    if (!session?.access_token || !inviteCode.trim()) return;
    setBusy(true);
    try {
      const response = await api.collaboration.joinWorkspace(
        session.access_token,
        inviteCode.trim().toUpperCase()
      );
      await refreshWorkspaces();
      setActiveWorkspaceId(response.workspace.id);
      setInviteCode("");
    } catch (err) {
      setError(toUserFacingError(err, "issues-load"));
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (member: WorkspaceMember, role: WorkspaceRole) => {
    if (!session?.access_token || !activeWorkspace?.workspace.id) return;
    try {
      const response = await api.collaboration.updateMemberRole(
        session.access_token,
        activeWorkspace.workspace.id,
        member.userId,
        role
      );
      setData((current) =>
        current
          ? {
              ...current,
              members: current.members.map((entry) =>
                entry.userId === member.userId ? response.member : entry
              ),
            }
          : current
      );
    } catch (err) {
      setError(toUserFacingError(err, "ticket-update"));
    }
  };

  const handleApproval = async (
    approval: ApprovalRequest,
    status: "approved" | "rejected"
  ) => {
    if (!session?.access_token) return;
    setApprovalLoadingId(approval.id);
    try {
      const response = await api.collaboration.updateApproval(
        session.access_token,
        approval.id,
        status
      );
      setData((current) =>
        current
          ? {
              ...current,
              approvals: current.approvals.map((entry) =>
                entry.id === approval.id ? response.approval : entry
              ),
            }
          : current
      );
    } catch (err) {
      setError(toUserFacingError(err, "ticket-update"));
    } finally {
      setApprovalLoadingId(null);
    }
  };

  const pendingApprovals = useMemo(
    () => (data?.approvals || []).filter((entry) => entry.status === "pending"),
    [data?.approvals]
  );

  return (
    <div className="space-y-6 pb-20">
      {error && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.18)]">
          <div className="flex flex-col gap-4 border-b border-slate-800/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
                Workspaces
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                Shared spaces where teams review AI actions, assign owners, and approve execution.
              </p>
            </div>
            {activeWorkspace && (
              <Badge variant="secondary">
                Active: {activeWorkspace.workspace.name}
              </Badge>
            )}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
              <p className="text-sm font-medium text-white">Create Workspace</p>
              <div className="mt-3 flex gap-2">
                <Input
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  placeholder="Platform team"
                  className="border-slate-800 bg-slate-900/70 text-slate-100"
                />
                <Button onClick={handleCreateWorkspace} disabled={busy || !workspaceName.trim()}>
                  Create
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
              <p className="text-sm font-medium text-white">Join Workspace</p>
              <div className="mt-3 flex gap-2">
                <Input
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                  placeholder="Invite code"
                  className="border-slate-800 bg-slate-900/70 text-slate-100"
                />
                <Button
                  variant="secondary"
                  onClick={handleJoinWorkspace}
                  disabled={busy || !inviteCode.trim()}
                >
                  Join
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {workspaceLoading ? (
              <Skeleton className="h-10 w-48 rounded-xl bg-slate-900" />
            ) : (
              workspaces.map((entry) => (
                <button
                  key={entry.workspace.id}
                  type="button"
                  onClick={() => setActiveWorkspaceId(entry.workspace.id)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    activeWorkspace?.workspace.id === entry.workspace.id
                      ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-100"
                      : "border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:text-white"
                  }`}
                >
                  <div className="text-sm font-medium">{entry.workspace.name}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    {entry.role}
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.18)]">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
                Approval Flow
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                AI suggests. The team approves. Product Pulse executes.
              </p>
            </div>
            <Badge variant="secondary">{pendingApprovals.length} pending</Badge>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              <>
                <Skeleton className="h-24 rounded-2xl bg-slate-900" />
                <Skeleton className="h-24 rounded-2xl bg-slate-900" />
              </>
            ) : pendingApprovals.length ? (
              pendingApprovals.map((approval) => (
                <div
                  key={approval.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {approval.actionType.replace(/_/g, " ")}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {approval.reasoning || "AI suggested this action based on recent issue pressure."}
                      </p>
                    </div>
                    <Badge variant={approvalVariant(approval.status)}>
                      {approval.status}
                    </Badge>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApproval(approval, "approved")}
                      disabled={approvalLoadingId === approval.id || data?.role === "viewer"}
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleApproval(approval, "rejected")}
                      disabled={approvalLoadingId === approval.id || data?.role === "viewer"}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-500">
                No approvals pending right now.
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr_1.1fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-cyan-300" />
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
              Members
            </h3>
          </div>
          <div className="mt-4 space-y-3">
            {loading ? (
              <Skeleton className="h-56 rounded-2xl bg-slate-900" />
            ) : (
              data?.members.map((member) => (
                <div
                  key={member.userId}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {member.name || member.email || "Teammate"}
                      </p>
                      <p className="text-xs text-slate-500">{member.email}</p>
                    </div>
                    {data?.role === "owner" || data?.role === "admin" ? (
                      <select
                        value={member.role}
                        onChange={(event) =>
                          handleRoleChange(member, event.target.value as WorkspaceRole)
                        }
                        className="rounded-xl border border-slate-800 bg-slate-900/70 px-2 py-1 text-xs text-slate-100 outline-none"
                      >
                        <option value="owner">owner</option>
                        <option value="admin">admin</option>
                        <option value="developer">developer</option>
                        <option value="viewer">viewer</option>
                      </select>
                    ) : (
                      <Badge variant="secondary">{member.role}</Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          {activeWorkspace && (
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-400">
              Invite code:{" "}
              <span className="font-medium text-slate-100">
                {activeWorkspace.workspace.inviteCode}
              </span>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center gap-2">
            <GitPullRequestArrow className="h-4 w-4 text-indigo-300" />
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
              Shared Issues
            </h3>
          </div>
          <div className="mt-4 space-y-3">
            {loading ? (
              <Skeleton className="h-56 rounded-2xl bg-slate-900" />
            ) : data?.issues.length ? (
              data.issues.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/dashboard/issues/${issue.id}`}
                  className="block rounded-xl border border-slate-800 bg-slate-950/60 p-3 transition hover:border-slate-700"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{issue.title}</p>
                    <Badge variant={issue.priority === "HIGH" ? "destructive" : "secondary"}>
                      {issue.priority}
                    </Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-400">{issue.summary}</p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                    <span>{issue.reportCount} reports</span>
                    <span>{issue.trendPercent}% trend</span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-500">
                No issues shared in this workspace yet.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-300" />
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
              Live Activity
            </h3>
          </div>
          <div className="mt-4 space-y-3">
            {loading ? (
              <Skeleton className="h-56 rounded-2xl bg-slate-900" />
            ) : data?.activity.length ? (
              data.activity.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-200">{entry.summary}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                        {entry.actorType} · {entry.actionType.replace(/_/g, " ")}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(entry.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-500">
                Activity will appear here as the team and AI interact.
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => void refreshWorkspaces()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
