import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import AstTree from "./components/AstTree";
import { BarChart, Sparkline } from "./components/InsightCharts";
import { starterTemplates } from "./data/starterTemplates";
import { bugPredictorApi, clearAuthToken, getAuthToken, setAuthToken } from "./lib/api";

const defaultAuth = { name: "", email: "demo@bugpredictor.dev", password: "demo1234" };
const defaultGitHub = { owner: "bugpredictor", repo: "core-engine", access_token: "", trigger_on_push: true, trigger_on_pr: true };
const defaultComment = { author: "Ava Lin", text: "", line: "" };
const defaultAssignment = { title: "", assignee: "Rhea Patel", severity: "medium" };

export default function App() {
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState(defaultAuth);
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [language, setLanguage] = useState(starterTemplates[0].language);
  const [filename, setFilename] = useState(starterTemplates[0].filename);
  const [code, setCode] = useState(starterTemplates[0].code);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [savingScan, setSavingScan] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [collapsedIds, setCollapsedIds] = useState(new Set());
  const [githubForm, setGitHubForm] = useState(defaultGitHub);
  const [commentForm, setCommentForm] = useState(defaultComment);
  const [assignmentForm, setAssignmentForm] = useState(defaultAssignment);
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantMessages, setAssistantMessages] = useState([]);
  const [workspaceError, setWorkspaceError] = useState("");
  const deferredCode = useDeferredValue(code);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationIdsRef = useRef([]);
  const analysisRef = useRef(null);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;
  const selectedNode = analysis?.node_index?.find((node) => node.id === selectedNodeId) || analysis?.node_index?.[0] || null;
  const templateTrend = selectedProject?.risk_trend?.length ? selectedProject.risk_trend : [22, 36, 31, 45, 28];

  useEffect(() => {
    analysisRef.current = analysis;
  }, [analysis]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      return;
    }
    void bootstrap();
  }, []);

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) {
      setSelectedProjectId(projects[0].id);
      setGitHubForm((current) => ({
        ...current,
        owner: projects[0]?.github?.owner || current.owner,
        repo: projects[0]?.github?.repo || current.repo
      }));
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void runAnalysis({ saveAnalysis: false, trigger: "manual" });
    }, 650);
    return () => window.clearTimeout(timeoutId);
  }, [user, deferredCode, language, filename, selectedProjectId]);

  useEffect(() => {
    if (!analysis) {
      return;
    }
    setSelectedNodeId(analysis.node_index?.[0]?.id ?? null);
    setCollapsedIds(new Set());
  }, [analysis?.filename, analysis?.risk_score]);

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !analysis) {
      return;
    }

    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const decorations = (analysis.highlighted_lines || []).map((highlight) => ({
      range: new monaco.Range(highlight.line, 1, highlight.line, 1),
      options: {
        isWholeLine: true,
        className: `risk-line risk-line-${highlight.severity}`,
        glyphMarginClassName: `risk-glyph risk-glyph-${highlight.severity}`,
        hoverMessage: {
          value: `**${highlight.title}**\n\n${highlight.detail}`
        }
      }
    }));

    if (selectedNode) {
      decorations.push({
        range: new monaco.Range(selectedNode.lineno, 1, selectedNode.end_lineno, 1),
        options: {
          isWholeLine: true,
          className: "node-selection-line"
        }
      });
      editor.revealLineInCenter(selectedNode.lineno);
    }

    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, decorations);
  }, [analysis, selectedNode]);

  async function bootstrap() {
    try {
      const [{ user: me }, { projects: nextProjects }, { dashboard: nextDashboard }] = await Promise.all([
        bugPredictorApi.getMe(),
        bugPredictorApi.getProjects(),
        bugPredictorApi.getDashboard()
      ]);

      startTransition(() => {
        setUser(me);
        setProjects(nextProjects);
        setDashboard(nextDashboard);
      });
    } catch (error) {
      clearAuthToken();
      setWorkspaceError(error.response?.data?.detail || "Could not restore your BugPredictor session.");
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    const payload = {
      ...authForm,
      name: authForm.name.trim(),
      email: authForm.email.trim(),
      password: authForm.password.trim()
    };
    try {
      const response =
        authMode === "login"
          ? await bugPredictorApi.login({ email: payload.email, password: payload.password })
          : await bugPredictorApi.signup(payload);

      setAuthToken(response.token);
      setUser(response.user);
      await bootstrap();
    } catch (error) {
      const detail = error.response?.data?.detail;
      setAuthError(
        detail ||
          "Authentication failed. Try the demo credentials exactly as shown: demo@bugpredictor.dev / demo1234"
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function runAnalysis({ saveAnalysis, trigger }) {
    if (!user) {
      return;
    }

    setAnalyzing(true);
    setWorkspaceError("");
    try {
      const response = await bugPredictorApi.analyze({
        code,
        language,
        filename,
        project_id: selectedProjectId || undefined,
        save_analysis: saveAnalysis,
        trigger
      });
      startTransition(() => setAnalysis(response));
      if (saveAnalysis) {
        await bootstrap();
      }
    } catch (error) {
      setWorkspaceError(error.response?.data?.detail || "Analysis failed.");
    } finally {
      setAnalyzing(false);
      setSavingScan(false);
    }
  }

  async function handleSaveScan() {
    setSavingScan(true);
    await runAnalysis({ saveAnalysis: true, trigger: "manual" });
  }

  async function handleGitHubConnect(event) {
    event.preventDefault();
    if (!selectedProjectId) {
      return;
    }
    try {
      await bugPredictorApi.connectGitHub({
        ...githubForm,
        project_id: selectedProjectId
      });
      await bootstrap();
    } catch (error) {
      setWorkspaceError(error.response?.data?.detail || "GitHub connection failed.");
    }
  }

  async function handleGitHubSimulate(eventType) {
    if (!selectedProjectId) {
      return;
    }
    try {
      const response = await bugPredictorApi.simulateGitHubEvent({
        project_id: selectedProjectId,
        event_type: eventType,
        code,
        language,
        filename
      });
      setAnalysis(response.analysis);
      await bootstrap();
    } catch (error) {
      setWorkspaceError(error.response?.data?.detail || "Could not simulate the GitHub workflow.");
    }
  }

  async function handleAskAssistant(event) {
    event.preventDefault();
    if (!assistantQuestion.trim()) {
      return;
    }

    const question = assistantQuestion.trim();
    setAssistantMessages((current) => [...current, { role: "user", text: question }]);
    setAssistantQuestion("");

    try {
      const response = await bugPredictorApi.askAssistant({
        question,
        code,
        language,
        filename,
        selected_node_id: selectedNodeId
      });
      setAssistantMessages((current) => [...current, { role: "assistant", text: response.answer }]);
    } catch (error) {
      setAssistantMessages((current) => [
        ...current,
        { role: "assistant", text: error.response?.data?.detail || "Assistant could not answer right now." }
      ]);
    }
  }

  async function handleCommentSubmit(event) {
    event.preventDefault();
    if (!selectedProjectId || !commentForm.text.trim()) {
      return;
    }
    await bugPredictorApi.addComment(selectedProjectId, {
      author: commentForm.author,
      text: commentForm.text,
      line: commentForm.line ? Number(commentForm.line) : null
    });
    setCommentForm(defaultComment);
    await bootstrap();
  }

  async function handleAssignmentSubmit(event) {
    event.preventDefault();
    if (!selectedProjectId || !assignmentForm.title.trim()) {
      return;
    }
    await bugPredictorApi.addAssignment(selectedProjectId, assignmentForm);
    setAssignmentForm(defaultAssignment);
    await bootstrap();
  }

  function handleEditorMount(editor, monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.onMouseDown((event) => {
      if (!event.target.position || !analysisRef.current?.node_index?.length) {
        return;
      }
      const node = findBestNodeAtLine(analysisRef.current.node_index, event.target.position.lineNumber);
      if (node) {
        selectNode(node.id, analysisRef.current.node_index);
      }
    });
  }

  function selectNode(nodeId, nodeIndex = analysis?.node_index || []) {
    setSelectedNodeId(nodeId);
    setCollapsedIds((current) => expandAncestors(current, nodeId, nodeIndex));
  }

  function handleLogout() {
    clearAuthToken();
    setUser(null);
    setProjects([]);
    setDashboard(null);
    setAnalysis(null);
  }

  function loadTemplate(templateId) {
    const template = starterTemplates.find((entry) => entry.id === templateId);
    if (!template) {
      return;
    }
    setLanguage(template.language);
    setFilename(template.filename);
    setCode(template.code);
  }

  if (!user) {
    return (
      <div className="auth-shell">
        <div className="auth-hero">
          <div className="eyebrow">BugPredictor</div>
          <h1>Explains, predicts, and improves code intelligently.</h1>
          <p>
            Static analysis, AST explainability, GitHub-triggered scans, realtime editor risk highlighting,
            contextual fixes, and collaboration in one developer-facing workspace.
          </p>
          <div className="auth-highlights">
            <span>AST JSON + interactive tree</span>
            <span>Bug probability score</span>
            <span>Security and quality insights</span>
          </div>
        </div>
        <form className="auth-card" onSubmit={handleAuthSubmit}>
          <div className="panel-title">{authMode === "login" ? "Sign in" : "Create account"}</div>
          {authMode === "signup" ? (
            <label className="field">
              <span>Name</span>
              <input value={authForm.name} onChange={(event) => setAuthForm((current) => ({ ...current, name: event.target.value }))} />
            </label>
          ) : null}
          <label className="field">
            <span>Email</span>
            <input value={authForm.email} onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" value={authForm.password} onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))} />
          </label>
          {authError ? <div className="inline-error">{authError}</div> : null}
          {workspaceError ? <div className="inline-error">{workspaceError}</div> : null}
          <button className="primary-button" type="submit" disabled={authBusy}>
            {authBusy ? "Working..." : authMode === "login" ? "Enter BugPredictor" : "Create workspace"}
          </button>
          <button className="secondary-button" type="button" onClick={() => setAuthMode((current) => (current === "login" ? "signup" : "login"))}>
            {authMode === "login" ? "Need an account?" : "Already have an account?"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setAuthForm({ name: "", email: "demo@bugpredictor.dev", password: "demo1234" })}
          >
            Use demo account
          </button>
          <div className="demo-note">Demo login: demo@bugpredictor.dev / demo1234</div>
        </form>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">AI bug prediction workspace</div>
          <h1>BugPredictor</h1>
        </div>
        <div className="topbar-actions">
          <button className="secondary-button" type="button" onClick={() => window.print()}>
            Export PDF
          </button>
          <button className="secondary-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <section className="hero-grid">
        <SummaryCard title="Average Risk" value={`${dashboard?.totals?.avg_risk ?? 0}%`} accent="high" />
        <SummaryCard title="Quality Score" value={`${dashboard?.totals?.avg_quality ?? 100}`} accent="low" />
        <SummaryCard title="Projects" value={`${dashboard?.totals?.projects ?? 0}`} accent="medium" />
        <SummaryCard title="Saved Scans" value={`${dashboard?.totals?.scans ?? 0}`} accent="low" />
      </section>

      <section className="main-grid">
        <aside className="rail card">
          <div className="panel-title">Projects</div>
          <div className="user-chip">{user.name} · {user.company || "BugPredictor workspace"}</div>
          <div className="project-list">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                className={`project-card ${project.id === selectedProjectId ? "is-active" : ""}`}
                onClick={() => {
                  setSelectedProjectId(project.id);
                  setGitHubForm((current) => ({
                    ...current,
                    owner: project.github?.owner || current.owner,
                    repo: project.github?.repo || current.repo
                  }));
                }}
              >
                <div className="project-name">{project.name}</div>
                <div className="project-meta">{project.repo || "Unlinked repo"} · {project.status}</div>
                <Sparkline points={project.risk_trend || [0, 0, 0]} color="#7ef0d0" label={`${project.name} trend`} />
              </button>
            ))}
          </div>
          <div className="panel-title compact">Templates</div>
          {starterTemplates.map((template) => (
            <button key={template.id} type="button" className="template-button" onClick={() => loadTemplate(template.id)}>
              <strong>{template.label}</strong>
              <span>{template.description}</span>
            </button>
          ))}
        </aside>

        <section className="workspace">
          <div className="card workspace-toolbar">
            <div className="toolbar-group">
              <input className="filename-input" value={filename} onChange={(event) => setFilename(event.target.value)} />
              <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>
            </div>
            <div className="toolbar-group">
              <button className="secondary-button" type="button" onClick={() => void runAnalysis({ saveAnalysis: false, trigger: "manual" })}>
                {analyzing ? "Analyzing..." : "Live Scan"}
              </button>
              <button className="primary-button" type="button" onClick={() => void handleSaveScan()} disabled={savingScan}>
                {savingScan ? "Saving..." : "Save Scan"}
              </button>
            </div>
          </div>

          <div className="split-view">
            <div className="card editor-card">
              <div className="panel-title">Code Editor</div>
              <Editor
                height="540px"
                language={language === "cpp" ? "cpp" : language}
                theme="vs-dark"
                value={code}
                onChange={(value) => setCode(value ?? "")}
                onMount={handleEditorMount}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  fontFamily: "Consolas, 'Cascadia Code', monospace",
                  scrollBeyondLastLine: false,
                  glyphMargin: true,
                  lineNumbersMinChars: 3,
                  smoothScrolling: true
                }}
              />
            </div>

            <div className="card ast-card">
              <div className="panel-title">AST Explorer</div>
              <AstTree
                tree={analysis?.ast_tree}
                selectedNodeId={selectedNodeId}
                collapsedIds={collapsedIds}
                onSelectNode={(nodeId) => selectNode(nodeId)}
                onToggleNode={(nodeId) =>
                  setCollapsedIds((current) => {
                    const next = new Set(current);
                    if (next.has(nodeId)) {
                      next.delete(nodeId);
                    } else {
                      next.add(nodeId);
                    }
                    return next;
                  })
                }
              />
              <div className="node-explanation">
                <div className="node-header">
                  <strong>{selectedNode?.label || "Select a node"}</strong>
                  <RiskPill value={selectedNode?.risk || "none"} />
                </div>
                <p>{selectedNode?.explanation || "Node explanations appear here after analysis."}</p>
                <div className="node-meta">
                  {selectedNode ? `Lines ${selectedNode.lineno}–${selectedNode.end_lineno}` : "No node selected"}
                </div>
              </div>
            </div>
          </div>

          <div className="card analysis-card">
            <div className="panel-title">Risk Findings</div>
            {workspaceError ? <div className="inline-error">{workspaceError}</div> : null}
            <div className="issue-list">
              {(analysis?.issues || []).map((issue) => (
                <button key={`${issue.id}-${issue.line}`} type="button" className="issue-card" onClick={() => {
                  const node = findBestNodeAtLine(analysis?.node_index || [], issue.line);
                  if (node) {
                    selectNode(node.id);
                  }
                }}>
                  <div className="issue-title-row">
                    <strong>{issue.title}</strong>
                    <RiskPill value={issue.severity} />
                  </div>
                  <div className="issue-detail">Line {issue.line} · {issue.detail}</div>
                  <div className="issue-fix-grid">
                    <pre>{issue.before || "// no source preview"}</pre>
                    <pre>{issue.after}</pre>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      </section>

      <section className="insight-grid">
        <div className="card">
          <div className="panel-title">Risk Trends</div>
          <Sparkline points={templateTrend} color="#ff9a8b" label="risk trend" />
          <div className="mini-stat-row">
            <span>Latest score</span>
            <strong>{analysis?.risk_score ?? selectedProject?.latest_analysis?.risk_score ?? 0}%</strong>
          </div>
          <div className="mini-stat-row">
            <span>Max nesting</span>
            <strong>{analysis?.metrics?.max_nesting ?? 0}</strong>
          </div>
          <div className="mini-stat-row">
            <span>Functions scanned</span>
            <strong>{analysis?.metrics?.functions ?? 0}</strong>
          </div>
        </div>

        <div className="card">
          <div className="panel-title">Most Error-Prone Files</div>
          <BarChart items={dashboard?.error_prone_files || []} />
        </div>

        <div className="card">
          <div className="panel-title">Test Case Generator</div>
          <div className="stack-list">
            {(analysis?.test_cases || []).map((testCase) => (
              <div key={testCase.title} className="stack-item">
                <strong>{testCase.title}</strong>
                <p>{testCase.rationale}</p>
                <pre>{testCase.skeleton}</pre>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="insight-grid">
        <div className="card">
          <div className="panel-title">GitHub Integration</div>
          <form className="stack-list" onSubmit={handleGitHubConnect}>
            <label className="field">
              <span>Owner</span>
              <input value={githubForm.owner} onChange={(event) => setGitHubForm((current) => ({ ...current, owner: event.target.value }))} />
            </label>
            <label className="field">
              <span>Repository</span>
              <input value={githubForm.repo} onChange={(event) => setGitHubForm((current) => ({ ...current, repo: event.target.value }))} />
            </label>
            <label className="field">
              <span>Access token</span>
              <input value={githubForm.access_token} onChange={(event) => setGitHubForm((current) => ({ ...current, access_token: event.target.value }))} />
            </label>
            <button className="primary-button" type="submit">Connect GitHub</button>
          </form>
          <div className="button-row">
            <button className="secondary-button" type="button" onClick={() => void handleGitHubSimulate("push")}>Simulate Push</button>
            <button className="secondary-button" type="button" onClick={() => void handleGitHubSimulate("pull_request")}>Simulate PR</button>
          </div>
          <div className="small-copy">{selectedProject?.github?.installation_hint || "Connect a repository to enable automated workflows."}</div>
        </div>

        <div className="card">
          <div className="panel-title">AI Chat Assistant</div>
          <div className="chat-thread">
            {assistantMessages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`chat-bubble ${message.role}`}>
                {message.text}
              </div>
            ))}
          </div>
          <form className="chat-form" onSubmit={handleAskAssistant}>
            <input value={assistantQuestion} onChange={(event) => setAssistantQuestion(event.target.value)} placeholder="Why is this risky? How do I fix it?" />
            <button className="primary-button" type="submit">Ask</button>
          </form>
        </div>

        <div className="card">
          <div className="panel-title">Team Collaboration</div>
          <form className="stack-list" onSubmit={handleCommentSubmit}>
            <label className="field">
              <span>Comment</span>
              <textarea value={commentForm.text} onChange={(event) => setCommentForm((current) => ({ ...current, text: event.target.value }))} rows="3" />
            </label>
            <label className="field">
              <span>Line</span>
              <input value={commentForm.line} onChange={(event) => setCommentForm((current) => ({ ...current, line: event.target.value }))} />
            </label>
            <button className="secondary-button" type="submit">Add Comment</button>
          </form>
          <form className="stack-list" onSubmit={handleAssignmentSubmit}>
            <label className="field">
              <span>Assignment</span>
              <input value={assignmentForm.title} onChange={(event) => setAssignmentForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <button className="secondary-button" type="submit">Assign Issue</button>
          </form>
          <div className="stack-list">
            {(selectedProject?.comments || []).map((comment) => (
              <div key={comment.id} className="stack-item">
                <strong>{comment.author}</strong>
                <p>{comment.text}</p>
                <span>Line {comment.line || "n/a"}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card printable-report">
        <div className="panel-title">Printable Report</div>
        <h2>{analysis?.report?.headline || "Run a scan to generate a report"}</h2>
        <p>Risk score: {analysis?.risk_score ?? 0}% · Quality score: {analysis?.quality_score ?? 100}</p>
        <ul className="report-list">
          {(analysis?.report?.key_findings || []).map((finding) => <li key={finding}>{finding}</li>)}
        </ul>
      </section>
    </div>
  );
}

function SummaryCard({ title, value, accent }) {
  return (
    <div className={`card summary-card ${accent}`}>
      <div className="summary-title">{title}</div>
      <div className="summary-value">{value}</div>
    </div>
  );
}

function RiskPill({ value }) {
  return <span className={`risk-pill ${value}`}>{value}</span>;
}

function findBestNodeAtLine(nodeIndex, line) {
  const matches = nodeIndex.filter((node) => line >= node.lineno && line <= node.end_lineno);
  matches.sort((a, b) => {
    const aSpan = a.end_lineno - a.lineno;
    const bSpan = b.end_lineno - b.lineno;
    if (aSpan !== bSpan) {
      return aSpan - bSpan;
    }
    return b.depth - a.depth;
  });
  return matches[0] || null;
}

function expandAncestors(current, nodeId, nodeIndex) {
  const next = new Set(current);
  const parentMap = new Map(nodeIndex.map((node) => [node.id, node.parent_id]));
  let pointer = parentMap.get(nodeId);
  while (pointer) {
    next.delete(pointer);
    pointer = parentMap.get(pointer);
  }
  return next;
}
