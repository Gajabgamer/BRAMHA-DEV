"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, MessageSquareText, ShieldCheck, UserRoundPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type ApprovalRequest, type IssueCollaboration } from "@/lib/api";
import { toUserFacingError } from "@/lib/user-facing-errors";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkspace } from "@/providers/WorkspaceProvider";

interface IssueCollaborationPanelProps {
  issueId: string;
}

function approvalTone(status: string) {
  if (status === "approved") return "success";
  if (status === "rejected") return "destructive";
  return "secondary";
}

export default function IssueCollaborationPanel({
  issueId,
}: IssueCollaborationPanelProps) {
  const { session } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [data, setData] = useState<IssueCollaboration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [approvalLoadingId, setApprovalLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const token = session?.access_token;
    const workspaceId = activeWorkspace?.workspace.id;

    if (!token || !workspaceId || !issueId) {
      setData(null);
      setLoading(false);
      return;
    }

    const safeToken: string = token;
    const safeWorkspaceId: string = workspaceId;

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const next = await api.collaboration.issue(
          safeToken,
          issueId,
          safeWorkspaceId
        );
        if (!cancelled) {
          setData(next);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(toUserFacingError(err, "issue-detail-load"));
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
  }, [activeWorkspace?.workspace.id, issueId, session?.access_token]);

  const handleAssign = async (assigneeUserId: string) => {
    if (!session?.access_token || !activeWorkspace?.workspace.id) return;
    setAssigning(true);
    try {
      const response = await api.collaboration.assignIssue(
        session.access_token,
        activeWorkspace.workspace.id,
        issueId,
        assigneeUserId
      );
      setData((current) =>
        current
          ? {
              ...current,
              assignments: [response.assignment],
            }
          : current
      );
    } catch (err) {
      setError(toUserFacingError(err, "ticket-update"));
    } finally {
      setAssigning(false);
    }
  };

  const handleComment = async () => {
    if (!session?.access_token || !activeWorkspace?.workspace.id || !comment.trim()) return;
    setPosting(true);
    try {
      const response = await api.collaboration.addComment(
        session.access_token,
        activeWorkspace.workspace.id,
        issueId,
        comment.trim()
      );
      setData((current) =>
        current
          ? {
              ...current,
              comments: [...current.comments, response.comment],
            }
          : current
      );
      setComment("");
    } catch (err) {
      setError(toUserFacingError(err, "reminder-create"));
    } finally {
      setPosting(false);
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

  if (!activeWorkspace) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-sm text-slate-400">
        Join or create a team workspace to assign issues, discuss with teammates, and approve AI suggestions together.
      </div>
    );
  }

  if (loading) {
    return <Skeleton className="h-80 rounded-2xl bg-slate-900" />;
  }

  const currentAssignment = data?.assignments[0] || null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.18)]">
      <div className="flex flex-col gap-3 border-b border-slate-800/80 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
            Collaboration
          </h3>
          <p className="mt-2 text-sm text-slate-400">
            Shared discussion, ownership, and approvals inside{" "}
            <span className="text-slate-200">{activeWorkspace.workspace.name}</span>.
          </p>
        </div>
        <Link
          href="/dashboard/workspace"
          className="text-sm text-indigo-300 transition hover:text-indigo-200"
        >
          Open Team Workspace
        </Link>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <UserRoundPlus className="h-4 w-4 text-indigo-300" />
              Assignment
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {data?.members.map((member) => {
                const selected = currentAssignment?.assigneeUserId === member.userId;
                return (
                  <button
                    key={member.userId}
                    type="button"
                    disabled={assigning || data?.role === "viewer"}
                    onClick={() => handleAssign(member.userId)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      selected
                        ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-200"
                        : "border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700 hover:text-white"
                    }`}
                  >
                    {member.name || member.email || "Teammate"}
                    <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      {member.role}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <ShieldCheck className="h-4 w-4 text-amber-300" />
              Approval Queue
            </div>
            <div className="mt-3 space-y-3">
              {data?.approvals.length ? (
                data.approvals.map((approval) => (
                  <div
                    key={approval.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {approval.actionType.replace(/_/g, " ")}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {approval.reasoning || "AI requested approval for this action."}
                        </p>
                      </div>
                      <Badge variant={approvalTone(approval.status)}>
                        {approval.status}
                      </Badge>
                    </div>
                    {approval.status === "pending" && data?.role !== "viewer" && (
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApproval(approval, "approved")}
                          disabled={approvalLoadingId === approval.id}
                        >
                          <Check className="h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleApproval(approval, "rejected")}
                          disabled={approvalLoadingId === approval.id}
                        >
                          <X className="h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  No approvals pending for this issue right now.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <MessageSquareText className="h-4 w-4 text-cyan-300" />
            Discussion
          </div>
          <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">
            {data?.comments.length ? (
              data.comments.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"
                >
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span className="font-medium text-slate-200">
                      {entry.author.name || entry.author.email || "Teammate"}
                    </span>
                    <span>{new Date(entry.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {entry.body}
                  </p>
                  {entry.isAi && (
                    <span className="mt-2 inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-200">
                      AI Assistant
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                No discussion yet. Add context so the team and AI stay aligned.
              </p>
            )}
          </div>

          <div className="mt-4 space-y-3">
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Share context, ask the AI to clarify, or leave handoff notes for the team..."
              className="min-h-28 w-full rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-500/40"
            />
            <div className="flex justify-end">
              <Button
                onClick={handleComment}
                disabled={posting || !comment.trim() || data?.role === "viewer"}
              >
                Post Comment
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
