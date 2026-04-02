"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, type SetupStatus } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";

interface SetupContextType {
  status: SetupStatus | null;
  loading: boolean;
  refreshSetup: () => Promise<void>;
}

const SetupContext = createContext<SetupContextType>({
  status: null,
  loading: true,
  refreshSetup: async () => {},
});

export function SetupProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSetup = useCallback(async () => {
    if (!session?.access_token) {
      setStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const next = await api.setup.status(session.access_token);
      setStatus(next);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (authLoading) return;
    void refreshSetup();
  }, [authLoading, refreshSetup]);

  return (
    <SetupContext.Provider value={{ status, loading, refreshSetup }}>
      {children}
    </SetupContext.Provider>
  );
}

export function useSetup() {
  return useContext(SetupContext);
}
