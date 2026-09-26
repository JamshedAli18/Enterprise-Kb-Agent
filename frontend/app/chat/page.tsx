import type { Metadata } from "next";
import ChatApp from "@/components/chat/chat-app";

export const metadata: Metadata = {
  title: "Chat — Enterprise KB Agent",
  description: "Ask questions across Slack, Notion and Google Drive, by text or voice.",
};

export default function ChatPage() {
  return <ChatApp />;
}
