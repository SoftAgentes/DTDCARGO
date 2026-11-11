import { buildLlmsFull } from "@/lib/public/llms-full";

export const dynamic = "force-static";

export function GET() {
  return new Response(buildLlmsFull(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
