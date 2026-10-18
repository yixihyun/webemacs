# WebEmacs Starter 0.1

A small browser-based editor prototype built with CodeMirror 6 and a local Node.js file API. Designed for Windows, WSL2 Ubuntu, and macOS.

## Requirements

- Node.js 20 or newer (Node.js 22 LTS recommended)
- npm

## Run in development

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173 in your browser. The frontend uses port 5173 and the local file API uses port 4179. Keep the terminal running while you use the editor.

## Workspace and safety

The backend only exposes files under `workspace/` by default. To use another folder, set `WEBEMACS_WORKSPACE` before starting the backend.

macOS/Linux:

```bash
WEBEMACS_WORKSPACE="$HOME/Documents/WebEmacs" npm run dev
```

Windows PowerShell:

```powershell
$env:WEBEMACS_WORKSPACE = "$HOME\Documents\WebEmacs"
npm run dev
```

Do not expose the backend port to a public network. This prototype is intended for local use only. It does not yet provide authentication, terminal execution, plugin sandboxing, or a Lisp runtime.

## Included in this prototype

- CodeMirror 6 editor
- Vim Normal/Insert/Visual keymap via `@replit/codemirror-vim`
- Korean IME-friendly browser text input (test with your browser/OS)
- Local workspace file listing, open, and save
- `:w [filename]`, `:e filename`, `:new`, `:q`, `:help`
- Ctrl/Cmd+S save shortcut
- Responsive dark UI

## Current limitations

- File browser lists only the top-level workspace; nested files can be opened by entering a relative path in `:e`.
- `:q` resets to a new scratch buffer after checking for unsaved changes; it does not close the browser tab.
- This is a starter prototype, not a full Emacs replacement. Emacs Lisp, Org mode, Git UI, and AI agents are planned extension points, not implemented features yet.
