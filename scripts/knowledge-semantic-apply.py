"""Validate an assistant Graphify fragment, merge it, and receipt only its verified documents.

This does not call an LLM. Unextracted documents keep their native semantic hash
empty and remain pending. The extracted fragment and explicit review are inputs.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from uuid import uuid4

from graphify.cache import save_semantic_cache
from graphify.detect import save_manifest

ID = re.compile(r"^[a-z0-9_]+$")
FILE_TYPES = {"code", "document", "paper", "image", "rationale", "concept"}
SEM_TYPES = {"document", "paper", "image"}
SCORES = {"EXTRACTED": {1.0}, "INFERRED": {0.95, 0.85, 0.75, 0.65, 0.55}}


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def load_adapter(root):
    location = root / "scripts/knowledge-graph.py"
    spec = importlib.util.spec_from_file_location("project_knowledge_graph", location)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.install_git_read_scope(root)
    return module


def normalized(row, root, adapter, allowed):
    source = adapter.local_path(row.get("source_file"), root)
    if source not in allowed:
        raise ValueError(f"fragment source is not an included semantic document: {row.get('source_file')}")
    return {**row, "source_file": source}, source


def checked_fragment(root, fragment_path, review_path, prompt, adapter):
    state, _, _ = adapter.inspect(root, prompt)
    if state["structural"]["status"] != "CURRENT":
        raise ValueError("structural graph must be current before importing semantic output")
    raw = fragment_path.read_bytes()
    fragment = json.loads(raw)
    review = json.loads(review_path.read_bytes())
    if not isinstance(fragment, dict) or any(not isinstance(fragment.get(key), list) for key in ("nodes", "edges", "hyperedges")):
        raise ValueError("fragment requires nodes, edges and hyperedges arrays")
    if review.get("schemaVersion") != 1 or review.get("head") != state["head"] or review.get("fragmentSha256") != digest(raw):
        raise ValueError("fragment review does not match HEAD and exact input bytes")
    allowed = {name for name, file in state["files"].items() if file["type"] in SEM_TYPES}
    graph_path = root / "graphify-out/graph.json"
    if graph_path.is_symlink():
        raise ValueError("graph.json cannot be a symlink")
    graph_raw = graph_path.read_bytes()
    graph = json.loads(graph_raw)
    existing = {row["id"] for row in graph.get("nodes", [])}
    ids = set()
    nodes = []
    counts = {}
    for row in fragment["nodes"]:
        if not isinstance(row, dict) or not ID.fullmatch(str(row.get("id", ""))) or row["id"] in ids:
            raise ValueError("semantic node ID is invalid or duplicated in the fragment")
        if row.get("file_type") not in FILE_TYPES or not isinstance(row.get("label"), str) or not row["label"]:
            raise ValueError("semantic node type or label is invalid")
        node, source = normalized(row, root, adapter, allowed)
        ids.add(node["id"])
        counts[source] = counts.get(source, 0) + 1
        nodes.append({**node, "_origin": "semantic"})
    if not counts or set(review.get("files", {})) != set(counts):
        raise ValueError("review must name exactly the documents with emitted semantic nodes")
    replaced = {row["id"] for row in graph["nodes"] if row.get("_origin") == "semantic" and
                adapter.local_path(row.get("source_file"), root) in counts}
    if any(row["id"] in existing - replaced for row in nodes):
        raise ValueError("semantic node ID collides with another source or AST node")
    for name, row in review["files"].items():
        file = state["files"][name]
        if row.get("sha256") != file["sha256"] or row.get("frontmatterReviewed") is not True:
            raise ValueError(f"source bytes or frontmatter review missing: {name}")
    git_status = subprocess.run(["git", "-C", str(root), "status", "--porcelain", "--", *sorted(counts)],
                                capture_output=True, text=True, encoding="utf-8")
    if git_status.returncode != 0 or git_status.stdout.strip():
        raise ValueError("semantic documents must be tracked and unchanged at HEAD")
    known = (existing - replaced) | ids
    edges = []
    for row in fragment["edges"]:
        if not isinstance(row, dict) or row.get("source") not in known or row.get("target") not in known:
            raise ValueError("semantic edge has a missing endpoint")
        confidence, score = row.get("confidence"), row.get("confidence_score")
        if confidence == "AMBIGUOUS":
            valid_score = isinstance(score, (int, float)) and 0.1 <= score <= 0.3
        else:
            valid_score = score in SCORES.get(confidence, set())
        if not valid_score or not isinstance(row.get("relation"), str) or not row["relation"]:
            raise ValueError("semantic edge confidence or relation is invalid")
        edge, _ = normalized(row, root, adapter, allowed)
        edges.append({**edge, "_origin": "semantic"})
    hyperedges = []
    for row in fragment["hyperedges"]:
        if not isinstance(row, dict) or not ID.fullmatch(str(row.get("id", ""))) or any(node not in known for node in row.get("nodes", [])):
            raise ValueError("semantic hyperedge has invalid ID or endpoints")
        edge, _ = normalized(row, root, adapter, allowed)
        hyperedges.append({**edge, "_origin": "semantic"})
    if len(hyperedges) > 3 or any(len(row["nodes"]) < 3 for row in hyperedges):
        raise ValueError("semantic hyperedges require 3+ members, max three per chunk")
    remaining_edges = [row for row in graph.get("links", []) if not
                       (row.get("_origin") == "semantic" and adapter.local_path(row.get("source_file"), root) in counts)]
    remaining_hyperedges = [row for row in graph.get("hyperedges", []) if not
                            (row.get("_origin") == "semantic" and adapter.local_path(row.get("source_file"), root) in counts)]
    if any(row.get("source") not in known or row.get("target") not in known for row in remaining_edges):
        raise ValueError("replacement would leave an existing edge dangling")
    if any(any(node not in known for node in row.get("nodes", [])) for row in remaining_hyperedges):
        raise ValueError("replacement would leave an existing hyperedge dangling")
    graph["nodes"] = [row for row in graph["nodes"] if row["id"] not in replaced]
    graph["links"] = remaining_edges
    graph["hyperedges"] = remaining_hyperedges
    if state["head"] != subprocess.run(["git", "-C", str(root), "rev-parse", "HEAD"], capture_output=True,
                                        text=True, encoding="utf-8").stdout.strip():
        raise ValueError("HEAD changed during semantic verification")
    return state, graph, graph_raw, fragment, review, nodes, edges, hyperedges, counts


def apply(root, fragment_path, review_path, prompt, dry_run):
    root = root.resolve()
    adapter = load_adapter(root)
    state, graph, graph_raw, fragment, review, nodes, edges, hyperedges, counts = checked_fragment(
        root, fragment_path, review_path, prompt, adapter)
    summary = {"status": "VALIDATED", "head": state["head"], "documents": len(counts), "nodes": len(nodes),
               "edges": len(edges), "hyperedges": len(hyperedges), "semanticPendingBefore": len(state["semantic"]["pending"])}
    if dry_run:
        return summary
    out = root / "graphify-out"
    if out.is_symlink():
        raise ValueError("graphify-out cannot be a symlink")
    manifest_path = out / "manifest.json"
    receipt_path = out / adapter.RECEIPT
    graph_path = out / "graph.json"
    old_manifest = manifest_path.read_bytes()
    old_receipt = receipt_path.read_bytes() if receipt_path.exists() else None
    lock = out / "knowledge-semantic-apply.lock"
    marker = uuid4().hex
    try:
        with lock.open("x", encoding="utf-8") as writer:
            writer.write(marker)
    except FileExistsError as exc:
        raise ValueError("another semantic writer owns the lock") from exc
    staged = None
    wrote_graph = False
    wrote_manifest = False
    try:
        if digest(graph_path.read_bytes()) != state["graphHash"] or manifest_path.read_bytes() != old_manifest:
            raise ValueError("graph or manifest changed during semantic validation")
        backup_dir = out / "semantic-backups" / marker
        if backup_dir.parent.is_symlink():
            raise ValueError("semantic backup directory cannot be a symlink")
        backup_dir.mkdir(parents=True, exist_ok=False)
        for name, raw in (("graph.json", graph_raw), ("manifest.json", old_manifest), ("knowledge-receipt.json", old_receipt)):
            if raw is None:
                continue
            with (backup_dir / name).open("xb") as writer:
                writer.write(raw)
                writer.flush()
                os.fsync(writer.fileno())
        # Normalize both the graph and native cache to the same walked,
        # repo-relative paths. Windows may resolve a temp root to its 8.3 name.
        cached = save_semantic_cache(nodes, edges, hyperedges, root=root,
                                     allowed_source_files=sorted(counts), prompt_file=prompt)
        if cached != len(counts):
            raise ValueError(f"native semantic cache accepted {cached}/{len(counts)} documents")
        graph["nodes"].extend(nodes)
        graph["links"].extend(edges)
        graph.setdefault("hyperedges", []).extend(hyperedges)
        rendered = json.dumps(graph, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        staged = out / ("knowledge-semantic-" + marker + ".tmp")
        if staged.resolve().parent != out.resolve():
            raise ValueError("semantic staging path escaped graphify-out")
        with staged.open("xb") as writer:
            writer.write(rendered)
            writer.flush()
            os.fsync(writer.fileno())
        if digest(graph_path.read_bytes()) != state["graphHash"] or manifest_path.read_bytes() != old_manifest:
            raise ValueError("graph or manifest changed before semantic replacement")
        os.replace(staged, graph_path)
        staged = None
        wrote_graph = True
        wrote_manifest = True
        save_manifest({"document": [str(root / name) for name in counts]}, manifest_path=str(manifest_path),
                      kind="semantic", root=root)
        after, graph_nodes, _ = adapter.inspect(root, prompt)
        if after["structural"]["status"] != "CURRENT":
            raise ValueError("structural graph changed after semantic import")
        evidence = {key: after[key] for key in ("schemaVersion", "version", "root", "head", "graphHash",
                                                  "corpusHash", "configHash", "promptHash")}
        evidence["files"] = {name: {"status": "success", "sha256": review["files"][name]["sha256"],
                                    "frontmatterReviewed": True, "nodeIds": sorted(node["id"] for node in nodes
                                                                                     if node["source_file"] == name)}
                             for name in sorted(counts)}
        evidence_path = out / ("semantic-evidence-" + digest(fragment_path.read_bytes())[:16] + ".json")
        evidence_path.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")
        recorded = adapter.record(root, prompt, evidence_path)
        if not set(counts) <= set(recorded["semantic"]["verified"]):
            raise ValueError("not all semantic documents were verified by the receipt")
        return {**summary, "status": "APPLIED", "nativeCacheFiles": cached, "backup": str(backup_dir),
                "evidence": str(evidence_path), "semanticVerified": len(recorded["semantic"]["verified"]),
                "semanticPendingAfter": len(recorded["semantic"]["pending"]),
                "refreshRequired": "graphify cluster-only . --no-label"}
    except Exception:
        if wrote_graph and digest(graph_path.read_bytes()) == digest(rendered):
            rollback = out / ("knowledge-semantic-rollback-" + marker + ".tmp")
            rollback.write_bytes(graph_raw)
            os.replace(rollback, graph_path)
        if wrote_manifest and manifest_path.exists():
            rollback = out / ("knowledge-manifest-rollback-" + marker + ".tmp")
            rollback.write_bytes(old_manifest)
            os.replace(rollback, manifest_path)
        if old_receipt is None and receipt_path.exists():
            receipt_path.unlink()
        elif old_receipt is not None and receipt_path.exists() and receipt_path.read_bytes() != old_receipt:
            rollback = out / ("knowledge-receipt-rollback-" + marker + ".tmp")
            rollback.write_bytes(old_receipt)
            os.replace(rollback, receipt_path)
        raise
    finally:
        if staged and staged.exists():
            staged.unlink()
        if lock.exists() and lock.read_text(encoding="utf-8") == marker:
            lock.unlink()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--fragment", type=Path, required=True)
    parser.add_argument("--review", type=Path, required=True)
    parser.add_argument("--prompt-file", type=Path, default=Path.home() / ".codex/skills/graphify/references/extraction-spec.md")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        print(json.dumps(apply(args.root, args.fragment.resolve(), args.review.resolve(), args.prompt_file.resolve(), args.check),
                         ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({"status": "REJECTED", "error": str(exc)}), file=sys.stderr)
        raise SystemExit(1) from None
