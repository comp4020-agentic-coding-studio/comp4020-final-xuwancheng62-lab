// In-process pub/sub for server-sent events. Fly runs exactly one machine for
// this app, so every open stream is in this process.
type Send = (event: string, data: unknown) => void;
const channels = new Map<string, Set<Send>>();

export function subscribe(names: string[], send: Send): () => void {
  for (const n of names) {
    if (!channels.has(n)) channels.set(n, new Set());
    channels.get(n)!.add(send);
  }
  return () => {
    for (const n of names) {
      const set = channels.get(n);
      set?.delete(send);
      if (set?.size === 0) channels.delete(n);
    }
  };
}

export interface LiveEvent {
  channel: string;
  event: string;
  data: unknown;
}

// Call only after the transaction that caused these has committed.
export function publish(events: LiveEvent[]): void {
  for (const e of events) for (const send of channels.get(e.channel) ?? []) send(e.event, e.data);
}
