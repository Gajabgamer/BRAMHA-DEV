"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { DashboardLiveProvider } from "@/providers/DashboardLiveProvider";
import { AgentProvider } from "@/providers/AgentProvider";
import { GuideProvider } from "@/providers/GuideProvider";
import { NotificationsProvider } from "@/providers/NotificationsProvider";
import { WorkspaceProvider } from "@/providers/WorkspaceProvider";
import ProtectedRoute from "@/components/ProtectedRoute";

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": {
    title: "System Intel",
    subtitle: "Real-time health of your product based on user sentiment.",
  },
  "/dashboard/connect": {
    title: "Data Sources",
    subtitle: "Manage the pipelines feeding your product intelligence engine.",
  },
  "/dashboard/github": {
    title: "GitHub Workspace",
    subtitle: "Connect a repository, inspect issue-to-code insights, and open safe pull requests.",
  },
  "/dashboard/workspace": {
    title: "Team Workspace",
    subtitle: "Collaborate with teammates, review AI approvals, and keep issue ownership clear.",
  },
  "/dashboard/command-center": {
    title: "Command Center",
    subtitle: "Monitor autonomous decisions, inspect reasoning, and ask the system what matters most.",
  },
  "/dashboard/ai-helper": {
    title: "AI Helper",
    subtitle: "Ask live questions about product issues, trends, and the next best action.",
  },
  "/dashboard/tickets": {
    title: "Tickets & Actions",
    subtitle: "Track internal issues and push them into the live product intelligence pipeline.",
  },
  "/dashboard/timeline": {
    title: "Timeline",
    subtitle: "View daily system health through issue volume, feedback flow, and resolution speed.",
  },
  "/dashboard/sdk": {
    title: "Website SDK",
    subtitle: "Ship Product Pulse into any website to capture feedback, events, and front-end issues.",
  },
  "/dashboard/profile": {
    title: "Profile & Security",
    subtitle: "Manage your account details, password, and access settings.",
  },
  "/dashboard/agent-activity": {
    title: "Agent Activity",
    subtitle: "Observe what the autonomous product agent detected, decided, and acted on.",
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const meta = pathname.startsWith("/dashboard/issues/")
    ? {
        title: "Issue Detail",
        subtitle: "Deep context, evidence, and recommended actions for your team.",
      }
    : pageMeta[pathname] ?? pageMeta["/dashboard"];

  return (
    <DashboardLiveProvider>
      <AgentProvider>
        <NotificationsProvider>
          <WorkspaceProvider>
            <GuideProvider>
              <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-50 selection:bg-indigo-500/30 selection:text-indigo-200">
                <Sidebar />
                <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:px-10">
                  <div className="mx-auto max-w-7xl">
                    <ProtectedRoute>
                      <Navbar title={meta.title} subtitle={meta.subtitle} />
                      {children}
                    </ProtectedRoute>
                  </div>
                </main>
              </div>
            </GuideProvider>
          </WorkspaceProvider>
        </NotificationsProvider>
      </AgentProvider>
    </DashboardLiveProvider>
  );
}

