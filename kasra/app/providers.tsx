"use client";

import { ReactNode } from "react";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { baseSepolia } from "wagmi/chains";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <OnchainKitProvider
      chain={baseSepolia}
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
      rpcUrl={process.env.NEXT_PUBLIC_RPC_URL}
    >
      {children}
    </OnchainKitProvider>
  );
}
