"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Wallet as WalletWrapper } from "@coinbase/onchainkit/wallet";
import TransactionBlock, {
  parseTransactionSummary,
} from "./components/TransactionBlock";
import { toast } from "sonner";
import { useAccount, useSignTypedData } from "wagmi";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";

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

type ChatThread = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};

const STORAGE_KEY = "kasra.chat.threads.v1";

function TypingDots() {
  return (
    <div className="flex items-center gap-1">
      <span
        className="inline-block h-2 w-2 rounded-full bg-zinc-400/80"
      />
      <span
        className="inline-block h-2 w-2 rounded-full bg-zinc-400/60"
      />
      <span className="inline-block h-2 w-2 rounded-full bg-zinc-400/40" />
    </div>
  );
}

function deriveThreadTitle(messages: ChatMessage[]) {
  const firstUser = messages.find((m) => m.role === "user")?.content?.trim();
  if (!firstUser) return "New chat";
  return firstUser.length > 32 ? `${firstUser.slice(0, 32)}…` : firstUser;
}

function newThread(seed?: Partial<Pick<ChatThread, "title" | "messages">>): ChatThread {
  const now = Date.now();
  const initialMessages: ChatMessage[] =
    seed?.messages ??
    [
      {
        id: uid(),
        role: "agent",
        content:
          "Saya KASRA. Tanyakan Saldo, ringkasan Pengeluaran, atau minta saya siapkan transfer IDRX.",
        createdAt: now,
      },
    ];

  return {
    id: uid(),
    title: seed?.title ?? "New chat",
    createdAt: now,
    updatedAt: now,
    messages: initialMessages,
  };
}

function safeParseThreads(raw: string | null): ChatThread[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const threads = parsed
      .filter((t) => isRecord(t))
      .map((t) => {
        const id = typeof t.id === "string" ? t.id : uid();
        const title = typeof t.title === "string" ? t.title : "New chat";
        const createdAt = typeof t.createdAt === "number" ? t.createdAt : Date.now();
        const updatedAt = typeof t.updatedAt === "number" ? t.updatedAt : createdAt;
        const messagesRaw = Array.isArray(t.messages) ? t.messages : [];
        const messages = messagesRaw
          .filter((m) => isRecord(m))
          .map((m) => {
            const role = m.role === "user" || m.role === "agent" ? (m.role as ChatRole) : "agent";
            const content = typeof m.content === "string" ? m.content : "";
            const createdAtMsg = typeof m.createdAt === "number" ? m.createdAt : Date.now();
            return {
              id: typeof m.id === "string" ? m.id : uid(),
              role,
              content,
              createdAt: createdAtMsg,
            } satisfies ChatMessage;
          });

        return {
          id,
          title,
          createdAt,
          updatedAt,
          messages,
        } satisfies ChatThread;
      });

    if (threads.length === 0) return null;
    return threads;
  } catch {
    return null;
  }
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  const initialThread = useMemo(() => newThread(), []);
  const [threads, setThreads] = useState<ChatThread[]>(() => [initialThread]);
  const [activeThreadId, setActiveThreadId] = useState<string>(() => initialThread.id);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [paymentRequired, setPaymentRequired] = useState<null | {
    status: number;
    details?: string;
    requestId?: string;
    lastMessage?: string;
  }>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const activeThread = useMemo(() => {
    return threads.find((t) => t.id === activeThreadId) ?? threads[0];
  }, [activeThreadId, threads]);

  const messages = activeThread?.messages ?? [];

  const fetchWithX402Payment = useMemo(() => {
    if (!isConnected || !address) return null;
    if (!signTypedDataAsync) return null;

    // x402 expects an EVM signer that can sign EIP-712 typed data.
    const signer = {
      address: address as `0x${string}`,
      signTypedData: async (message: {
        domain: Record<string, unknown>;
        types: Record<string, unknown>;
        primaryType: string;
        message: Record<string, unknown>;
      }) => {
        // wagmi expects a specific typed-data shape; x402 provides compatible fields.
        return (await signTypedDataAsync(message as never)) as `0x${string}`;
      },
    };

    const client = new x402Client().register(
      // Base Sepolia CAIP-2
      "eip155:84532",
      new ExactEvmScheme(signer),
    );

    return wrapFetchWithPayment(fetch, client);
  }, [address, isConnected, signTypedDataAsync]);

  const quickActions = useMemo(
    () => [
      "Cek Saldo",
      "Transfer 10rb ke Kopi Kenangan",
      "Laporan Pengeluaran",
    ],
    [],
  );

  const canSend = useMemo(() => {
    return !isLoading && input.trim().length > 0;
  }, [input, isLoading]);

  // Load threads from localStorage on mount.
  useEffect(() => {
    const parsed = safeParseThreads(window.localStorage.getItem(STORAGE_KEY));
    if (!parsed) return;
    setThreads(parsed);
    setActiveThreadId(parsed[0]?.id ?? uid());
  }, []);

  // Persist threads.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
    } catch {
      // ignore
    }
  }, [threads]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isLoading]);

  function updateThreadById(threadId: string, updater: (thread: ChatThread) => ChatThread) {
    setThreads((prev) =>
      prev
        .map((t) => (t.id === threadId ? updater(t) : t))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    );
  }

  function startNewChat() {
    const t = newThread();
    setThreads((prev) => [t, ...prev]);
    setActiveThreadId(t.id);
    setPaymentRequired(null);
    setInput("");
    setIsSidebarOpen(false);
  }

  function deleteThread(threadId: string) {
    setThreads((prev) => {
      const next = prev.filter((t) => t.id !== threadId);
      const normalized = next.length > 0 ? next : [newThread()];

      if (activeThreadId === threadId) {
        setActiveThreadId(normalized[0]!.id);
      }

      return normalized;
    });
  }

  async function sendMessage(
    overrideText?: string,
    options?: { appendUser?: boolean; threadId?: string; usePayment?: boolean },
  ) {
    const text = (overrideText ?? input).trim();
    if (!text || isLoading) return;

    const threadId = options?.threadId ?? activeThread?.id;
    if (!threadId) return;

    setInput("");
    setPaymentRequired(null);

    if (options?.appendUser !== false) {
      const userMessage: ChatMessage = {
        id: uid(),
        role: "user",
        content: text,
        createdAt: Date.now(),
      };
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== threadId) return t;
          const nextMessages = [...t.messages, userMessage];
          const title = t.title === "New chat" ? deriveThreadTitle(nextMessages) : t.title;
          return {
            ...t,
            title,
            messages: nextMessages,
            updatedAt: Date.now(),
          };
        }),
      );
    }
    setIsLoading(true);

    try {
      const doFetch = options?.usePayment && fetchWithX402Payment ? fetchWithX402Payment : fetch;

      const res = await doFetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      // x402-style payment-required UX (first request without payment)
      if (res.status === 402) {
        const details = res.headers.get("www-authenticate") ?? res.headers.get("x-payment-required");
        const requestId = res.headers.get("x-request-id") ?? undefined;
        setPaymentRequired({ status: 402, details: details ?? undefined, requestId, lastMessage: text });

        updateThreadById(threadId, (t) => {
          const agentMessage: ChatMessage = {
            id: uid(),
            role: "agent",
            content:
              isConnected
                ? "Endpoint membutuhkan pembayaran (x402). Klik **Pay & Retry** untuk membayar via wallet Anda dan melanjutkan."
                : "Endpoint membutuhkan pembayaran (x402). Silakan **connect wallet** dulu, lalu klik Pay & Retry.",
            createdAt: Date.now(),
          };
          return {
            ...t,
            messages: [...t.messages, agentMessage],
            updatedAt: Date.now(),
          };
        });

        toast.error("Payment required (402)", {
          description: "Server meminta pembayaran (x402).",
        });
        return;
      }

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

      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== threadId) return t;
          const nextMessages = [...t.messages, agentMessage];
          const title = t.title === "New chat" ? deriveThreadTitle(nextMessages) : t.title;
          return {
            ...t,
            title,
            messages: nextMessages,
            updatedAt: Date.now(),
          };
        }),
      );
    } catch (e) {
      toast.error("Gagal menghubungi server", {
        description: "Coba lagi sebentar.",
      });

      updateThreadById(threadId, (t) => ({
        ...t,
        messages: [
          ...t.messages,
          {
            id: uid(),
            role: "agent",
            content:
              "Maaf, terjadi kendala saat memproses permintaan. Coba lagi sebentar.",
            createdAt: Date.now(),
          },
        ],
        updatedAt: Date.now(),
      }));
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-dvh min-h-screen bg-zinc-50">
      {/* Mobile overlay */}
      {isSidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={[
          "fixed z-30 flex h-dvh w-[280px] flex-col border-r border-black/5 bg-zinc-900 text-zinc-50 md:static md:z-auto",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          "transition-transform duration-200",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="text-sm font-semibold tracking-tight">KASRA</div>
          <button
            type="button"
            onClick={startNewChat}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/15"
          >
            New chat
          </button>
        </div>

        <div className="px-3 pb-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Chats
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3">
          <div className="flex flex-col gap-1">
            {threads.map((t) => {
              const isActive = t.id === activeThreadId;
              return (
                <div key={t.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveThreadId(t.id);
                      setIsSidebarOpen(false);
                      setPaymentRequired(null);
                    }}
                    className={[
                      "flex-1 truncate rounded-lg px-3 py-2 text-left text-sm",
                      isActive ? "bg-white/15" : "hover:bg-white/10",
                    ].join(" ")}
                    title={t.title}
                  >
                    {t.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteThread(t.id)}
                    className="invisible rounded-lg px-2 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10 group-hover:visible"
                    aria-label="Delete chat"
                    title="Delete"
                  >
                    Del
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-white/10 px-4 py-3">
          <div className="text-xs text-zinc-300">
            Demo: Chat + Onchain transfer
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-10 border-b border-black/5 bg-white/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 md:hidden"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4 6h16M4 12h16M4 18h16"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              <div className="min-w-0">
                <div className="truncate text-sm font-semibold tracking-tight text-zinc-900">
                  {activeThread?.title ?? "KASRA Financial"}
                </div>
                <div className="truncate text-[11px] text-zinc-500">
                  Onchain Financial Agent on Base
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <WalletWrapper />
            </div>
          </div>
        </header>

        {/* Messages */}
        <main className="mx-auto flex w-full max-w-4xl flex-1 min-w-0 flex-col overflow-hidden px-4">
          <div className="flex-1 overflow-y-auto py-6">
            <div className="flex flex-col gap-4">
              {messages.map((m) => {
                const isUser = m.role === "user";
                const txSummary = !isUser ? parseTransactionSummary(m.content) : null;

                return (
                  <div key={m.id} className="flex w-full gap-3">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-black/10">
                      <div
                        className={[
                          "h-8 w-8 rounded-full",
                          isUser ? "bg-blue-600" : "bg-zinc-900",
                        ].join(" ")}
                        aria-hidden
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 text-xs font-semibold text-zinc-700">
                        {isUser ? "You" : "KASRA"}
                      </div>

                      <div
                        className={[
                          "whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ring-1 ring-black/5",
                          isUser ? "bg-blue-600 text-white" : "bg-white text-zinc-900",
                        ].join(" ")}
                      >
                        {m.content}
                        {txSummary ? <TransactionBlock summary={txSummary} /> : null}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isLoading ? (
                <div className="flex w-full gap-3">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 text-xs font-semibold text-zinc-700">KASRA</div>
                    <div className="max-w-[680px] animate-pulse rounded-2xl bg-white px-4 py-3 text-sm text-zinc-700 ring-1 ring-black/5">
                      <div className="flex items-center gap-2">
                        <TypingDots />
                        <span className="text-xs text-zinc-500">memproses…</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div ref={scrollRef} />
            </div>
          </div>

          {/* Composer */}
          <div className="sticky bottom-0 border-t border-black/5 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
            <div className="py-3">
              <div className="mb-2 flex flex-wrap gap-2">
                {quickActions.map((label) => (
                  <button
                    key={label}
                    type="button"
                    disabled={isLoading}
                    onClick={() => {
                      const text = label.trim();
                      if (!text || isLoading) return;
                      void sendMessage(text);
                    }}
                    className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {paymentRequired ? (
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <div className="min-w-0">
                    <div className="font-semibold">Payment required (x402)</div>
                    <div className="truncate text-amber-800/90">
                      {paymentRequired.details ?? "Server meminta pembayaran sebelum melanjutkan."}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-lg bg-amber-900 px-3 py-1.5 font-semibold text-amber-50 hover:bg-amber-950 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => {
                        const last = paymentRequired.lastMessage;
                        if (!last) return;
                        if (!fetchWithX402Payment) {
                          toast.error("Wallet belum siap", {
                            description: "Connect wallet terlebih dulu untuk membayar via x402.",
                          });
                          return;
                        }
                        void sendMessage(last, {
                          appendUser: false,
                          threadId: activeThread?.id,
                          usePayment: true,
                        });
                      }}
                      disabled={!fetchWithX402Payment || isLoading}
                    >
                      Pay & Retry
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-semibold text-amber-900 hover:bg-amber-100"
                      onClick={() => setPaymentRequired(null)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : null}

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
                  placeholder={isLoading ? "Memproses…" : "Tulis pesan…"}
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

              <div className="mt-2 text-center text-[11px] text-zinc-500">
                KASRA dapat mengusulkan transaksi IDRX; Anda yang menandatangani.
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
