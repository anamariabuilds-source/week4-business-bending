# Screening Substitution Tracker

A mobile-friendly, simulated-data-only Next.js prototype for documenting whether an existing
screening step was kept, shortened, or removed. The product boundaries and planned behavior are
defined in `docs/PACKET.md`.

## Local development

Requirements: a current Node.js LTS release and npm.

```bash
npm install
npm run dev
```

Feature 1 renders only the four-step navigation shell. It intentionally contains no workflow
logic, persistence, forms, fixtures, or Gemini routes.

## Environment variables

Copy `.env.example` to `.env.local` only when a later feature introduces the server-side Gemini
routes. `GEMINI_API_KEY` must remain a server-side environment variable in local development and
Vercel. Never prefix it with `NEXT_PUBLIC_`, expose it to client components, commit its value, or
include its value in documentation or logs.

Only simulated content may be submitted. Google Free Tier may use submitted content to improve
its products, so this prototype is not an appropriate architecture for real student projects,
personal data, or confidential employer information.
