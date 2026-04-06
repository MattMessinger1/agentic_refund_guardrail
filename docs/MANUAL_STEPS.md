# What still has to be done manually

Automation and docs in this repo can’t replace these steps — someone with the right accounts must do them once.

## 1. Publish to PyPI (`refund-guard`)

**Recommended:** use the repo workflow **Publish to PyPI** (`.github/workflows/publish-pypi.yml`) with **trusted publishing** — no long-lived PyPI token in GitHub.

Step-by-step (account + one-time PyPI linking + run workflow): **[PYPI_FIRST_TIME.md](PYPI_FIRST_TIME.md)**.

**Manual alternative** (token on your laptop): `python -m build` then `twine upload dist/*` — see [RELEASING.md](../RELEASING.md).

After the package exists on PyPI, add a PyPI badge or **Website** link in the repo About (optional).

## 2. Publish to npm (`@mattmessinger/refund-guard`)

The package was **not** on the public npm registry (404). To publish:

1. Log in: `npm login` (npm account with access to the `@mattmessinger` scope, or change the scope/name in `packages/refund-guard-ts/package.json`).
2. `cd packages/refund-guard-ts`
3. `npm publish --access public` (if scoped and public).

Then add the npm version badge and the **Website** link in the GitHub repo **About** box.

## 3. Branch protection on GitHub

In **Settings → Branches → Branch protection rules** for `main`:

- Require **status checks** to pass (CI workflow jobs).
- Optionally require pull request reviews before merging.

See [GITHUB_SETUP.md](GITHUB_SETUP.md).

## 4. Optional: enable GitHub Security advisories

**Settings → Security** — enable private vulnerability reporting if you want reports through GitHub.

## 5. Dogfood in your app (e.g. SignupAssist)

Add a real dependency on the published npm (or `file:` / git URL during development) in your product repo and run refunds through this library. That’s application work, not this repository.
