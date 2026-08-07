# AI Agent Guidelines


## Version Control
- **Commits:** Use conventional commits (e.g., `fix:`, `feat:`, `refactor:`).

## UI Conventions

- **Permission gating:** Gate every write/delete control on a named capability gate from `OrganizationsService` (`canWriteProject`, `canAdminOrg`, …) rather than an inline scope list. `hasScope(...)` is the any-of primitive behind those gates, public only for ad-hoc combinations. The backend enforces access regardless; gating is a UX affordance so users do not click actions that will 403. Gate by _reason_:
  - **Permission/role → hide** with `@if (canXxx())`, e.g. `@if (canAdminProject()) { <button>Delete</button> }`. If hiding a lone action would leave an empty card, hide the whole card, or render its data read-only. Hiding keeps the control out of screen-reader focus, unlike `[disabled]`.
  - **Transient state → `[disabled]`** (pristine form, in-flight request, missing prerequisite), paired with a reason the user can act on. Never `[disabled]` for permission.
  - **Write and admin are different scopes.** `project:admin` deletes projects and alerts, `team:admin` deletes teams, `org:admin` is Owner-only. Do not gate a delete on the write gate.
  - **Team writes are team-scoped**, not org-scoped: use the team gates, and `TeamsService.canModifyTeam` where the backend's in-team/not-in-team distinction applies.
  - **Re-home copy that points at a control you hid.** An empty state reading "press Create New Project" must not render when that button is gated away — pass the button's own condition down instead.
  - **Multi-org views cannot use these gates.** Every gate derives from the one selected organization, so a view listing several orgs (the home project list) must gate per-org or not at all. `GET /api/0/organizations/` does not yet return `access`.

## Local Development

- **Backend:** sibling repo `glitchtip-backend`. Start with `docker compose up -d` from that repo; API is served on `http://localhost:8000`.
- **Frontend:** `npm start` in this repo; dev server at `http://localhost:4200` proxies API calls to the backend.
- **Test login:** the backend's first-run bootstrap prints a seeded admin user (email and password) in the `web` container logs — inspect with `docker compose logs web` in the backend repo to retrieve current credentials before logging in via the UI.
- **API token for seeding:** the bootstrap also seeds a full-scope API token on the test user (label `bootstrap_dev`). Query it with `docker compose exec web python manage.py shell -c "from apps.api_tokens.models import APIToken; print(APIToken.objects.first().token)"` and use `Authorization: Bearer <token>` against `http://localhost:8000/api/0/...` to create orgs/projects/events/transactions. Prefer this over driving sessions via curl or clicking through the UI when generating test data.

## Licensing — Clean Room Development

GlitchTip is API-compatible with Sentry, but **their server code and documentation are NOT open source**. They use the Business Source License (BSL) and Functional Source License (FSL). You MUST strictly adhere to a clean room development process.

- **OFF LIMITS (Server Code & Docs):** You are strictly prohibited from reading, searching, curling, copying, or referencing Sentry's server-side source code or official documentation. 
  - Do not access `getsentry/sentry`, `getsentry/self-hosted`, or similar server repositories.
  - Do not access `docs.sentry.io` or the `getsentry/sentry-docs` repository. 
- **ALLOWED (MIT SDKs):** You may read and analyze Sentry's **MIT-licensed client SDKs** (e.g., `sentry-python`, `sentry-javascript`). These send data *to* the server and are genuinely open source.
- **How to build for compatibility:** To understand API payloads or endpoints, do not look up their documentation. Instead, inspect the source code of the MIT-licensed SDKs to see what they transmit, or ask the user to provide a captured JSON payload from an SDK to use as a test fixture.
- **Terminology:** Avoid mentioning the company Sentry (capital S) unless explicitly necessary, to prevent trademark confusion. When referencing the client-side libraries, refer to them as "MIT sentry SDKs" (lowercase s).


## Issues & merge requests — AI policy (for AI coding agents)

This project follows the GlitchTip AI Policy:
https://gitlab.com/glitchtip/glitchtip/-/blob/master/AI_POLICY.md

When you help a user draft an issue or merge request description:

- The **Summary / Description must be the human's own words.** Do not write it
  for them and present it as theirs. Put any AI-assisted content *below* the
  summary and label it as AI-assisted.
- **Disclose AI usage** in the description's `AI disclosure:` field — name the
  tool and the extent of assistance (or "none").
- **Do not submit untested code.** Verify changes with real human use first.
- **Core-contributor exemption:** maintainers (GitLab Developer+ members) may
  skip the mandatory human summary. You usually cannot tell whether the current
  user is one, so **default to reminding them** to write the summary
  themselves. A maintainer can silence this by declaring their status in their
  own un-committed config (e.g. `CLAUDE.local.md` or personal agent memory) —
  check there first.
