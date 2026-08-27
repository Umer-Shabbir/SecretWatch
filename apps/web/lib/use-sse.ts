"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useSSE — React hook for connecting to the admin SSE endpoint
 * (/api/admin/events). Listens for named events and calls the provided
 * handlers with the parsed JSON data. Falls back gracefully: if the
 * EventSource connection fails (auth error, network issue), the hook
 * reports an error state so callers can degrade to polling or show a
 * reconnection notice.
 *
 * The EventSource protocol retries automatically on transient failures
 * (with exponential backoff built into the browser), so most network
 * blips self-heal without explicit retry logic.
 */

export interface SSEHandlers {
  /** Called when a `workers` event arrives (WorkerMonitoringSnapshot). */
  onWorkers?: (data: unknown) => void;
  /** Called when an `activity` event arrives (LiveActivity). */
  onActivity?: (data: unknown) => void;
}

export interface SSEState {
  connected: boolean;
  error: boolean;
}

export function useSSE(handlers: SSEHandlers): SSEState {
  const [state, setState] = useState<SSEState>({ connected: false, error: false });
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  // Track whether the component is still mounted
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let es: EventSource | null = null;

    function connect() {
      es = new EventSource("/api/admin/events");

      es.onopen = () => {
        if (mountedRef.current) {
          setState({ connected: true, error: false });
        }
      };

      es.onerror = () => {
        if (mountedRef.current) {
          setState({ connected: false, error: true });
        }
        // EventSource auto-reconnects; if the error is a 401/403 (auth
        // failure), the browser will keep retrying. We set error: true
        // so callers can fall back to polling if needed.
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
  }, []);

  return state;
}
