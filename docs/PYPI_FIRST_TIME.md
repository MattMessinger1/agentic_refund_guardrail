# First-time publish to PyPI (trusted publishing)

I can’t log into PyPI for you, but this repo includes **`.github/workflows/publish-pypi.yml`**, which publishes using **OpenID Connect** — you **do not** paste a PyPI password into GitHub forever; you link GitHub to PyPI once.

## 1. Create a PyPI account

1. Go to [https://pypi.org/account/register/](https://pypi.org/account/register/) and sign up.
2. Confirm your email.

## 2. Register a “trusted publisher” (one-time)

This tells PyPI: “when **this** GitHub Actions workflow succeeds, it may upload **refund-guard**.”

1. Log in at [pypi.org](https://pypi.org).
2. Open **Account settings** → **Publishing** (or [Publishing — add a pending publisher](https://pypi.org/manage/account/publishing/)).
3. Choose **GitHub** as the publisher type.
4. Fill in (must match the workflow file in this repo):

   | Field | Value |
   |-------|--------|
   | **PyPI Project name** | `refund-guard` |
   | **Owner** | `MattMessinger1` |
   | **Repository name** | `agentic_refund_guardrail` |
   | **Workflow name** | `publish-pypi.yml` |
   | **Environment name** | *(leave empty)* — the workflow does not use a named GitHub Environment |

5. Save. PyPI may show the project as **pending** until the first successful upload.

Details: [PyPI — publishing with OpenID Connect](https://docs.pypi.org/trusted-publishers/).

## 3. Run the workflow

After **`publish-pypi.yml`** is on the default branch:

1. GitHub → **Actions** → **Publish to PyPI**.
2. **Run workflow** → branch **`main`** → **Run workflow**.

If it goes green, the package should appear at [https://pypi.org/project/refund-guard/](https://pypi.org/project/refund-guard/).

Alternatively, **create a GitHub Release** (e.g. tag `v0.1.0`); the same workflow runs automatically on `release: published`.

## 4. Version bumps

`pyproject.toml` has `version = "0.1.0"`. PyPI **rejects** re-uploading the same version. For the next release:

1. Bump `version` in `pyproject.toml` (and keep [CHANGELOG.md](../CHANGELOG.md) in sync).
2. Commit, tag (e.g. `v0.1.1`), push, create a **new** GitHub Release — or run the workflow manually after merging.

## Troubleshooting

- **“Permission denied” / OIDC failed** — Double-check owner, repo, and workflow filename **`publish-pypi.yml`** on PyPI match exactly (case-sensitive).
- **“File already exists”** — You’re uploading a version that’s already on PyPI; bump the version in `pyproject.toml`.
