# capstone_web — CeduSync staff app (desktop web)
Workspace rules, purpose and the plan loop are in `../CLAUDE.md`. Shared memory: `../capstone_docs/`.
**Read `../capstone_docs/UI_RULES.md` before any change here.**

## Stack
React 19 (Create React App / react-scripts 5), React Router 6, Tailwind 3 + design tokens in
`src/styles/tokens.css`, axios (`src/api/client.js`), lucide-react icons, react-toastify, html5-qrcode.

## Commands (from this folder)
- Run: `npm start` → http://localhost:3000 (needs the backend on port 8000)
- Lint: `npx eslint src --ext .js,.jsx` (react-app config from package.json; without `--ext`, ESLint 8 skips `.jsx`)
- Build check: `npm run build`

## Map
- `src/App.jsx` routes: /login, /sus (public), /dashboard (admin), /new-application, /qr-scan, /records,
  /staff (admin), /settings (admin)
- `src/pages/` — `NewApplication.jsx` is the voice interview page (3,000+ lines: change it in small, tested steps)
- `src/components/ui/` reusable Button, Card, Input, Badge, EmptyState, Skeleton
- `src/components/common/` Layout, Sidebar, Header, LoadingSpinner · `src/api/` one file per backend area

## Rules for this repo
- Reuse `src/components/ui/*`; tokens only (`var(--color-...)`), no new `gray-*`/`slate-*` classes.
- Any page or component change → `/verify-ui` at 1366×768, 1024×768 and 390×844 before `/result`.
- API calls go through `src/api/*` using the shared axios client; never hard-code the backend URL.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
