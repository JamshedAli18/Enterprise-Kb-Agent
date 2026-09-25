"""
Loads the three mock datasets, embeds them with Cohere (1024-dim,
matching what test_all_keys.py verified), and upserts each into its
own Pinecone namespace inside one shared index.

Then runs one retrieval smoke test per namespace so we are not just
trusting that upsert did not error - we confirm the right chunk comes
back for an obvious query.
"""

import json
import os
import time

import cohere
from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec

load_dotenv()

COHERE_API_KEY = os.getenv("COHERE_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "enterprise-kb-agent")
DIMENSION = 1024

co = cohere.ClientV2(api_key=COHERE_API_KEY)
pc = Pinecone(api_key=PINECONE_API_KEY)


def embed(texts, input_type):
    res = co.embed(
        texts=texts,
        model="embed-v4.0",
        input_type=input_type,
        output_dimension=DIMENSION,
        embedding_types=["float"],
    )
    return res.embeddings.float


def ensure_index():
    if not pc.has_index(INDEX_NAME):
        print(f"Creating index '{INDEX_NAME}' ...")
        pc.create_index(
            name=INDEX_NAME,
            dimension=DIMENSION,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
        while not pc.describe_index(INDEX_NAME).status["ready"]:
            time.sleep(1)
    else:
        print(f"Reusing existing index '{INDEX_NAME}'")
    return pc.Index(INDEX_NAME)


def load(path):
    with open(path, "r", encoding="utf-8-sig") as f:
        return json.load(f)


def date_to_num(date_str):
    # "2026-03-10" -> 20260310, so Pinecone's numeric $gte/$lte can filter on it
    return int(date_str.replace("-", ""))


def ingest_slack(index):
    items = load("data/slack_messages.json")
    texts = [item["text"] for item in items]
    vectors = embed(texts, input_type="search_document")
    upserts = [
        {
            "id": f"slack-{item['id']}",
            "values": vec,
            "metadata": {
                "source": "slack",
                "channel": item["channel"],
                "author": item["author"],
                "date": item["date"],
                "date_num": date_to_num(item["date"]),
                "text": item["text"],
            },
        }
        for item, vec in zip(items, vectors)
    ]
    index.upsert(vectors=upserts, namespace="slack")
    return len(upserts)


def ingest_notion(index):
    items = load("data/notion_pages.json")
    texts = [item["body"] for item in items]
    vectors = embed(texts, input_type="search_document")
    upserts = [
        {
            "id": f"notion-{item['id']}",
            "values": vec,
            "metadata": {
                "source": "notion",
                "page": item["page_title"],
                "author": item["author"],
                "date": item["last_edited"],
                "text": item["body"],
            },
        }
        for item, vec in zip(items, vectors)
    ]
    index.upsert(vectors=upserts, namespace="notion")
    return len(upserts)


def ingest_drive(index):
    items = load("data/drive_docs.json")
    texts = [item["content"] for item in items]
    vectors = embed(texts, input_type="search_document")
    upserts = [
        {
            "id": f"drive-{item['id']}",
            "values": vec,
            "metadata": {
                "source": "drive",
                "filename": item["filename"],
                "folder": item["folder"],
                "text": item["content"],
            },
        }
        for item, vec in zip(items, vectors)
    ]
    index.upsert(vectors=upserts, namespace="drive")
    return len(upserts)


def smoke_test(index, namespace, query):
    vec = embed([query], input_type="search_query")[0]
    result = index.query(
        vector=vec,
        namespace=namespace,
        top_k=1,
        include_metadata=True,
    )
    match = result["matches"][0]
    print(f"      query: {query!r}")
    print(f"      top match ({match['score']:.3f}): {match['metadata']['text'][:80]!r}")


def main():
    index = ensure_index()

    for label, fn, test_query in [
        ("slack", ingest_slack, "what changed about pricing"),
        ("notion", ingest_notion, "how many days can I work remotely"),
        ("drive", ingest_drive, "what is the enterprise pricing"),
    ]:
        start = time.time()
        count = fn(index)
        elapsed = time.time() - start
        print(f"PASS  ingested {count} {label} chunks  ({elapsed:.2f}s)")
        smoke_test(index, label, test_query)
        print()


if __name__ == "__main__":
    main()
