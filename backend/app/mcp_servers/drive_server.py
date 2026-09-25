"""
MCP server exposing search_drive - hybrid retrieval over the
Drive-style documents in Pinecone's "drive" namespace.
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

mcp = FastMCP("drive-search")


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
async def search_drive(
    query: str,
    folder: Optional[str] = None,
    filetype: Optional[str] = None,
    top_k: int = 5,
) -> str:
    """Search Drive-style documents for relevant context.

    Args:
        query: what to search for, in natural language
        folder: optional folder to narrow the search (e.g. "Sales", "HR", "Engineering")
        filetype: optional file type to narrow the search (e.g. "pdf")
        top_k: how many results to return (default 5)
    """
    vector = embed_query(query)

    filter_dict = {}
    if folder:
        filter_dict["folder"] = {"$eq": folder}
    if filetype:
        filter_dict["filetype"] = {"$eq": filetype}

    result = index.query(
        vector=vector,
        namespace="drive",
        top_k=top_k,
        include_metadata=True,
        filter=filter_dict or None,
    )

    if not result["matches"]:
        return "No matching Drive documents found."

    lines = []
    for match in result["matches"]:
        meta = match["metadata"]
        lines.append(
            f"[Drive: {meta['filename']} in {meta['folder']}] "
            f"(score {match['score']:.3f}): {meta['text']}"
        )
    return "\n".join(lines)


if __name__ == "__main__":
    mcp.run(transport="stdio")
