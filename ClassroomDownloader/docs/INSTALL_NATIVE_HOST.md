# Native Host Install

The extension talks to the Python native host through Chrome Native Messaging. The host name used by the extension is:

```txt
com.classroom_ai_exporter.host
```

## Development Setup

```sh
cd ClassroomDownloader/native
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
  "path": "/ABSOLUTE/PATH/ClassroomDownloader/native/.venv/bin/classroom-ai-host",
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
command = "python"
args = ["/ABSOLUTE/PATH/ClassroomDownloader/native/classroom_ai_exporter/mcp/server.py"]
env = { CLASSROOM_AI_ROOT = "/ABSOLUTE/PATH/ClassroomAIExport" }
startup_timeout_sec = 20
tool_timeout_sec = 300
```
