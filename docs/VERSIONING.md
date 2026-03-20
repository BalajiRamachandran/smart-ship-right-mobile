# Versioning, tags, and releases

Every **commit** on this repo:

1. **Pre-commit** (`scripts/bump-version.js`) bumps the patch version in `package.json` and `app.json` (`expo.version`) and stages those files.
2. **Post-commit** (`scripts/create-tag-release.js`) creates an annotated tag `v{version}`, pushes it to `origin`, and creates a GitHub release with auto-generated notes (requires [`gh` CLI](https://cli.github.com/) logged in).

## Pull requests

- **Direct commits to `main`:** No PR is required; push after commit as usual.
- **Feature work:** Create a branch, commit (version still bumps per commit), push, then open a PR when the change should be reviewed before merging:

  ```bash
  git checkout -b feature/your-change
  # ... edit, commit (hooks run) ...
  git push -u origin feature/your-change
  gh pr create --fill
  ```

After merge to `main`, the version on `main` reflects the latest bump from the merge commit.
