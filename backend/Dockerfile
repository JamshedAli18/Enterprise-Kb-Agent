FROM python:3.12-slim

WORKDIR /app

# Install dependencies first (separate layer) so code changes don't force a
# full reinstall every rebuild.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Only the runtime app goes into the image -- data/, test_*.py, and the
# ingestion script are one-time/local-only (Pinecone already holds the
# ingested vectors; the MCP servers query Pinecone over the API, not the
# local JSON files).
COPY app ./app

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# Render assigns the port dynamically via $PORT; default to 8000 for local
# `docker run` testing where $PORT won't be set.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
