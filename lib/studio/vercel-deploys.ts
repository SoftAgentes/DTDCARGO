/**
 * Vercel API · historial de deploys del proyecto.
 *
 * Server-only. Usado por /studio/debug para mostrar los últimos deploys
 * sin que el founder tenga que abrir el dashboard de Vercel.
 *
 * Env vars requeridas (no `NEXT_PUBLIC_` — secrets):
 *   - VERCEL_API_TOKEN     — token de Vercel (https://vercel.com/account/tokens)
 *   - VERCEL_PROJECT_ID    — ID del proyecto (formato `prj_...`)
 *   - VERCEL_TEAM_ID       — opcional, si el proyecto vive en un team
 *
 * Si faltan, `listRecentDeploys()` devuelve `{ ok: false, reason: 'mock_no_token' }`
 * sin hacer HTTP request. El caller decide cómo mostrar el empty state.
 */

const API_BASE = "https://api.vercel.com";

export type VercelDeployState =
  | "READY"
  | "BUILDING"
  | "QUEUED"
  | "ERROR"
  | "CANCELED"
  | "INITIALIZING";

export type VercelDeployType = "production" | "preview";

export type DeployItem = {
  uid: string;
  url: string;          // dtdcargo-xxx.vercel.app
  state: VercelDeployState;
  type: VercelDeployType;
  createdAt: number;    // epoch ms
  commitSha: string | null;
  commitShaShort: string | null;
  commitMessage: string | null;
  branch: string | null;
  author: string | null;
};

export type ListDeploysResult =
  | { ok: true; deploys: DeployItem[] }
  | { ok: false; reason: "mock_no_token" | "api_error"; error?: string };

type VercelApiDeployment = {
  uid: string;
  url: string;
  state: VercelDeployState;
  target?: "production" | "preview" | null;
  created: number;
  meta?: {
    githubCommitSha?: string;
    gitCommitSha?: string;
    githubCommitMessage?: string;
    gitCommitMessage?: string;
    githubCommitRef?: string;
    gitCommitRef?: string;
    githubCommitAuthorName?: string;
    gitCommitAuthorName?: string;
  };
};

function normalize(d: VercelApiDeployment): DeployItem {
  const sha = d.meta?.githubCommitSha ?? d.meta?.gitCommitSha ?? null;
  const msg = d.meta?.githubCommitMessage ?? d.meta?.gitCommitMessage ?? null;
  // Vercel API trims commit message at first newline in some cases —
  // mantenemos solo la primera línea para mostrar tidy en la tabla.
  const msgClean = msg ? msg.split("\n")[0].trim() : null;
  return {
    uid: d.uid,
    url: d.url,
    state: d.state,
    type: d.target === "production" ? "production" : "preview",
    createdAt: d.created,
    commitSha: sha,
    commitShaShort: sha ? sha.slice(0, 7) : null,
    commitMessage: msgClean,
    branch: d.meta?.githubCommitRef ?? d.meta?.gitCommitRef ?? null,
    author: d.meta?.githubCommitAuthorName ?? d.meta?.gitCommitAuthorName ?? null,
  };
}

export async function listRecentDeploys(limit = 10): Promise<ListDeploysResult> {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token || !projectId) {
    return { ok: false, reason: "mock_no_token" };
  }

  const url = new URL(`${API_BASE}/v6/deployments`);
  url.searchParams.set("projectId", projectId);
  url.searchParams.set("limit", String(limit));
  if (teamId) url.searchParams.set("teamId", teamId);

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      // Server fetch · next.js cachea 60s para no bombardear la API en cada render
      next: { revalidate: 60, tags: ["vercel-deploys"] },
    });
    if (!res.ok) {
      return { ok: false, reason: "api_error", error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { deployments: VercelApiDeployment[] };
    return {
      ok: true,
      deploys: (data.deployments ?? []).map(normalize),
    };
  } catch (e) {
    return {
      ok: false,
      reason: "api_error",
      error: e instanceof Error ? e.message : "unknown",
    };
  }
}

/** Devuelve "hace 3 min", "hace 2 h", "hace 5 d" */
export function relativeTime(epochMs: number): string {
  const diff = Date.now() - epochMs;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `hace ${d} d`;
  const months = Math.round(d / 30);
  return `hace ${months} mes${months > 1 ? "es" : ""}`;
}
