"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * SSE Provider (PERF-003 Fix).
 * Manages a single, application-wide EventSource connection to the admin SSE endpoint
 * (/api/admin/events) and broadcasts events to all children via React Context.
 * This prevents component-level useSSE hooks from exhausting the browser's
 * 6-connection HTTP/1.1 limit by opening separate connections.
 */

export interface SSEState {
  connected: boolean;
  error: boolean;
}

export interface SSEHandlers {
  onWorkers?: (data: unknown) => void;
  onActivity?: (data: unknown) => void;
}

interface SSEContextValue extends SSEState {
  subscribe: (handlersRef: React.MutableRefObject<SSEHandlers>) => () => void;
}

export const SSEContext = createContext<SSEContextValue | null>(null);

export function useSSEContext() {
  return useContext(SSEContext);
}

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SSEState>({ connected: false, error: false });
  const subscribersRef = useRef<Set<React.MutableRefObject<SSEHandlers>>>(new Set());

  useEffect(() => {
    let es: EventSource | null = null;

    function connect() {
      es = new EventSource("/api/admin/events");

      es.onopen = () => {
        setState({ connected: true, error: false });
      };

      es.onerror = () => {
        setState({ connected: false, error: true });
      };

      es.addEventListener("workers", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          subscribersRef.current.forEach((ref) => ref.current.onWorkers?.(data));
        } catch {
          // parse failed
        }
      });

      es.addEventListener("activity", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          subscribersRef.current.forEach((ref) => ref.current.onActivity?.(data));
        } catch {
          // parse failed
        }
      });
    }

    connect();

    return () => {
      if (es) {
        es.close();
      }
    };
  }, []);

  const subscribe = React.useCallback((handlersRef: React.MutableRefObject<SSEHandlers>) => {
    subscribersRef.current.add(handlersRef);
    return () => {
      subscribersRef.current.delete(handlersRef);
    };
  }, []);

  return (
    <SSEContext.Provider value={{ ...state, subscribe }}>
      {children}
    </SSEContext.Provider>
  );
}
