# Implementation Decisions

This is an append-only implementation log. Planned Packet tests remain marked
`Not run — planned before code` until the separately documented Mechanical Pass begins.

## 2026-09-03 — Session 1: Feature 1 foundation

- **Decision or implementation detail:** Minimally scaffold the Next.js App Router foundation and
  render a semantic, responsive shell containing only the four required workflow steps.
- **Reason and Packet boundary protected:** Establishes the required application shape while
  deferring records, workflow behavior, persistence, forms, fixtures, and Gemini integration to
  their explicitly sequenced features.
- **Files or behavior changed:** Added the App Router scaffold, semantic four-step navigation shell,
  persistent simulated-data banner, responsive base styles, environment template and protections,
  local setup/security documentation, and this decision log. `docs/PACKET.md` was not edited.
- **Real tests run and results:** `npm run lint` passed with no findings. `npm run build` passed
  with a successful production compile, TypeScript check, and static generation of `/`. The Packet
  SHA-256 remained `68ba7d7ce62e05e563bc3fa63c7d424d1a0f256736350568d7cf8d3147485923`.
  A local development request returned HTTP 200 and included the persistent banner and all four
  required step labels. A secret-pattern scan found no populated Gemini key or public Gemini
  variable. The first
  development-dependency install failed because the existing npm cache was inaccessible; the same
  install then succeeded using a temporary cache and reported zero vulnerabilities. Next.js
  generated agent-instruction files during the local smoke test; they were removed as out-of-scope
  artifacts and automatic agent-file generation was disabled in configuration.
- **Commit SHA and push status:** Feature 1 committed as `54d28f3`; push not attempted because no
  Git remote is configured.
- **Deployment URL/status:** Not applicable during Feature 1.
- **Unresolved issues:** No Git remote is configured, so the required push remains unavailable.
  Browser-level visual and accessibility review remains planned for the later review feature;
  Feature 1 uses responsive CSS but has not been marked against any Packet Mechanical Pass test.
- **Tomorrow's first move:** After user review, begin Feature 2 by defining the versioned Zod record
  schema before adding persistence behavior.

## 2026-09-03 — Session 2: Feature 2 structured record and lifecycle

- **Decision or implementation detail:** Added one strict, versioned Zod record with ten separate
  data groups, an invented fixed-case fixture, pure lifecycle helpers, and a single-record browser
  storage adapter. The root view creates the fixture only after explicit action and supports manual
  deletion. Raw baseline and proposed-workflow cost inputs are present, while all calculated cost
  results remain empty for Feature 3.
- **Reason and Packet boundary protected:** Runtime validation and strict nested objects reject
  unknown persisted fields, including audio. Expiry and context invalidation are deterministic,
  and invalid or expired storage is removed without automatically creating a replacement case.
- **Files or behavior changed:** Added schema, fixture, lifecycle, storage, tests, and the client
  empty/active case states; updated the shell styles and direct dependencies.
- **Real tests run and results:** The first lint run found one synchronous-effect state-update
  error in `app/demo-case.tsx`; localStorage hydration was deferred to the next animation frame.
  This was a Feature 2 implementation issue discovered and resolved before session close; it does
  not count as the required Mechanical Pass bug, and the Mechanical Pass has not started.
  After the fix, the final `npm test` run passed 17 tests, `npm run lint` passed with no findings, and
  `npm run build` passed with TypeScript checking and static generation of `/`. Final verification
  confirmed the Packet checksum was unchanged, no populated Gemini secret or public Gemini
  variable was present, and no Feature 3 calculation or baseline-lock behavior was added.
- **Commit SHA and push status:** Feature 2 committed as `7789572` and successfully pushed to
  `origin/main`; local HEAD and the remote-tracking branch both resolved to the same full SHA,
  `7789572a95790ab1dc294bb81a8d026a7727e24e`.
- **Deployment URL/status:** Not applicable during Feature 2.
- **Unresolved issues:** None within the approved Feature 2 scope.
- **Tomorrow's first move:** After Feature 2 review and authorization, define the Feature 3 pure
  cost arithmetic and baseline-lock invariants before adding baseline controls.
