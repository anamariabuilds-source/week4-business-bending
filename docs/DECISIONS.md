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

## 2026-09-03 — Session 3: Feature 3 baseline and cost model

- **Decision or implementation detail:** Added pure employer-cost arithmetic and Checkpoint 1 lock
  functions plus a functional Baseline Setup form. Current and proposed costs are rounded to two
  decimals and stored separately; candidate time is excluded. Locking preserves the validated raw
  inputs, costs, volume, candidate time, simulated 50% rule, and timestamp. Actual cost, workflow
  outcome, and observed substitution remain null and are not displayed.
- **Reason and Packet boundary protected:** The cost function receives only employer cost inputs
  and candidate volume. The lock function does not derive any result from evidence status, Hiring
  Manager relevance, or stated interest, so none can establish substitution or economic value.
  Obvious contact patterns are rejected in the new free-text field without claiming perfect PII
  detection.
- **Files or behavior changed:** Added the Checkpoint 1 rules and tests, strengthened baseline
  validation, made the Baseline Setup view editable before lock and read-only after lock, and added
  responsive form and cost-summary styles.
- **Real tests run and results:** The first full run passed tests but lint reported one unused test
  variable warning and the build failed because TypeScript did not preserve a nullable `lockedAt`
  narrowing through JSX. Both were fixed before session close. These are Feature 3 implementation
  issues, not Mechanical Pass bugs; the Mechanical Pass has not started. The final `npm test` run
  passed 35 tests across two files, `npm run lint` passed with no findings, and `npm run build`
  passed with TypeScript checking and static generation of `/`.
- **Commit SHA and push status:** Feature 3 committed as `c32b793` and successfully pushed to
  `origin/main`; local HEAD and the remote-tracking branch both resolved to the same full SHA,
  `c32b79319135e11e1aecfc7d7f062461de91c1f2`.
- **Deployment URL/status:** Not deployed; deployment is outside Feature 3.
- **Unresolved issues:** None within the approved Feature 3 scope. Final integrity, secret, and
  scope scans passed before review.
- **Tomorrow's first move:** After Feature 3 review and authorization, define the bounded Feature 4
  consent-state transitions before adding Candidate Text and no-project UI branches.

## 2026-09-04 — Session 4: Feature 4 consent, Text, and no-project branches

- **Decision or implementation detail:** Added pure context-consent, Text authorization, sharing,
  employer-visibility, and step-navigation transitions. Only steps 1 and 2 are operational. Text
  drafts remain in component memory; only a reviewed response is persisted when analysis is
  authorized. `Analysis unavailable` is a deterministic Feature 4 placeholder only.
- **Reason and Packet boundary protected:** Candidate evidence remains closed to employer access
  for every implemented path. No-project is distinct from insufficient evidence, refusal clears
  candidate evidence from the record, premature Share is rejected, and a context change clears the
  prior confirmation and authorization. The placeholder is not evidence and does not validate real
  Gemini or API failure handling.
- **Files or behavior changed:** Added consent transition rules and tests, strengthened confirmation
  validation and context invalidation, connected the Baseline and Candidate views, and added the
  Text review, refusal, no-project handoff, placeholder, and paused-review interfaces.
- **Real tests run and results:** `npm test` passed 52 tests across three files, `npm run lint`
  passed with no findings, and `npm run build` passed with TypeScript checking and static generation
  of `/`. No real implementation issue was discovered during Feature 4 before final review.
- **Mechanical Pass status:** Not started. T08 and every other Packet Mechanical Pass test remain
  `Not run — planned before code`; the placeholder does not count as running or validating T08.
- **Commit SHA and push status:** Feature 4 committed as `ab5a3ac` and successfully pushed to
  `origin/main`; local HEAD and the remote-tracking branch both resolved to the same full SHA,
  `ab5a3ac9c06389a2cf05bc01dab8f52046232373`.
- **Deployment URL/status:** Not deployed; Deploy 1 requires separate post-review authorization.
- **Unresolved issues:** None within the approved Feature 4 scope. Final integrity, secret,
  personal-data, safe-rendering, and later-feature scope scans passed before review.
- **Tomorrow's first move:** After Feature 4 review and session close, obtain explicit authorization
  before either Deploy 1 or proposing Feature 5.

## 2026-09-04 — Session 5: Feature 5 Voice and bounded Gemini analysis

- **Decision or implementation detail:** Added server-only Gemini transcription and evidence-analysis
  routes using the exactly pinned `@google/genai` 2.21.0 package and `gemini-3.5-flash`. Audio is
  sent inline as a raw bounded request. Analysis uses fixed simulated evidence, JSON Schema output,
  and server-side Zod validation. The browser automatically stops recording at 60 seconds; the
  server independently enforces supported MIME types and a 5 MB body limit without claiming to
  inspect audio duration.
- **Reason and Packet boundary protected:** Voice and Text converge on one approved confirmation
  field and analysis request. Audio remains temporary client state and is cleared after use.
  Technical, API, timeout, and invalid-output failures map to `Analysis unavailable`; Voice failures
  map to `Voice transcription unavailable`. Neither route intentionally logs submitted or model
  content. Gemini never calculates human review, costs, acceptance, substitution, or outcomes.
- **Files or behavior changed:** Added bounded AI contracts, server request/route adapters, fixed
  prompt and generation-request builders, Voice state and UI, deterministic analysis-state rules,
  API routes, tests, styles, schema fields, and the server-only SDK dependency.
- **Real tests run and results:** Controlled tests cover server request limits, MIME validation,
  structured-output rejection, timeouts, no-content logging, prompt boundaries, inline audio,
  client Voice limits and cleanup, Text/Voice equivalence, sharing gates, and deterministic
  additional-human-review rules. Final `npm test` passed 89 tests across six files, `npm run lint`
  passed with no findings, and `npm run build` passed with TypeScript checking and both API routes
  emitted as dynamic server routes. Dependency installation reported zero vulnerabilities.
- **Implementation issues discovered:** The first new controlled test run found that Vitest did not
  resolve direct `@/` aliases in two test imports; after those were made relative, a runtime contract
  import exposed the same issue in `analysis-state.ts`. The imports were corrected and the final
  suite passed. Live verification then found that the client explicitly selected Gemini API `v1`,
  while this key exposes `gemini-2.5-flash` through `v1beta`; the server-only client was corrected to
  use `v1beta` without changing the model or any prompt, schema, validation, consent, cost, or claim
  boundary. These are Feature 5 implementation issues, not Mechanical Pass bugs.
- **Provider compatibility correction:** `gemini-2.5-flash` returned provider-side HTTP 404 on
  `generateContent` for this project despite appearing in `models.list`; stable
  `gemini-3.5-flash` was substituted after live verification. No product behavior or claim boundary
  changed.
- **Live Gemini verification:** With `GEMINI_API_KEY` configured, the key-specific `v1beta` model
  listing returned `gemini-2.5-flash` with `generateContent` support. The earlier failed Text
  attempts returned HTTP 422 `ANALYSIS_UNAVAILABLE`; both a content-free SDK request and direct
  `v1beta` REST `generateContent` request returned HTTP 404. Stable `gemini-3.5-flash` was then
  selected, the forced API-version override was removed, and the content-free smoke test passed.
  The final simulated Text request returned HTTP 200 with `status: available`; the bounded payload
  passed the route's server-side Zod validation and independent shape checks, including a permitted
  evidence status, source references, and limitations. A synthetic `say`/`afconvert` MP4 Voice
  fixture produced HTTP 200 with `status: available` and a non-empty transcript within 600
  characters; the temporary fixture and response were deleted immediately after the request.
  No transcript, audio, evidence, model content, or API key was printed or intentionally logged;
  only request method, path, status, and timing appeared in development-server output.
- **Mechanical Pass status:** Not started. T08 and every other Packet Mechanical Pass test remain
  `Not run — planned before code`; controlled Feature 5 route tests do not update that status.
- **Commit SHA and push status:** No commit yet; Feature 5 must be reviewed before staging or
  committing.
- **Deployment URL/status:** Not deployed.
- **Unresolved issues:** None within the approved Feature 5 scope. The provider compatibility issue
  was corrected without changing product behavior or claim boundaries. Final integrity, secret,
  client-bundle, logging, personal-data, audio-persistence, and later-feature scope scans passed.
- **Tomorrow's first move:** Obtain review authorization before staging or closing Feature 5; do not
  start Feature 6 or the Mechanical Pass from this session.
