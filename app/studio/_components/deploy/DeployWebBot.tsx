"use client";

/**
 * DeployWebBot · botón "Push" + modal de confirmación.
 *
 * Vive en el EnvBanner del Studio. Solo visible cuando estás en local
 * (env === "local") porque las server actions de deploy requieren acceso
 * al filesystem · en Vercel no funcionan (gate explícito en el action).
 *
 * Flow del modal:
 *   1. loading-status · llama a getDeployStatusAction() para leer git
 *   2. ready          · muestra archivos pendientes + form (tipo + msg)
 *   3. pushing        · ejecutando server action
 *   4. result         · éxito (con link a /studio/debug) o error
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getDeployStatusAction,
  gitPushAction,
} from "../../(app)/_actions/deployActions";
import type {
  DeployType,
  GitPushResult,
  GitStatusSnapshot,
} from "@/lib/studio/deploy/types";
import { ModalShell } from "../wiring/ProfileModal";

export function DeployButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="studio-btn studio-btn-primary studio-btn-sm"
        title="Subir cambios pendientes a Vercel"
        style={{ whiteSpace: "nowrap" }}
      >
        <span aria-hidden style={{ marginRight: 6 }}>↑</span>
        Push
      </button>
      {open && <DeployModal onClose={() => setOpen(false)} />}
    </>
  );
}

type Phase = "loading-status" | "ready" | "pushing" | "result";

function DeployModal({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("loading-status");
  const [snapshot, setSnapshot] = useState<GitStatusSnapshot | null>(null);
  const [type, setType] = useState<DeployType>("preview");
  const [commitMessage, setCommitMessage] = useState("");
  const [result, setResult] = useState<Extract<GitPushResult, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const r = await getDeployStatusAction();
      if (r.ok) {
        setSnapshot(r.snapshot);
        setPhase("ready");
      } else {
        setError(r.error);
        setPhase("result");
      }
    })();
  }, []);

  const handlePush = async () => {
    setPhase("pushing");
    setError(null);
    const r = await gitPushAction({
      type,
      commitMessage: commitMessage.trim() || undefined,
    });
    if (r.ok) {
      setResult(r);
    } else {
      setError(r.error);
    }
    setPhase("result");
  };

  return (
    <ModalShell title="Subir cambios" onClose={onClose} width={580}>
      <div style={{ padding: "var(--s-5) var(--s-6)" }}>
        {phase === "loading-status" && (
          <p style={{ color: "var(--ink-soft)", fontSize: 14, margin: 0 }}>
            Leyendo cambios pendientes…
          </p>
        )}

        {phase === "ready" && snapshot && (
          <ReadyView
            snapshot={snapshot}
            type={type}
            setType={setType}
            commitMessage={commitMessage}
            setCommitMessage={setCommitMessage}
            onPush={handlePush}
            onCancel={onClose}
          />
        )}

        {phase === "pushing" && (
          <PushingView />
        )}

        {phase === "result" && (
          <ResultView result={result} error={error} onClose={onClose} />
        )}
      </div>
    </ModalShell>
  );
}

function ReadyView({
  snapshot,
  type,
  setType,
  commitMessage,
  setCommitMessage,
  onPush,
  onCancel,
}: {
  snapshot: GitStatusSnapshot;
  type: DeployType;
  setType: (t: DeployType) => void;
  commitMessage: string;
  setCommitMessage: (s: string) => void;
  onPush: () => void;
  onCancel: () => void;
}) {
  const placeholder = `${snapshot.scopeTag} wip · (auto)`;
  const totalFiles = snapshot.pendingFiles.length;
  const isEmpty = totalFiles === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}>
      {/* Resumen */}
      <div>
        <div
          className="studio-eyebrow"
          style={{ color: "var(--ink-soft)", marginBottom: "var(--s-2)" }}
        >
          Scope detectado · {snapshot.scopeTag}
        </div>
        <p style={{ margin: 0, color: "var(--ink)", fontSize: 14 }}>
          {isEmpty ? (
            "No hay cambios pendientes."
          ) : (
            <>
              <strong>{totalFiles}</strong> archivo{totalFiles > 1 ? "s" : ""} para
              subir desde branch <code style={{ fontFamily: "var(--f-mono)" }}>{snapshot.currentBranch}</code>.
            </>
          )}
        </p>
      </div>

      {/* Lista de archivos */}
      {!isEmpty && (
        <div
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-sm)",
            padding: "var(--s-3)",
            maxHeight: 180,
            overflowY: "auto",
            fontFamily: "var(--f-mono)",
            fontSize: 12,
          }}
        >
          {snapshot.pendingFiles.map((f) => (
            <div key={f.path} style={{ color: "var(--ink-soft)" }}>
              <span style={{ color: "var(--warning)", fontWeight: 600 }}>
                {f.status.trim().padEnd(2)}
              </span>{" "}
              {f.path}
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      {!isEmpty && (
        <>
          <div>
            <label
              className="studio-label"
              htmlFor="deploy-type"
              style={{ display: "block", marginBottom: "var(--s-2)" }}
            >
              Destino
            </label>
            <div style={{ display: "flex", gap: "var(--s-2)" }}>
              <TypeButton
                label="Preview"
                desc="URL temporal"
                active={type === "preview"}
                onClick={() => setType("preview")}
              />
              <TypeButton
                label="Producción"
                desc="dtdcargo.com"
                active={type === "production"}
                onClick={() => setType("production")}
                accent="wine"
              />
            </div>
          </div>

          <div>
            <label
              className="studio-label"
              htmlFor="deploy-msg"
              style={{ display: "block", marginBottom: "var(--s-2)" }}
            >
              Mensaje del commit · vacío = auto
            </label>
            <input
              id="deploy-msg"
              className="studio-input"
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder={placeholder}
              style={{ width: "100%" }}
            />
          </div>
        </>
      )}

      {/* Botones */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--s-2)" }}>
        <button
          type="button"
          onClick={onCancel}
          className="studio-btn studio-btn-ghost studio-btn-sm"
        >
          Cancelar
        </button>
        {!isEmpty && (
          <button
            type="button"
            onClick={onPush}
            className={`studio-btn studio-btn-sm ${type === "production" ? "studio-btn-danger" : "studio-btn-primary"}`}
          >
            <span aria-hidden style={{ marginRight: 6 }}>↑</span>
            {type === "production" ? "Subir a producción" : "Subir a preview"}
          </button>
        )}
      </div>
    </div>
  );
}

function TypeButton({
  label,
  desc,
  active,
  onClick,
  accent = "info",
}: {
  label: string;
  desc: string;
  active: boolean;
  onClick: () => void;
  accent?: "info" | "wine";
}) {
  const activeColor = accent === "wine" ? "var(--wine)" : "var(--info)";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        textAlign: "left",
        padding: "var(--s-3) var(--s-4)",
        border: active ? `2px solid ${activeColor}` : "1px solid var(--border)",
        borderRadius: "var(--r-sm)",
        background: active ? "var(--bg-surface)" : "var(--bg-elevated)",
        cursor: "pointer",
        color: "var(--ink)",
        transition: "all 120ms",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 2 }}>
        {desc}
      </div>
    </button>
  );
}

function PushingView() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--s-3)",
        padding: "var(--s-6) 0",
      }}
    >
      <span
        className="studio-spin"
        aria-hidden
        style={{
          display: "inline-block",
          width: 32,
          height: 32,
          border: "3px solid var(--border)",
          borderTopColor: "var(--wine)",
          borderRadius: "50%",
        }}
      />
      <p style={{ color: "var(--ink-soft)", fontSize: 13, margin: 0 }}>
        Subiendo a GitHub… (esto puede tardar 10-20 seg)
      </p>
    </div>
  );
}

function ResultView({
  result,
  error,
  onClose,
}: {
  result: Extract<GitPushResult, { ok: true }> | null;
  error: string | null;
  onClose: () => void;
}) {
  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
        <div
          style={{
            background: "var(--danger-bg)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--r-sm)",
            padding: "var(--s-4)",
            color: "var(--danger)",
            fontSize: 13,
          }}
        >
          <strong style={{ display: "block", marginBottom: 4 }}>Algo falló</strong>
          {error}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            className="studio-btn studio-btn-ghost studio-btn-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
      <div
        style={{
          background: "var(--success-bg)",
          border: "1px solid var(--success)",
          borderRadius: "var(--r-sm)",
          padding: "var(--s-4)",
          color: "var(--ink)",
          fontSize: 13,
        }}
      >
        <strong style={{ display: "block", color: "var(--success)", marginBottom: 4 }}>
          Subido a GitHub
        </strong>
        <div style={{ marginTop: "var(--s-2)" }}>
          <div>Branch: <code style={{ fontFamily: "var(--f-mono)" }}>{result.branch}</code></div>
          <div>Commit: <code style={{ fontFamily: "var(--f-mono)" }}>{result.commitShaShort}</code> · {result.scopeTag}</div>
          <div style={{ color: "var(--ink-soft)" }}>{result.commitMessage}</div>
        </div>
        <p style={{ marginTop: "var(--s-3)", marginBottom: 0, color: "var(--ink-soft)" }}>
          Vercel ya está deployando · revisá el progreso en{" "}
          <Link
            href="/studio/debug"
            onClick={onClose}
            style={{ color: "var(--info)", textDecoration: "underline" }}
          >
            /studio/debug
          </Link>{" "}
          (sección &quot;Deploys recientes&quot;).
        </p>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onClose}
          className="studio-btn studio-btn-primary studio-btn-sm"
        >
          Listo
        </button>
      </div>
    </div>
  );
}
