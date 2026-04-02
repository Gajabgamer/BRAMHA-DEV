"use client";

import { useEffect, useState } from "react";
import { Check, Pencil, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toUserFacingError } from "@/lib/user-facing-errors";

interface DecisionFeedbackBarProps {
  token: string | null | undefined;
  issueType: string;
  compact?: boolean;
}

type FeedbackAction = "accept" | "reject" | "edit";

export default function DecisionFeedbackBar({
  token,
  issueType,
  compact = false,
}: DecisionFeedbackBarProps) {
  const [submittedAction, setSubmittedAction] = useState<FeedbackAction | null>(null);
  const [submitting, setSubmitting] = useState<FeedbackAction | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setSubmittedAction(null);
    setSubmitting(null);
    setToast(null);
  }, [issueType]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const submit = async (action: FeedbackAction) => {
    if (!token || submitting || submittedAction) {
      return;
    }

    setSubmitting(action);

    try {
      await api.agent.feedbackAction(token, {
        issue_type: issueType,
        action,
      });
      setSubmittedAction(action);
      setToast(
        action === "accept"
          ? "Learning from this decision"
          : action === "reject"
            ? "Feedback recorded. Improving future suggestions."
            : "Adjustment noted"
      );
    } catch (error) {
      setToast(toUserFacingError(error, "agent-settings"));
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="sticky bottom-4 z-10 rounded-2xl border border-slate-800 bg-slate-950/90 p-4 shadow-2xl shadow-slate-950/30 backdrop-blur sm:static sm:bg-slate-950/60 sm:shadow-none">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium text-slate-200">Was this helpful?</p>
          <p className="mt-1 text-xs text-slate-500">
            Your feedback improves future confidence and actions.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant={submittedAction === "accept" ? "default" : "secondary"}
            className={`w-full ${compact ? "sm:w-auto" : ""}`}
            onClick={() => void submit("accept")}
            disabled={Boolean(submitting || submittedAction)}
          >
            {submittedAction === "accept" ? (
              <Check className="h-4 w-4" />
            ) : (
              <ThumbsUp className="h-4 w-4" />
            )}
            👍 Accept
          </Button>
          <Button
            variant={submittedAction === "reject" ? "destructive" : "secondary"}
            className={`w-full ${compact ? "sm:w-auto" : ""}`}
            onClick={() => void submit("reject")}
            disabled={Boolean(submitting || submittedAction)}
          >
            {submittedAction === "reject" ? (
              <Check className="h-4 w-4" />
            ) : (
              <ThumbsDown className="h-4 w-4" />
            )}
            👎 Reject
          </Button>
          <Button
            variant={submittedAction === "edit" ? "default" : "secondary"}
            className={`w-full ${compact ? "sm:w-auto" : ""}`}
            onClick={() => void submit("edit")}
            disabled={Boolean(submitting || submittedAction)}
          >
            {submittedAction === "edit" ? (
              <Check className="h-4 w-4" />
            ) : (
              <Pencil className="h-4 w-4" />
            )}
            ✏️ Edit
          </Button>
        </div>
      </div>

      {toast ? (
        <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
