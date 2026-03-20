# Versioning, tags, and releases

Every **commit** on this repo:

1. **Pre-commit** (`scripts/bump-version.js`) bumps the patch version in `package.json` and `app.json` (`expo.version`) and stages those files.
2. **Post-commit** (`scripts/create-tag-release.js`) creates an annotated tag `v{version}`, pushes it to `origin`, and creates a GitHub release with auto-generated notes (requires [`gh` CLI](https://cli.github.com/) logged in).
3. **Post-push** (`scripts/post-push-pr.js`) runs after `git push`. If the current branch is **not** the default branch (`main` / `origin/HEAD`) and there is **no open PR** for that branch, it runs `gh pr create --fill` so a PR is opened automatically.

   - Disable: `SKIP_POST_PUSH_PR=1 git push`
   - Requires `gh` authenticated (`gh auth login`).

## Pull requests

- **Direct commits to `main`:** No PR is created (post-push exits immediately on the default branch).
- **Feature work:** Create a branch, commit (version still bumps per commit), push — a PR is created automatically when possible. You can still open one manually:

  ```bash
  git checkout -b feature/your-change
  # ... edit, commit (hooks run) ...
  git push -u origin feature/your-change
  ```

After merge to `main`, the version on `main` reflects the latest bump from the merge commit.
