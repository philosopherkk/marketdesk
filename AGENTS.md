# AGENTS.md — MarketDesk

Standing brief for any agent working in this repository.

## Source of truth

**Canonical source = this GitHub repo** (`philosopherkk/marketdesk`).

There is **no** chat-only project. Never treat chat history, a Grok preview, or a bot’s private disk as the app. Accepted changes belong in files here, committed on a branch, reviewed via PR, merged to `main`.

Deploy is GitHub Pages via `.github/workflows/pages.yml` → https://philosopherkk.github.io/marketdesk/

## Ownership

| Owner | Owns |
|---|---|
| **This repo** | Dashboard app (HTML/CSS/JS, Pages deploy, `VERSION`) |
| **Tape bot** | Morning desk notes → public `data/tape-daily.json` (OK to commit) |

Do not invent Tape desk content in chat and call it live. Prefer updating `data/tape-daily.json` through the Tape bot path when that is the intent.

## Autonomy

Plan → show file list / diff → **wait** when the change is a publish or touches secrets/deploy.

- Never treat chat as the app.
- No silent “live” edits outside git.
- Never commit Massive / IB / other API keys.
- Keys live in browser `localStorage` only (`marketdesk:secrets:v1`).

## Three habits after any accepted change

### 1) CANONICAL REPO

- Write or overwrite files **only** in this repository.
- List every file touched.
- Do not treat chat pastebacks, previews, or side copies as the live project.

### 2) GIT

After accepted writes:

1. `git status`
2. Stage **those** files
3. Commit on a **`feat/*` or `chore/*`** branch (never on `main`)

**Never:**

- Commit on `main` — KK merges to `main`
- Force-push or amend published history
- Push `main`
- Commit secrets, tokens, or `.env`-style key files

PRs are the normal path: branch → PR → merge `main` → Pages Actions deploy.

### 3) DEPLOY PATH (git → PR → merge → Pages)

- GitHub repo **philosopherkk/marketdesk** is what **GitHub Actions** deploys (static site — `.github/workflows/pages.yml`).
- Production URL **https://philosopherkk.github.io/marketdesk/** tracks branch **`main` only**.
- A content/app edit: commit on a **`feat/*` or `chore/*` branch** → push → **PR** → KK merges `main` → Actions deploy.
- **Never** deploy from a bot’s cloud disk copy. Only from **this repo’s git remote**.
- After KK merges: hard-refresh https://philosopherkk.github.io/marketdesk/ and confirm header **VERSION** / `APP_VERSION` and **APP_UPDATED** (HKT) match `origin/main`. If not, say so.
- Chat-only edits that are not committed **do not exist**.
- **CHANGELOG.md** entries come from **git**, not from chat. Chat-only notes are not history.

**Allowed without extra ceremony** after KK approved the file edits: write files, commit, push a **feature/chore branch**, open PR and wait.

**Still needs KK yes that turn:** merge to `main`, Pages/settings changes, deleting history, making secrets public.

## Secrets

- Never commit Massive.com / Polygon, Interactive Brokers, or any API keys.
- Keys are pasted in the app UI and stored only in this browser’s `localStorage`.
- `data/tape-daily.json` is public desk data — OK to commit.
- If secrets are found in the tree: **stop** and report the **path only** (do not paste values).

## Publish gates

On **every publish** (release that should show up live):

1. Bump `VERSION`
2. Bump `APP_VERSION` and `APP_UPDATED` (HKT) in `core.js` — keep in sync with `VERSION`
3. Append a `CHANGELOG.md` entry from **that git commit** (date, commit SHA, summary). Do not invent history from chat notes.
4. PR → merge `main` → wait for Pages Actions
5. Hard-refresh the live URL and check VERSION in the header (and that the footer **History** link opens `CHANGELOG.md` on GitHub)

## Hard rules

- Do not put Massive/IB tokens in public frontend JS or Export backups.
- Do not invent prices or brokerage fills. Target ≠ exit.
- US bare tickers resolve to US listings; Stockbee MM labeled reconstructed / not official.
- Prefer docs/handoff updates over inventing a second source of truth outside this repo.
