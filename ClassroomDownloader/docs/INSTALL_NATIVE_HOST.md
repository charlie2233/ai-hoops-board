# Native Host Install

The extension talks to the Python native host through Chrome Native Messaging. The host name used by the extension is:

```txt
com.classroom_ai_exporter.host
```

## Development Setup

Run these commands from the standalone repository root:

```sh
cd native
python3 -m venv .venv
. .venv/bin/activate
pip install -e .
```

Set the archive root:

```sh
export CLASSROOM_AI_ROOT="$HOME/ClassroomAIExport"
```

Smoke-test the host handler directly:

```sh
python -m classroom_ai_exporter.mcp.server
```

## Dev Installer

After building/loading the unpacked extension, copy its extension id from `chrome://extensions` and run:

```sh
cd native
python3 -m classroom_ai_exporter.install_native_host \
  --extension-id EXTENSION_ID \
  --archive-root "$HOME/ClassroomAIExport"
```

The installer writes a small executable wrapper under `native/.native-host/` and writes Chrome's native messaging manifest for `com.classroom_ai_exporter.host`.

If the logged-in Chrome profile is school-managed and blocks unpacked extensions, load the extension in a personal Chromium-compatible browser profile and point the installer at that browser's NativeMessagingHosts directory:

```sh
python3 -m classroom_ai_exporter.install_native_host \
  --extension-id EXTENSION_ID \
  --archive-root "$HOME/ClassroomAIExport" \
  --manifest-dir "$HOME/Library/Application Support/Chromium/NativeMessagingHosts"
```

For Chrome for Testing on macOS, use:

```sh
python3 -m classroom_ai_exporter.install_native_host \
  --extension-id EXTENSION_ID \
  --archive-root "$HOME/ClassroomAIExport" \
  --manifest-dir "$HOME/Library/Application Support/Google/Chrome for Testing/NativeMessagingHosts"
```

## Chrome Host Manifest

Chrome needs a native messaging manifest outside the repo. For development, create:

```txt
~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.classroom_ai_exporter.host.json
```

Example content:

```json
{
  "name": "com.classroom_ai_exporter.host",
  "description": "Classroom AI Exporter native host",
  "path": "/ABSOLUTE/PATH/classroom-ai-exporter/native/.native-host/classroom-ai-host",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://EXTENSION_ID/"
  ]
}
```

Replace `EXTENSION_ID` after loading the unpacked extension.

## Codex MCP Config

```toml
[mcp_servers.classroom_ai]
command = "classroom-ai-mcp"
args = []
env = { CLASSROOM_AI_ROOT = "/ABSOLUTE/PATH/ClassroomAIExport" }
startup_timeout_sec = 20
tool_timeout_sec = 300
```
