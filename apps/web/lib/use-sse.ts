"use client";

import { useEffect, useRef, useState } from "react";
import { useSSEContext } from "@/components/sse-provider";

export interface SSEHandlers {
  onWorkers?: (data: unknown) => void;
  onActivity?: (data: unknown) => void;
}

export interface SSEState {
  connected: boolean;
  error: boolean;
}

/**
 * useSSE — React hook for consuming the shared admin SSE endpoint
 * (/api/admin/events). Listens for named events and calls the provided
 * handlers with the parsed JSON data.
 *
 * Automatically attaches to the root-level <SSEProvider> context to share a single
 * EventSource connection across the entire app (PERF-003). If mounted outside
 * SSEProvider, it gracefully falls back to a standalone EventSource instance.
 */
export function useSSE(handlers: SSEHandlers): SSEState {
  const context = useSSEContext();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  // Fallback standalone state if no SSEProvider is present in the tree
  const [fallbackState, setFallbackState] = useState<SSEState>({ connected: false, error: false });
  const mountedRef = useRef(true);

  // Hook into context if available
  useEffect(() => {
    if (context) {
      return context.subscribe(handlersRef);
    }

    // Standalone fallback:
    mountedRef.current = true;
    let es: EventSource | null = null;

    function connect() {
      es = new EventSource("/api/admin/events");

      es.onopen = () => {
        if (mountedRef.current) {
          setFallbackState({ connected: true, error: false });
        }
      };

      es.onerror = () => {
        if (mountedRef.current) {
          setFallbackState({ connected: false, error: true });
        }
      };

      es.addEventListener("workers", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          handlersRef.current.onWorkers?.(data);
        } catch {
          // Malformed JSON — skip
        }
      });

      es.addEventListener("activity", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          handlersRef.current.onActivity?.(data);
        } catch {
          // Malformed JSON — skip
        }
      });
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (es) {
        es.close();
        es = null;
      }
    };
  }, [context]);

  if (context) {
    return {
      connected: context.connected,
      error: context.error,
    };
  }

  return fallbackState;
}
