"""Read-only Graphify 0.9.61 inspection and explicit per-file evidence receipts.

inspect never rebuilds/stamps Graphify. record writes only its owned receipt after
checking native manifests and semantic output; it does not run an LLM.
"""
from __future__ import annotations

import argparse
import contextlib
import hashlib
import importlib.metadata
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unicodedata

VERSION = "0.9.61"
SCHEMA = 1
RECEIPT = "knowledge-receipt.json"
SEMANTIC_TYPES = {"document", "paper", "image"}


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def read_json(path, fallback=None):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8-sig"))


def local_path(value, root):
    if not isinstance(value, str) or not value or "://" in value:
        return None
    try:
        path = Path(value.replace("\\", "/"))
        if not path.is_absolute():
            path = root / path
        return unicodedata.normalize("NFC", path.resolve().relative_to(root).as_posix())
    except (OSError, ValueError):
        return None


def git(root, *args):
    result = subprocess.run(["git", "-c", f"safe.directory={root.as_posix()}", "-C", str(root), *args], capture_output=True, text=True, encoding="utf-8")
    return result.stdout.strip() if result.returncode == 0 else None


def install_git_read_scope(root):
    # Native detect calls git itself. A process-local safe-directory entry avoids
    # modifying global config when a sandbox reader has a different Windows SID.
    number = int(os.environ.get("GIT_CONFIG_COUNT", "0"))
    os.environ[f"GIT_CONFIG_KEY_{number}"] = "safe.directory"
    os.environ[f"GIT_CONFIG_VALUE_{number}"] = root.as_posix()
    os.environ["GIT_CONFIG_COUNT"] = str(number + 1)


def native_detect(root, temporary):
    # Graphify's detector caches word counts and may create conversion sidecars.
    # Redirect ALL library outputs into this disposable directory before import.
    os.environ["GRAPHIFY_OUT"] = str(temporary / "graphify-out")
    from graphify.detect import detect
    from graphify import cache
    # record inspects more than once in this process. The native package binds
    # this setting at import time, so rebind its output constants to this scan's
    # temporary directory before any count/conversion helper runs.
    for module_name, module in tuple(sys.modules.items()):
        if module_name == "graphify" or module_name.startswith("graphify."):
            for attribute in ("GRAPHIFY_OUT", "_GRAPHIFY_OUT"):
                if hasattr(module, attribute):
                    setattr(module, attribute, os.environ["GRAPHIFY_OUT"])
    warnings = io.StringIO()
    try:
        with contextlib.redirect_stdout(warnings), contextlib.redirect_stderr(warnings):
            result = detect(root, cache_root=temporary, google_workspace=False, follow_symlinks=False,
                            extra_excludes=["/graphify-out/", "/DTD Cargo/"])
    finally:
        # No atexit cache flush after TemporaryDirectory cleanup (no resurrection).
        cache._stat_index_dirty = False
    return result, warnings.getvalue().strip()


def config_hash(root, files):
    paths = {root / name for name in (".graphifyignore", ".gitignore")}
    # Every included source's ancestor rules can affect classification. A corpus
    # change caused by a new rule is independently caught by corpusHash.
    for name in files:
        for parent in (root / name).parents:
            if parent == root:
                break
            if root not in parent.parents:
                break
            paths.update(parent / item for item in (".graphifyignore", ".gitignore"))
    values = {path.relative_to(root).as_posix(): digest(path.read_bytes()) for path in sorted(paths) if path.is_file()}
    return digest(encoded(values))


class NodeIndex(dict):
    def __init__(self, root):
        super().__init__()
        self.root = root
        self.relations = {}


def node_fingerprint(nodes, ids):
    ignored = {"community", "community_name", "degree", "betweenness", "pagerank"}
    output = [{key: value for key, value in nodes[node_id].items() if key not in ignored} for node_id in sorted(ids)]
    source_paths = {local_path(nodes[node_id].get("source_file"), nodes.root) for node_id in ids}
    relations = [{key: value for key, value in relation.items() if key not in ignored}
                 for source in sorted(source_paths) for relation in nodes.relations.get(source, [])]
    return digest(encoded({"nodes": output, "relations": sorted(relations, key=lambda value: encoded(value))}))


def valid_semantic_row(row, name, state, nodes):
    if not isinstance(row, dict) or row.get("sha256") != state["files"][name]["sha256"]:
        return False
    ids = row.get("nodeIds")
    if not isinstance(ids, list) or not ids or len(set(ids)) != len(ids):
        return False
    for node_id in ids:
        node = nodes.get(node_id)
        if not node or node.get("_origin") != "semantic" or local_path(node.get("source_file"), Path(state["root"])) != name:
            return False
    return row.get("outputHash") == node_fingerprint(nodes, ids)


def inspect(root, prompt):
    out = root / "graphify-out"
    issues = []
    try:
        version = importlib.metadata.version("graphifyy")
    except importlib.metadata.PackageNotFoundError:
        version = None
    state = {"schemaVersion": SCHEMA, "requiredVersion": VERSION, "version": version, "root": str(root),
             "head": git(root, "rev-parse", "HEAD"), "graphHash": None, "corpusHash": None,
             "configHash": None, "promptHash": digest(prompt.read_bytes()) if prompt and prompt.is_file() else None,
             "files": {}, "graphSourcePaths": [], "issues": issues}
    if version != VERSION:
        issues.append({"code": "graphify_version", "severity": "error", "expected": VERSION, "actual": version})
        state["structural"] = {"status": "UNAVAILABLE", "pending": [], "missing": [], "deleted": [], "excluded": []}
        state["semantic"] = {"status": "UNAVAILABLE", "pending": [], "verified": [], "pendingReasons": {}}
        state["warnings"] = []
        return state, {}, {}
    if not state["promptHash"]:
        issues.append({"code": "semantic_prompt_unavailable", "severity": "warning"})
    with tempfile.TemporaryDirectory(prefix="knowledge-inspect-") as directory:
        detected, warnings = native_detect(root, Path(directory))
    if warnings:
        issues.append({"code": "detect_warning", "severity": "warning", "message": warnings})
    manifest_path = out / "manifest.json"
    try:
        raw_manifest = read_json(manifest_path, {})
        if not isinstance(raw_manifest, dict):
            raise ValueError("manifest must be an object")
    except (OSError, ValueError) as exc:
        raw_manifest = {}
        issues.append({"code": "manifest_invalid", "severity": "error", "message": str(exc)})
    manifest = {}
    for source, row in raw_manifest.items():
        relative = local_path(source, root)
        if relative:
            manifest[relative] = row if isinstance(row, dict) else {}
        else:
            issues.append({"code": "manifest_outside_root", "severity": "error", "source": source})
    for kind, names in detected.get("files", {}).items():
        for source in names:
            relative = local_path(source, root)
            if relative is None:
                issues.append({"code": "detected_sidecar_or_external", "severity": "error", "source": source})
                continue
            raw = (root / relative).read_bytes()
            md5 = hashlib.md5(raw, usedforsecurity=False).hexdigest()
            row = manifest.get(relative, {})
            state["files"][relative] = {"type": kind, "sha256": digest(raw), "astCurrent": row.get("ast_hash") == md5,
                                         "semanticNativeCurrent": row.get("semantic_hash") == md5}
    state["files"] = dict(sorted(state["files"].items()))
    state["corpusHash"] = digest(encoded({name: {"type": row["type"], "sha256": row["sha256"]} for name, row in state["files"].items()}))
    state["configHash"] = config_hash(root, state["files"])
    graph_path = out / "graph.json"
    graph = {}
    try:
        raw = graph_path.read_bytes()
        state["graphHash"] = digest(raw)
        graph = json.loads(raw)
        if not isinstance(graph, dict) or not isinstance(graph.get("nodes"), list):
            raise ValueError("graph must contain nodes array")
    except (OSError, ValueError) as exc:
        issues.append({"code": "graph_missing_or_invalid", "severity": "error", "message": str(exc)})
        graph = {}
    nodes = NodeIndex(root)
    sources = set()
    ast_sources = set()
    missing_sources = []
    for node in graph.get("nodes", []):
        if not isinstance(node, dict) or not isinstance(node.get("id"), str) or not node["id"]:
            issues.append({"code": "invalid_node", "severity": "error"})
            continue
        if node["id"] in nodes:
            issues.append({"code": "duplicate_node_id", "severity": "error", "id": node["id"]})
        nodes[node["id"]] = node
        if node.get("source_file"):
            name = local_path(node["source_file"], root)
            if name:
                sources.add(name)
                if node.get("_origin") == "ast":
                    ast_sources.add(name)
            else:
                missing_sources.append(node["source_file"])
    edges = graph.get("links", graph.get("edges", []))
    if not isinstance(edges, list):
        edges = []
        issues.append({"code": "invalid_edges", "severity": "error"})
    loops = 0
    dangling = 0
    for edge in edges:
        if not isinstance(edge, dict) or not isinstance(edge.get("source"), str) or not isinstance(edge.get("target"), str) or edge.get("source") not in nodes or edge.get("target") not in nodes:
            dangling += 1
            continue
        loops += edge["source"] == edge["target"]
        if edge.get("source_file"):
            name = local_path(edge["source_file"], root)
            if name:
                sources.add(name)
                if edge.get("_origin") == "semantic" or (edge.get("_origin") is None and any(nodes[item].get("_origin") == "semantic" for item in (edge["source"], edge["target"]))):
                    nodes.relations.setdefault(name, []).append(edge)
            else:
                missing_sources.append(edge["source_file"])
    hyperedges = graph.get("hyperedges", graph.get("graph", {}).get("hyperedges", []) if isinstance(graph.get("graph"), dict) else [])
    if not isinstance(hyperedges, list):
        hyperedges = []
        issues.append({"code": "invalid_hyperedges", "severity": "error"})
    for hyperedge in hyperedges:
        members = hyperedge.get("nodes") if isinstance(hyperedge, dict) else None
        if not isinstance(members, list) or not members or any(not isinstance(item, str) or item not in nodes for item in members):
            issues.append({"code": "dangling_hyperedge", "severity": "error"})
            continue
        if hyperedge.get("source_file"):
            name = local_path(hyperedge["source_file"], root)
            if name:
                sources.add(name)
                nodes.relations.setdefault(name, []).append(hyperedge)
            else:
                missing_sources.append(hyperedge["source_file"])
    if dangling:
        issues.append({"code": "dangling_edges", "severity": "error", "count": dangling})
    if loops:
        issues.append({"code": "self_loops", "severity": "warning", "count": loops})
    if missing_sources:
        issues.append({"code": "graph_external_sources", "severity": "error", "sources": sorted(set(missing_sources))})
    if not nodes:
        issues.append({"code": "graph_empty", "severity": "error"})
    state["graphSourcePaths"] = sorted(sources)
    state["counts"] = {"files": len(state["files"]), "nodes": len(nodes), "edges": len(edges),
                       "skippedSensitive": len(detected.get("skipped_sensitive", []))}
    absent = sorted((set(manifest) | sources) - set(state["files"]))
    deleted = [name for name in absent if not (root / name).exists()]
    excluded = [name for name in absent if (root / name).exists()]
    structural_names = [name for name, row in state["files"].items() if row["type"] in {"code", "document"}]
    # A manifest hash with no code node can be a failed extraction stamped by an
    # old Graphify run. Never certify it merely because its timestamp matches.
    missing = [name for name in structural_names if state["files"][name]["type"] == "code" and name not in ast_sources]
    pending = sorted({name for name in structural_names if not state["files"][name]["astCurrent"]} | set(missing))
    errors = any(issue["severity"] == "error" for issue in issues)
    state["structural"] = {"status": "INVALID" if errors else "PENDING" if pending or absent else "CURRENT",
                           "pending": pending, "missing": missing, "deleted": deleted, "excluded": excluded}
    try:
        receipt = read_json(out / RECEIPT, {})
        if not isinstance(receipt, dict):
            raise ValueError("receipt must be an object")
    except (OSError, ValueError):
        receipt = {}
        issues.append({"code": "receipt_invalid", "severity": "warning"})
    reusable = receipt.get("schemaVersion") == SCHEMA and receipt.get("version") == VERSION and receipt.get("root") == str(root) and receipt.get("promptHash") == state["promptHash"] and state["promptHash"] is not None
    reasons = {}
    verified = []
    rows = receipt.get("files", {}) if reusable else {}
    if not isinstance(rows, dict):
        rows = {}
    for name, row in state["files"].items():
        if row["type"] not in SEMANTIC_TYPES:
            continue
        reason = None
        if not row["semanticNativeCurrent"]:
            reason = "native_semantic_missing_or_changed"
        elif not reusable:
            reason = "full_bytes_evidence_missing_or_prompt_changed"
        elif not valid_semantic_row(rows.get(name), name, state, nodes):
            reason = "full_bytes_or_semantic_output_changed"
        if reason:
            reasons[name] = reason
        else:
            verified.append(name)
    state["semantic"] = {"status": "INVALID" if errors else "PENDING" if reasons or absent else "CURRENT",
                         "pending": sorted(reasons), "verified": sorted(verified), "pendingReasons": reasons}
    state["receipt"] = {"path": str(out / RECEIPT), "graphHash": receipt.get("graphHash"), "head": receipt.get("head")}
    state["warnings"] = [issue for issue in issues if issue["severity"] == "warning"]
    state["issues"] = [issue for issue in issues if issue["severity"] == "error"]
    return state, nodes, receipt


def record(root, prompt, evidence_path):
    out = root / "graphify-out"
    if out.is_symlink() or out.resolve().parent != root:
        raise ValueError("graphify-out must be a local non-symlink directory")
    out.mkdir(exist_ok=True)
    lock_path = out / "knowledge-record.lock"
    fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    temporary = None
    try:
        os.write(fd, str(os.getpid()).encode())
        os.close(fd)
        state, nodes, previous = inspect(root, prompt)
        if state["structural"]["status"] != "CURRENT":
            raise ValueError("structural graph must be current and valid before recording evidence")
        rows = {name: previous["files"][name] for name in state["semantic"]["verified"]}
        if evidence_path:
            evidence = read_json(evidence_path)
            if not isinstance(evidence, dict):
                raise ValueError("evidence must be an object")
            for key in ("schemaVersion", "version", "root", "head", "graphHash", "corpusHash", "configHash", "promptHash"):
                if evidence.get(key) != state[key] or state[key] is None:
                    raise ValueError(f"evidence {key} does not match inspected inputs")
            if not isinstance(evidence.get("files"), dict):
                raise ValueError("evidence.files must be an object")
            for name, item in evidence["files"].items():
                if not isinstance(item, dict) or item.get("status") != "success":
                    rows.pop(name, None)  # failed chunks invalidate previous coverage too
                    continue
                file = state["files"].get(name)
                if not file or file["type"] not in SEMANTIC_TYPES or not file["semanticNativeCurrent"]:
                    raise ValueError(f"semantic manifest is not current for {name}")
                if item.get("sha256") != file["sha256"] or item.get("frontmatterReviewed") is not True:
                    raise ValueError(f"full-file review evidence is missing or changed for {name}")
                row = {"sha256": item["sha256"], "nodeIds": item.get("nodeIds"), "frontmatterReviewed": True}
                try:
                    row["outputHash"] = node_fingerprint(nodes, row["nodeIds"])
                except (KeyError, TypeError):
                    raise ValueError(f"semantic node IDs are invalid for {name}") from None
                if not valid_semantic_row(row, name, state, nodes):
                    raise ValueError(f"semantic nodes must have matching source and semantic origin for {name}")
                rows[name] = row
        receipt = {key: state[key] for key in ("schemaVersion", "version", "root", "head", "graphHash", "corpusHash", "configHash", "promptHash")}
        receipt["files"] = dict(sorted(rows.items()))
        # Re-read every source plus graph: a write during review must not certify
        # a mixture of old extraction and new documents.
        for name, info in state["files"].items():
            if digest((root / name).read_bytes()) != info["sha256"]:
                raise ValueError("source changed during evidence recording")
        if digest((out / "graph.json").read_bytes()) != state["graphHash"] or config_hash(root, state["files"]) != state["configHash"]:
            raise ValueError("graph or policy changed during evidence recording")
        final_state, _, _ = inspect(root, prompt)
        for key in ("head", "graphHash", "corpusHash", "configHash", "promptHash"):
            if final_state[key] != state[key]:
                raise ValueError("source set, graph or policy changed during evidence recording")
        path = out / RECEIPT
        if path.is_symlink():
            raise ValueError("refusing to replace symlink receipt")
        payload = json.dumps(receipt, indent=2, ensure_ascii=False) + "\n"
        if not path.exists() or path.read_text(encoding="utf-8") != payload:
            fd, temporary = tempfile.mkstemp(prefix=".knowledge-receipt-", suffix=".tmp", dir=out)
            with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
                handle.write(payload)
            os.replace(temporary, path)
            temporary = None
        result, _, _ = inspect(root, prompt)
        result["recorded"] = True
        return result
    finally:
        if temporary and Path(temporary).exists():
            Path(temporary).unlink()
        lock_path.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("inspect", "record"))
    parser.add_argument("--root", default=".")
    parser.add_argument("--prompt-file")
    parser.add_argument("--semantic-evidence")
    args = parser.parse_args()
    root = Path(args.root).resolve()
    prompt = Path(args.prompt_file).resolve() if args.prompt_file else Path.home() / ".codex" / "skills" / "graphify" / "references" / "extraction-spec.md"
    install_git_read_scope(root)
    try:
        result = inspect(root, prompt)[0] if args.command == "inspect" else record(root, prompt, Path(args.semantic_evidence).resolve() if args.semantic_evidence else None)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except (OSError, ValueError, KeyError, TypeError, ImportError) as exc:
        print(json.dumps({"error": str(exc), "recorded": False, "root": str(root)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
