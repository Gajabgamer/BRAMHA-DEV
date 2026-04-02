type LiveEvent = {
  id: string;
  userId: string;
  type: string;
  queue?: string | null;
  priority?: string | null;
  payload?: Record<string, unknown>;
  createdAt: string;
};

type Listener = (event: LiveEvent) => void;

function getApiOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:8000";
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "";
}

class LiveEventsClient {
  private listeners = new Set<Listener>();
  private token: string | null = null;
  private controller: AbortController | null = null;
  private reconnectTimer: number | null = null;
  private connected = false;

  connect(token: string) {
    if (this.token === token && this.connected) {
      return;
    }

    this.disconnect();
    this.token = token;
    this.connected = true;
    this.start();
  }

  disconnect() {
    this.connected = false;
    this.token = null;
    this.controller?.abort();
    this.controller = null;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: LiveEvent) {
    this.listeners.forEach((listener) => listener(event));
  }

  private scheduleReconnect() {
    if (!this.connected) {
      return;
    }

    this.reconnectTimer = window.setTimeout(() => {
      this.start();
    }, 3000);
  }

  private async start() {
    if (!this.token || !this.connected) {
      return;
    }

    this.controller = new AbortController();

    try {
      const response = await fetch(`${getApiOrigin()}/api/events/stream`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "text/event-stream",
        },
        signal: this.controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Live stream failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (this.connected) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";

        for (const chunk of chunks) {
          const lines = chunk.split("\n");
          let eventName = "message";
          let data = "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              data += line.slice(5).trim();
            }
          }

          if (!data || eventName === "heartbeat") {
            continue;
          }

          try {
            this.emit(JSON.parse(data) as LiveEvent);
          } catch {
            // Ignore malformed events and keep stream alive.
          }
        }
      }
    } catch {
      if (this.connected) {
        this.scheduleReconnect();
      }
    }
  }
}

export type { LiveEvent };
export const liveEventsClient = new LiveEventsClient();
