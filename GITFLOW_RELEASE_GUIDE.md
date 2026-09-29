# Gitflow Release Guide

This guide explains how to perform a complete gitflow release from `develop` to `main` and back to `develop`.

## Overview

Gitflow is a branching model that uses dedicated branches for releases. The complete flow involves:

1. Create a release branch from `develop`
2. Bump version and prepare release
3. Merge release to `main` (production)
4. Merge release back to `develop` (to sync changes)

## Step-by-Step Process

### Step 1: Create Release Branch from Develop

```bash
# Ensure you're on develop and it's up to date
git checkout develop
git pull origin develop

# Create release branch (e.g., for version 1.1.1)
git checkout -b release/1.1.1
```

### Step 2: Bump Version and Prepare Release

```bash
# Bump package.json AND package-lock.json together. Editing package.json by
# hand leaves the lockfile on the old version (this happened in 1.4.1).
npm version 1.1.1 --no-git-tag-version
```

Update `CHANGELOG.md`:
- Add `## [1.1.1] - YYYY-MM-DD` directly under `## [Unreleased]`, so the pending entries move into the release and `[Unreleased]` is left empty
- Add a compare link above the previous one at the bottom of the file:
  `[1.1.1]: https://github.com/comnam90/veeam-data-cloud-services-map/compare/v1.1.0...v1.1.1`

```bash
# Commit the version bump and changelog together
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore(release): bump version to 1.1.1"

# Verify on a clean install
npm ci
npm run build
npm test
npm run test:ui
```

> The API contract version (`1.0.0` in `src/functions/_worker.ts` and `routes/v1/health.ts`) is separate from the package version. Only change it for breaking API changes.

### Step 3: Merge Release to Main

The release branch should be merged to `main` via a Pull Request:

> ⚠️ **Important:** When creating the PR, always verify that the **base branch is set to `main`**, not `develop`. GitHub may default to a different base depending on how the branch was created.

```bash
# Push release branch
git push origin release/1.1.1

# Create PR: release/1.1.1 → main   ← base MUST be main
# Title: "chore(release): v1.1.1"
# Include:
# - List of changes since last release
# - Version bump details
# - Test results
```

**PR Description Template:**
```markdown
## Release v1.1.1

Merging release branch to main for version 1.1.1.

### Changes
- List key features, bug fixes, and updates
- Include PR/issue references

### Version
- Version bumped from 1.1.0 to 1.1.1

### Testing
- All tests passing (specify numbers)
```

> If the PR shows **merge conflicts** on `CHANGELOG.md` / `package.json`, or only Cloudflare Pages and GitGuardian report (GitHub doesn't run `pull_request` workflows on a conflicting PR), see [Release PR conflicts with main](#release-pr-conflicts-with-main).

Merge with a **merge commit** (`gh pr merge <PR> --merge`), not squash — squashing creates a new commit on `main` that `develop` never gets, which causes conflicts on the next release.

After PR is merged to main:
```bash
# Tag the release on main
git checkout main
git pull origin main
git tag -a v1.1.1 -m "Release version 1.1.1"
git push origin v1.1.1
```

### Step 4: Merge Release Back to Develop

After merging to `main`, merge the release branch itself back to `develop`. Branch from the release branch — **do not cherry-pick** the version bump onto a branch from `develop`:

```bash
git fetch origin
git checkout -b chore/merge-release-1.1.1-to-develop origin/release/1.1.1
git push -u origin chore/merge-release-1.1.1-to-develop

# Create PR: chore/merge-release-1.1.1-to-develop → develop
# Merge with a merge commit (gh pr merge <PR> --merge), not squash
```

> ⚠️ **Why not cherry-pick?** A cherry-pick creates a *new* commit with the same content, so `develop` never contains the commit that went to `main`. The next release PR then diffs from a point *before* this release, and both sides appear to have edited the same lines of `CHANGELOG.md` and `package.json`. This is what made the 1.5.0 release PR conflict: the 1.4.1 bump existed as `d843b56` on `main` and `e2b9fc3` on `develop`.

**PR Description Template:**
```markdown
## Merge release v1.1.1 back to develop

Completes the gitflow release cycle by incorporating release changes into develop.

### Changes
- Version bump: 1.1.0 → 1.1.1

### Why This Is Needed
In gitflow, release changes must flow back to develop to ensure:
- Future features start from the correct version
- Develop stays synchronized with production
- No version conflicts in next release

### Testing
- All tests passing
```

### Step 5: Create GitHub Release

A pushed tag alone does not show up on the repo's **Releases** page — publish a GitHub Release against it so the release notes are visible and the `Full Changelog` compare link is generated:

```bash
# Preferred: reuse the entry already written in CHANGELOG.md for this version
gh release create v1.1.1 \
  --title "v1.1.1" \
  --notes "$(sed -n '/^## \[1.1.1\]/,/^## \[/p' CHANGELOG.md | sed '$d')"

# Fallback: no CHANGELOG entry yet — let GitHub summarize merged PRs instead
gh release create v1.1.1 --title "v1.1.1" --generate-notes
```

> Past releases (see `CHANGELOG.md`) sometimes add a short subtitle to the title, e.g. `v1.4.0 — Mission Control Redesign`. Do this when the release has a clear theme; otherwise `vX.Y.Z` alone is fine.

### Step 6: Cleanup (Optional)

```bash
# Delete the release branch locally and remotely
# (--delete-branch on the back-merge PR already removes the chore branch)
git branch -d release/1.1.1
git push origin --delete release/1.1.1
```

## Complete Example

Here's a complete example for releasing version 1.1.1:

```bash
# 1. Create release branch
git checkout develop
git checkout -b release/1.1.1

# 2. Bump version (package.json + package-lock.json) and update CHANGELOG.md
npm version 1.1.1 --no-git-tag-version
# Edit CHANGELOG.md: add "## [1.1.1] - YYYY-MM-DD" under [Unreleased] + compare link
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore(release): bump version to 1.1.1"

# 3. Push and create PR to main (base MUST be main), merge with a merge commit
git push origin release/1.1.1
gh pr create --base main --head release/1.1.1 --title "chore(release): v1.1.1"
gh pr merge <PR> --merge

# 4. After PR merged to main, tag the release
git checkout main
git pull origin main
git tag -a v1.1.1 -m "Release version 1.1.1"
git push origin v1.1.1

# 5. Merge back to develop — branch from the release branch, never cherry-pick
git checkout -b chore/merge-release-1.1.1-to-develop origin/release/1.1.1
git push -u origin chore/merge-release-1.1.1-to-develop
gh pr create --base develop --title "chore: merge release/1.1.1 back to develop"
gh pr merge <PR> --merge --delete-branch

# 6. Create GitHub Release
gh release create v1.1.1 --title "v1.1.1" \
  --notes "$(sed -n '/^## \[1.1.1\]/,/^## \[/p' CHANGELOG.md | sed '$d')"

# 7. Cleanup
git branch -d release/1.1.1
git push origin --delete release/1.1.1
```

## Why Merge Back to Develop?

The release branch may contain:
- **Version bumps**: Essential for next development cycle
- **Release notes/changelog updates**: Documentation of what shipped
- **Last-minute bug fixes**: Critical fixes made during release prep
- **Build or config changes**: Release-specific adjustments

Without merging back to develop:
- ❌ Next feature branches start from old version
- ❌ Version conflicts in next release
- ❌ Missing release-specific fixes
- ❌ Divergent history between main and develop

## Best Practices

1. **Always use PRs**: Even for develop, use PRs for review and CI/CD
2. **Test thoroughly**: Run full test suite before creating release
3. **Document changes**: Update `CHANGELOG.md` as part of the release branch — it becomes the source for the GitHub Release notes
4. **Tag releases**: Always tag releases on main for easy reference
5. **Publish a GitHub Release**: A tag alone doesn't appear on the Releases page — always follow it with `gh release create` (Step 5)
6. **Consistent naming**: Use `release/X.Y.Z` format for release branches
7. **Clean history**: Use merge commits (`--no-ff` / `gh pr merge --merge`) for both release PRs — never squash or cherry-pick release commits between `main` and `develop`

## Troubleshooting

### Unrelated histories error
```bash
# If you get "refusing to merge unrelated histories"
git merge --allow-unrelated-histories release/1.1.1
```

### Conflicts during merge
```bash
# Resolve conflicts manually, then:
git add <resolved-files>
git commit
```

### Release PR conflicts with main

**Symptom:** the `release/X.Y.Z → main` PR reports conflicts on `CHANGELOG.md` and/or `package.json`, and PR Validation never starts (only Cloudflare Pages and GitGuardian report).

**Cause:** a previous release's commits reached `develop` as copies (cherry-pick or squash) rather than via a merge, so `main` isn't in `develop`'s history. Check with:
```bash
git fetch origin
git merge-base --is-ancestor origin/main origin/release/X.Y.Z || echo "main is not in release history"
```

**Fix:** merge `main` into the release branch, keeping the release branch's versions of the conflicted files. `main`'s content should already be in `develop`, so this changes history only, not the release contents. Verify before pushing:
```bash
git checkout release/X.Y.Z
git merge --no-ff --no-commit origin/main
git checkout --ours CHANGELOG.md package.json     # keep the release versions
git add CHANGELOG.md package.json
git diff --cached --stat <release-bump-commit>     # must be empty: contents unchanged
git commit -m "chore(release): merge main into release/X.Y.Z"
git push origin release/X.Y.Z
```
The back-merge in Step 4 then brings `main`'s history into `develop`, so the next release won't hit this again. (Done for 1.5.0 in `c529eb2`.)

## References

- [Gitflow Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow)
- [Semantic Versioning](https://semver.org/)
- Project Version: Check `package.json` for current version
