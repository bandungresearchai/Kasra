"use client";

import React, { useMemo } from "react";
import {
  Transaction,
  TransactionButton,
  TransactionStatus,
  TransactionStatusLabel,
  TransactionToast,
} from "@coinbase/onchainkit/transaction";
import type { Address } from "viem";
import { formatIDR } from "../lib/formatIDR";

const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

function isHexAddress(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export type TransactionSummary = {
  recipientLabel: string;
  recipientAddress: Address;
  amount: bigint;
  category: string;
};

export function parseTransactionSummary(text: string): TransactionSummary | null {
  if (!text.includes("Rincian Transaksi")) return null;

  // Expected format:
  // Rincian Transaksi: [Ke: <Recipient> | Nominal: <Amount> | Kategori: <Category>].
  const bracketMatch = text.match(/Rincian\s+Transaksi\s*:\s*\[([\s\S]*?)\]/i);
  const inner = bracketMatch?.[1];
  if (!inner) return null;

  const toMatch = inner.match(/Ke\s*:\s*([^|\]]+)/i);
  const nominalMatch = inner.match(/Nominal\s*:\s*([^|\]]+)/i);
  const categoryMatch = inner.match(/Kategori\s*:\s*([^|\]]+)/i);

  const recipientLabel = (toMatch?.[1] ?? "").trim() || "(Recipient)";
  const category = (categoryMatch?.[1] ?? "Uncategorized Expense").trim();

  const rawNominal = (nominalMatch?.[1] ?? "").trim();
  const amount = parseAmountToBigInt(rawNominal);
  if (amount === null) return null;

  // MVP logic: if recipient is not a hex address, fall back to env demo address.
  const demoRecipient =
    (process.env.NEXT_PUBLIC_DEMO_RECIPIENT_ADDRESS as string | undefined) ??
    "0x0000000000000000000000000000000000000000";

  const recipientAddress = isHexAddress(recipientLabel)
    ? (recipientLabel as Address)
    : isHexAddress(demoRecipient)
      ? (demoRecipient as Address)
      : ("0x0000000000000000000000000000000000000000" as Address);

  return {
    recipientLabel,
    recipientAddress,
    amount,
    category,
  };
}

function parseAmountToBigInt(input: string): bigint | null {
  if (!input) return null;

  const lower = input.toLowerCase();

  // Handle shorthand: 10rb / 10k / 2jt
  const shorthand = lower.match(/(\d+(?:[\.,]\d+)?)\s*(rb|k|jt|juta)\b/);
  if (shorthand) {
    const n = Number(shorthand[1].replace(",", "."));
    if (!Number.isFinite(n)) return null;
    const unit = shorthand[2];
    const multiplier = unit === "jt" || unit === "juta" ? 1_000_000 : 1_000;
    return BigInt(Math.round(n * multiplier));
  }

  // Strip currency symbols and thousands separators.
  // Examples: "Rp 50.000" -> 50000, "50,000" -> 50000
  const digitsOnly = lower
    .replace(/rp/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, "")
    .match(/\d+/)?.[0];

  if (!digitsOnly) return null;

  try {
    return BigInt(digitsOnly);
  } catch {
    return null;
  }
}

export default function TransactionBlock({
  summary,
}: {
  summary: TransactionSummary;
}) {
  const idrxAddress =
    (process.env.NEXT_PUBLIC_IDRX_ADDRESS as string | undefined) ??
    "0x0000000000000000000000000000000000000000";

  const calls = useMemo(() => {
    const tokenAddress = isHexAddress(idrxAddress)
      ? (idrxAddress as Address)
      : ("0x0000000000000000000000000000000000000000" as Address);

    return [
      {
        address: tokenAddress,
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer" as const,
        args: [summary.recipientAddress, summary.amount] as const,
      },
    ];
  }, [idrxAddress, summary.amount, summary.recipientAddress]);

  const amountIDR = useMemo(() => {
    const asNumber = Number(summary.amount);
    if (Number.isFinite(asNumber) && Math.abs(asNumber) <= Number.MAX_SAFE_INTEGER) {
      return formatIDR(asNumber);
    }
    return `Rp ${summary.amount.toString()}`;
  }, [summary.amount]);

  return (
    <div className="mt-3 rounded-xl border border-black/10 bg-zinc-50 p-3">
      <div className="mb-2 text-xs font-semibold text-zinc-700">
        Siap ditandatangani
      </div>

      <div className="grid gap-1 text-xs text-zinc-700">
        <div>
          <span className="font-semibold">Ke:</span> {summary.recipientLabel}
        </div>
        <div>
          <span className="font-semibold">Nominal:</span> {amountIDR}
        </div>
        <div>
          <span className="font-semibold">Kategori:</span> {summary.category}
        </div>
      </div>

      <Transaction calls={calls}>
        <div className="mt-3 flex items-center justify-between gap-3">
          <TransactionStatus className="text-xs">
            <TransactionStatusLabel />
          </TransactionStatus>
          <TransactionButton
            text="CONFIRM TRANSFER"
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
          />
        </div>
        <TransactionToast />
      </Transaction>

      {(!isHexAddress(idrxAddress) || idrxAddress.endsWith("0000")) && (
        <div className="mt-2 text-[11px] text-amber-700">
          Catatan: set `NEXT_PUBLIC_IDRX_ADDRESS` (dan opsional `NEXT_PUBLIC_DEMO_RECIPIENT_ADDRESS`) untuk demo yang benar.
        </div>
      )}
    </div>
  );
}
