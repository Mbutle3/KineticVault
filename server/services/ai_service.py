from __future__ import annotations

# TODO: Integrate Claude API for actual AI command processing.
# Suggested integration path:
#   1. pip install anthropic
#   2. Set ANTHROPIC_API_KEY environment variable
#   3. Replace the stub below with a real messages.create() call
#
# Example:
#   import anthropic
#   client = anthropic.Anthropic()
#   response = client.messages.create(
#       model="claude-opus-4-6",
#       max_tokens=1024,
#       system="You are an AI file system assistant...",
#       messages=[{"role": "user", "content": command}],
#   )
#   return {"action": "...", "message": response.content[0].text, "result": None}


QUICK_ACTION_STUBS = {
    "find recent files": {
        "action": "find_recent",
        "message": "Here are your most recently modified files.",
        "result": ["report.pdf", "notes.md", "config.json"],
    },
    "show largest files": {
        "action": "find_largest",
        "message": "Here are the largest files on disk.",
        "result": ["backup.tar.gz (4.2 GB)", "video.mp4 (1.8 GB)", "archive.zip (900 MB)"],
    },
    "summarize this file": {
        "action": "summarize",
        "message": "AI summarization is not yet connected. Wire up the Claude API to enable this.",
        "result": None,
    },
}


class AIService:
    def process_command(self, command: str, context=None) -> dict:
        # TODO: Replace stub with real Claude API call (see module docstring above)
        normalized = command.strip().lower()
        if normalized in QUICK_ACTION_STUBS:
            return QUICK_ACTION_STUBS[normalized]

        return {
            "action": "echo",
            "message": f'Received: "{command}". AI integration pending — add your Claude API key to enable smart responses.',
            "result": None,
        }
