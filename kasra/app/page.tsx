"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Wallet as WalletWrapper } from "@coinbase/onchainkit/wallet";

type ChatRole = "user" | "agent";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "agent",
      content:
        "Saya KASRA. Tanyakan Saldo, ringkasan Pengeluaran, atau minta saya siapkan transfer IDRX.",
      createdAt: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => {
    return !isLoading && input.trim().length > 0;
  }, [input, isLoading]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isLoading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");

    const userMessage: ChatMessage = {
      id: uid(),
      role: "user",
      content: text,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Request failed (${res.status})`);
      }

      const data: unknown = await res.json();

      let reply = "";
      if (typeof data === "string") {
        reply = data;
      } else if (isRecord(data)) {
        const candidates: Array<unknown> = [
          data.reply,
          data.message,
          data.text,
          data.result,
          data.output,
          data.content,
        ];
        const firstString = candidates.find((v) => typeof v === "string");
        reply = typeof firstString === "string" ? firstString : JSON.stringify(data);
      } else {
        reply = JSON.stringify(data);
      }

      const agentMessage: ChatMessage = {
        id: uid(),
        role: "agent",
        content: reply,
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, agentMessage]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "agent",
          content:
            "Maaf, terjadi kendala saat memproses permintaan. Coba lagi sebentar.",
          createdAt: Date.now(),
        },
      ]);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-dvh min-h-screen flex-col bg-zinc-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
          <h1 className="text-base font-semibold tracking-tight text-zinc-900">
            KASRA Financial
          </h1>

          <div className="flex items-center">
            <WalletWrapper />
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden px-4">
        <div className="flex-1 overflow-y-auto py-4">
          <div className="flex flex-col gap-3">
            {messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={[
                      "max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm",
                      isUser
                        ? "bg-blue-600 text-white"
                        : "bg-white text-zinc-900 ring-1 ring-black/5",
                    ].join(" ")}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
              );
            })}

            {isLoading ? (
              <div className="flex w-full justify-start">
                <div className="max-w-[85%] rounded-2xl bg-white px-4 py-2 text-sm text-zinc-600 ring-1 ring-black/5">
                  Thinking...
                </div>
              </div>
            ) : null}

            <div ref={scrollRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="sticky bottom-0 border-t border-black/5 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="py-3">
            <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 py-2 shadow-sm">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                disabled={isLoading}
                placeholder={isLoading ? "Thinking..." : "Tulis pesan…"}
                className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-500 disabled:opacity-60"
                aria-label="Message input"
              />

              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!canSend}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                {/* Paper plane icon */}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3.4 20.2L21 12 3.4 3.8 3 10l12 2-12 2 .4 6.2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
