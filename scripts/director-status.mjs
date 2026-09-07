/** Read-only evidence for Director. No fetch, writes, cleanup or secret reads. */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function run(bin, args, cwd) {
  const r = spawnSync(bin, args, { cwd, encoding: "utf8", timeout: 30_000,
    maxBuffer: 16 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } });
  return r.status === 0
    ? { available: true, output: r.stdout.trimEnd() }
    : { available: false, error: r.error?.code || r.stderr?.trim() || "command failed" };
}
const lines = (text) => text.split(/\r?\n/).filter(Boolean);
export function parseWorktrees(raw) {
  return raw.split("\0\0").filter(Boolean).map((record) => {
    const fields = record.split("\0");
    const get = (key) => fields.find((f) => f.startsWith(key + " "))?.slice(key.length + 1);
    return { path: get("worktree"), head: get("HEAD"), branch: get("branch") || null,
      detached: fields.includes("detached"), locked: fields.some((f) => f === "locked" || f.startsWith("locked ")) };
  });
}
export function overlaps(prs) {
  const result = [];
  for (let i = 0; i < prs.length; i++) for (let j = i + 1; j < prs.length; j++) {
    if (!prs[i].files || !prs[j].files) continue;
    const other = new Set(prs[j].files);
    const shared = prs[i].files.filter((f) => other.has(f));
    if (shared.length) result.push({ prs: [prs[i].number, prs[j].number], files: shared });
  }
  return result; // Shared filenames are a signal, never a semantic independence proof.
}
export function snapshot(cwd = process.cwd(), { offline = false } = {}) {
  const git = (...args) => run("git", args, cwd);
  const root = git("rev-parse", "--show-toplevel");
  if (!root.available) throw new Error("Not a Git repository");
  const report = { at: new Date().toISOString(), root: root.output, fetchPerformed: false,
    main: git("rev-parse", "--verify", "refs/heads/main"),
    originMain: git("log", "-1", "--format=%H %cI %s", "refs/remotes/origin/main"),
    worktrees: [], branches: [], prs: [], warnings: [] };
  const wts = git("worktree", "list", "--porcelain", "-z");
  if (!wts.available) throw new Error(wts.error);
  for (const wt of parseWorktrees(wts.output)) {
    const local = (...args) => run("git", args, wt.path);
    const status = local("status", "--porcelain=v1", "--untracked-files=all");
    const handoffs = local("ls-files", "--cached", "--others", "--exclude-standard", "--", ".agents/handoffs");
    let specs;
    try {
      specs = fs.readdirSync(path.join(wt.path, "docs/specs"), { withFileTypes: true })
        .filter((d) => d.isDirectory() && /^\d{4}-/.test(d.name)).map((d) => {
          const file = path.join(wt.path, "docs/specs", d.name, "spec.md");
          try {
            const body = fs.readFileSync(file, "utf8");
            return { path: "docs/specs/" + d.name + "/spec.md",
              status: body.match(/^status:\s*(.+)$/m)?.[1] || "unknown" };
          } catch { return { path: "docs/specs/" + d.name, status: "unreadable" }; }
        });
    } catch { specs = null; }
    const claimPath = local("rev-parse", "--absolute-git-dir");
    let claim = null;
    if (claimPath.available) {
      try { claim = JSON.parse(fs.readFileSync(path.join(claimPath.output, "harness-session-claim.json"), "utf8")); }
      catch (error) { if (error.code !== "ENOENT") claim = { error: "unreadable claim" }; }
    }
    report.worktrees.push({ ...wt, status, handoffs, specs, claim, sessionActivity: "NOT_VERIFIED",
      commits: local("log", "-5", "--format=%H %cI %s") });
  }
  const branches = git("for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes", "refs/dtd");
  if (branches.available) for (const ref of lines(branches.output)) {
    report.branches.push({ ref, divergence: git("rev-list", "--left-right", "--count", "origin/main..." + ref),
      changedFiles: git("diff", "--name-only", "origin/main..." + ref),
      handoffs: git("ls-tree", "-r", "--name-only", ref, "--", ".agents/handoffs") });
  } else report.warnings.push("Branch inventory unavailable");
  report.github = { available: false, reason: offline ? "OFFLINE requested" : "unavailable" };
  if (!offline) {
    const repository = run("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], cwd);
    if (repository.available) {
      const listing = run("gh", ["api", "--paginate", "--slurp",
        "repos/" + repository.output + "/pulls?state=open&per_page=100"], cwd);
      if (listing.available) {
        try {
          const entries = JSON.parse(listing.output).flat();
          report.github = { available: true, repository: repository.output };
          for (const pr of entries) {
            const details = run("gh", ["pr", "view", String(pr.number), "--json",
              "number,title,url,headRefName,headRefOid,baseRefName,isDraft,mergeable,mergeStateStatus,statusCheckRollup,reviewDecision"], cwd);
            const files = run("gh", ["api", "--paginate", "--slurp",
              "repos/" + repository.output + "/pulls/" + pr.number + "/files?per_page=100"], cwd);
            const record = details.available ? JSON.parse(details.output) :
              { number: pr.number, title: pr.title, url: pr.html_url, detailsUnavailable: true };
            record.files = files.available ? JSON.parse(files.output).flat().map((f) => f.filename) : null;
            if (!record.files || !details.available) report.warnings.push("Incomplete PR #" + pr.number);
            if (record.files?.length >= 3000) report.warnings.push("GitHub file limit reached for PR #" + pr.number);
            report.prs.push(record);
          }
        } catch { report.github = { available: false, reason: "Invalid or incomplete GitHub response" }; }
      } else report.github = { available: false, reason: listing.error };
    } else report.github = { available: false, reason: repository.error };
  }
  report.overlaps = overlaps(report.prs);
  report.warnings.push("Stored refs may be stale; refresh explicitly. Clean does not mean finished. No session liveness proof.");
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.slice(2).some((a) => a !== "--offline")) throw new Error("Usage: director-status.mjs [--offline]");
    console.log(JSON.stringify(snapshot(process.cwd(), { offline: process.argv.includes("--offline") }), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
