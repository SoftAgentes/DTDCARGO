/**
 * Tipos compartidos del deploy web bot.
 *
 * NUNCA se importan en client components sin tree-shaking — algunos llevan
 * referencias a node:child_process.
 */

export type ScopeTag = "[web]" | "[studio]" | "[mixed]" | "[empty]";

export type DeployType = "preview" | "production";

export type GitPushResult =
  | {
      ok: true;
      branch: string;
      commitSha: string;
      commitShaShort: string;
      commitMessage: string;
      scopeTag: ScopeTag;
      filesChanged: number;
    }
  | {
      ok: false;
      step: "validate" | "git_add" | "git_commit" | "git_push" | "branch_create";
      error: string;
    };

export type GitStatusSnapshot = {
  hasChanges: boolean;
  currentBranch: string;
  pendingFiles: Array<{ status: string; path: string }>;
  scopeTag: ScopeTag;
};
