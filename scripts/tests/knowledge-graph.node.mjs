import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../knowledge-graph.py", import.meta.url));
const candidates = [process.env.GRAPHIFY_PYTHON,
  path.join(os.homedir(), "AppData/Roaming/uv/tools/graphifyy/Scripts/python.exe"),
  "python3", "python"].filter(Boolean);
const python = candidates.find(candidate => {
  const result = spawnSync(candidate, ["-c", "import importlib.metadata; print(importlib.metadata.version('graphifyy'))"], { encoding: "utf8" });
  return result.status === 0 && result.stdout.trim() === "0.9.61";
});
const skip = python ? false : "NO DISPONIBLE: Graphify 0.9.61 Python runtime; set GRAPHIFY_PYTHON";
const hash = (raw, algorithm = "sha256") => createHash(algorithm).update(raw).digest("hex");

function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-graph-test-"));
  const root = path.join(base, "repo");
  const prompt = path.join(base, "extraction-spec.md");
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.mkdirSync(path.join(root, "graphify-out"));
  fs.writeFileSync(prompt, "Interpret document and its frontmatter.\n");
  fs.writeFileSync(path.join(root, ".gitignore"), "graphify-out/\n");
  fs.writeFileSync(path.join(root, "source.py"), "def example():\n    return 1\n");
  fs.writeFileSync(path.join(root, "docs/guide.md"), "---\nstatus: approved\n---\n# Knowledge\n\nOne verified decision.\n");
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-b", "main");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  git("add", "source.py", "docs/guide.md", ".gitignore");
  git("commit", "-m", "fixture");
  const graph = { directed: false, nodes: [
    { id: "source_example", source_file: "source.py", _origin: "ast", label: "example", file_type: "code" },
    { id: "docs_guide_knowledge", source_file: "docs/guide.md", _origin: "ast", label: "Knowledge", file_type: "document" },
    { id: "docs_guide_decision", source_file: "docs/guide.md", _origin: "semantic", label: "Verified decision", file_type: "document" },
  ], links: [{ source: "docs_guide_decision", target: "source_example", confidence: "EXTRACTED", source_file: "docs/guide.md" }] };
  function writeGraph() { fs.writeFileSync(path.join(root, "graphify-out/graph.json"), JSON.stringify(graph)); }
  function stamp({ semantic = true } = {}) {
    const manifest = {};
    for (const name of ["source.py", "docs/guide.md"]) {
      if (!fs.existsSync(path.join(root, name))) continue;
      const raw = fs.readFileSync(path.join(root, name));
      manifest[name] = { ast_hash: hash(raw, "md5"), semantic_hash: name.endsWith(".md") && semantic ? hash(raw, "md5") : "" };
    }
    fs.writeFileSync(path.join(root, "graphify-out/manifest.json"), JSON.stringify(manifest));
  }
  function run(command = "inspect", extra = [], expected = 0) {
    const result = spawnSync(python, [script, command, "--root", root, "--prompt-file", prompt, ...extra], { encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
    assert.equal(result.status, expected, `status ${result.status}; stdout ${result.stdout}; stderr ${result.stderr}`);
    return JSON.parse(result.stdout);
  }
  function evidence(state = run(), patch = {}) {
    const value = Object.fromEntries(["schemaVersion", "version", "root", "head", "graphHash", "corpusHash", "configHash", "promptHash"].map(key => [key, state[key]]));
    value.files = { "docs/guide.md": { status: "success", sha256: state.files["docs/guide.md"].sha256, nodeIds: ["docs_guide_decision"], frontmatterReviewed: true, ...patch } };
    const location = path.join(base, "evidence.json");
    fs.writeFileSync(location, JSON.stringify(value));
    return location;
  }
  function close() {
    const resolved = path.resolve(base);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
  stamp(); writeGraph();
  return { root, prompt, graph, git, run, stamp, writeGraph, evidence, close };
}

test("native semantic stamp alone is not full-byte extraction evidence; inspect is read-only", { skip }, () => {
  const f = fixture();
  try {
    const before = f.git("status", "--porcelain");
    const outBefore = fs.readdirSync(path.join(f.root, "graphify-out"));
    const state = f.run();
    assert.equal(state.structural.status, "CURRENT");
    assert.equal(state.semantic.status, "PENDING");
    assert.deepEqual(state.semantic.pending, ["docs/guide.md"]);
    assert.equal(f.git("status", "--porcelain"), before);
    assert.deepEqual(fs.readdirSync(path.join(f.root, "graphify-out")), outBefore);
    assert.equal(fs.existsSync(path.join(f.root, "graphify-out/cache")), false);
  } finally { f.close(); }
});

test("evidence remains valid across code refresh and metadata-only docs changes requeue", { skip }, () => {
  const f = fixture();
  try {
    const location = f.evidence();
    assert.equal(f.run("record", ["--semantic-evidence", location]).semantic.status, "CURRENT");
    const receipt = path.join(f.root, "graphify-out/knowledge-receipt.json");
    const before = fs.readFileSync(receipt, "utf8");
    f.run("record");
    assert.equal(fs.readFileSync(receipt, "utf8"), before);
    fs.writeFileSync(path.join(f.root, "source.py"), "def example():\n    return 2\n");
    assert.equal(f.run().structural.status, "PENDING");
    f.graph.nodes[0].label = "example updated";
    f.stamp(); f.writeGraph();
    assert.equal(f.run().semantic.status, "CURRENT");
    const doc = path.join(f.root, "docs/guide.md");
    fs.writeFileSync(doc, fs.readFileSync(doc, "utf8").replace("approved", "reviewed"));
    f.stamp(); // Simulate Graphify cache reuse despite changed frontmatter.
    const after = f.run();
    assert.equal(after.files["docs/guide.md"].semanticNativeCurrent, true);
    assert.equal(after.semantic.status, "PENDING");
    assert.equal(after.semantic.pendingReasons["docs/guide.md"], "full_bytes_or_semantic_output_changed");
  } finally { f.close(); }
});

test("failed chunks and AST IDs cannot certify semantic coverage", { skip }, () => {
  const f = fixture();
  try {
    const bad = f.evidence(undefined, { nodeIds: ["docs_guide_knowledge"] });
    assert.match(f.run("record", ["--semantic-evidence", bad], 1).error, /semantic nodes/);
    assert.equal(fs.existsSync(path.join(f.root, "graphify-out/knowledge-receipt.json")), false);
    const failed = f.evidence(undefined, { status: "failed" });
    assert.equal(f.run("record", ["--semantic-evidence", failed]).semantic.status, "PENDING");
    const valid = f.evidence();
    assert.equal(f.run("record", ["--semantic-evidence", valid]).semantic.status, "CURRENT");
    f.stamp({ semantic: false });
    assert.equal(f.run().semantic.status, "PENDING");
  } finally { f.close(); }
});

test("removed sources, dangling endpoints and concurrent recorder are rejected", { skip }, () => {
  const f = fixture();
  try {
    fs.writeFileSync(path.join(f.root, "graphify-out/knowledge-record.lock"), "another writer");
    assert.match(f.run("record", [], 1).error, /exist/i);
    fs.unlinkSync(path.join(f.root, "graphify-out/knowledge-record.lock"));
    f.graph.links.push({ source: "missing", target: "source_example" });
    f.writeGraph();
    const invalid = f.run();
    assert.equal(invalid.structural.status, "INVALID");
    assert.ok(invalid.issues.some(issue => issue.code === "dangling_edges"));
    f.graph.links.pop(); f.writeGraph();
    fs.renameSync(path.join(f.root, "docs/guide.md"), path.join(f.root, "docs/renamed.md"));
    const renamed = f.run();
    assert.deepEqual(renamed.structural.deleted, ["docs/guide.md"]);
    assert.ok(renamed.structural.pending.includes("docs/renamed.md"));
    assert.match(f.run("record", [], 1).error, /structural graph/);
  } finally { f.close(); }
});

test("prompt change and semantic node changes invalidate earlier evidence; loops are warnings", { skip }, () => {
  const f = fixture();
  try {
    f.run("record", ["--semantic-evidence", f.evidence()]);
    f.graph.links.push({ source: "source_example", target: "source_example" });
    f.writeGraph();
    const loop = f.run();
    assert.equal(loop.structural.status, "CURRENT");
    assert.equal(loop.issues.length, 0);
    assert.ok(loop.warnings.some(issue => issue.code === "self_loops"));
    f.graph.nodes[2].label = "Different decision"; f.writeGraph();
    assert.equal(f.run().semantic.status, "PENDING");
    f.graph.nodes[2].label = "Verified decision"; f.writeGraph();
    fs.appendFileSync(f.prompt, "New extraction requirement.\n");
    assert.equal(f.run().semantic.status, "PENDING");
  } finally { f.close(); }
});

test("semantic relation loss and excluded graph sources stay visible", { skip }, () => {
  const f = fixture();
  try {
    f.run("record", ["--semantic-evidence", f.evidence()]);
    const relation = f.graph.links.pop(); f.writeGraph();
    assert.equal(f.run().semantic.status, "PENDING");
    f.graph.links.push(relation);
    f.graph.hyperedges = [{ id: "invalid-hyperedge", nodes: ["docs_guide_decision", "missing"], source_file: "docs/guide.md" }];
    f.writeGraph();
    assert.ok(f.run().issues.some(issue => issue.code === "dangling_hyperedge"));
    f.graph.hyperedges = []; f.writeGraph();
    fs.writeFileSync(path.join(f.root, ".graphifyignore"), "docs/guide.md\n");
    const excluded = f.run();
    assert.deepEqual(excluded.structural.excluded, ["docs/guide.md"]);
    assert.equal(excluded.structural.status, "PENDING");
    assert.equal(excluded.semantic.status, "PENDING");
  } finally { f.close(); }
});
