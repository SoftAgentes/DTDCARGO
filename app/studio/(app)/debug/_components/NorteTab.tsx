/**
 * Pestaña Norte de la torre de control (SDD-0050 Slice B).
 *
 * Embebe el "Norte visual" — el snapshot horneado en el build (`public/norte.html`,
 * generado por `scripts/norte.mjs` en el `postbuild`). El Norte vivo e interactivo
 * corre SOLO en local (lee el filesystem del repo); en la web servimos el HTML
 * estático del último deploy.
 *
 * Banner de limitación OBLIGATORIO (requisito no-negociable del founder): declara
 * que es un snapshot y que los links "Abrir ↗" a los mockups individuales no
 * funcionan en la web (apuntan a archivos que solo existen en local). El banner es
 * MODE-AWARE usando el `EnvName` que el server pasa desde `getEnvStatus()`:
 *   - web (preview/prod) → banner ámbar (warning): es un snapshot, links rotos.
 *   - local              → banner verde (success): snapshot local, cómo regenerar.
 *
 * Solo tokens `var(--*)` del sistema (sin hex inventados) y dots de color en vez
 * de emojis decorativos (regla de marca C5). El iframe usa un height generoso para
 * que el Norte (página larga con su propio scroll) se vea cómodo.
 */

import type { EnvName } from "@/lib/studio/env-status";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

const SNAPSHOT_SRC = "/norte.html";

export function NorteTab({ env }: { env: EnvName }) {
  const isWeb = env === "preview" || env === "production";

  // Web = atención (limitación real); local = información.

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
      {/* Banner de limitación OBLIGATORIO (mode-aware) */}
      <div data-norte-mode={isWeb ? "web" : "local"}>
        <Aviso tono={isWeb ? "atencion" : "info"} compacto>
          {isWeb ? (
            <span>
              <strong>Snapshot del último deploy.</strong>{" "}
              La versión viva e interactiva del Norte es{" "}
              <strong>local</strong> (
              <code style={{ fontFamily: "var(--f-mono)" }}>node scripts/norte.mjs</code> →{" "}
              <code style={{ fontFamily: "var(--f-mono)" }}>:3010</code>). En la web, los
              links <strong>&ldquo;Abrir ↗&rdquo;</strong> a los mockups individuales{" "}
              <strong>no funcionan</strong> (solo local).
            </span>
          ) : (
            <span>
              <strong>Snapshot local.</strong>{" "}
              Regeneralo con{" "}
              <code style={{ fontFamily: "var(--f-mono)" }}>node scripts/norte.mjs</code>.
              La versión navegable completa la sirves en{" "}
              <code style={{ fontFamily: "var(--f-mono)" }}>:3010</code>.
            </span>
          )}
        </Aviso>
      </div>

      {/* Snapshot embebido */}
      <iframe
        src={SNAPSHOT_SRC}
        title="Norte visual · snapshot"
        loading="lazy"
        style={{
          width: "100%",
          height: "calc(100vh - 240px)",
          minHeight: 560,
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          background: "var(--bg-surface)",
        }}
      />
    </div>
  );
}
