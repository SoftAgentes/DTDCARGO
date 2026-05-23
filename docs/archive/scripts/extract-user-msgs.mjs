#!/usr/bin/env node
// Extrae mensajes user que mencionen un keyword (case-insensitive)
// de los transcripts JSONL del proyecto DTDCargo.
//
// uso: node extract-user-msgs.mjs <keyword>

import fs from "node:fs";
import path from "node:path";

const ROOT =
  "C:/Users/Trabajo/.claude/projects/C--Users-Trabajo-Desktop-DTDCargo";
const keyword = (process.argv[2] || "doortudoor").toLowerCase();

const files = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith(".jsonl"))
  .map((f) => path.join(ROOT, f));

const hits = [];

for (const file of files) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (row.type !== "user") continue;
    const content = row.message?.content;
    let text = "";
    if (typeof content === "string") text = content;
    else if (Array.isArray(content))
      text = content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");
    if (!text) continue;
    if (!text.toLowerCase().includes(keyword)) continue;
    // Skip tool_result auto-injected blobs
    if (text.startsWith("<tool_use_error>")) continue;
    hits.push({
      session: path.basename(file).slice(0, 8),
      time: row.timestamp,
      text: text.trim().slice(0, 1200),
    });
  }
}

hits.sort((a, b) => a.time.localeCompare(b.time));

console.log(`\n# ${hits.length} mensajes user con "${keyword}"\n`);
for (const h of hits) {
  console.log(`---\n[${h.time}]  sesión ${h.session}…`);
  console.log(h.text);
  console.log();
}
