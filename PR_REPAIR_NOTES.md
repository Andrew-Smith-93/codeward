# Integrated PR repair candidate

## Scope and source

This candidate descends from remote base `e08724f` and integrates the prior local action safety and Node test-runner repairs. It covers the requested Zod range `^4.6.6`, locked to 4.6.7. It is not the original head of PR #5. Removing Vitest also removes Vite; accepting this candidate would supersede dependency PRs #3 and #4 rather than merge those upgrades. No PR has been closed.

CI fetches full base history, checks the actual PR diff, and disables persisted checkout credentials. The local-action workflow uses the mock provider without provider secrets or PR comments. Both its workflow and job names describe an offline smoke check. It is not a security audit. Mock findings do not create security annotations.

Action inputs remain literal arguments and keys remain outside argv. Each invocation receives a unique report path. Missing or empty reports do not post. Sticky-comment updates require the authenticated author's identity; failed identity lookup creates a new comment with a warning rather than editing an uncertain match.

## Verified local evidence — 2026-11-10

- On code commit `387be9e`, all 60 tests and production TypeScript builds passed on Node 18.20.8, 20.20.2 and 22.23.1. Each compiled test file was executed directly to verify individual cases.
- The isolated clean checkout of `387be9e` completed `npm ci --ignore-scripts`, test compilation and production build with a separate cache. No existing node_modules were reused in that checkout.
- Tests cover explicit review modes, PR-base selection, shell-sensitive arguments, key exclusion, native matcher behavior, Zod4 defaults/bounds/nested parsing, report isolation and comment authorship.
- Independent reviewers inspected the changes. Their recommendations and outstanding Council decisions are recorded outside this source tree; no GitHub review or binding approval is implied here.
- Earlier 48/51/54-test counts and Node18/20 gaps describe superseded intermediate candidates.

## Remaining gates

- Final Prophet Council decision and hosted checks on the actual published candidate.
- Hosted GitHub token/comment integration has not been exercised; identity lookup failure is covered locally.
- No publication, merge, package release, deployment, external provider request or real PR comment has occurred.
