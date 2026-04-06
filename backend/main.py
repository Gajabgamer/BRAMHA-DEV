from __future__ import annotations

from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .bugpredictor_api.analysis import analyze_code, answer_assistant, normalize_language
from .bugpredictor_api.storage import LocalStore


BASE_DIR = Path(__file__).resolve().parent
STORE = LocalStore(BASE_DIR / "data" / "bugpredictor_store.json")

app = FastAPI(
    title="BugPredictor API",
    version="1.0.0",
    description="AI-powered static analysis, AST explainability, and developer workflow insights.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AuthPayload(BaseModel):
    name: str | None = None
    email: str
    password: str


class AnalyzePayload(BaseModel):
    code: str = Field(default="")
    language: str = Field(default="python")
    filename: str = Field(default="snippet.py")
    project_id: str | None = None
    save_analysis: bool = True
    trigger: str = Field(default="manual")


class GitHubConnectPayload(BaseModel):
    project_id: str
    owner: str
    repo: str
    access_token: str = ""
    trigger_on_push: bool = True
    trigger_on_pr: bool = True


class GitHubEventPayload(BaseModel):
    project_id: str
    event_type: str = "push"
    filename: str = "github_event.py"
    code: str = ""
    language: str = "python"


class CommentPayload(BaseModel):
    author: str
    text: str
    line: int | None = None


class AssignmentPayload(BaseModel):
    title: str
    assignee: str
    severity: str = "medium"


class AssistantPayload(BaseModel):
    question: str
    code: str = ""
    language: str = "python"
    filename: str = "snippet.py"
    selected_node_id: str | None = None


def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    token = ""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    user = STORE.get_user_from_token(token)
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required.")
    return user


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "bugpredictor-api"}


@app.post("/auth/signup")
def signup(payload: AuthPayload) -> dict:
    if not payload.name or len(payload.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Please provide a valid name.")
    if len(payload.password.strip()) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    try:
        user, token = STORE.create_user(payload.name, payload.email, payload.password)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {"user": user, "token": token}


@app.post("/auth/login")
def login(payload: AuthPayload) -> dict:
    try:
        user, token = STORE.authenticate(payload.email, payload.password)
    except ValueError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    return {"user": user, "token": token}


@app.get("/auth/me")
def auth_me(user: dict = Depends(get_current_user)) -> dict:
    return {"user": user}


@app.get("/projects")
def projects(user: dict = Depends(get_current_user)) -> dict:
    return {"projects": STORE.list_projects(user["id"])}


@app.get("/dashboard")
def dashboard(user: dict = Depends(get_current_user)) -> dict:
    return {"dashboard": STORE.dashboard_summary(user["id"])}


@app.post("/analyze")
def analyze(payload: AnalyzePayload, user: dict = Depends(get_current_user)) -> dict:
    result = analyze_code(payload.code, normalize_language(payload.language), payload.filename)
    if payload.save_analysis:
        snapshot = STORE.save_analysis(
            user["id"],
            result,
            project_id=payload.project_id,
            trigger=payload.trigger,
        )
        result["saved_snapshot"] = snapshot
    return result


@app.post("/github/connect")
def github_connect(payload: GitHubConnectPayload, user: dict = Depends(get_current_user)) -> dict:
    try:
        connection = STORE.connect_github(user["id"], payload.project_id, payload.model_dump())
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return {"github": connection}


@app.post("/github/simulate")
def github_simulate(payload: GitHubEventPayload, user: dict = Depends(get_current_user)) -> dict:
    result = analyze_code(payload.code, normalize_language(payload.language), payload.filename)
    snapshot = STORE.save_analysis(
        user["id"],
        result,
        project_id=payload.project_id,
        trigger=payload.event_type,
    )
    return {"analysis": result, "snapshot": snapshot}


@app.post("/assistant/chat")
def assistant_chat(payload: AssistantPayload, user: dict = Depends(get_current_user)) -> dict:
    analysis = analyze_code(payload.code, normalize_language(payload.language), payload.filename)
    return answer_assistant(payload.question, analysis, payload.selected_node_id)


@app.post("/projects/{project_id}/comments")
def project_comment(project_id: str, payload: CommentPayload, user: dict = Depends(get_current_user)) -> dict:
    try:
        comment = STORE.add_comment(user["id"], project_id, payload.author, payload.text, payload.line)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return {"comment": comment}


@app.post("/projects/{project_id}/assignments")
def project_assignment(project_id: str, payload: AssignmentPayload, user: dict = Depends(get_current_user)) -> dict:
    try:
        assignment = STORE.add_assignment(user["id"], project_id, payload.title, payload.assignee, payload.severity)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return {"assignment": assignment}


@app.post("/reports/export")
def reports_export(payload: AnalyzePayload, user: dict = Depends(get_current_user)) -> dict:
    result = analyze_code(payload.code, normalize_language(payload.language), payload.filename)
    return {"report": result["report"], "issues": result["issues"], "suggestions": result["suggestions"]}
