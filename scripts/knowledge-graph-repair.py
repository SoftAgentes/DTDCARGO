"""Remove one verified stale Graphify 0.9.61 node created from a historical comment.

This is deliberately not a general graph prune: other external paths remain
errors until their own source and provenance have been investigated.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import sys
from datetime import datetime, timezone
from uuid import uuid4

VERSION = "0.9.61"
NODE_ID = "ext_app_portal_auth_login_page_js"
EXTERNAL_SOURCE = "../app/portal/(auth)/login/page.js"
HISTORICAL_PATH = "../../app/portal/(auth)/login/page.js"
SCRIPT = "scripts/prune-next-types.mjs"
PROSE = "la referencia ../../app/portal/(auth)/login/page.js mediante import()"
OLD_EXAMPLE = 'import("../../app/portal/(auth)/login/page.js")'


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def check(root: Path):
    root = root.resolve()
    out = root / "graphify-out"
    graph_path = out / "graph.json"
    if out.is_symlink() or graph_path.is_symlink() or not graph_path.is_file():
        raise ValueError("local regular graphify-out/graph.json required")
    if importlib.metadata.version("graphifyy") != VERSION:
        raise ValueError(f"Graphify {VERSION} required")
    script_path = root / SCRIPT
    source = script_path.read_bytes()
    text = source.decode("utf-8")
    if PROSE not in text or OLD_EXAMPLE in text:
        raise ValueError("historical example is not the verified prose form")
    manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    native_hash = hashlib.md5(source, usedforsecurity=False).hexdigest()
    if manifest.get(SCRIPT, {}).get("ast_hash") != native_hash:
        raise ValueError("source AST stamp is stale; run graphify update first")

    raw = graph_path.read_bytes()
    graph = json.loads(raw)
    if not isinstance(graph, dict) or not isinstance(graph.get("nodes"), list):
        raise ValueError("invalid graph.json")
    matches = [node for node in graph["nodes"] if node.get("id") == NODE_ID]
    if not matches:
        return {"status": "UNCHANGED", "root": str(root), "graphHash": sha(raw), "node": NODE_ID}
    if len(matches) != 1 or matches[0].get("source_file") != EXTERNAL_SOURCE or matches[0].get("_origin") != "ast":
        raise ValueError("orphan identity or provenance does not match")
    links = graph.get("links", graph.get("edges", []))
    hyperedges = graph.get("hyperedges", [])
    if not isinstance(links, list) or not isinstance(hyperedges, list):
        raise ValueError("invalid graph relations")
    if any(edge.get("source") == NODE_ID or edge.get("target") == NODE_ID for edge in links if isinstance(edge, dict)):
        raise ValueError("historical node is connected; investigate rather than remove")
    if any(NODE_ID in (edge.get("nodes") or []) for edge in hyperedges if isinstance(edge, dict)):
        raise ValueError("historical node has a hyperedge; investigate rather than remove")

    # The pinned extractor must agree that the current script cannot emit this
    # path. Its cache stays in this checkout's ignored graphify-out directory.
    from graphify.extract import extract
    fresh = extract([script_path], cache_root=out / "repair-proof", root=root, parallel=False)
    if fresh.get("error") or any(HISTORICAL_PATH in json.dumps(row, ensure_ascii=False)
                                  for key in ("nodes", "edges") for row in fresh.get(key, [])):
        raise ValueError("native extraction still contains the historical path")
    return {"status": "REPAIRABLE", "root": str(root), "graphHash": sha(raw), "sourceHash": sha(source),
            "node": NODE_ID, "nodesBefore": len(graph["nodes"]), "graph": graph, "raw": raw}


def repair(root: Path, dry_run: bool):
    evidence = check(root)
    if evidence["status"] != "REPAIRABLE" or dry_run:
        return {key: value for key, value in evidence.items() if key not in ("graph", "raw")}
    out = Path(evidence["root"]) / "graphify-out"
    lock = out / "knowledge-graph-repair.lock"
    marker = uuid4().hex
    try:
        with lock.open("x", encoding="utf-8") as writer:
            writer.write(marker)
    except FileExistsError as exc:
        raise ValueError("another graph repair owns the lock") from exc
    staged = None
    try:
        if sha((out / "graph.json").read_bytes()) != evidence["graphHash"]:
            raise ValueError("graph changed after evidence check")
        backup_dir = out / "repair-backups"
        if backup_dir.is_symlink():
            raise ValueError("repair backup directory cannot be a symlink")
        backup_dir.mkdir(exist_ok=True)
        backup = backup_dir / ("orphan-" + evidence["graphHash"][:12] + "-" +
                               datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S") + "-" + marker + ".json")
        if backup.resolve().parent != backup_dir.resolve():
            raise ValueError("repair backup path escaped")
        with backup.open("xb") as writer:
            writer.write(evidence["raw"])
            writer.flush()
            os.fsync(writer.fileno())
        graph = evidence["graph"]
        graph["nodes"] = [node for node in graph["nodes"] if node.get("id") != NODE_ID]
        rendered = json.dumps(graph, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        staged = out / ("knowledge-graph-repair-" + marker + ".tmp")
        if staged.resolve().parent != out.resolve():
            raise ValueError("repair staging path escaped")
        with staged.open("xb") as writer:
            writer.write(rendered)
            writer.flush()
            os.fsync(writer.fileno())
        if len(json.loads(staged.read_bytes())["nodes"]) != evidence["nodesBefore"] - 1:
            raise ValueError("staged graph lost unexpected nodes")
        if sha((out / "graph.json").read_bytes()) != evidence["graphHash"]:
            raise ValueError("graph changed during staging")
        os.replace(staged, out / "graph.json")
        staged = None
        return {"status": "REPAIRED", "root": evidence["root"], "node": NODE_ID,
                "graphHashBefore": evidence["graphHash"], "graphHashAfter": sha(rendered),
                "nodesAfter": evidence["nodesBefore"] - 1, "backup": str(backup),
                "refreshRequired": "graphify cluster-only . --no-label"}
    finally:
        if staged and staged.exists():
            staged.unlink()
        if lock.exists() and lock.read_text(encoding="utf-8") == marker:
            lock.unlink()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--check", action="store_true", help="verify evidence without changing graph.json")
    args = parser.parse_args()
    try:
        print(json.dumps(repair(args.root, args.check), ensure_ascii=False))
    except (OSError, ValueError, json.JSONDecodeError, importlib.metadata.PackageNotFoundError) as exc:
        print(json.dumps({"status": "REJECTED", "error": str(exc)}), file=sys.stderr)
        raise SystemExit(1) from None
