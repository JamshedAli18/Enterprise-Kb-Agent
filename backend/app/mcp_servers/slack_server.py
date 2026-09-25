"""
MCP server exposing search_slack - hybrid retrieval (vector search +
metadata filter) over the Slack-style data in Pinecone's "slack" namespace.
"""

import os
from typing import Optional

import cohere
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP
from pinecone import Pinecone

load_dotenv()

co = cohere.ClientV2(api_key=os.getenv("COHERE_API_KEY"))
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index(os.getenv("PINECONE_INDEX_NAME", "enterprise-kb-agent"))

mcp = FastMCP("slack-search")


def embed_query(text: str) -> list[float]:
    res = co.embed(
        texts=[text],
        model="embed-v4.0",
        input_type="search_query",
        output_dimension=1024,
        embedding_types=["float"],
    )
    return res.embeddings.float[0]


def date_to_num(date_str: str) -> int:
    return int(date_str.replace("-", ""))


@mcp.tool()
async def search_slack(
    query: str,
    channel: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    top_k: int = 5,
) -> str:
    """Search Slack-style team messages for relevant context.

    Args:
        query: what to search for, in natural language
        channel: optional channel to narrow the search (e.g. "pricing", "engineering", "hr")
        date_from: optional ISO date (YYYY-MM-DD), only messages on/after this date
        date_to: optional ISO date (YYYY-MM-DD), only messages on/before this date
        top_k: how many results to return (default 5)
    """
    vector = embed_query(query)

    filter_dict = {}
    if channel:
        filter_dict["channel"] = {"$eq": channel}
    if date_from or date_to:
        date_filter = {}
        if date_from:
            date_filter["$gte"] = date_to_num(date_from)
        if date_to:
            date_filter["$lte"] = date_to_num(date_to)
        filter_dict["date_num"] = date_filter

    result = index.query(
        vector=vector,
        namespace="slack",
        top_k=top_k,
        include_metadata=True,
        filter=filter_dict or None,
    )

    if not result["matches"]:
        return "No matching Slack messages found."

    lines = []
    for match in result["matches"]:
        meta = match["metadata"]
        lines.append(
            f"[Slack #{meta['channel']} - {meta['author']}, {meta['date']}] "
            f"(score {match['score']:.3f}): {meta['text']}"
        )
    return "\n".join(lines)


if __name__ == "__main__":
    mcp.run(transport="stdio")
