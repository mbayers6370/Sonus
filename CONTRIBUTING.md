# Contributing

## Scope
This repository is an npm-workspaces monorepo:

- `sonus-react/` frontend
- `backend/` API
- `shared/` shared contracts

## Prerequisites
- Node.js `20+`
- npm `10+`
- PostgreSQL (local or Docker) for backend integration checks

## Setup
```bash
npm install
cp backend/.env.example backend/.env
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:push
```

## Local Development
```bash
npm run dev
```

## Quality Gates (Required Before PR)
```bash
npm run lint
npm run build
npm test
```

Optional:
```bash
npm run quality:report:prod-safe
npm run codehealth
```

## Pull Request Guidelines
- Keep PRs focused and small where possible.
- Include test evidence in the PR description.
- Update docs when behavior, API, or operations change.
- Do not commit secrets or `.env` files.
- Avoid breaking mobile layouts and accessibility baselines.

## Commit Guidance
- Use clear, imperative commit messages.
- Group related file changes together.
- Avoid mixing refactors with unrelated feature work.

## Security
If you find a security issue, do not open a public issue first.  
Use the process in [SECURITY.md](SECURITY.md).
