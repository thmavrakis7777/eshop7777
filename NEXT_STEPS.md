# Next Steps

## START HERE NEXT SESSION

Read `PROJECT_MEMORY.md`, `CURRENT_STATE.md`, and `TASKS.md` first — this file is
the pointer to exactly where to resume, those three have the detail behind it. Do
not restart the project, do not regenerate completed features, do not re-analyze
the whole codebase from zero — everything needed is in these five files.

1. **Exact phase we are currently in**: Phase 3 is complete and closed out.
   No phase is "in progress" — the project is sitting at a clean checkpoint
   between Phase 3 (done) and Phase 4/5 (not started, and not yet chosen
   between — see #2).
2. **Last completed action**: a documentation-only handoff commit (no code
   changes) that expanded `PROJECT_MEMORY.md` and added `CURRENT_STATE.md` +
   this file, on top of the Phase 3 work itself (audit fixes + real Medusa
   data wiring), all committed and pushed to `origin/main`.
3. **Next action to execute**: **this is a decision, not a coding task.**
   See section 2 below ("Exact next action to perform") before writing any
   code — do not silently start Phase 4 or Phase 5 without stating the
   reasoning first.
4. **First files to inspect**: `PROJECT_MEMORY.md` → `CURRENT_STATE.md` →
   `TASKS.md`, then whichever direction-specific files are listed in section 3
   below once a direction is chosen.
5. **Warnings / important context**: see section 5 below in full before
   touching the dev servers or trusting a console error — several environment
   quirks in this specific setup have already wasted time once each and are
   documented so they don't waste time twice.

---

**The rest of this file is the detailed version of the five points above.**

## 1. Exact last action completed

Phase 3 ("storefront wired to real Medusa data") was finished, verified, and
closed out. The very last actions of the previous session, in order:

1. Ran a full engineering audit of everything built in Phases 1–2, found and
   fixed real bugs (see `CHANGELOG.md` for the itemized list).
2. Built the Store API client, data adapters, real PLP/PDP pages.
3. Found and fixed two real backend bugs during verification (missing Greece
   in the sales region; top-level category pages showing 0 products).
4. Ran full verification: `tsc --noEmit`, `eslint`, `next build` — all clean.
   Manually verified in-browser: homepage, mega menu, mobile menu (focus
   management), `/kouzina`, `/kouzina/tigania`, a product detail page.
5. Committed (`781c132`) and **pushed to `origin/main`**.
6. This handoff: wrote/expanded `PROJECT_MEMORY.md`, `CURRENT_STATE.md`,
   `TASKS.md`, `CHANGELOG.md`, `NEXT_STEPS.md`. No code changes in this step.

**Git is clean and pushed as of this handoff.** `git status` should show nothing
to commit; `git log --oneline` should show `781c132` as the tip (plus whatever
commit this handoff itself becomes, if it's committed after being written —
check `git log` to see if it already is).

## 2. Exact next action to perform

**This is a decision point, not a coding task — do not silently pick an option
and start coding.** The roadmap's next phase (Phase 4, full PDP) leads with two
items that are currently blocked:

- Real product gallery — needs real photography, which does not exist
- Variant/option selection UI — the entire catalog is single-variant products,
  so there's nothing to build a selector against yet

The two unblocked Phase 4 items (recently-viewed, frequently-bought-together)
are minor. Phase 5 (cart & checkout) has no content blockers and is arguably
more valuable for an actually-functioning store than PDP polish.

**If a human is available to ask**: ask which of these three to do next —
(a) the unblocked Phase 4 items, (b) jump to Phase 5 cart/checkout, or (c) wait
on Phase 4's blocked items until real photography/variant data exists.

**If no human is available and a choice must be made autonomously**: cart &
checkout (Phase 5) is the more defensible default — it has zero content
blockers, and a store with no working cart is not a functioning store
regardless of how polished the PDP is. But state this reasoning explicitly
before starting, don't just start.

## 3. Which files should be opened first

- `PROJECT_MEMORY.md` — architecture, conventions, the "important technical
  decisions" section especially (region/category-filtering gotchas that will
  bite again if not read first).
- `CURRENT_STATE.md` — what actually exists and what's actually been tested,
  so verification effort isn't wasted re-checking things already confirmed
  working.
- `TASKS.md` — the full roadmap this file points into.
- Depending on which direction is chosen:
  - **Cart/checkout**: `apps/storefront/src/components/product/ProductCard.tsx`
    and `AddToCartButton.tsx` (the two currently-inert buttons to wire up),
    `apps/storefront/src/lib/medusa.ts` and `lib/data/` (the pattern to follow
    for a new `lib/data/cart.ts`), Medusa's Store API cart endpoints
    (`/store/carts`) — read the live API before assuming its shape, same as
    last session did for products/categories.
  - **Recently viewed / bundles**: `apps/storefront/src/components/product/`
    and `apps/storefront/src/app/proionta/[handle]/page.tsx`.

## 4. Which files should NOT be modified

- `apps/backend/apps/backend/src/migration-scripts/initial-data-seed.ts` —
  Medusa's own default seed script; per `apps/backend/AGENTS.md`, add a new
  migration rather than rewriting one that may already have run.
- `apps/backend/apps/backend/.env` / `apps/storefront/.env.local` — gitignored,
  contain real secrets/connection strings. Never print their contents into
  chat, logs, or commit them. Edit `.env.template`/`.env.example` instead when
  documenting a new required variable.
- The lockfiles (`pnpm-lock.yaml` in either app) — never hand-edit, only let
  package-manager commands change them.
- `apps/backend/pnpm-workspace.yaml`'s exclusion of `apps/backend` from the
  root workspace — this is deliberate (see `PROJECT_MEMORY.md`), don't "fix" it.
- Don't rename/restructure `lib/types.ts`'s domain types casually — `ProductCard`
  and every PLP/PDP page depend on that exact shape; a change there is a
  UI-wide change, not a local one.

## 5. Warnings / things to remember

- **Turbopack dev-server HMR goes stale after long edit sessions.** If a
  dev-server error contradicts what `pnpm build` says, `rm -rf .next` and
  restart before assuming the code is wrong. Happened twice last session.
- **`read_console_messages` (browser tool) accumulates stale history across
  navigations.** Don't trust it alone — cross-check with live DOM queries or
  server-side `preview_logs`.
- **`computer.key` synthetic keypresses don't reliably reach the page in this
  environment.** Use `document.dispatchEvent(new KeyboardEvent(...))` instead
  when verifying keyboard-only interactions.
- **No admin rights on this machine** — Node/gh were installed as portable
  no-admin extracts; if a fresh shell is missing them from `PATH`, see
  "Environment setup" in `PROJECT_MEMORY.md` for the exact paths.
- **Verify Medusa API assumptions against the live backend before building on
  them** — this caught two real bugs last session (region-based pricing,
  category-descendant filtering). Don't assume; curl it first.
- Both apps need to be running to see the full site working:
  `pnpm run backend:dev` from `apps/backend`, `pnpm dev` from the repo root.
  Neither is running right now (both were stopped cleanly at session end).

## 6. Known bugs

**None currently open.** Every bug found during the last session's audit was
fixed and verified before the session ended (see `CHANGELOG.md` for the full
list of what was found and fixed). If new issues turn up during Phase 4/5 work,
add them here rather than only mentioning them in chat.

## 7. Pending decisions

- **Which unblocked next step to take** — see section 2 above. This is the
  actual next action and needs a decision before code gets written.
- **Backend hosting** — Vercel is connected but can't run Medusa's persistent
  server; no hosting decision has been made, deferred until actually needed
  (prior explicit user decision — don't revisit without cause, but it will
  need answering before any real deployment).
- **Real brand name / domain** — "STIA" / `stia.gr` are placeholders, never
  trademark-checked. Needs a real decision before anything here is public-facing.
- **Real product photography** — sourcing/creating it is what unblocks two
  Phase 4 items. No plan yet for where photography comes from.
- **Greek payment provider integration** (Viva Wallet / Everypay) — named in
  the roadmap for Phase 5 checkout but no account/API credentials exist yet for
  either. Will need setting up before checkout can actually process a real
  payment (COD can work without this, but that's not a full solution).
