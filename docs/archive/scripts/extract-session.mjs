#!/usr/bin/env node
// Extrae la conversación (user + assistant) de una sesión JSONL completa
// y la formatea como markdown legible.
//
// uso: node extract-session.mjs <sessionShortId> [keywordFilter]
//   <sessionShortId>  primeros 8 chars del nombre del .jsonl
//   [keywordFilter]   opcional — solo incluye turnos donde aparece el keyword

import fs from "node:fs";
import path from "node:path";

const ROOT =
  "C:/Users/Trabajo/.claude/projects/C--Users-Trabajo-Desktop-DTDCargo";

const shortId = process.argv[2];
const filter = process.argv[3]?.toLowerCase();

if (!shortId) {
  console.error("Falta sessionShortId");
  process.exit(1);
}

const file = fs
  .readdirSync(ROOT)
  .find((f) => f.startsWith(shortId) && f.endsWith(".jsonl"));

if (!file) {
  console.error(`No encontre sesion ${shortId}`);
  process.exit(1);
}

const fullPath = path.join(ROOT, file);
const lines = fs.readFileSync(fullPath, "utf8").split("\n");

const turns = [];

for (const line of lines) {
  if (!line.trim()) continue;
  let row;
  try {
    row = JSON.parse(line);
  } catch {
    continue;
  }
  if (row.type !== "user" && row.type !== "assistant") continue;
  if (row.isSidechain) continue; // skip sub-agent traffic

  const content = row.message?.content;
  let text = "";
  let toolNames = [];
  if (typeof content === "string") text = content;
  else if (Array.isArray(content)) {
    for (const c of content) {
      if (c.type === "text" && c.text) text += c.text + "\n";
      if (c.type === "tool_use") toolNames.push(c.name);
    }
  }
  text = text.trim();

  // Skip empty/system noise
  if (!text && toolNames.length === 0) continue;
  if (text.startsWith("<command-name>")) continue;
  if (text.startsWith("<system-reminder>")) continue;
  if (text.startsWith("<local-command-stdout>")) continue;
  if (text.startsWith("[Request interrupted")) continue;
  if (text.startsWith("Base directory for this skill:")) continue;
  if (text.startsWith("<!-- AUTO-GENERATED")) continue;
  // Skip tool_result auto-injected blobs in user turns
  if (
    row.type === "user" &&
    Array.isArray(content) &&
    content.every((c) => c.type === "tool_result")
  )
    continue;

  turns.push({
    role: row.type,
    time: row.timestamp,
    text,
    toolNames,
  });
}

const filtered = filter
  ? turns.filter((t) => t.text.toLowerCase().includes(filter))
  : turns;

const session = shortId;
const fechaInicio = turns[0]?.time?.slice(0, 10) ?? "?";
const fechaFin = turns[turns.length - 1]?.time?.slice(0, 10) ?? "?";

let md = `# Archivo conversacion — sesion ${session}\n\n`;
md += `**Fuente:** \`${file}\`\n`;
md += `**Rango:** ${fechaInicio} → ${fechaFin}\n`;
md += `**Total turnos:** ${turns.length}${filter ? ` (filtrados por "${filter}": ${filtered.length})` : ""}\n\n`;
md += `---\n\n`;

for (const t of filtered) {
  const hora = t.time.slice(11, 19);
  const icon = t.role === "user" ? "👤" : "🤖";
  md += `## ${icon} ${t.role.toUpperCase()} — ${t.time.slice(0, 10)} ${hora}\n\n`;
  if (t.text) md += `${t.text}\n\n`;
  if (t.toolNames.length) {
    md += `*Tools usadas: ${t.toolNames.join(", ")}*\n\n`;
  }
  md += `---\n\n`;
}

process.stdout.write(md);
