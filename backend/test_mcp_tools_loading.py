"""
Verifies langchain-mcp-adapters can connect to all three MCP servers
and load their tools as real, callable LangChain tools - the piece
the LangGraph supervisor will depend on next.
"""

import asyncio
import os
import sys
import time

from langchain_mcp_adapters.client import MultiServerMCPClient

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def server_path(name):
    return os.path.join(BASE_DIR, "app", "mcp_servers", name)


async def main():
    client = MultiServerMCPClient(
        {
            "slack": {
                "command": sys.executable,
                "args": [server_path("slack_server.py")],
                "transport": "stdio",
            },
            "notion": {
                "command": sys.executable,
                "args": [server_path("notion_server.py")],
                "transport": "stdio",
            },
            "drive": {
                "command": sys.executable,
                "args": [server_path("drive_server.py")],
                "transport": "stdio",
            },
        }
    )

    start = time.time()
    tools = await client.get_tools()
    elapsed = time.time() - start

    print(f"Loaded {len(tools)} tool(s) in {elapsed:.2f}s\n")
    for tool in tools:
        print(f"- {tool.name}: {tool.description.strip().splitlines()[0]}")
    print()

    expected = {"search_slack", "search_notion", "search_drive"}
    found = {tool.name for tool in tools}
    if expected != found:
        print(f"FAIL  expected tools {expected}, got {found}")
        return

    print("PASS  all three tools discovered\n")

    slack_tool = next(t for t in tools if t.name == "search_slack")
    start = time.time()
    result = await slack_tool.ainvoke({"query": "what changed about pricing", "channel": "pricing"})
    elapsed = time.time() - start

    print(f"--- invoking search_slack directly through the LangChain tool wrapper ---")
    print(f"PASS  ({elapsed:.2f}s)")
    print(result)


if __name__ == "__main__":
    asyncio.run(main())
