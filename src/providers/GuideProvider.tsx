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
import { useAuth } from "@/providers/AuthProvider";
import GuideOverlay, { guideSteps } from "@/components/GuideOverlay";

type GuideContextType = {
  openGuide: (stepIndex?: number) => void;
  closeGuide: () => void;
  resetGuide: () => void;
  isOpen: boolean;
};

const GuideContext = createContext<GuideContextType>({
  openGuide: () => {},
  closeGuide: () => {},
  resetGuide: () => {},
  isOpen: false,
});

function getGuideKey(userId: string | null) {
  return userId ? `product-pulse-guide-seen:${userId}` : "product-pulse-guide-seen";
}

function readGuideSeen(key: string) {
  if (typeof window === "undefined") {
    return true;
  }

  return window.localStorage.getItem(key) === "true";
}

function writeGuideSeen(key: string, value: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, value ? "true" : "false");
}

export function GuideProvider({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const guideKey = useMemo(() => getGuideKey(profile.id), [profile.id]);

  useEffect(() => {
    if (loading || !profile.id) {
      return;
    }

    if (!readGuideSeen(guideKey)) {
      const frame = window.requestAnimationFrame(() => {
        setIsOpen(true);
      });

      return () => window.cancelAnimationFrame(frame);
    }
  }, [guideKey, loading, profile.id]);

  const markSeen = useCallback(() => {
    writeGuideSeen(guideKey, true);
  }, [guideKey]);

  const closeGuide = useCallback(() => {
    markSeen();
    setIsOpen(false);
    setStepIndex(0);
  }, [markSeen]);

  const openGuide = useCallback((initialStep = 0) => {
    setStepIndex(Math.max(0, Math.min(initialStep, guideSteps.length - 1)));
    setIsOpen(true);
  }, []);

  const resetGuide = useCallback(() => {
    writeGuideSeen(guideKey, false);
    setStepIndex(0);
    setIsOpen(true);
  }, [guideKey]);

  const handleNext = useCallback(() => {
    setStepIndex((current) => {
      if (current >= guideSteps.length - 1) {
        markSeen();
        setIsOpen(false);
        return 0;
      }

      return current + 1;
    });
  }, [markSeen]);

  const handlePrevious = useCallback(() => {
    setStepIndex((current) => Math.max(0, current - 1));
  }, []);

  const handleSkip = useCallback(() => {
    closeGuide();
  }, [closeGuide]);

  return (
    <GuideContext.Provider
      value={{
        openGuide,
        closeGuide,
        resetGuide,
        isOpen,
      }}
    >
      {children}
      <GuideOverlay
        open={isOpen}
        stepIndex={stepIndex}
        onClose={closeGuide}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onSkip={handleSkip}
        onSelectStep={setStepIndex}
      />
    </GuideContext.Provider>
  );
}

export function useGuide() {
  return useContext(GuideContext);
}
