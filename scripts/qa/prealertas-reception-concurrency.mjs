// Uses only the caller's disposable PostgreSQL container, never a network database.
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
const container = process.argv[2];
if (!container || !container.startsWith("dtd_sdd0443_test")) throw new Error("Pass the dedicated dtd_sdd0443_test container");
const db = `qa0443_${Date.now()}`;
const exec = (args, input) => {
  const result = spawnSync("docker", ["exec", "-i", container, ...args], { encoding: "utf8", input });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout;
};
try {
  exec(["createdb", "-U", "postgres", db]);
  const fixture = readFileSync("supabase/tests/0449_prealerta_exact_box_reception.test.sql", "utf8")
    .split("do $$ declare r jsonb;")[0].replace("../migrations/", "/sb/migrations/") + "\ncommit;";
  exec(["psql", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1"], fixture);
  const sql = "select receive_prealerta_boxes_as_operario('00000000-0000-0000-0000-000000000003','DTD-B-000001',array['DTD-B-000001','DTD-B-000002','DTD-B-000003']);";
  const run = () => new Promise(resolve => {
    const child = spawn("docker", ["exec", container, "psql", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-c", sql]);
    let output = "";
    child.stderr.on("data", d => { output += d; });
    child.stdout.on("data", d => { output += d; });
    child.on("close", code => resolve({ code, output }));
  });
  const results = await Promise.all([run(), run()]);
  if (results.filter(r => r.code === 0).length !== 1) throw new Error(JSON.stringify(results));
  const counts = exec(["psql", "-U", "postgres", "-d", db, "-Atc", "select (select count(*) from warehouse_receipts_cn)::text || ':' || (select count(*) from warehouse_boxes where status='recibida')::text;"]).trim();
  if (counts !== "1:3") throw new Error(`Duplicate/missing boxes: ${counts}`);
  console.log("PASS: two simultaneous requests produced one receipt and exactly three received boxes.");
} finally {
  exec(["dropdb", "-U", "postgres", "--if-exists", db]);
}
