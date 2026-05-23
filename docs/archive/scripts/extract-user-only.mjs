#!/usr/bin/env node
// Extrae SOLO los mensajes del usuario de una sesión (highlights = briefing
// + decisiones crudas, sin las respuestas largas del modelo).
//
// uso: node extract-user-only.mjs <sessionShortId>

import fs from "node:fs";
import path from "node:path";

const ROOT =
  "C:/Users/Trabajo/.claude/projects/C--Users-Trabajo-Desktop-DTDCargo";
const shortId = process.argv[2];
if (!shortId) {
  console.error("Falta sessionShortId");
  process.exit(1);
}

const file = fs
  .readdirSync(ROOT)
  .find((f) => f.startsWith(shortId) && f.endsWith(".jsonl"));
if (!file) {
  console.error("No encontre sesion");
  process.exit(1);
}

const lines = fs.readFileSync(path.join(ROOT, file), "utf8").split("\n");
const msgs = [];

for (const line of lines) {
  if (!line.trim()) continue;
  let row;
  try {
    row = JSON.parse(line);
  } catch {
    continue;
  }
  if (row.type !== "user" || row.isSidechain) continue;
  const content = row.message?.content;
  let text = "";
  if (typeof content === "string") text = content;
  else if (Array.isArray(content)) {
    if (content.every((c) => c.type === "tool_result")) continue;
    text = content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
  }
  text = text.trim();
  if (!text) continue;
  if (text.startsWith("<command-name>")) continue;
  if (text.startsWith("<system-reminder>")) continue;
  if (text.startsWith("<local-command-stdout>")) continue;
  if (text.startsWith("[Request interrupted")) continue;
  // Skip skill template inyectado como mensaje user (office-hours, etc.)
  if (text.startsWith("Base directory for this skill:")) continue;
  if (text.startsWith("<!-- AUTO-GENERATED")) continue;
  // Skip pasted agent system prompts (rol="Eres un...")
  if (text.length > 3000 && text.includes("Tu rol en esta conversación")) continue;
  msgs.push({ time: row.timestamp, text });
}

let md = `# Briefing crudo — sesion ${shortId}\n\n`;
md += `Solo mensajes del usuario, en orden cronologico. Util para releer las\n`;
md += `decisiones y el contexto crudo sin las respuestas largas del modelo.\n\n`;
md += `**Total mensajes:** ${msgs.length}\n\n---\n\n`;

let n = 1;
for (const m of msgs) {
  const hora = m.time.slice(11, 19);
  md += `## ${n}. ${m.time.slice(0, 10)} ${hora}\n\n`;
  md += `${m.text}\n\n---\n\n`;
  n++;
}

process.stdout.write(md);
