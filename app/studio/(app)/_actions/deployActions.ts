"use server";

/**
 * Server actions del deploy web bot.
 *
 * IMPORTANTE: estas actions solo funcionan en LOCAL (`pnpm dev`). En cualquier
 * despliegue (Vercel, o Docker en el servidor propio) el server no tiene acceso
 * al filesystem del founder ni a su .git · por eso todas pasan por
 * `isLocalRuntime()` (`lib/runtime/app-env.ts`), que falla cerrado: sin señal
 * explícita, `NODE_ENV=production` NO es local. Leer `VERCEL_ENV` a secas
 * dejaba este candado abierto en Docker (M1 · auditoría 2026-07-31 · SDD-0505).
 *
 * Patrón de retorno: `{ ok: true, ...data }` o `{ ok: false, error: "..." }`.
 * Sin throws · errores se propagan como propiedades del objeto.
 */

import {
  gitAddAll,
  gitCheckoutNewBranch,
  gitCommit,
  gitPush,
  gitPushSetUpstream,
  gitRevParse,
  getGitStatus,
  makePreviewBranchName,
} from "@/lib/studio/deploy/git-runner";
import type { DeployType, GitPushResult } from "@/lib/studio/deploy/types";
import { createClient } from "@/lib/db/server";
import { getStudioRole } from "@/lib/studio/rbac-guard";
import { isLocalRuntime } from "@/lib/runtime/app-env";

const REPO_PATH = process.cwd();

/**
 * Gate centralizado: las server actions de deploy solo deben correr en local.
 * Se evalúa en cada llamada (no al cargar el módulo) para que un cambio de
 * entorno en caliente no deje una decisión vieja cacheada.
 */
function assertLocal(): { ok: false; error: string } | null {
  if (!isLocalRuntime()) {
    return {
      ok: false,
      error:
        "Esta acción solo funciona corriendo en local (`pnpm dev`): en producción, staging o preview el servidor no tiene acceso a tu filesystem ni a tu .git.",
    };
  }
  return null;
}

async function assertAuthorizedLocal(): Promise<{ ok: false; error: string } | null> {
  const localGate = assertLocal();
  if (localGate) return localGate;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autorizado." };
  const role = await getStudioRole(supabase);
  if (role !== "admin") return { ok: false, error: "No autorizado." };
  return null;
}

/**
 * Devuelve un snapshot del git status actual para que la UI pueda mostrar
 * qué se va a subir antes de confirmar. Safe para mostrar al cliente.
 */
export async function getDeployStatusAction() {
  const gate = await assertAuthorizedLocal();
  if (gate) return gate;
  const snapshot = await getGitStatus(REPO_PATH);
  return { ok: true as const, snapshot };
}

type GitPushInput = {
  type: DeployType;
  commitMessage?: string;
};

function defaultCommitMessage(scopeTag: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `${scopeTag} wip · ${ts}`;
}

/**
 * Ejecuta el flow completo de push:
 *   1. Validate (gate + git status)
 *   2. git add -A
 *   3. git commit -m
 *   4. checkout -b (si preview) / checkout main + merge (si production)
 *   5. git push
 *
 * No espera la publicación ni corre la prueba rápida: lo que llega a `main`
 * lo construye GitHub y lo publica el vigilante del servidor (SDD-0541), y su
 * avance se ve en /studio/debug, card "Publicaciones del servidor" (SDD-0547).
 *
 * Lo que NO hace V1 (intencional):
 *   - Promover una rama `preview/*` a producción (eso va por PR)
 *   - typecheck/lint pre-push (el build de la imagen falla si hay errores TS)
 *   - Smoke test post-deploy (lo corre el vigilante; si falla, vuelve atrás)
 */
export async function gitPushAction(
  input: GitPushInput,
): Promise<GitPushResult> {
  const gate = await assertAuthorizedLocal();
  if (gate) return { ok: false, step: "validate", error: gate.error };

  // 1. Validate
  const snapshot = await getGitStatus(REPO_PATH);
  if (!snapshot.hasChanges) {
    return {
      ok: false,
      step: "validate",
      error: "No hay cambios pendientes para commitear.",
    };
  }
  // Detectar archivos sensibles
  const dangerFiles = snapshot.pendingFiles.filter((f) =>
    /\.env(\.|$)|secret|credential/i.test(f.path),
  );
  if (dangerFiles.length > 0) {
    return {
      ok: false,
      step: "validate",
      error: `Archivos sensibles detectados (.env / secret / credential): ${dangerFiles
        .map((f) => f.path)
        .join(", ")}. Revisar manualmente antes de subir.`,
    };
  }

  const commitMessage =
    input.commitMessage?.trim() || defaultCommitMessage(snapshot.scopeTag);

  // 2. Determinar branch
  //    - production: requiere estar en main
  //    - preview:
  //        si estás en main → crear branch nueva preview/timestamp
  //        si ya estás en preview/* → push a la branch existente (no crear otra)
  //        si estás en otra rama → crear preview/timestamp
  const isProd = input.type === "production";
  let targetBranch: string;
  let createNewBranch = false;
  if (isProd) {
    if (snapshot.currentBranch !== "main") {
      return {
        ok: false,
        step: "validate",
        error: `Para producción tienes que estar en branch 'main'. Estás en '${snapshot.currentBranch}'. Haz checkout manual primero.`,
      };
    }
    targetBranch = "main";
  } else {
    if (snapshot.currentBranch.startsWith("preview/")) {
      // Ya estás en una branch preview existente · push a la misma
      targetBranch = snapshot.currentBranch;
      createNewBranch = false;
    } else {
      // Crear branch preview nueva desde donde estés
      targetBranch = makePreviewBranchName();
      createNewBranch = true;
    }
  }

  // 3. git add
  const addRes = await gitAddAll(REPO_PATH);
  if (!addRes.ok) {
    return { ok: false, step: "git_add", error: addRes.stderr || "git add falló" };
  }

  // 4. git commit
  const commitRes = await gitCommit(REPO_PATH, commitMessage);
  if (!commitRes.ok) {
    return {
      ok: false,
      step: "git_commit",
      error: commitRes.stderr || "git commit falló",
    };
  }

  // 5. Branch handling
  if (createNewBranch) {
    const branchRes = await gitCheckoutNewBranch(REPO_PATH, targetBranch);
    if (!branchRes.ok) {
      return {
        ok: false,
        step: "branch_create",
        error: branchRes.stderr || `No se pudo crear branch ${targetBranch}`,
      };
    }
  }

  // 6. Push (push directo si la branch ya existe en remote, set-upstream si nueva)
  const pushRes = isProd || !createNewBranch
    ? await gitPush(REPO_PATH, targetBranch)
    : await gitPushSetUpstream(REPO_PATH, targetBranch);
  if (!pushRes.ok) {
    return {
      ok: false,
      step: "git_push",
      error: pushRes.stderr || "git push falló",
    };
  }

  const commitSha = (await gitRevParse(REPO_PATH)) ?? "";
  return {
    ok: true,
    branch: targetBranch,
    commitSha,
    commitShaShort: commitSha.slice(0, 7),
    commitMessage,
    scopeTag: snapshot.scopeTag,
    filesChanged: snapshot.pendingFiles.length,
  };
}
