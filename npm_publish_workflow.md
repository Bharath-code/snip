Local publish (quick):
   1. Bump version and create a git tag:
    - npm version patch -m "Release v%s"
    - git push && git push --tags
   2. Validate package:
    - npm publish --dry-run
   3. Log in and publish:
    - npm login
    - npm publish --access public
  CI-based publish (recommended for reproducible releases):
   1. Create a GitHub secret NPM_TOKEN (from npmjs.com).
   2. Add this GitHub Action (asks to confirm if you want me to create it):
    - .github/workflows/publish.yml
    - Uses actions/setup-node and npm publish when a git tag is pushed, authenticating with ${{ secrets.NPM_TOKEN }}.
  Tell me if you want the publish workflow added now (I’ll create the workflow file and show how to set NPM_TOKEN).

  Creating a GitHub Actions workflow that publishes the package to npm when a git tag like v1.2.3 is pushed, using the NPM_TOKEN secret for authentication.
  Workflow added at .github/workflows/publish.yml — set a repository secret named NPM_TOKEN (value from npmjs.com) and push a tag (e.g., git tag v0.1.0 && git push --tags) to
  trigger release.