from __future__ import annotations

import json
import threading
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

from .sample_data import build_seed_store, hash_password


class LocalStore:
    def __init__(self, file_path: str | Path):
        self.file_path = Path(file_path)
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        if not self.file_path.exists():
            self._write(build_seed_store())
        else:
            self._repair_if_needed()

    def _repair_if_needed(self) -> None:
        with self._lock:
            data = self._read()
            seed = build_seed_store()
            changed = False
            for key in ("users", "sessions", "projects", "audit_log"):
                if key not in data:
                    data[key] = seed[key]
                    changed = True
            if changed:
                self._write(data)

    def _read(self) -> dict:
        return json.loads(self.file_path.read_text(encoding="utf-8"))

    def _write(self, data: dict) -> None:
        self.file_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def create_user(self, name: str, email: str, password: str) -> tuple[dict, str]:
        with self._lock:
            data = self._read()
            if any(user["email"].lower() == email.lower() for user in data["users"]):
                raise ValueError("An account already exists for that email.")

            user = {
                "id": f"user_{uuid.uuid4().hex[:8]}",
                "name": name.strip(),
                "email": email.strip().lower(),
                "password_hash": hash_password(password),
                "role": "member",
                "company": "Independent",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            starter_project = {
                "id": f"project_{uuid.uuid4().hex[:8]}",
                "owner_id": user["id"],
                "name": "Starter Repository",
                "description": "Fresh project created from BugPredictor onboarding.",
                "repo": "user/starter-repo",
                "language": "python",
                "status": "New",
                "branch": "main",
                "team": [{"id": "tm_owner", "name": user["name"], "role": "Owner"}],
                "github": {
                    "connected": False,
                    "owner": "",
                    "repo": "",
                    "installation_hint": "Connect GitHub to enable push and PR scans.",
                    "triggers": {"push": False, "pull_request": False},
                    "last_event": None,
                },
                "comments": [],
                "assignments": [],
                "analyses": [],
            }
            token = f"bp_{uuid.uuid4().hex}"
            data["users"].append(user)
            data["projects"].append(starter_project)
            data["sessions"][token] = user["id"]
            data["audit_log"].append(
                {
                    "id": f"audit_{uuid.uuid4().hex[:8]}",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "actor": user["name"],
                    "action": "Created a BugPredictor account.",
                }
            )
            self._write(data)
            return self._public_user(user), token

    def authenticate(self, email: str, password: str) -> tuple[dict, str]:
        with self._lock:
            data = self._read()
            password_hash = hash_password(password)
            user = next(
                (
                    item
                    for item in data["users"]
                    if item["email"].lower() == email.lower() and item["password_hash"] == password_hash
                ),
                None,
            )
            if user is None:
                raise ValueError("Incorrect email or password.")
            token = f"bp_{uuid.uuid4().hex}"
            data["sessions"][token] = user["id"]
            data["audit_log"].append(
                {
                    "id": f"audit_{uuid.uuid4().hex[:8]}",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "actor": user["name"],
                    "action": "Signed in to BugPredictor.",
                }
            )
            self._write(data)
            return self._public_user(user), token

    def get_user_from_token(self, token: str) -> dict | None:
        if not token:
            return None
        with self._lock:
            data = self._read()
            user_id = data["sessions"].get(token)
            if not user_id:
                return None
            user = next((item for item in data["users"] if item["id"] == user_id), None)
            return self._public_user(user) if user else None

    def list_projects(self, user_id: str) -> list[dict]:
        with self._lock:
            data = self._read()
            projects = [deepcopy(project) for project in data["projects"] if project["owner_id"] == user_id]
            for project in projects:
                latest = project["analyses"][-1] if project["analyses"] else None
                project["latest_analysis"] = latest
                project["analysis_count"] = len(project["analyses"])
                project["risk_trend"] = [entry["risk_score"] for entry in project["analyses"][-7:]]
            return projects

    def save_analysis(
        self,
        user_id: str,
        analysis_payload: dict,
        *,
        project_id: str | None,
        trigger: str,
    ) -> dict:
        with self._lock:
            data = self._read()
            matching_projects = [project for project in data["projects"] if project["owner_id"] == user_id]
            if not matching_projects:
                raise ValueError("No project is available for this account yet.")

            project = None
            if project_id:
                project = next((item for item in matching_projects if item["id"] == project_id), None)
            if project is None:
                project = matching_projects[0]

            snapshot = {
                "id": f"analysis_{uuid.uuid4().hex[:8]}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "risk_score": analysis_payload["risk_score"],
                "quality_score": analysis_payload["quality_score"],
                "issues_count": len(analysis_payload["issues"]),
                "filename": analysis_payload["filename"],
                "language": analysis_payload["language"],
                "trigger": trigger,
                "top_issue": analysis_payload["issues"][0]["title"] if analysis_payload["issues"] else "No critical issues detected.",
            }
            project["analyses"].append(snapshot)
            project["status"] = "Healthy" if snapshot["risk_score"] < 35 else "Watch" if snapshot["risk_score"] < 65 else "Critical"
            project["github"]["last_event"] = {
                "type": trigger,
                "timestamp": snapshot["timestamp"],
                "description": f"{trigger.replace('_', ' ').title()} scan completed for {snapshot['filename']}.",
            }
            data["audit_log"].append(
                {
                    "id": f"audit_{uuid.uuid4().hex[:8]}",
                    "timestamp": snapshot["timestamp"],
                    "actor": "BugPredictor",
                    "action": f"Saved analysis for {project['name']} with risk score {snapshot['risk_score']}%.",
                }
            )
            self._write(data)
            return snapshot

    def connect_github(self, user_id: str, project_id: str, payload: dict) -> dict:
        with self._lock:
            data = self._read()
            project = next(
                (
                    item
                    for item in data["projects"]
                    if item["id"] == project_id and item["owner_id"] == user_id
                ),
                None,
            )
            if project is None:
                raise ValueError("Project not found.")

            project["github"] = {
                "connected": True,
                "owner": payload.get("owner", "").strip(),
                "repo": payload.get("repo", "").strip(),
                "token_hint": f"Stored {len(payload.get('access_token', '').strip())} token chars securely in demo mode.",
                "installation_hint": "For production, replace the local token store with GitHub App credentials.",
                "triggers": {
                    "push": bool(payload.get("trigger_on_push", True)),
                    "pull_request": bool(payload.get("trigger_on_pr", True)),
                },
                "last_event": project.get("github", {}).get("last_event"),
            }
            project["repo"] = f"{project['github']['owner']}/{project['github']['repo']}".strip("/")
            self._write(data)
            return deepcopy(project["github"])

    def add_comment(self, user_id: str, project_id: str, author: str, text: str, line: int | None) -> dict:
        with self._lock:
            data = self._read()
            project = next(
                (
                    item
                    for item in data["projects"]
                    if item["id"] == project_id and item["owner_id"] == user_id
                ),
                None,
            )
            if project is None:
                raise ValueError("Project not found.")

            comment = {
                "id": f"comment_{uuid.uuid4().hex[:8]}",
                "author": author.strip() or "Teammate",
                "text": text.strip(),
                "line": line,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            project["comments"].insert(0, comment)
            self._write(data)
            return comment

    def add_assignment(self, user_id: str, project_id: str, title: str, assignee: str, severity: str) -> dict:
        with self._lock:
            data = self._read()
            project = next(
                (
                    item
                    for item in data["projects"]
                    if item["id"] == project_id and item["owner_id"] == user_id
                ),
                None,
            )
            if project is None:
                raise ValueError("Project not found.")

            assignment = {
                "id": f"assign_{uuid.uuid4().hex[:8]}",
                "title": title.strip(),
                "assignee": assignee.strip() or "Unassigned",
                "severity": severity,
                "status": "Todo",
            }
            project["assignments"].insert(0, assignment)
            self._write(data)
            return assignment

    def dashboard_summary(self, user_id: str) -> dict:
        projects = self.list_projects(user_id)
        all_analyses = [entry for project in projects for entry in project["analyses"]]
        total_scans = len(all_analyses)
        avg_risk = round(sum(entry["risk_score"] for entry in all_analyses) / total_scans, 1) if total_scans else 0
        avg_quality = round(sum(entry["quality_score"] for entry in all_analyses) / total_scans, 1) if total_scans else 100
        trend_points = [
            {"label": project["name"], "value": project["latest_analysis"]["risk_score"] if project["latest_analysis"] else 0}
            for project in projects
        ]
        risky_files: dict[str, list[int]] = {}
        for entry in all_analyses:
            risky_files.setdefault(entry["filename"], []).append(entry["risk_score"])
        error_prone_files = [
            {"filename": filename, "risk": round(sum(values) / len(values), 1), "scans": len(values)}
            for filename, values in risky_files.items()
        ]
        error_prone_files.sort(key=lambda item: item["risk"], reverse=True)

        return {
            "totals": {
                "projects": len(projects),
                "scans": total_scans,
                "avg_risk": avg_risk,
                "avg_quality": avg_quality,
            },
            "trend_points": trend_points,
            "error_prone_files": error_prone_files[:5],
            "recent_activity": [
                {
                    "project": project["name"],
                    "timestamp": project["latest_analysis"]["timestamp"] if project["latest_analysis"] else None,
                    "message": project["latest_analysis"]["top_issue"] if project["latest_analysis"] else "No scans yet.",
                    "risk_score": project["latest_analysis"]["risk_score"] if project["latest_analysis"] else 0,
                }
                for project in projects
            ],
        }

    @staticmethod
    def _public_user(user: dict | None) -> dict | None:
        if user is None:
            return None
        return {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "company": user.get("company", ""),
            "created_at": user["created_at"],
        }
