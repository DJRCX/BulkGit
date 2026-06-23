<div align="center">

<img src="src-tauri/icons/128x128@2x.png" alt="BulkGit logo" width="80" height="80" />

# BulkGit

**Monitor, manage, and operate all your Git repositories — at once.**

[![Release](https://img.shields.io/github/v/release/DJRCX/BulkGit?style=flat-square&color=e85d04)](https://github.com/DJRCX/BulkGit/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Built with Tauri](https://img.shields.io/badge/Built%20with-Tauri%202-24C8D8?style=flat-square)](https://tauri.app)

</div>

---

BulkGit is a **desktop Git manager** built with Tauri + React. It scans your filesystem for Git repositories and presents them in a unified, fast interface — letting you fetch, pull, commit, switch branches, stash, and resolve merge conflicts across dozens of repos simultaneously.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🗂 **Multi-repo Scan** | Recursively scan any directory for Git repos |
| 🔄 **Bulk Fetch / Pull** | Run fetch or pull across all selected repos with configurable concurrency |
| 📊 **Live Status** | See sync status (ahead, behind, diverged, auth error) at a glance |
| 🌿 **Branch Switching** | Switch branches on multiple repos simultaneously |
| 📦 **Bulk Stash** | Stash local changes across multiple repos at once |
| 💬 **Bulk Commit & Push** | Stage, commit, and push to multiple repos in one action |
| 🔍 **Diff Viewer** | Slide-over panel showing changed files and unified diffs |
| ⚔️ **Merge Conflict Resolver** | Visual 3-way merge editor to resolve conflicts file-by-file |
| 🔎 **Filter & Search** | Filter by sync status or search by repo name/path/branch |
| 🗂 **Workspace Groups** | Organise repos into named groups for focused workflows |
| 🌑 **Themes** | AMOLED Dark, Tokyo Night, Tokyo Night Light |
| ⌨️ **Keyboard Shortcuts** | Full keyboard navigation and shortcut support |

---

## 📦 Installation

Download the latest installer from the [**Releases**](https://github.com/DJRCX/BulkGit/releases/latest) page.

| Platform | Installer |
|----------|-----------|
| 🪟 Windows | `.msi` installer |
| 🐧 Linux | `.deb` (Debian/Ubuntu) or `.AppImage` |

> **Prerequisites:**
> - [Git CLI](https://git-scm.com/downloads) — required for terminal operations and SSH authentication
> - SSH Agent (optional) — required for private repositories over SSH

BulkGit will check your environment on first launch and guide you through any missing dependencies.

---

## 🚀 Quick Start

1. Launch BulkGit
2. Click **Scan** in the toolbar and select a root directory (e.g. `~/Work` or `C:\Projects`)
3. BulkGit discovers all Git repos inside and displays their status
4. Select repos using checkboxes, then use the **Command Bar** to fetch, pull, commit, or switch branches

---

## 🛠 Building from Source

### Prerequisites

- [Node.js](https://nodejs.org) ≥ 18
- [Rust](https://rustup.rs) stable toolchain
- Platform-specific Tauri system dependencies:
  - **Linux:** `sudo dnf install gtk3-devel webkit2gtk4.1-devel openssl-devel` (Fedora) or `sudo apt-get install libwebkit2gtk-4.1-dev libssl-dev` (Ubuntu)
  - **Windows:** [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) + [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

```bash
# Clone
git clone https://github.com/DJRCX/BulkGit.git
cd BulkGit

# Install dependencies
npm install

# Start dev server
npm run tauri dev

# Build release
npm run tauri build
```

---

## 🏗 Architecture

```
BulkGit/
├── src/                  # React frontend (TypeScript)
│   ├── components/       # UI components
│   ├── store/            # Zustand state management
│   ├── hooks/            # Custom React hooks
│   └── styles/           # Global CSS (CSS variables / theming)
├── src-tauri/            # Rust backend (Tauri)
│   ├── src/
│   │   ├── commands.rs   # Tauri command handlers
│   │   ├── git_worker.rs # Git operations (libgit2)
│   │   └── scanner.rs    # Repository discovery
│   └── icons/            # Application icons
└── .github/workflows/    # CI/CD release automation
```

---

## 🤝 Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push and open a Pull Request

---

## 📄 License

[MIT](LICENSE) — © DJRCX