"""
app/main.py -- FastAPI app exposing the knowledge-base agent over HTTP.

GET  /health      -> basic liveness check
POST /chat        -> text in, streamed text answer out (SSE), with
                      thread_id-based multi-turn memory.
POST /voice-chat   -> audio in (multipart upload), streamed as SSE:
                        event: transcript  -> what Whisper heard
                        data: {token}      -> streamed answer text (same as /chat)
                        event: done        -> metadata + base64 mp3 of the
                                              spoken answer (Deepgram TTS)

v2 fix: a follow-up voice request crashed the connection mid-stream with no
explanation (httpx saw "peer closed connection without sending complete
message body"). Root cause: neither streaming generator had any error
handling, so any exception deep in the pipeline (both LLM providers rate
limited, a TTS failure, etc.) just killed the SSE stream silently. Both
generators are now wrapped so a failure is surfaced as a clean
"event: error" instead of a dropped connection -- this also means we no
longer need the server-side log to see what went wrong, it'll show up
directly in the client output.

The graph is built once at startup (app.state.graph) via FastAPI's lifespan
handler, so the MCP tool client and checkpointer aren't reloaded per request.
"""

import base64
import json
import uuid
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.graph import create_app_graph
from app.voice import synthesize_speech_bytes, transcribe_audio_bytes


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Startup: loading MCP tools and building graph...")
    app.state.graph = await create_app_graph()
    print("Startup complete: graph ready.")
    yield


app = FastAPI(title="Enterprise Knowledge-Base Agent", lifespan=lifespan)


class ChatRequest(BaseModel):
    question: str
    thread_id: Optional[str] = None


@app.get("/health")
async def health():
    return {"status": "ok"}


def build_done_event(final_state: dict, thread_id: str, extra: Optional[dict] = None) -> str:
    meta = {
        "thread_id": thread_id,
        "router_used": final_state.get("router_used"),
        "decision": final_state.get("decision"),
        "synth_used": final_state.get("synth_used"),
        "routing_time": final_state.get("routing_time"),
        "retrieval_time": final_state.get("retrieval_time"),
        "synthesis_time": final_state.get("synthesis_time"),
    }
    if extra:
        meta.update(extra)
    return f"event: done\ndata: {json.dumps(meta)}\n\n"


def build_error_event(exc: Exception) -> str:
    payload = {"message": str(exc), "type": type(exc).__name__}
    return f"event: error\ndata: {json.dumps(payload)}\n\n"


async def run_graph_streaming(graph, question: str, thread_id: str):
    """Runs the graph, yielding ('token', str) as they stream and finally
    ('final_state', dict) once complete."""
    final_state = {}
    config = {"configurable": {"thread_id": thread_id}}
    async for mode, payload in graph.astream({"question": question}, config=config, stream_mode=["custom", "values"]):
        if mode == "custom":
            yield "token", payload
        elif mode == "values":
            final_state = payload
    yield "final_state", final_state


async def stream_answer(graph, question: str, thread_id: str):
    final_state = {}
    try:
        async for kind, payload in run_graph_streaming(graph, question, thread_id):
            if kind == "token":
                yield f"data: {json.dumps({'token': payload})}\n\n"
            else:
                final_state = payload
        yield build_done_event(final_state, thread_id)
    except Exception as e:
        yield build_error_event(e)


async def stream_voice_answer(graph, audio_bytes: bytes, thread_id: str):
    try:
        transcript = transcribe_audio_bytes(audio_bytes)
        yield f"event: transcript\ndata: {json.dumps({'text': transcript})}\n\n"

        final_state = {}
        async for kind, payload in run_graph_streaming(graph, transcript, thread_id):
            if kind == "token":
                yield f"data: {json.dumps({'token': payload})}\n\n"
            else:
                final_state = payload

        answer = final_state.get("answer", "")
        audio_out = synthesize_speech_bytes(answer) if answer.strip() else b""
        audio_b64 = base64.b64encode(audio_out).decode("utf-8")

        yield build_done_event(final_state, thread_id, extra={
            "transcript": transcript,
            "answer_audio_base64": audio_b64,
        })
    except Exception as e:
        yield build_error_event(e)


@app.post("/chat")
async def chat(request: ChatRequest):
    graph = app.state.graph
    thread_id = request.thread_id or str(uuid.uuid4())
    return StreamingResponse(
        stream_answer(graph, request.question, thread_id),
        media_type="text/event-stream",
    )


@app.post("/voice-chat")
async def voice_chat(file: UploadFile = File(...), thread_id: Optional[str] = Form(None)):
    graph = app.state.graph
    resolved_thread_id = thread_id or str(uuid.uuid4())
    audio_bytes = await file.read()
    return StreamingResponse(
        stream_voice_answer(graph, audio_bytes, resolved_thread_id),
        media_type="text/event-stream",
    )
