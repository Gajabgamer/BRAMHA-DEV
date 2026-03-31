"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, type AgentAction, type AgentStatus } from "@/lib/api";
import { toUserFacingError } from "@/lib/user-facing-errors";
import { useAuth } from "./AuthProvider";

const EMPTY_STATUS: AgentStatus = {
  enabled: true,
  state: "idle",
  lastRunAt: null,
  latestBanner: null,
  latestAction: null,
  actions: [],
  listening: true,
};

interface AgentContextValue {
  status: AgentStatus;
  actions: AgentAction[];
  loading: boolean;
  error: string | null;
  refreshAgent: () => void;
  setAgentEnabled: (enabled: boolean) => Promise<void>;
}

const AgentContext = createContext<AgentContextValue | null>(null);

export function AgentProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [status, setStatus] = useState<AgentStatus>(EMPTY_STATUS);
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshAgent = useCallback(async () => {
    if (!session?.access_token) {
      setStatus(EMPTY_STATUS);
      setActions([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [nextStatus, nextActions] = await Promise.all([
        api.agent.status(session.access_token),
        api.agent.actions(session.access_token),
      ]);
      setStatus({ ...nextStatus, actions: nextActions });
      setActions(nextActions);
    } catch (err) {
      setStatus(EMPTY_STATUS);
      setActions([]);
      setError(toUserFacingError(err, "agent-load"));
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void refreshAgent();
  }, [refreshAgent]);

  useEffect(() => {
    if (!session?.access_token) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshAgent();
    }, 15000);

    return () => window.clearInterval(timer);
  }, [refreshAgent, session?.access_token]);

  const setAgentEnabled = useCallback(
    async (enabled: boolean) => {
      if (!session?.access_token) {
        return;
      }

      const nextStatus = await api.agent.updateSettings(session.access_token, enabled);
      setStatus((current) => ({
        ...current,
        ...nextStatus,
      }));
    },
    [session?.access_token]
  );

  const value = useMemo(
    () => ({
      status,
      actions,
      loading,
      error,
      refreshAgent,
      setAgentEnabled,
    }),
    [actions, error, loading, refreshAgent, setAgentEnabled, status]
  );

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgent() {
  const context = useContext(AgentContext);

  if (!context) {
    throw new Error("useAgent must be used within AgentProvider.");
  }

  return context;
}
