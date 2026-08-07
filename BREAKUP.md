# BREAKUP plan — detail-page + settings design-system sweep

> **This file is informational scaffolding for splitting this draft MR into real
> iterative MRs. It is NOT meant to be merged — delete it (and drop this commit)
> when you carve out the individual MRs.**

This branch is a prototype sweep that brings every detail page, settings page,
and list page onto one design-system language. It is intentionally large. Each
commit below is scoped to one concept so it can be cherry-picked into its own MR.

## The design language this establishes
- **Two header tiers:** data-rich pages use `gt-detail-masthead` (status + title
  + vitals + pulse, in an outlined card); settings-style pages use
  `gt-page-header` (title + hairline, no card).
- **Header role rule:** page title -> `.section-header-text`; section/card ->
  uppercase `.detail-section-header` eyebrow; nested group ->
  `.detail-subsection-header`. Never raw `mat-card-title` / bare `<h2>`.
- **Identifiers in mono** (`--gt-font-mono`): emails, slugs, DSNs, tokens,
  versions, hashes, timestamps. Centralised where possible (e.g. `gt-copy-input`).
- **8px grid spacing** (`--gt-space-*`), outlined cards, hairline row separators,
  compact `gt-empty-state [dense]` for detail tables, on-system chart labels.

## Suggested MRs (land in this order — 1 and 2 are prerequisites for the rest)

| # | MR | Commit | Scope |
|---|----|--------|-------|
| 1 | Foundations | `feat(design-system): mono font token, eyebrow/subsection type classes, on-system chart labels` | `src/styles.scss`, `src/assets/styles/_font-files.scss`. Depended on by every other MR. |
| 2 | Shared detail primitives | `feat(shared): detail-page header primitives + on-system shared bits` | `gt-detail-masthead`, `gt-page-header`, `gt-stat`, `gt-detail-header` emphasis, `gt-entry-data` dense/mono, `gt-copy-input` mono, `gt-empty-state` dense. Depends on #1. |
| 3 | Issue/event detail | `feat(issues): revamp issue/event detail ...` | `src/app/issues/**`. Includes the original issue-detail prototype + reconciliation. Depends on #1, #2. |
| 4 | Monitor detail | `feat(uptime): revamp monitor detail ...` | `src/app/uptime/**`. Depends on #1, #2. |
| 5 | Transaction + release detail | `feat(perf,releases): ...` | `src/app/performance/**`, `src/app/releases/**`. Depends on #1, #2. |
| 6 | Settings detail pages | `feat(settings): gt-page-header + eyebrow sections for member/project/team detail` | member-detail, project-detail (+ environments/alerts), team-details/members/projects/settings. Depends on #1, #2. |
| 7 | Settings list pages + list rows | `feat(settings): eyebrow headers, mono identifiers, tidy list rows ...` | org settings, members list, teams list, new-member. Includes the list-row layout fix (single line; collapse at tablet, not `$large`). Depends on #1, #2. |
| 8 | Profile + auth | `feat(profile,auth): apply header rule ...` | `src/app/profile/**`, auth/standalone pages, system-info. Depends on #1, #2. |

## Cross-cutting threads (woven into the MRs above)
- **Outlined destructive buttons** (per the button audit) touch org/project/team/
  account delete buttons in MRs 6/7/8. If you'd rather ship them as one small
  "destructive button consistency" MR, cherry-pick just those button changes.
- **`gt-copy-input` mono** lives in MR 2 but visibly affects DSNs (MR 6) and
  tokens (MR 8).
- **`subscription/payment`** was deliberately NOT changed (data-driven pricing
  grid, not section cards) — no action needed.

## Verification notes
- Every commit built clean (`ng build`, Node 24). Browser-verified across issue,
  monitor, transaction, release, member, project, team, org/members/teams lists,
  profile, auth — desktop and a mobile pass on the data mastheads.
- Seed data used for screenshots: `Checkout API` monitor (id 10), `GET /api/checkout`
  transaction spans, `checkout@2.4.0` release files. Not part of the code.

## Deferred follow-ups (NOT in this branch)
1. Extract `gt-section-intro` — the "eyebrow + description + primary action" card
   pattern is still hand-rolled in ~5 places (auth-tokens, project-alerts,
   org/project/team delete rows, teams "Your teams").
2. Extract `gt-list-item` — the member/team/project rows are now visually
   identical, so the extraction is mechanical (DESIGN_AUDIT already calls for it).
3. Document the header-role rule + the new primitives in `DESIGN.md` and add
   preview-doc pages in `projects/component-preview`.
4. Response-time chart y-axis outlier scaling (a big spike squashes the normal band).
5. Dark-mode visual pass (changes are token-based, but not yet screenshotted in dark).
