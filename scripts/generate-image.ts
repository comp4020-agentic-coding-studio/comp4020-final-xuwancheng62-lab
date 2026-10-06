#!/usr/bin/env node
// Wrapper for the course's image-generation proxy
// (https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/generating-images/).
// Reads the key from COMP4020_IMAGE_KEY, not from any Claude Code env var --
// this talks to an external host and should never carry Claude Code's own
// session credential.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const BASE_URL = "https://strproxy.comp.anu.edu.au/api/images";

function apiKey(): string {
  const key = process.env.COMP4020_IMAGE_KEY;
  if (!key) {
    throw new Error(
      "COMP4020_IMAGE_KEY is not set -- export your course sk-... key under this name first",
    );
  }
  return key;
}

interface ModelInfo {
  name: string;
  price_usd: string;
  max_n: number;
}

interface ModelsResponse {
  models: ModelInfo[];
  sizes: string[];
  image_price_usd: string;
  image_budget: string;
  image_spend: string;
  image_budget_remaining: string;
}

export async function listModels(): Promise<ModelsResponse> {
  const res = await fetch(`${BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok) {
    throw new Error(`GET /api/images/models failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as ModelsResponse;
}

export async function generateImage(
  prompt: string,
  opts: { model?: string; size?: string } = {},
): Promise<string> {
  const res = await fetch(`${BASE_URL}/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: opts.model ?? "flux-schnell", prompt, ...opts }),
  });
  if (!res.ok) {
    throw new Error(`POST /api/images/generations failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { data: { url: string }[] };
  const url = body.data[0]?.url;
  if (!url) throw new Error(`no image url in response: ${JSON.stringify(body)}`);
  return url;
}

// Generation URLs point at Replicate's delivery CDN and expire -- the proxy
// stores no bytes, so download immediately rather than keeping the URL.
export async function downloadTo(url: string, outPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to download ${url}: ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, bytes);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);

  if (cmd === "models") {
    console.log(JSON.stringify(await listModels(), null, 2));
    return;
  }

  if (cmd === "generate") {
    const [prompt, outPath, model] = rest;
    if (!prompt || !outPath) {
      console.error('usage: generate-image.ts generate "<prompt>" <out-path> [model]');
      process.exitCode = 1;
      return;
    }
    const url = await generateImage(prompt, model ? { model } : {});
    await downloadTo(url, outPath);
    console.log(`saved ${outPath}`);
    return;
  }

  console.error("usage: generate-image.ts models | generate <prompt> <out-path> [model]");
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
