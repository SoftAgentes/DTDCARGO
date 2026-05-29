/**
 * git-runner.ts · wrapper de child_process para ejecutar git desde el server.
 *
 * Server-only. Usado por la server action `gitPushAction` del deploy web bot.
 * NUNCA se usa en producción (gate por VERCEL_ENV en el caller).
 *
 * Razones de diseño:
 *  - Usamos `execFile` con array de args (no `exec` con string) para evitar
 *    shell injection · el commitMessage del usuario va como arg, no como
 *    string concatenado
 *  - Timeout por comando para evitar git que se cuelga (auth prompts, etc)
 *  - Captura stdout/stderr para devolver errores reales al UI
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitStatusSnapshot, ScopeTag } from "./types";

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 60_000;

type GitOk = { ok: true; stdout: string; stderr: string };
type GitErr = { ok: false; stdout: string; stderr: string; exitCode: number };
type GitResult = GitOk | GitErr;

async function git(cwd: string, args: string[]): Promise<GitResult> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      timeout: TIMEOUT_MS,
      maxBuffer: 1024 * 1024 * 10,
    });
    return { ok: true, stdout, stderr };
  } catch (e) {
    const err = e as {
      stdout?: string;
      stderr?: string;
      code?: number;
      message?: string;
    };
    return {
      ok: false,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? err.message ?? "unknown",
      exitCode: err.code ?? 1,
    };
  }
}

function detectScopeTag(porcelainLines: string[]): ScopeTag {
  if (porcelainLines.length === 0) return "[empty]";
  const studioCount = porcelainLines.filter((l) => l.includes("app/studio")).length;
  const otherCount = porcelainLines.length - studioCount;
  if (studioCount > 0 && otherCount > 0) return "[mixed]";
  if (studioCount > 0) return "[studio]";
  if (otherCount > 0) return "[web]";
  return "[empty]";
}

export async function getGitStatus(cwd: string): Promise<GitStatusSnapshot> {
  const [statusRes, branchRes] = await Promise.all([
    git(cwd, ["status", "--porcelain"]),
    git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]),
  ]);

  const lines = statusRes.ok
    ? statusRes.stdout.split("\n").filter((l) => l.trim().length > 0)
    : [];

  const pendingFiles = lines.map((l) => ({
    status: l.slice(0, 2),
    path: l.slice(3),
  }));

  return {
    hasChanges: lines.length > 0,
    currentBranch: branchRes.ok ? branchRes.stdout.trim() : "unknown",
    pendingFiles,
    scopeTag: detectScopeTag(lines),
  };
}

export async function gitAddAll(cwd: string): Promise<GitResult> {
  return git(cwd, ["add", "-A"]);
}

export async function gitCommit(cwd: string, message: string): Promise<GitResult> {
  return git(cwd, ["commit", "-m", message]);
}

export async function gitCheckoutNewBranch(
  cwd: string,
  branchName: string,
): Promise<GitResult> {
  return git(cwd, ["checkout", "-b", branchName]);
}

export async function gitPushSetUpstream(
  cwd: string,
  branchName: string,
): Promise<GitResult> {
  return git(cwd, ["push", "-u", "origin", branchName]);
}

export async function gitPush(cwd: string, branchName: string): Promise<GitResult> {
  return git(cwd, ["push", "origin", branchName]);
}

export async function gitRevParse(cwd: string, ref = "HEAD"): Promise<string | null> {
  const r = await git(cwd, ["rev-parse", ref]);
  return r.ok ? r.stdout.trim() : null;
}

export function makePreviewBranchName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `preview/${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}
