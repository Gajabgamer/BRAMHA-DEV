"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthProvider";
import {
  liveEventsClient,
  type LiveEvent,
} from "@/services/liveEventsClient";

type LiveEventsContextValue = {
  subscribeToEvents: (
    handler: (event: LiveEvent) => void,
    options?: { types?: string[] }
  ) => () => void;
};

const LiveEventsContext = createContext<LiveEventsContextValue | null>(null);

export function LiveEventsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();

  useEffect(() => {
    if (!session?.access_token) {
      liveEventsClient.disconnect();
      return;
    }

    liveEventsClient.connect(session.access_token);

    return () => {
      liveEventsClient.disconnect();
    };
  }, [session?.access_token]);

  const subscribeToEvents = useCallback(
    (handler: (event: LiveEvent) => void, options?: { types?: string[] }) => {
      const allowedTypes = options?.types?.length
        ? new Set(options.types)
        : null;

      return liveEventsClient.subscribe((event) => {
        if (allowedTypes && !allowedTypes.has(event.type)) {
          return;
        }
        handler(event);
      });
    },
    []
  );

  const value = useMemo(
    () => ({
      subscribeToEvents,
    }),
    [subscribeToEvents]
  );

  return (
    <LiveEventsContext.Provider value={value}>
      {children}
    </LiveEventsContext.Provider>
  );
}

export function useLiveEvents() {
  const context = useContext(LiveEventsContext);

  if (!context) {
    throw new Error("useLiveEvents must be used within LiveEventsProvider.");
  }

  return context;
}
