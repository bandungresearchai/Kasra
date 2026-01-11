"use client";

import { ReactNode } from "react";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { Toaster } from "sonner";

const baseSepoliaChain = {
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://sepolia.base.org"],
    },
    public: {
      http: ["https://sepolia.base.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "BaseScan",
      url: "https://sepolia.basescan.org",
    },
  },
  testnet: true,
} as const;

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <OnchainKitProvider
      chain={baseSepoliaChain as never}
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
      rpcUrl={process.env.NEXT_PUBLIC_RPC_URL}
    >
      <Toaster position="top-center" richColors />
      {children}
    </OnchainKitProvider>
  );
}
