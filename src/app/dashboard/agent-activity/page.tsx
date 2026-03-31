"use client";

import { Bot, CheckCircle2, Clock3, LoaderCircle, Sparkles, TriangleAlert } from "lucide-react";
import { useAgent } from "@/providers/AgentProvider";

function timeLabel(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toneForAction(actionType: string) {
  if (actionType.includes("ticket")) {
    return "border-cyan-500/20 bg-cyan-500/10 text-cyan-100";
  }
  if (actionType.includes("reminder")) {
    return "border-amber-500/20 bg-amber-500/10 text-amber-100";
  }
  if (actionType.includes("spike")) {
    return "border-rose-500/20 bg-rose-500/10 text-rose-100";
  }
  return "border-emerald-500/20 bg-emerald-500/10 text-emerald-100";
}

export default function AgentActivityPage() {
  const { status, actions, loading, error } = useAgent();

  return (
    <div className="mx-auto max-w-5xl pb-24">
      <div className="mb-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.24)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-200">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Autonomous Agent
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                {status.state === "processing"
                  ? "Processing fresh product signals"
                  : status.state === "active"
                    ? "Agent is actively monitoring your product"
                    : "Agent is currently idle"}
              </h2>
            </div>
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            {status.latestBanner ??
              "The agent will log detections, tickets, reminders, and monitoring notes here as new feedback arrives."}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.24)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Live Status
          </p>
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
            {status.state === "processing" ? (
              <LoaderCircle className="h-5 w-5 animate-spin text-amber-300" />
            ) : status.state === "active" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            ) : (
              <Clock3 className="h-5 w-5 text-rose-300" />
            )}
            <div>
              <p className="text-sm font-medium text-white">
                {status.state === "processing"
                  ? "Processing"
                  : status.state === "active"
                    ? "Active"
                    : "Idle"}
              </p>
              <p className="text-xs text-slate-400">
                {status.lastRunAt ? `Last run ${timeLabel(status.lastRunAt)}` : "Waiting for a fresh signal"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.24)]">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Activity Timeline
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Every detection, decision, and automated follow-up is logged here.
            </p>
          </div>
          <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1 text-xs font-medium text-slate-300">
            {actions.length} action{actions.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-5 py-8 text-sm text-slate-400">
            Loading agent activity...
          </div>
        ) : actions.length > 0 ? (
          <div className="space-y-4">
            {actions.map((action) => (
              <div
                key={action.id}
                className={`rounded-2xl border px-5 py-4 ${toneForAction(action.actionType)}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em]">
                      <Sparkles className="h-3.5 w-3.5" />
                      {action.actionType.replace(/_/g, " ")}
                    </div>
                    <p className="mt-3 text-sm font-medium text-white">{action.reason}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Why this happened:{" "}
                      {String(action.metadata?.why || action.metadata?.reasoning || "The agent detected a meaningful change in product signals.")}
                    </p>
                  </div>
                  <span className="text-xs text-slate-300">{timeLabel(action.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/70 px-5 py-8">
            <div className="flex items-center gap-3 text-slate-300">
              <TriangleAlert className="h-5 w-5 text-amber-300" />
              <div>
                <p className="text-sm font-medium text-white">Waiting for your first agent action</p>
                <p className="mt-1 text-sm text-slate-400">
                  Connect a source and sync fresh feedback. The agent will start detecting issues and logging its actions here automatically.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
