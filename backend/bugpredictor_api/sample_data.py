from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
from hashlib import sha256


def hash_password(password: str) -> str:
    return sha256(password.encode("utf-8")).hexdigest()


def iso_days_ago(days: int, hour: int = 9) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).replace(
        hour=hour, minute=0, second=0, microsecond=0
    ).isoformat()


def build_seed_store() -> dict:
    demo_user = {
        "id": "user_demo",
        "name": "Ava Lin",
        "email": "demo@bugpredictor.dev",
        "password_hash": hash_password("demo1234"),
        "role": "admin",
        "company": "BugPredictor Labs",
        "created_at": iso_days_ago(30),
    }

    history_api_guard = [
        {
            "id": "analysis_1",
            "timestamp": iso_days_ago(6),
            "risk_score": 62,
            "quality_score": 56,
            "issues_count": 7,
            "filename": "payment_guard.py",
            "language": "python",
            "trigger": "pull_request",
            "top_issue": "Broad exception handling masks failed payment validations.",
        },
        {
            "id": "analysis_2",
            "timestamp": iso_days_ago(4),
            "risk_score": 48,
            "quality_score": 68,
            "issues_count": 5,
            "filename": "payment_guard.py",
            "language": "python",
            "trigger": "push",
            "top_issue": "Dynamic SQL builder still accepts interpolated values.",
        },
        {
            "id": "analysis_3",
            "timestamp": iso_days_ago(2),
            "risk_score": 33,
            "quality_score": 79,
            "issues_count": 3,
            "filename": "payment_guard.py",
            "language": "python",
            "trigger": "manual",
            "top_issue": "Loop nesting remains high in fraud scoring branch.",
        },
    ]

    history_ide = [
        {
            "id": "analysis_4",
            "timestamp": iso_days_ago(5),
            "risk_score": 41,
            "quality_score": 72,
            "issues_count": 4,
            "filename": "buffer_sync.py",
            "language": "python",
            "trigger": "push",
            "top_issue": "Mutable default arguments can leak editor state.",
        },
        {
            "id": "analysis_5",
            "timestamp": iso_days_ago(1),
            "risk_score": 27,
            "quality_score": 84,
            "issues_count": 2,
            "filename": "buffer_sync.py",
            "language": "python",
            "trigger": "manual",
            "top_issue": "Telemetry pipeline looks healthy after refactor.",
        },
    ]

    project_template = {
        "id": "project_bugpredictor_core",
        "owner_id": demo_user["id"],
        "name": "BugPredictor Core",
        "description": "Core risk scoring engine for Python services and pull requests.",
        "repo": "bugpredictor/core-engine",
        "language": "python",
        "status": "Healthy",
        "branch": "main",
        "team": [
            {"id": "tm_1", "name": "Ava Lin", "role": "Lead Engineer"},
            {"id": "tm_2", "name": "Noah Kim", "role": "ML Engineer"},
            {"id": "tm_3", "name": "Rhea Patel", "role": "Platform Engineer"},
        ],
        "github": {
            "connected": True,
            "owner": "bugpredictor",
            "repo": "core-engine",
            "installation_hint": "Use a GitHub App or PAT in production.",
            "triggers": {"push": True, "pull_request": True},
            "last_event": {
                "type": "pull_request",
                "timestamp": iso_days_ago(1, 14),
                "description": "PR #184 triggered an automated scan for risky retry logic.",
            },
        },
        "comments": [
            {
                "id": "comment_1",
                "author": "Rhea Patel",
                "text": "The retry branch still needs a timeout guard before merge.",
                "line": 14,
                "created_at": iso_days_ago(1, 16),
            },
            {
                "id": "comment_2",
                "author": "Noah Kim",
                "text": "Risk score dropped after replacing the string-built SQL query.",
                "line": 8,
                "created_at": iso_days_ago(0, 10),
            },
        ],
        "assignments": [
            {
                "id": "assign_1",
                "title": "Replace broad exception with payment-specific errors",
                "assignee": "Rhea Patel",
                "severity": "high",
                "status": "In Progress",
            }
        ],
        "analyses": history_api_guard,
    }

    realtime_project = {
        "id": "project_editor_plugin",
        "owner_id": demo_user["id"],
        "name": "IDE Realtime Plugin",
        "description": "Low-latency editor diagnostics for risky code paths.",
        "repo": "bugpredictor/ide-plugin",
        "language": "python",
        "status": "Watch",
        "branch": "develop",
        "team": deepcopy(project_template["team"]),
        "github": {
            "connected": True,
            "owner": "bugpredictor",
            "repo": "ide-plugin",
            "installation_hint": "Wire webhook signing for production usage.",
            "triggers": {"push": True, "pull_request": False},
            "last_event": {
                "type": "push",
                "timestamp": iso_days_ago(0, 12),
                "description": "Push scan completed on feature/realtime-buffering.",
            },
        },
        "comments": [
            {
                "id": "comment_3",
                "author": "Ava Lin",
                "text": "Need a smaller debounce window for the inline analyzer.",
                "line": 4,
                "created_at": iso_days_ago(2, 11),
            }
        ],
        "assignments": [
            {
                "id": "assign_2",
                "title": "Reduce mutable editor state spread",
                "assignee": "Noah Kim",
                "severity": "medium",
                "status": "Todo",
            }
        ],
        "analyses": history_ide,
    }

    return {
        "users": [demo_user],
        "sessions": {},
        "projects": [project_template, realtime_project],
        "audit_log": [
            {
                "id": "audit_1",
                "timestamp": iso_days_ago(0, 13),
                "actor": "GitHub",
                "action": "Automated PR analysis completed for bugpredictor/core-engine",
            }
        ],
    }
