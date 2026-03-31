"use client";

import type { ComponentType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, Sparkles, Cable, LayoutDashboard, Bot, History, Package, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type GuideStep = {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

export const guideSteps: GuideStep[] = [
  {
    title: "Welcome to Product Pulse",
    description:
      "Product Pulse is your AI product intelligence system. It listens to feedback across channels, detects issues, reasons about impact, and helps your team take action automatically.",
    icon: Sparkles,
  },
  {
    title: "Connect Sources",
    description:
      "Start in Data Sources. Connect Gmail to ingest feedback emails, then add Reddit Listening, Social Listening, App Store Reviews, Google Play Reviews, Outlook, IMAP inboxes, or the Website SDK. Each source shows health and last synced state so you always know what is feeding the system.",
    icon: Cable,
  },
  {
    title: "Google Workspace Actions",
    description:
      "When you connect Gmail, Product Pulse can also use your Google Calendar connection. The agent can schedule follow-ups automatically, create reminders, and find the next available time slot using your calendar before placing an event.",
    icon: Bot,
  },
  {
    title: "Control Room Dashboard",
    description:
      "The Control Room is your live command center. It combines incoming feedback, issue clusters, alerts, trend cards, source signals, and health status so you can understand what is happening in the product at a glance.",
    icon: LayoutDashboard,
  },
  {
    title: "Issues, Tickets, and Reminders",
    description:
      "Product Pulse groups similar feedback into real issues, shows evidence and source/location breakdowns, then helps the agent create tickets, reminders, notifications, and follow-up actions when something important needs attention.",
    icon: LayoutDashboard,
  },
  {
    title: "Agent Actions",
    description:
      "The autonomous agent watches for spikes, repeated complaints, unresolved high-severity issues, and growing trends. When needed, it can acknowledge emails and SDK feedback automatically, create tickets, send notifications, schedule reminders, and log exactly why each action happened.",
    icon: Sparkles,
  },
  {
    title: "Timeline",
    description:
      "Use Timeline to track how issue volume changes over time, inspect spike days, monitor system health, and review the weekly product insight report powered by structured metrics and AI summaries.",
    icon: History,
  },
  {
    title: "AI Helper",
    description:
      "AI Helper lets you ask natural questions about your live product data, like what to fix first, what is trending, which users are most affected, or what changed this week. It works on top of the same feedback and issue pipeline you see across the dashboard.",
    icon: Bot,
  },
  {
    title: "Website SDK",
    description:
      "Add one script to your product to collect real-time user feedback, website events, and front-end errors. Those signals flow into the same feedback pipeline as emails, reviews, and social mentions.",
    icon: Package,
  },
  {
    title: "You’re all set",
    description:
      "Connect your sources, sync them once, and let Product Pulse keep listening. From there, the system can cluster issues, surface insights, notify you about important changes, and help your team move from feedback to action much faster.",
    icon: CheckCircle2,
  },
];

interface GuideOverlayProps {
  open: boolean;
  stepIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onSelectStep: (index: number) => void;
}

export default function GuideOverlay({
  open,
  stepIndex,
  onClose,
  onNext,
  onPrevious,
  onSkip,
  onSelectStep,
}: GuideOverlayProps) {
  const step = guideSteps[stepIndex];

  if (!step) {
    return null;
  }

  const Icon = step.icon;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === guideSteps.length - 1;

  return (
    <AnimatePresence>
      {open ? (
        <div className="pointer-events-none fixed inset-0 z-[80]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="pointer-events-auto absolute inset-4 flex items-center justify-center md:inset-6"
          >
            <div className="relative w-full max-w-[470px] overflow-hidden rounded-3xl p-[1px] shadow-[0_24px_90px_rgba(2,6,23,0.55)]">
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-[130%] opacity-95"
                animate={{ rotate: 360 }}
                transition={{
                  duration: 6,
                  ease: "linear",
                  repeat: Number.POSITIVE_INFINITY,
                }}
                style={{
                  background:
                    "conic-gradient(from 0deg, rgba(239,68,68,0) 0deg, rgba(239,68,68,0) 280deg, rgba(248,113,113,0.95) 320deg, rgba(239,68,68,0.35) 345deg, rgba(239,68,68,0) 360deg)",
                }}
              />
              <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] border border-rose-400/20 bg-slate-950/96 backdrop-blur-xl">
              <div className="bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.18),transparent_34%),radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_28%)] p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                        In-App Guide
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        Step {stepIndex + 1} of {guideSteps.length}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:border-white/20 hover:text-white"
                    aria-label="Close guide"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
                  <h3 className="text-xl font-semibold text-white">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    {step.description}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {guideSteps.map((guideStep, index) => (
                      <button
                        key={guideStep.title}
                        type="button"
                        onClick={() => onSelectStep(index)}
                        className={cn(
                          "h-2.5 rounded-full transition-all",
                          index === stepIndex
                            ? "w-7 bg-cyan-300"
                            : "w-2.5 bg-slate-700 hover:bg-slate-500"
                        )}
                        aria-label={`Go to step ${index + 1}`}
                      />
                    ))}
                  </div>

                  <div className="hidden items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-slate-300 sm:inline-flex">
                    <Info className="h-3.5 w-3.5 text-cyan-300" />
                    Reopen anytime from the sidebar
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 px-6 py-4">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onSkip}
                    className="rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white"
                  >
                    Skip
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onPrevious}
                    disabled={isFirst}
                    className="rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-40"
                  >
                    Previous
                  </Button>
                </div>

                <Button
                  type="button"
                  onClick={isLast ? onClose : onNext}
                  className="rounded-xl border-0 bg-[linear-gradient(90deg,#22d3ee_0%,#6366f1_55%,#8b5cf6_100%)] px-5 text-white shadow-[0_14px_28px_rgba(99,102,241,0.28)] transition hover:scale-[1.01] hover:brightness-105"
                >
                  {isLast ? "Done" : "Next"}
                </Button>
              </div>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
