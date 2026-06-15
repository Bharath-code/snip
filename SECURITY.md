# Security Policy

## Supported Versions

The table below lists the versions of `snip` that are currently supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | ✅ Yes             |
| < 0.3.0 | ❌ No              |

## Reporting a Vulnerability

We take the security of `snip` seriously. If you find a security vulnerability, please do **not** open a public issue. Instead, follow these steps:

1. Send an email to **kumarbharath63@gmail.com** detailing the vulnerability.
2. Include steps to reproduce, potential impact, and any suggested fixes.
3. We will acknowledge your report within 48 hours and work with you to coordinate a security release.

## Snippet Execution & Safety
`snip` includes built-in warning checks for potentially destructive commands (e.g. `rm -rf /`, fork bombs, curl-pipe-bash). While these warnings help prevent accidents, always inspect third-party packs before installing them.
