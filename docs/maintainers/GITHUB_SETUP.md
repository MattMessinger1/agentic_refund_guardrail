# GitHub settings (maintainers)

The repo already includes CI (`.github/workflows/ci.yml`), issue templates, and `CONTRIBUTING.md`. A few things must be toggled **in the GitHub web UI** (this file cannot set them for you).

**Publishing PyPI/npm and tokens:** see [MANUAL_STEPS.md](MANUAL_STEPS.md) (same directory).

## Repository “About”

On the repo home page, click **⚙️** next to **About**.

- **Description** (suggested):  
  `Server-side refund policy checks between an AI tool call and your refund provider.`
- **Website** (optional): PyPI or npm package URL once published.
- **Topics** (suggested):  
  `refunds`, `stripe`, `agents`, `guardrails`, `python`, `typescript`, `mcp`, `safety`, `pypi`, `npm`

## Branch protection (recommended)

**Settings → Branches → Branch protection rule** for `main`:

- Require a pull request before merging (optional for solo maintainers).
- **Require status checks to pass** before merging — select the jobs from `.github/workflows/ci.yml` (e.g. `python`, `typescript`).
- Allow **squash** merges if you like a linear history.

## Releases

When you publish to **PyPI** and **npm**, create a **GitHub Release** with the same tag as `pyproject.toml` / `package.json` (e.g. `v0.1.0`). See [RELEASING.md](RELEASING.md).
