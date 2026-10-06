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

// Who is looking into which shelter right now, counted per open stream so a
// second tab doesn't double anyone. Leaving waits out a short grace period, so
// a reload or a click to another page doesn't flicker someone off the gate.
export interface Visitor {
  id: number;
  name: string;
}
const present = new Map<number, Map<number, { name: string; streams: number }>>();
const GRACE_MS = 4000;

export function visitorsOf(shelterId: number): Visitor[] {
  return [...(present.get(shelterId) ?? new Map()).entries()].map(([id, v]) => ({ id, name: v.name }));
}

// Returns true when this is a new arrival rather than another tab.
export function arrive(shelterId: number, visitor: Visitor): boolean {
  if (!present.has(shelterId)) present.set(shelterId, new Map());
  const here = present.get(shelterId)!;
  const v = here.get(visitor.id);
  if (v) {
    v.streams += 1;
    return false;
  }
  here.set(visitor.id, { name: visitor.name, streams: 1 });
  return true;
}

export function leave(shelterId: number, visitorId: number, onGone: () => void): void {
  const v = present.get(shelterId)?.get(visitorId);
  if (!v) return;
  v.streams -= 1;
  if (v.streams > 0) return;
  setTimeout(() => {
    const here = present.get(shelterId);
    if (here?.get(visitorId)?.streams !== 0) return;
    here.delete(visitorId);
    if (here.size === 0) present.delete(shelterId);
    onGone();
  }, GRACE_MS);
}
