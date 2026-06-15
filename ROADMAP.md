# 🏔️ snip — Product & Technical Roadmap

This document outlines the short-term, medium-term, and long-term milestones for `snip`. We welcome contributions and feedback on any of these areas!

---

## 📅 v0.4.0 — Extensibility & AI Era Memory (Current)
- [x] **Model Context Protocol (MCP) Server**: Complete integration for AI agents (Claude Code, Cursor) to search, execute, and save snippets.
- [x] **Shell History Watcher**: Background watch daemon to suggest saving repeated commands.
- [x] **Local Fallback for Snippet Packs**: Out-of-the-box snippet packs for Git, Docker, Kubernetes, etc.
- [x] **Snippet Versioning & Undo**: Local SQLite/JSON history tracking with safe rollback.
- [x] **Editor Extensions**: Prototypes for VS Code and Neovim to pipe text buffers.

---

## 📅 v0.5.0 — UI/UX & Native Desktop Tools (Next)
- [ ] **Modern Web Dashboard**: A local desktop Web UI (via a simple server command `snip dashboard`) to visual search, edit, and export snippets.
- [ ] **Production Editor Extensions**: Publish VS Code and Neovim integrations to their respective extension marketplaces.
- [ ] **Interactive Widgets**: Support custom inputs/form controls for snippet parameters in the TUI.

---

## 📅 v0.6.0 — Enterprise Sharing & Sync
- [ ] **Collaborative Shared Libraries**: Secure, encrypted team snippet sync using custom secure servers or self-hosted Git repositories.
- [ ] **Role-Based Access (RBAC)**: Read-only locks for specific team snippet categories.
- [ ] **Secure Secret Vaulting**: Encrypting sensitive parameter keys and environment variables in snippets using system keychains.

---

## 💡 How to Contribute
Please check our [CONTRIBUTING.md](./CONTRIBUTING.md) to get started! If you want to work on a roadmap item, open a GitHub issue to discuss the design.
