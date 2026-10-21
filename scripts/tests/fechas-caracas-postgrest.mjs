#!/usr/bin/env node
// C1: contrato común para PGlite y PostgreSQL desechable. HTTP se añade en la
// misma ruta; esta utilidad no lee .env ni contacta un servicio alojado.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const contractPath = resolve(root, 'supabase/tests/0499_fechas_caracas_operaciones.test.sql');
export function inlineContract(vars = {}, replacements = {}) {
  const state = { ...vars }, out = [];
  function run(file) {
    const key = Object.keys(replacements).find(name => file.endsWith(name));
    const source = key ? replacements[key] : readFileSync(file, 'utf8');
    const stack = [], active = () => stack.every(frame => frame.active);
    for (const line of source.split(/\r?\n/)) {
      const meta = line.match(/^\\(\w+)\s*(.*)$/);
      if (!meta) { if (active()) out.push(line); continue; }
      const [, command, rest] = meta;
      if (command === 'if') {
        let taken = false;
        if (active()) {
          const defined = rest.match(/^:\{\?(\w+)\}$/);
          const value = defined ? String(defined[1] in state) : rest.startsWith(':') ? String(state[rest.slice(1)]) : rest;
          if (!/^(true|false|on|off|t|f|yes|no|1|0)$/i.test(value)) throw Error('if no booleano: ' + rest);
          taken = /^(true|on|t|yes|1)$/i.test(value);
        }
        stack.push({ active: taken, taken });
      } else if (command === 'else') { const frame=stack.at(-1); if (!frame) throw Error('else sin if'); frame.active=!frame.taken; }
      else if (command === 'endif') { if (!stack.pop()) throw Error('endif sin if'); }
      else if (!active()) continue;
      else if (command === 'set') { const [name,value] = rest.split(/\s+/); if(name!=='ON_ERROR_STOP') state[name] = value.startsWith(':') ? state[value.slice(1)] : value; }
      else if (command === 'ir') run(resolve(dirname(file), rest));
      else throw Error('metaorden no soportada: ' + command);
    }
    if(stack.length) throw Error('if sin cerrar: '+file);
  }
  run(contractPath);
  return out.join('\n');
}
export function embeddedSql(sql) {
  return sql.replace(/pg_read_file\('\/sb\/migrations\/([^']+)'\)/g, (_, name) => "'" + readFileSync(resolve(root,'supabase/migrations',name),'utf8').replaceAll("'", "''") + "'");
}
