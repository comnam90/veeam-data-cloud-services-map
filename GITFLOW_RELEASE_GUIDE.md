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
# Update version in package.json
# Change "version": "1.1.0" to "version": "1.1.1"

# Commit the version bump
git add package.json
git commit -m "chore(release): bump version to 1.1.1"

# Optional: Run tests to verify everything works
npm ci
npm test
npm run build
```

### Step 3: Merge Release to Main

The release branch should be merged to `main` via a Pull Request:

```bash
# Push release branch
git push origin release/1.1.1

# Create PR: release/1.1.1 → main
# Title: "Release v1.1.1"
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

After PR is merged to main:
```bash
# Tag the release on main
git checkout main
git pull origin main
git tag -a v1.1.1 -m "Release version 1.1.1"
git push origin v1.1.1
```

### Step 4: Merge Release Back to Develop

After merging to `main`, merge the release changes back to `develop`:

**Option A: Via Pull Request (Recommended)**
```bash
# The release branch already has the version bump
# Create PR: release/1.1.1 → develop (or cherry-pick to new branch)

# If cherry-picking:
git checkout develop
git pull origin develop
git checkout -b chore/merge-release-1.1.1-to-develop
git cherry-pick <release-version-bump-commit-sha>
git push origin chore/merge-release-1.1.1-to-develop

# Create PR: chore/merge-release-1.1.1-to-develop → develop
```

**Option B: Direct Merge**
```bash
# Only if you have direct push access
git checkout develop
git pull origin develop
git merge --no-ff release/1.1.1 -m "chore: merge release/1.1.1 back to develop"
git push origin develop
```

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

### Step 5: Cleanup (Optional)

```bash
# Delete the release branch locally and remotely
git branch -d release/1.1.1
git push origin --delete release/1.1.1
```

## Complete Example

Here's a complete example for releasing version 1.1.1:

```bash
# 1. Create release branch
git checkout develop
git checkout -b release/1.1.1

# 2. Bump version
# Edit package.json: "version": "1.1.1"
git add package.json
git commit -m "chore(release): bump version to 1.1.1"

# 3. Push and create PR to main
git push origin release/1.1.1
# Create PR: release/1.1.1 → main

# 4. After PR merged to main, tag the release
git checkout main
git pull origin main
git tag -a v1.1.1 -m "Release version 1.1.1"
git push origin v1.1.1

# 5. Merge back to develop
git checkout develop
git pull origin develop
git cherry-pick <version-bump-commit>
git push origin develop
# Or create PR with the cherry-picked commit

# 6. Cleanup
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

## Current Release Status

For the v1.1.1 release:

✅ **Step 1**: Release branch created from develop
✅ **Step 2**: Version bumped to 1.1.1  
✅ **Step 3**: Ready to merge to main (via current PR)
⏳ **Step 4**: After main merge, needs to merge back to develop
⏳ **Step 5**: Cleanup release branch

## Best Practices

1. **Always use PRs**: Even for develop, use PRs for review and CI/CD
2. **Test thoroughly**: Run full test suite before creating release
3. **Document changes**: Update CHANGELOG if present
4. **Tag releases**: Always tag releases on main for easy reference
5. **Consistent naming**: Use `release/X.Y.Z` format for release branches
6. **Clean history**: Use `--no-ff` for merge commits to preserve release history

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

### Cherry-pick conflicts
```bash
# If cherry-picking causes conflicts:
git cherry-pick --abort
# Then manually apply the changes and commit
```

## References

- [Gitflow Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow)
- [Semantic Versioning](https://semver.org/)
- Project Version: Check `package.json` for current version
