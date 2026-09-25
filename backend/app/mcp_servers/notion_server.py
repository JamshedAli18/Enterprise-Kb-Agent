"""
MCP server exposing search_notion - hybrid retrieval over the
Notion-style pages in Pinecone's "notion" namespace.
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

mcp = FastMCP("notion-search")


def embed_query(text: str) -> list[float]:
    res = co.embed(
        texts=[text],
        model="embed-v4.0",
        input_type="search_query",
        output_dimension=1024,
        embedding_types=["float"],
    )
    return res.embeddings.float[0]


@mcp.tool()
async def search_notion(
    query: str,
    page: Optional[str] = None,
    top_k: int = 5,
) -> str:
    """Search Notion-style policy and planning pages for relevant context.

    Args:
        query: what to search for, in natural language
        page: optional exact page title to narrow the search (e.g. "Remote Work Policy")
        top_k: how many results to return (default 5)
    """
    vector = embed_query(query)

    filter_dict = {}
    if page:
        filter_dict["page"] = {"$eq": page}

    result = index.query(
        vector=vector,
        namespace="notion",
        top_k=top_k,
        include_metadata=True,
        filter=filter_dict or None,
    )

    if not result["matches"]:
        return "No matching Notion pages found."

    lines = []
    for match in result["matches"]:
        meta = match["metadata"]
        lines.append(
            f"[Notion: {meta['page']} - {meta['author']}, last edited {meta['date']}] "
            f"(score {match['score']:.3f}): {meta['text']}"
        )
    return "\n".join(lines)


if __name__ == "__main__":
    mcp.run(transport="stdio")
