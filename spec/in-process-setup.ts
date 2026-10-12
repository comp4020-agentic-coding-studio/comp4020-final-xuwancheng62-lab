import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "holdout-http-in-process-"));
const { app } = await import("../src/server.ts");
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.origin !== "http://localhost:8080") return realFetch(input, init);
  request.headers.set("host", url.host);
  const response = await app.request(request);
  if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) return response;
  const reader = response.body.getReader();
  let finished = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      request.signal.addEventListener("abort", () => {
        if (finished) return;
        finished = true;
        void reader.cancel().catch(() => {});
        controller.error(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    },
    async pull(controller) {
      if (finished) return;
      try {
        const { value, done } = await reader.read();
        if (finished) return;
        if (done) { finished = true; controller.close(); }
        else controller.enqueue(value);
      } catch (error) { if (!finished) { finished = true; controller.error(error); } }
    },
    cancel(reason) { finished = true; return reader.cancel(reason); },
  });
  return new Response(body, { status: response.status, headers: response.headers });
};
