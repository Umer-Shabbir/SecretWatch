"use client";

import { SessionProvider } from "next-auth/react";
import { SSEProvider } from "@/components/sse-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SSEProvider>{children}</SSEProvider>
    </SessionProvider>
  );
}
