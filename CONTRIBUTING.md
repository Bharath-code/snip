# Contributing to snip

Thank you for your interest in contributing to snip!

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to keep our community approachable and respectable.

## How Can I Contribute?

### Reporting Bugs

1. **Search existing issues** — Check if the bug has already been reported
2. **Use the bug template** — Include detailed steps to reproduce
3. **Include context** — OS, Node.js version, and snip version

### Suggesting Features

1. **Check existing discussions** — Maybe someone already proposed it
2. **Use the feature request template** — Describe the problem and solution
3. **Explain use cases** — How would you use this feature?

### Pull Requests

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/my-feature`
3. **Make your changes** — Follow the coding standards
4. **Add tests** — If applicable
5. **Commit with clear messages**: `git commit -m 'Add feature: description'`
6. **Push and create PR**: `git push origin feature/my-feature`

## Development Setup

```bash
# Clone the repository
git clone https://github.com/bharath/snip.git
cd snip

# Install dependencies
npm install

# Run tests
npm test

# Run in development mode
node bin/snip --help
```

## Coding Standards

- Use 2 spaces for indentation
- Add comments for complex logic
- Keep functions small and focused
- Test your changes before submitting

## Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:
```
feat(add): Add --tags flag to snip add command

Allows users to add multiple tags when creating a snippet.

Closes #123
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
