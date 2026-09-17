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

// Module-level fallback singleton shared across any hooks mounted outside SSEProvider
let sharedEs: EventSource | null = null;
const sharedHandlers = new Set<React.MutableRefObject<SSEHandlers>>();
const stateListeners = new Set<(state: SSEState) => void>();
let sharedState: SSEState = { connected: false, error: false };
let disconnectTimeout: ReturnType<typeof setTimeout> | null = null;

function updateSharedState(next: SSEState) {
  sharedState = next;
  stateListeners.forEach((listener) => listener(next));
}

function initSharedEventSource() {
  if (sharedEs) return;

  sharedEs = new EventSource("/api/admin/events");

  sharedEs.onopen = () => {
    updateSharedState({ connected: true, error: false });
  };

  sharedEs.onerror = () => {
    updateSharedState({ connected: false, error: true });
  };

  sharedEs.addEventListener("workers", (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      sharedHandlers.forEach((ref) => ref.current.onWorkers?.(data));
    } catch {
      // Malformed JSON — skip
    }
  });

  sharedEs.addEventListener("activity", (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      sharedHandlers.forEach((ref) => ref.current.onActivity?.(data));
    } catch {
      // Malformed JSON — skip
    }
  });
}

function closeSharedEventSource() {
  if (sharedEs) {
    sharedEs.close();
    sharedEs = null;
    updateSharedState({ connected: false, error: false });
  }
}

/**
 * useSSE — React hook for consuming the shared admin SSE endpoint
 * (/api/admin/events). Listens for named events and calls the provided
 * handlers with the parsed JSON data.
 *
 * Automatically attaches to the root-level <SSEProvider> context to share a single
 * EventSource connection across the entire app (PERF-003). If mounted outside
 * SSEProvider, it gracefully falls back to a shared module-level singleton EventSource
 * to guarantee that at most one connection exists per tab.
 */
export function useSSE(handlers: SSEHandlers): SSEState {
  const context = useSSEContext();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const [fallbackState, setFallbackState] = useState<SSEState>(sharedState);

  // Hook into context if available
  useEffect(() => {
    if (context) {
      return context.subscribe(handlersRef);
    }

    // Standalone fallback using module-level singleton:
    if (disconnectTimeout) {
      clearTimeout(disconnectTimeout);
      disconnectTimeout = null;
    }

    sharedHandlers.add(handlersRef);
    stateListeners.add(setFallbackState);
    initSharedEventSource();

    return () => {
      sharedHandlers.delete(handlersRef);
      stateListeners.delete(setFallbackState);

      if (sharedHandlers.size === 0) {
        disconnectTimeout = setTimeout(() => {
          if (sharedHandlers.size === 0) {
            closeSharedEventSource();
          }
        }, 1000);
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
