from __future__ import annotations

import ast
import re
from collections import defaultdict
from typing import Any


CONTROL_NODES = (ast.If, ast.For, ast.AsyncFor, ast.While, ast.Try, ast.With, ast.Match)
SEVERITY_WEIGHT = {"low": 7, "medium": 14, "high": 24}
RISK_VALUE = {"none": 0, "low": 0.25, "medium": 0.55, "high": 0.9}
SECURITY_NAMES = ("password", "secret", "token", "api_key", "apikey", "private_key")
BUILTIN_NAMES = set(dir(__builtins__))


def normalize_language(language: str | None) -> str:
    normalized = (language or "python").strip().lower()
    aliases = {"py": "python", "js": "javascript", "c#": "csharp", "cpp": "cpp"}
    return aliases.get(normalized, normalized)


def analyze_code(code: str, language: str, filename: str) -> dict[str, Any]:
    normalized = normalize_language(language)
    if normalized == "python":
        return analyze_python(code, filename)
    return analyze_preview_language(code, normalized, filename)


def analyze_preview_language(code: str, language: str, filename: str) -> dict[str, Any]:
    lines = code.splitlines() or [""]
    issues: list[dict[str, Any]] = []
    lowered = code.lower()

    if not code.strip():
        issues.append(
            make_issue(
                title="No source code provided",
                severity="low",
                category="validation",
                line=1,
                detail="Add code to start a language preview scan.",
                suggestion="Paste a source file or connect a repository to analyze it.",
                before="",
                after="// add code here",
            )
        )
    if "eval(" in lowered:
        issues.append(
            make_issue(
                title="Dynamic evaluation increases runtime risk",
                severity="high",
                category="security",
                line=find_line(lines, "eval("),
                detail="`eval`-style execution can hide logic bugs and injection issues.",
                suggestion="Replace dynamic evaluation with explicit parsing or lookup tables.",
                before=get_line(lines, find_line(lines, "eval(")),
                after="const value = allowedExpressions[input];",
            )
        )
    if re.search(r"(password|secret|token)\s*[:=]\s*['\"]", code, re.IGNORECASE):
        issues.append(
            make_issue(
                title="Hardcoded credential-like value detected",
                severity="high",
                category="security",
                line=find_line_regex(lines, r"(password|secret|token)\s*[:=]\s*['\"]"),
                detail="Secrets should not live directly in source control.",
                suggestion="Read secrets from environment variables or a dedicated secret manager.",
                before=get_line(lines, find_line_regex(lines, r"(password|secret|token)\s*[:=]\s*['\"]")),
                after="const apiToken = process.env.API_TOKEN;",
            )
        )
    if re.search(r"\bvar\b", code):
        issues.append(
            make_issue(
                title="Legacy variable declaration found",
                severity="medium",
                category="maintainability",
                line=find_line_regex(lines, r"\bvar\b"),
                detail="Using `var` makes scope harder to reason about in bug-prone code paths.",
                suggestion="Prefer block-scoped declarations such as `const` or `let`.",
                before=get_line(lines, find_line_regex(lines, r"\bvar\b")),
                after="const result = computeResult();",
            )
        )

    risk_score = min(92, 10 + sum(SEVERITY_WEIGHT[item["severity"]] for item in issues))
    quality_score = max(8, 100 - risk_score)
    highlighted = build_highlights_from_issues(issues)

    preview_tree = {
        "id": "root",
        "parent_id": None,
        "type": f"{language.title()}Preview",
        "label": f"{language.title()} preview AST",
        "explanation": f"BugPredictor currently performs full AST analysis for Python and lightweight preview analysis for {language.title()}.",
        "risk": highest_risk_from_issues(issues),
        "lineno": 1,
        "end_lineno": len(lines),
        "children": [
            {
                "id": f"line_{index}",
                "parent_id": "root",
                "type": "Line",
                "label": f"Line {index + 1}",
                "explanation": line.strip() or "Blank line",
                "risk": risk_for_line(index + 1, highlighted),
                "lineno": index + 1,
                "end_lineno": index + 1,
                "children": [],
            }
            for index, line in enumerate(lines[:40])
        ],
    }

    return {
        "language": language,
        "filename": filename or f"snippet.{language}",
        "risk_score": risk_score,
        "quality_score": quality_score,
        "issues": issues,
        "suggestions": [
            {
                "title": issue["title"],
                "priority": issue["severity"],
                "summary": issue["suggestion"],
                "before": issue["before"],
                "after": issue["after"],
            }
            for issue in issues
        ],
        "ast_tree": preview_tree,
        "node_index": flatten_tree(preview_tree),
        "highlighted_lines": highlighted,
        "metrics": {
            "language_mode": "preview",
            "line_count": len(lines),
            "functions": 0,
            "classes": 0,
            "max_nesting": 0,
            "complexity_hotspots": [],
        },
        "test_cases": [
            {
                "title": f"Smoke test for {language.title()} snippet",
                "rationale": "Start with a simple behavior check before adding edge cases.",
                "skeleton": "// TODO: Add assertions for the expected output path.",
            }
        ],
        "report": build_report_payload(
            filename or f"snippet.{language}",
            language,
            risk_score,
            quality_score,
            issues,
            highlighted,
        ),
        "warnings": [
            f"Full AST explanations are currently implemented for Python. {language.title()} is running in preview mode."
        ],
    }


def analyze_python(code: str, filename: str) -> dict[str, Any]:
    lines = code.splitlines() or [""]
    if not code.strip():
        empty_issue = make_issue(
            title="No source code provided",
            severity="low",
            category="validation",
            line=1,
            detail="Add Python code to begin AST and risk analysis.",
            suggestion="Paste a function, module, or repository file into the editor.",
            before="",
            after="def main():\n    return 'hello world'",
        )
        root = {
            "id": "root",
            "parent_id": None,
            "type": "Module",
            "label": "Empty module",
            "explanation": "The module is empty, so there is nothing to score yet.",
            "risk": "low",
            "lineno": 1,
            "end_lineno": 1,
            "children": [],
        }
        return {
            "language": "python",
            "filename": filename or "snippet.py",
            "risk_score": 0,
            "quality_score": 100,
            "issues": [empty_issue],
            "suggestions": [
                {
                    "title": empty_issue["title"],
                    "priority": empty_issue["severity"],
                    "summary": empty_issue["suggestion"],
                    "before": empty_issue["before"],
                    "after": empty_issue["after"],
                }
            ],
            "ast_tree": root,
            "node_index": flatten_tree(root),
            "highlighted_lines": build_highlights_from_issues([empty_issue]),
            "metrics": {
                "language_mode": "full_ast",
                "line_count": 0,
                "functions": 0,
                "classes": 0,
                "max_nesting": 0,
                "complexity_hotspots": [],
            },
            "test_cases": [],
            "report": build_report_payload(filename or "snippet.py", "python", 0, 100, [empty_issue], []),
            "warnings": [],
        }

    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        line = exc.lineno or 1
        before = get_line(lines, line)
        issue = make_issue(
            title="Syntax error blocks deeper analysis",
            severity="high",
            category="syntax",
            line=line,
            detail=exc.msg,
            suggestion="Fix the parser error before relying on risk predictions for this file.",
            before=before,
            after=before.rstrip() + "  # fix syntax here",
        )
        root = {
            "id": "root",
            "parent_id": None,
            "type": "Module",
            "label": "Syntax error",
            "explanation": "BugPredictor could not build a Python AST because the file has invalid syntax.",
            "risk": "high",
            "lineno": 1,
            "end_lineno": len(lines),
            "children": [],
        }
        highlights = build_highlights_from_issues([issue])
        return {
            "language": "python",
            "filename": filename or "snippet.py",
            "risk_score": 88,
            "quality_score": 12,
            "issues": [issue],
            "suggestions": [
                {
                    "title": issue["title"],
                    "priority": issue["severity"],
                    "summary": issue["suggestion"],
                    "before": issue["before"],
                    "after": issue["after"],
                }
            ],
            "ast_tree": root,
            "node_index": flatten_tree(root),
            "highlighted_lines": highlights,
            "metrics": {
                "language_mode": "syntax_error",
                "line_count": len(lines),
                "functions": 0,
                "classes": 0,
                "max_nesting": 0,
                "complexity_hotspots": [],
            },
            "test_cases": [],
            "report": build_report_payload(filename or "snippet.py", "python", 88, 12, [issue], highlights),
            "warnings": ["Analysis is partial because the AST could not be constructed."],
        }

    complexity_map = calculate_complexity(tree)
    issues = collect_python_issues(tree, lines, complexity_map)
    highlights = build_highlights_from_issues(issues)
    ast_tree, node_index = build_ast_output(tree, complexity_map, highlights, issues)
    max_nesting = measure_max_nesting(tree)
    functions = [node for node in ast.walk(tree) if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))]
    classes = [node for node in ast.walk(tree) if isinstance(node, ast.ClassDef)]

    base_risk = 8
    base_risk += max(0, max_nesting - 2) * 6
    base_risk += sum(SEVERITY_WEIGHT[issue["severity"]] for issue in issues)
    base_risk += sum(max(0, complexity_map.get(id(node), 1) - 6) * 3 for node in functions)
    risk_score = min(99, base_risk)
    quality_score = max(4, 100 - risk_score)
    hotspots = [
        {
            "name": node.name,
            "complexity": complexity_map.get(id(node), 1),
            "line": getattr(node, "lineno", 1),
        }
        for node in functions
        if complexity_map.get(id(node), 1) >= 6
    ]
    hotspots.sort(key=lambda item: item["complexity"], reverse=True)

    return {
        "language": "python",
        "filename": filename or "snippet.py",
        "risk_score": risk_score,
        "quality_score": quality_score,
        "issues": issues,
        "suggestions": [
            {
                "title": issue["title"],
                "priority": issue["severity"],
                "summary": issue["suggestion"],
                "before": issue["before"],
                "after": issue["after"],
            }
            for issue in issues
        ],
        "ast_tree": ast_tree,
        "node_index": node_index,
        "highlighted_lines": highlights,
        "metrics": {
            "language_mode": "full_ast",
            "line_count": len(lines),
            "functions": len(functions),
            "classes": len(classes),
            "max_nesting": max_nesting,
            "complexity_hotspots": hotspots[:6],
        },
        "test_cases": generate_test_cases(functions, lines),
        "report": build_report_payload(filename or "snippet.py", "python", risk_score, quality_score, issues, highlights),
        "warnings": [],
    }


def collect_python_issues(tree: ast.AST, lines: list[str], complexity_map: dict[int, int]) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            complexity = complexity_map.get(id(node), 1)
            if complexity >= 8:
                issues.append(
                    make_issue(
                        title=f"Function `{node.name}` has elevated complexity",
                        severity="high" if complexity >= 10 else "medium",
                        category="complexity",
                        line=node.lineno,
                        detail=f"This function's decision count is {complexity}, which raises bug probability and review cost.",
                        suggestion="Split branching logic into focused helpers and add tests around each branch.",
                        before=get_multiline_excerpt(lines, node.lineno, min(getattr(node, "end_lineno", node.lineno), node.lineno + 4)),
                        after=f"def {node.name}(...) -> ...:\n    validated_input = validate_input(...)\n    return handle_{node.name}_logic(validated_input)",
                    )
                )

            parameter_count = len(node.args.args) + len(node.args.kwonlyargs) + len(node.args.posonlyargs)
            if parameter_count > 5:
                issues.append(
                    make_issue(
                        title=f"`{node.name}` accepts too many parameters",
                        severity="medium",
                        category="maintainability",
                        line=node.lineno,
                        detail="Functions with many inputs are harder to call safely and easier to misuse.",
                        suggestion="Group related parameters into a typed object or smaller helper functions.",
                        before=get_line(lines, node.lineno),
                        after=f"def {node.name}(request: {node.name.title()}Request):",
                    )
                )

            for default in node.args.defaults:
                if isinstance(default, (ast.List, ast.Dict, ast.Set)):
                    issues.append(
                        make_issue(
                            title=f"`{node.name}` uses a mutable default argument",
                            severity="high",
                            category="bug_risk",
                            line=node.lineno,
                            detail="Mutable defaults persist between calls and can leak state unexpectedly.",
                            suggestion="Use `None` as the default and initialize the collection inside the function body.",
                            before=get_line(lines, node.lineno),
                            after=f"def {node.name}(..., items=None):\n    items = [] if items is None else items",
                        )
                    )

            function_length = getattr(node, "end_lineno", node.lineno) - node.lineno + 1
            if function_length > 35:
                issues.append(
                    make_issue(
                        title=f"`{node.name}` is long enough to hide defects",
                        severity="medium",
                        category="maintainability",
                        line=node.lineno,
                        detail=f"The function spans {function_length} lines, making it harder to review critical paths.",
                        suggestion="Extract smaller helpers around validation, transformation, and persistence responsibilities.",
                        before=get_multiline_excerpt(lines, node.lineno, min(node.lineno + 4, len(lines))),
                        after=f"def {node.name}(...):\n    normalized = normalize_input(...)\n    validated = validate_input(normalized)\n    return persist_result(validated)",
                    )
                )

        if isinstance(node, ast.ExceptHandler):
            if node.type is None:
                issues.append(
                    make_issue(
                        title="Bare `except` hides the true failure source",
                        severity="high",
                        category="reliability",
                        line=node.lineno,
                        detail="Catching everything can swallow programming errors and make bugs harder to trace.",
                        suggestion="Catch the narrowest expected exception type and log unexpected failures separately.",
                        before=get_line(lines, node.lineno),
                        after="except ValueError as exc:",
                    )
                )
            elif isinstance(node.type, ast.Name) and node.type.id == "Exception":
                issues.append(
                    make_issue(
                        title="Broad `Exception` handler masks specific failures",
                        severity="medium",
                        category="reliability",
                        line=node.lineno,
                        detail="Generic exception handling lowers observability and may hide broken assumptions.",
                        suggestion="Use domain-specific exception types and preserve error context.",
                        before=get_line(lines, node.lineno),
                        after="except PaymentValidationError as exc:",
                    )
                )

        if isinstance(node, ast.Call):
            name = dotted_name(node.func)
            if name in {"eval", "exec"}:
                issues.append(
                    make_issue(
                        title=f"Dynamic execution via `{name}` is risky",
                        severity="high",
                        category="security",
                        line=node.lineno,
                        detail="Dynamic execution can create injection paths and hide logic issues from static analysis.",
                        suggestion="Use explicit parsers, mappings, or whitelisted operations instead of runtime evaluation.",
                        before=get_line(lines, node.lineno),
                        after="safe_value = allowed_expressions[user_input]",
                    )
                )

            if name.endswith("execute") and node.args:
                first_arg = node.args[0]
                if isinstance(first_arg, (ast.BinOp, ast.JoinedStr)):
                    issues.append(
                        make_issue(
                            title="Potential SQL injection pattern detected",
                            severity="high",
                            category="security",
                            line=node.lineno,
                            detail="This query appears to embed dynamic values directly into the SQL string.",
                            suggestion="Use parameterized queries instead of string interpolation when calling `execute`.",
                            before=get_line(lines, node.lineno),
                            after='cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))',
                        )
                    )

            if name.startswith("subprocess.") and any(keyword.arg == "shell" and is_truthy(keyword.value) for keyword in node.keywords):
                issues.append(
                    make_issue(
                        title="`subprocess` uses `shell=True`",
                        severity="high",
                        category="security",
                        line=node.lineno,
                        detail="Shell invocation expands the attack surface and makes command construction fragile.",
                        suggestion="Pass command arguments as a list and keep `shell=False`.",
                        before=get_line(lines, node.lineno),
                        after='subprocess.run(["python", "worker.py"], check=True)',
                    )
                )

        if isinstance(node, ast.Assign):
            names = [target.id for target in node.targets if isinstance(target, ast.Name)]
            if names and isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
                for name in names:
                    if any(keyword in name.lower() for keyword in SECURITY_NAMES):
                        issues.append(
                            make_issue(
                                title="Hardcoded secret-like value found",
                                severity="high",
                                category="security",
                                line=node.lineno,
                                detail=f"`{name}` looks like a secret and is assigned directly in source code.",
                                suggestion="Load secret material from environment variables or a secure secret store.",
                                before=get_line(lines, node.lineno),
                                after=f"{name} = os.environ['{name.upper()}']",
                            )
                        )

        if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store) and node.id in BUILTIN_NAMES:
            issues.append(
                make_issue(
                    title=f"Variable `{node.id}` shadows a Python builtin",
                    severity="medium",
                    category="maintainability",
                    line=node.lineno,
                    detail="Shadowing builtins makes code harder to read and can create confusing runtime behavior.",
                    suggestion="Rename the variable to something more specific to its domain role.",
                    before=get_line(lines, node.lineno),
                    after=get_line(lines, node.lineno).replace(node.id, f"{node.id}_value", 1),
                )
            )

        if isinstance(node, ast.Pass):
            issues.append(
                make_issue(
                    title="`pass` leaves behavior intentionally empty",
                    severity="low",
                    category="logic",
                    line=node.lineno,
                    detail="Empty branches often hide unfinished logic or missed error handling.",
                    suggestion="Document why the branch is intentionally empty or implement the missing behavior.",
                    before=get_line(lines, node.lineno),
                    after="raise NotImplementedError('Explain why this branch is empty')",
                )
            )

        if isinstance(node, (ast.Global, ast.Nonlocal)):
            issues.append(
                make_issue(
                    title="Shared mutable scope increases bug risk",
                    severity="medium",
                    category="state",
                    line=node.lineno,
                    detail="Modifying outer scope from deep inside a function makes state transitions harder to predict.",
                    suggestion="Return computed values explicitly instead of mutating shared state.",
                    before=get_line(lines, node.lineno),
                    after="# return the updated value instead of mutating outer state",
                )
            )

    max_nesting = measure_max_nesting(tree)
    if max_nesting >= 4:
        deep_line = find_deepest_control_line(tree)
        issues.append(
            make_issue(
                title="Nesting depth is high",
                severity="high" if max_nesting >= 5 else "medium",
                category="complexity",
                line=deep_line,
                detail=f"The maximum nesting depth is {max_nesting}, which makes control flow hard to reason about.",
                suggestion="Introduce guard clauses or extract helper functions to flatten the main execution path.",
                before=get_line(lines, deep_line),
                after="if not is_valid(request):\n    return error_response('invalid request')",
            )
        )

    issues.sort(key=lambda issue: (-SEVERITY_WEIGHT[issue["severity"]], issue["line"]))
    return dedupe_issues(issues)


def build_ast_output(
    tree: ast.AST,
    complexity_map: dict[int, int],
    highlights: list[dict[str, Any]],
    issues: list[dict[str, Any]],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    line_risk = {item["line"]: item["severity"] for item in highlights}
    issue_lookup = defaultdict(list)
    for issue in issues:
        issue_lookup[issue["line"]].append(issue["title"])

    counter = {"value": 0}
    flat: list[dict[str, Any]] = []

    def build(node: ast.AST, parent_id: str | None, depth: int) -> dict[str, Any]:
        counter["value"] += 1
        node_id = f"node_{counter['value']}"
        start_line = getattr(node, "lineno", 1)
        end_line = getattr(node, "end_lineno", start_line)
        risk = max_risk_for_range(start_line, end_line, line_risk)
        entry = {
            "id": node_id,
            "parent_id": parent_id,
            "type": type(node).__name__,
            "label": describe_node(node),
            "explanation": explain_node(node, complexity_map),
            "risk": risk,
            "lineno": start_line,
            "end_lineno": end_line,
            "col_offset": getattr(node, "col_offset", 0),
            "end_col_offset": getattr(node, "end_col_offset", 0),
            "depth": depth,
            "issue_titles": sorted({title for line in range(start_line, end_line + 1) for title in issue_lookup.get(line, [])}),
            "children": [],
        }
        for child in ast.iter_child_nodes(node):
            entry["children"].append(build(child, node_id, depth + 1))
        flat.append({key: value for key, value in entry.items() if key != "children"})
        return entry

    root = build(tree, None, 0)
    return root, sorted(flat, key=lambda item: (item["lineno"], item["depth"]))


def calculate_complexity(tree: ast.AST) -> dict[int, int]:
    complexity: dict[int, int] = {}
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            score = 1
            for child in ast.walk(node):
                if isinstance(child, (ast.If, ast.For, ast.AsyncFor, ast.While, ast.Try, ast.ExceptHandler, ast.With, ast.Match)):
                    score += 1
                if isinstance(child, ast.BoolOp):
                    score += max(1, len(child.values) - 1)
                if isinstance(child, ast.comprehension):
                    score += 1
            complexity[id(node)] = score
    return complexity


def measure_max_nesting(node: ast.AST, depth: int = 0) -> int:
    next_depth = depth + 1 if isinstance(node, CONTROL_NODES) else depth
    child_depths = [measure_max_nesting(child, next_depth) for child in ast.iter_child_nodes(node)]
    return max([next_depth, *child_depths], default=next_depth)


def find_deepest_control_line(node: ast.AST, depth: int = 0) -> int:
    best_line = getattr(node, "lineno", 1)
    best_depth = depth
    next_depth = depth + 1 if isinstance(node, CONTROL_NODES) else depth
    for child in ast.iter_child_nodes(node):
        child_line = find_deepest_control_line(child, next_depth)
        child_depth = measure_max_nesting(child, next_depth)
        if child_depth > best_depth:
            best_depth = child_depth
            best_line = child_line
    return best_line


def generate_test_cases(functions: list[ast.AST], lines: list[str]) -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    for node in functions[:4]:
        params = [arg.arg for arg in node.args.args[:4]]
        args_preview = ", ".join(f"{name}=..." for name in params) if params else ""
        cases.append(
            {
                "title": f"Happy path for `{node.name}`",
                "rationale": "Start with the dominant success path to preserve expected behavior while refactoring.",
                "skeleton": f"def test_{node.name}_happy_path():\n    result = {node.name}({args_preview})\n    assert result is not None",
            }
        )
        cases.append(
            {
                "title": f"Edge case for `{node.name}`",
                "rationale": "Guard against empty or missing input because that is a common bug trigger.",
                "skeleton": f"def test_{node.name}_handles_empty_input():\n    # TODO: replace with the safest empty values for {node.name}\n    result = {node.name}({args_preview})\n    assert result is not None",
            }
        )
        if "except" in get_multiline_excerpt(lines, node.lineno, getattr(node, "end_lineno", node.lineno)).lower():
            cases.append(
                {
                    "title": f"Failure path for `{node.name}`",
                    "rationale": "The function already handles exceptions, so it needs an explicit error-path test.",
                    "skeleton": f"def test_{node.name}_raises_or_reports_errors():\n    # TODO: provide invalid input that triggers the exception path\n    assert {node.name}({args_preview}) is not None",
                }
            )
    return cases[:8]


def answer_assistant(question: str, analysis: dict[str, Any], selected_node_id: str | None = None) -> dict[str, Any]:
    lowered = (question or "").strip().lower()
    issues = analysis.get("issues", [])
    node = next((item for item in analysis.get("node_index", []) if item["id"] == selected_node_id), None)
    top_issue = issues[0] if issues else None

    if not lowered:
        answer = "Ask about risk, fixes, security, tests, or a selected AST node and I will explain the analysis context."
    elif "why" in lowered and ("risk" in lowered or "risky" in lowered):
        if node:
            answer = (
                f"`{node['label']}` is marked `{node['risk']}` risk because it spans lines {node['lineno']} to {node['end_lineno']} "
                f"and overlaps with these findings: {', '.join(node['issue_titles']) or 'no direct issue titles, but it sits on a risky path'}."
            )
        elif top_issue:
            answer = f"The file risk is driven mainly by `{top_issue['title']}` plus {max(len(issues) - 1, 0)} additional finding(s)."
        else:
            answer = "The current file looks relatively safe because no major static-analysis red flags were detected."
    elif "fix" in lowered or "improve" in lowered:
        suggestions = analysis.get("suggestions", [])[:3]
        if suggestions:
            answer = "Start with these fixes:\n" + "\n".join(
                f"- {item['title']}: {item['summary']}" for item in suggestions
            )
        else:
            answer = "There are no urgent fixes yet. Consider adding stronger tests to keep the code safe as it evolves."
    elif "test" in lowered:
        tests = analysis.get("test_cases", [])[:3]
        if tests:
            answer = "These test cases would lower risk fastest:\n" + "\n".join(
                f"- {item['title']}: {item['rationale']}" for item in tests
            )
        else:
            answer = "Generate a scan first so I can tailor tests to the current functions and branches."
    elif "security" in lowered:
        security_issues = [item for item in issues if item["category"] == "security"]
        if security_issues:
            answer = "Security hotspots detected:\n" + "\n".join(
                f"- {item['title']} on line {item['line']}" for item in security_issues[:4]
            )
        else:
            answer = "No explicit security signatures were detected in this scan, but deeper dependency and data-flow analysis would still help."
    else:
        answer = (
            f"The current risk score is {analysis.get('risk_score', 0)}% with {len(issues)} issue(s). "
            "Ask why a node is risky, how to fix a finding, or which tests to add next."
        )

    return {
        "answer": answer,
        "references": [
            {
                "title": item["title"],
                "line": item["line"],
                "severity": item["severity"],
            }
            for item in issues[:4]
        ],
    }


def build_report_payload(
    filename: str,
    language: str,
    risk_score: int,
    quality_score: int,
    issues: list[dict[str, Any]],
    highlighted: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "headline": f"BugPredictor report for {filename}",
        "summary": {
            "language": language,
            "risk_score": risk_score,
            "quality_score": quality_score,
            "issues": len(issues),
            "highlighted_lines": len(highlighted),
        },
        "key_findings": [issue["title"] for issue in issues[:5]],
        "next_actions": [issue["suggestion"] for issue in issues[:5]],
    }


def make_issue(
    *,
    title: str,
    severity: str,
    category: str,
    line: int,
    detail: str,
    suggestion: str,
    before: str,
    after: str,
) -> dict[str, Any]:
    return {
        "id": re.sub(r"[^a-z0-9]+", "_", title.lower()).strip("_"),
        "title": title,
        "severity": severity,
        "category": category,
        "line": max(1, line),
        "detail": detail,
        "suggestion": suggestion,
        "before": before.strip("\n"),
        "after": after.strip("\n"),
    }


def build_highlights_from_issues(issues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    per_line: dict[int, dict[str, Any]] = {}
    for issue in issues:
        existing = per_line.get(issue["line"])
        if existing is None or SEVERITY_WEIGHT[issue["severity"]] > SEVERITY_WEIGHT[existing["severity"]]:
            per_line[issue["line"]] = {
                "line": issue["line"],
                "severity": issue["severity"],
                "title": issue["title"],
                "detail": issue["detail"],
            }
    return sorted(per_line.values(), key=lambda item: item["line"])


def flatten_tree(tree: dict[str, Any]) -> list[dict[str, Any]]:
    flat: list[dict[str, Any]] = []

    def walk(node: dict[str, Any]) -> None:
        flat.append({key: value for key, value in node.items() if key != "children"})
        for child in node.get("children", []):
            walk(child)

    walk(tree)
    return flat


def dedupe_issues(issues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, int]] = set()
    unique: list[dict[str, Any]] = []
    for issue in issues:
        key = (issue["title"], issue["line"])
        if key not in seen:
            unique.append(issue)
            seen.add(key)
    return unique


def describe_node(node: ast.AST) -> str:
    if isinstance(node, ast.Module):
        return "Module"
    if isinstance(node, ast.FunctionDef):
        return f"Function `{node.name}`"
    if isinstance(node, ast.AsyncFunctionDef):
        return f"Async function `{node.name}`"
    if isinstance(node, ast.ClassDef):
        return f"Class `{node.name}`"
    if isinstance(node, ast.Call):
        return f"Call `{dotted_name(node.func) or 'anonymous'}`"
    if isinstance(node, ast.Assign):
        targets = ", ".join(target.id for target in node.targets if isinstance(target, ast.Name))
        return f"Assignment to {targets or 'target'}"
    if isinstance(node, ast.Return):
        return "Return statement"
    if isinstance(node, ast.If):
        return "Conditional branch"
    if isinstance(node, ast.For):
        return "For loop"
    if isinstance(node, ast.While):
        return "While loop"
    if isinstance(node, ast.Try):
        return "Try block"
    if isinstance(node, ast.ExceptHandler):
        return "Exception handler"
    return type(node).__name__


def explain_node(node: ast.AST, complexity_map: dict[int, int]) -> str:
    if isinstance(node, ast.Module):
        return "The module is the root container for the file. Every class, function, and statement lives under this node."
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        complexity = complexity_map.get(id(node), 1)
        return f"This function defines reusable behavior. Its estimated branch complexity is {complexity}, which is a useful signal for bug probability."
    if isinstance(node, ast.ClassDef):
        return "This class groups behavior and state. Bug risk tends to rise when classes coordinate too many responsibilities."
    if isinstance(node, ast.Assign):
        return "This assignment writes data into a variable. Risk increases when assignments hide secrets or mutate shared state."
    if isinstance(node, ast.Call):
        return "This node represents a function or method call. Calls are worth checking because they are where side effects and unsafe APIs often appear."
    if isinstance(node, ast.If):
        return "This branch changes control flow based on a condition. Branch-heavy regions are common sources of overlooked edge cases."
    if isinstance(node, (ast.For, ast.AsyncFor, ast.While)):
        return "This loop repeats behavior. Nested or stateful loops can increase the chance of logic bugs."
    if isinstance(node, ast.Try):
        return "This block handles failure paths. Risk depends on how specific the exception handling is."
    if isinstance(node, ast.ExceptHandler):
        return "This node catches errors. Broad handlers can mask the real cause of failures."
    if isinstance(node, ast.Return):
        return "This statement exits the current function and sends a value back to the caller."
    return "This AST node captures a structural part of the code so BugPredictor can reason about behavior without executing it."


def dotted_name(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        prefix = dotted_name(node.value)
        return f"{prefix}.{node.attr}" if prefix else node.attr
    return ""


def get_line(lines: list[str], line_number: int) -> str:
    if 1 <= line_number <= len(lines):
        return lines[line_number - 1]
    return ""


def get_multiline_excerpt(lines: list[str], start: int, end: int) -> str:
    start_index = max(1, start)
    end_index = max(start_index, min(end, len(lines)))
    return "\n".join(lines[start_index - 1 : end_index])


def highest_risk_from_issues(issues: list[dict[str, Any]]) -> str:
    if any(item["severity"] == "high" for item in issues):
        return "high"
    if any(item["severity"] == "medium" for item in issues):
        return "medium"
    if any(item["severity"] == "low" for item in issues):
        return "low"
    return "none"


def max_risk_for_range(start: int, end: int, line_risk: dict[int, str]) -> str:
    score = 0.0
    selected = "none"
    for line in range(start, end + 1):
        risk = line_risk.get(line, "none")
        if RISK_VALUE[risk] > score:
            score = RISK_VALUE[risk]
            selected = risk
    return selected


def risk_for_line(line: int, highlights: list[dict[str, Any]]) -> str:
    item = next((entry for entry in highlights if entry["line"] == line), None)
    return item["severity"] if item else "none"


def is_truthy(node: ast.AST) -> bool:
    return isinstance(node, ast.Constant) and bool(node.value) is True


def find_line(lines: list[str], fragment: str) -> int:
    for index, line in enumerate(lines, start=1):
        if fragment in line:
            return index
    return 1


def find_line_regex(lines: list[str], pattern: str) -> int:
    regex = re.compile(pattern, re.IGNORECASE)
    for index, line in enumerate(lines, start=1):
        if regex.search(line):
            return index
    return 1
