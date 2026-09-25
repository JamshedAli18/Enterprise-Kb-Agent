"""
Standalone test client for the three MCP servers - launches each as a
subprocess over stdio and calls its tool directly, so we can verify
correctness and latency before wiring anything into LangGraph.
"""

import asyncio
import time

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def call_server(script_path, tool_name, tool_args):
    params = StdioServerParameters(command="python", args=[script_path])
    start = time.time()
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, arguments=tool_args)
            elapsed = time.time() - start
            text_blocks = [block.text for block in result.content if hasattr(block, "text")]
            return "\n".join(text_blocks), elapsed


async def main():
    tests = [
        ("app/mcp_servers/slack_server.py", "search_slack",
         {"query": "what changed about pricing", "channel": "pricing"}),
        ("app/mcp_servers/notion_server.py", "search_notion",
         {"query": "how many days can I work remotely"}),
        ("app/mcp_servers/drive_server.py", "search_drive",
         {"query": "what is the enterprise pricing", "folder": "Sales"}),
    ]
    for script_path, tool_name, args in tests:
        print(f"--- {tool_name}  args={args} ---")
        try:
            output, elapsed = await call_server(script_path, tool_name, args)
            print(f"PASS  ({elapsed:.2f}s)")
            print(output)
        except Exception as e:
            print(f"FAIL  {type(e).__name__}: {e}")
        print()


if __name__ == "__main__":
    asyncio.run(main())
