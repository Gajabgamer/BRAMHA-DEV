# BugPredictor

BugPredictor is a full-stack developer tool that predicts bug probability, explains code using AST data, flags risky lines, suggests fixes, and surfaces project-level quality trends.

## What is included

- React + Vite frontend with a Monaco-powered editor
- Interactive AST explorer rendered with D3
- FastAPI backend for static analysis and AST JSON output
- Heuristic bug prediction for Python with preview support for JavaScript, Java, and C++
- Line-by-line risk highlighting, fix suggestions, test generation, and contextual assistant answers
- Local auth, project dashboard, GitHub workflow simulation, team comments, and printable PDF-friendly reporting

## Core flows

1. Sign in with the demo account: `demo@bugpredictor.dev` / `demo1234`
2. Pick a starter template or paste your own code
3. Inspect the live risk score, AST tree, risky lines, and fix suggestions
4. Save a scan to update project history and analytics
5. Connect a GitHub repo and simulate `push` or `pull_request` analysis events
6. Ask the assistant why something is risky or which tests to add

## Tech stack

- Frontend: React 19, Vite, Monaco Editor, D3
- Backend: FastAPI, Python AST
- Storage: local JSON store in [`backend/data/bugpredictor_store.json`](/C:/Users/ashwa/OneDrive/Desktop/MOVIE%2024/backend/data/bugpredictor_store.json)

## Run locally

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
py -m pip install -r backend/requirements.txt
py -m pip install httpx
npm run dev:api
```

Open the frontend at `http://127.0.0.1:5173`.

## Important files

- Frontend app: [`client/src/App.jsx`](/C:/Users/ashwa/OneDrive/Desktop/MOVIE%2024/client/src/App.jsx)
- AST renderer: [`client/src/components/AstTree.jsx`](/C:/Users/ashwa/OneDrive/Desktop/MOVIE%2024/client/src/components/AstTree.jsx)
- Frontend API client: [`client/src/lib/api.js`](/C:/Users/ashwa/OneDrive/Desktop/MOVIE%2024/client/src/lib/api.js)
- FastAPI entrypoint: [`backend/main.py`](/C:/Users/ashwa/OneDrive/Desktop/MOVIE%2024/backend/main.py)
- Analysis engine: [`backend/bugpredictor_api/analysis.py`](/C:/Users/ashwa/OneDrive/Desktop/MOVIE%2024/backend/bugpredictor_api/analysis.py)
- Local persistence: [`backend/bugpredictor_api/storage.py`](/C:/Users/ashwa/OneDrive/Desktop/MOVIE%2024/backend/bugpredictor_api/storage.py)
- Sample dataset: [`sample-data/bugpredictor_samples.json`](/C:/Users/ashwa/OneDrive/Desktop/MOVIE%2024/sample-data/bugpredictor_samples.json)

## API snapshot

- `POST /auth/signup`
- `POST /auth/login`
- `GET /projects`
- `GET /dashboard`
- `POST /analyze`
- `POST /github/connect`
- `POST /github/simulate`
- `POST /assistant/chat`
- `POST /projects/{project_id}/comments`
- `POST /projects/{project_id}/assignments`

## Verification completed

- `npm run build`
- Parsed backend source with Python AST
- Imported the FastAPI app successfully
- Exercised `/health`, `/auth/login`, `/projects`, and `/analyze` through FastAPI `TestClient`

## Notes

- Python gets full AST analysis today.
- JavaScript, Java, and C++ currently run in preview mode with lightweight heuristics.
- The GitHub integration is production-shaped in the UI and API, but uses local demo storage instead of live OAuth/webhooks.
