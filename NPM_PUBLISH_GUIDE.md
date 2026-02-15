# NPM Publication Guide for `snip-cli-manager`

This guide outlines the final steps to publish your CLI tool to the npm registry.

## 1. Final Package Check

I have already performed the following:
- [x] **Name Check**: Changed `package.json` name to `snip-cli-manager` (as `snip` and `snip-cli` are taken).
- [x] **License**: Added a standard MIT [LICENSE](./LICENSE) file.
- [x] **Shebang**: Verified `bin/snip` starts with `#!/usr/bin/env node`.
- [x] **Metadata**: Populated `keywords`, `repository`, `author`, and `description` in `package.json`.
- [x] **README**: Polished [README.md](./README.md) with clear installation and usage instructions.
- [x] **Ignore List**: Verified `.npmignore` excludes tests and development config.

## 2. Manual Verification (Dry Run)

Before publishing for real, verify what files will be included:

```bash
npm publish --dry-run
```

Check the output to ensure `lib/`, `bin/`, `package.json`, `README.md`, and `LICENSE` are included, while `__tests__/` and `.github/` are ignored.

## 3. Account Setup

If you haven't already:
1. Create an account on [npmjs.com](https://www.npmjs.com/).
2. Log in from your terminal:
   ```bash
   npm login
   ```

## 4. Method A: Manual Publication (Simple)

Run these commands from the root directory:

```bash
# 1. Bump version and create a git tag (e.g., v0.1.0)
npm version patch -m "Release v%s"

# 2. Push to GitHub (including tags)
git push && git push --tags

# 3. Publish to npm
npm publish --access public
```

## 5. Method B: GitHub Actions (Recommended)

I have already configured a GitHub Action at [.github/workflows/publish.yml](.github/workflows/publish.yml). To use it:

1. **Get an NPM Token**:
   - Go to [npmjs.com/settings/tokens](https://www.npmjs.com/settings/tokens).
   - Generate a new "Classic Token" with **Automation** access.
2. **Add to GitHub Secrets**:
   - Go to your GitHub repository settings.
   - Navigate to **Secrets and variables > Actions**.
   - Add a new secret named `NPM_TOKEN` with your token as the value.
3. **Trigger the Release**:
   - Simply push a new tag starting with `v` (e.g., `git tag v0.1.0 && git push --tags`).
   - GitHub Actions will automatically run tests and publish if they pass.

## 6. Testing the Published Package

Once published, you can test it by installing it globally:

```bash
npm install -g snip-cli-manager
snip --version
```

---

**Pro Tip**: If you decide to change the name again, remember to update both `package.json` and `README.md` before publishing!
