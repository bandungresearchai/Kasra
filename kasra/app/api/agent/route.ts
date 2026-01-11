import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

import {
  AgentKit,
  LegacyCdpWalletProvider,
  erc20ActionProvider,
  walletActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WALLET_DATA_PATH = path.join(process.cwd(), "wallet_data.txt");

const KASRA_SYSTEM_PROMPT = `You are KASRA, a professional, strict, yet helpful Financial Assistant for the Base Blockchain. Your primary language is Indonesian (Bahasa Indonesia).

Your Operating Protocols:
1) Tone: Professional, concise, financial-focused. Use terms like 'Saldo' (Balance), 'Aset' (Asset), 'Pengeluaran' (Expense).
2) Mandatory Validation: Before verifying any transfer request, you MUST check the user's balance using your tools.
   - If Balance < Amount: Reply 'Saldo Anda tidak mencukupi untuk transaksi ini. Harap hemat.'
   - If Balance > Amount: Proceed.
3) Categorization: You are an accountant. Every transfer must have a category (e.g., Food, Transport, Debt). If the user doesn't specify one, infer it from the context or label it 'Uncategorized Expense'.
4) IDRX Handling: When users say 'Rp 50.000' or '50rb', treat this as 50,000 units of the IDRX Token.
5) Output Format: If you are ready to propose a transaction, end your response with:
   'Rincian Transaksi: [Ke: <Recipient> | Nominal: <Amount> | Kategori: <Category>]. Silakan tanda tangani di bawah.'
`;

let cachedAgentPromise: Promise<ReturnType<typeof createReactAgent>> | null = null;

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function initAgent() {
  const apiKeyId = process.env.CDP_API_KEY_NAME;
  const apiKeySecret = process.env.CDP_API_KEY_PRIVATE_KEY;

  if (!apiKeyId || !apiKeySecret) {
    throw new Error(
      "Missing CDP credentials. Please set CDP_API_KEY_NAME and CDP_API_KEY_PRIVATE_KEY in your environment.",
    );
  }

  const networkId = process.env.NETWORK_ID ?? "base-sepolia";

  let walletProvider: LegacyCdpWalletProvider;

  try {
    if (await fileExists(WALLET_DATA_PATH)) {
      const saved = await fs.readFile(WALLET_DATA_PATH, "utf8");
      walletProvider = await LegacyCdpWalletProvider.configureWithWallet({
        apiKeyId,
        apiKeySecret,
        networkId,
        cdpWalletData: saved,
      });
    } else {
      walletProvider = await LegacyCdpWalletProvider.configureWithWallet({
        apiKeyId,
        apiKeySecret,
        networkId,
      });

      const exported = await walletProvider.exportWallet();
      await fs.writeFile(WALLET_DATA_PATH, JSON.stringify(exported), "utf8");
    }
  } catch (err) {
    console.error("Failed to load/create wallet from wallet_data.txt", err);
    throw new Error(
      "Wallet initialization failed. Check server logs and confirm wallet_data.txt is valid JSON.",
    );
  }

  const agentKit = await AgentKit.from({
    walletProvider,
    actionProviders: [walletActionProvider(), erc20ActionProvider()],
  });

  const tools = await getLangChainTools(agentKit);

  const llm = new ChatOpenAI({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.2,
  });

  return createReactAgent({
    llm,
    tools,
    messageModifier: KASRA_SYSTEM_PROMPT,
  });
}

async function getAgent() {
  if (!cachedAgentPromise) {
    cachedAgentPromise = initAgent();
  }
  return cachedAgentPromise;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { message?: string };

    const message = body?.message?.trim();
    if (!message) {
      return NextResponse.json(
        { reply: "Mohon kirim pesan yang valid." },
        { status: 400 },
      );
    }

    const agent = await getAgent();

    const result = await agent.invoke({
      messages: [{ role: "user", content: message }],
    });

    const last = result?.messages?.[result.messages.length - 1];
    const reply =
      typeof last?.content === "string"
        ? last.content
        : last?.content
          ? JSON.stringify(last.content)
          : "Maaf, saya tidak bisa memproses itu sekarang.";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("/api/agent error", err);
    return NextResponse.json({
      reply:
        "Maaf, sistem sedang bermasalah. Silakan coba lagi beberapa saat lagi.",
    });
  }
}
