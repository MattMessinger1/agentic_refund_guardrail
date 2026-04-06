# What still has to be done manually

Automation and docs in this repo can’t replace these steps — someone with the right accounts must do them once.

## 1. Publish to PyPI (`refund-guard`)

As of the last check, **`refund-guard` was not on PyPI** (404). To publish:

1. Create accounts on [PyPI](https://pypi.org/) and (recommended) [TestPyPI](https://test.pypi.org/).
2. Configure **trusted publishing** (OIDC from GitHub) or use **API tokens**.
3. From the repo root:

   ```bash
   pip install build twine
   python -m build
   python -m twine upload dist/*
   ```

4. After the first upload, add the PyPI badge in the README (version will resolve on [shields.io](https://shields.io/)).

See also [RELEASING.md](../RELEASING.md).

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
