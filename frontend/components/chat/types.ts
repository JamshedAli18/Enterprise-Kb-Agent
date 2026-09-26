import type { DoneEvent, ErrorEvent } from "@/lib/api";

export type UserMessage = {
  id: string;
  role: "user";
  content: string;
  via: "text" | "voice";
  /** Voice messages wait for the transcript event before they have content. */
  transcribing?: boolean;
};

export type AssistantMessage = {
  id: string;
  role: "assistant";
  content: string;
  status: "pending" | "streaming" | "done" | "stopped" | "error";
  /** Text question that produced this answer, used for retry. */
  question?: string;
  error?: ErrorEvent;
  meta?: DoneEvent;
  audioUrl?: string;
};

export type Message = UserMessage | AssistantMessage;
