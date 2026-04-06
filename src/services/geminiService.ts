import { AnalysisResult } from "../types";

export async function analyzeCode(code: string, name?: string): Promise<AnalysisResult & { id: number }> {
  if (!code.trim()) {
    throw new Error("No code provided for analysis.");
  }

  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code, name }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to analyze code.");
  }

  return await response.json();
}
