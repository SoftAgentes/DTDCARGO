/**
 * SDD-0625 · Lista «Publicadas» y «Retiradas».
 *
 * Publicadas: titular, fecha, categoría y estado; «Corregir» abre el editor y
 * «Retirar» la pantalla de retiro con motivo (§4.11 de la 0611). Retiradas:
 * «Volver a publicar» con ActionButton (anti doble clic) y toast con enlace.
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { useRowHighlight } from "@/app/studio/_components/ui/useRowHighlight";
import { Icon } from "@/app/studio/_components/icons";
import { getCategoryInfo } from "@/lib/news/categories";
import { MOTIVOS_RETIRO, type MotivoRetiro } from "@/lib/news/autopublicar/motivos";
import type { NoticiaPublicada, NoticiaRetirada } from "@/lib/studio/news-publicadas-queries";
import { volverAPublicar } from "../actions";

const BASE = "/studio/marketing/noticias-web/publicadas";

function fecha(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" });
}

const celda: React.CSSProperties = {
  padding: "12px 10px",
  borderBottom: "1px solid var(--color-grey-200, #E5E2DC)",
  fontSize: 14,
  verticalAlign: "middle",
};
const cabecera: React.CSSProperties = {
  ...celda,
  fontSize: 12,
  fontWeight: 600,
  color: "var(--color-grey-500, #6B6B6B)",
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

export function PublicadasClient({
  publicadas,
  retiradas,
  error,
}: {
  publicadas: NoticiaPublicada[];
  retiradas: NoticiaRetirada[];
  error: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const flashClassFor = useRowHighlight();
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  if (error) {
    return (
      <Aviso tono="error">
        {error}. Recarga la página; si sigue, avisa al equipo técnico.
      </Aviso>
    );
  }

  return (
    <div style={{ display: "grid", gap: 36 }}>
      <section aria-labelledby="titulo-publicadas">
        <h2 id="titulo-publicadas" style={{ fontSize: 18, fontWeight: 700, margin: "0 0 12px" }}>
          En el sitio ({publicadas.length})
        </h2>
        {publicadas.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--color-grey-500, #6B6B6B)" }}>
            Todavía no hay noticias publicadas. Crea la primera en «Nueva noticia».
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr>
                  <th scope="col" style={cabecera}>Titular</th>
                  <th scope="col" style={cabecera}>Fecha</th>
                  <th scope="col" style={cabecera}>Categoría</th>
                  <th scope="col" style={cabecera}>Estado</th>
                  <th scope="col" style={{ ...cabecera, textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {publicadas.map((p) => (
                  <tr key={p.id} data-row-id={p.id} className={flashClassFor(p.id)}>
                    <td style={{ ...celda, fontWeight: 600, maxWidth: 420 }}>{p.title}</td>
                    <td style={{ ...celda, whiteSpace: "nowrap" }}>{fecha(p.date)}</td>
                    <td style={celda}>{getCategoryInfo(p.categoria).label}</td>
                    <td style={celda}>
                      <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
                        <Badge tone="success" size="sm">Publicada</Badge>
                        {p.publish_via === "automatica" ? <Badge tone="info" size="sm">Publicada sola</Badge> : null}
                      </span>
                    </td>
                    <td style={{ ...celda, textAlign: "right", whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", gap: 8, justifyContent: "flex-end" }}>
                        <a
                          className="studio-btn studio-btn-ghost studio-btn-sm"
                          href={`/noticias/${p.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Ver «${p.title}» en el sitio (abre otra pestaña)`}
                        >
                          {Icon.external(14)} Ver
                        </a>
                        <Link className="studio-btn studio-btn-dark studio-btn-sm" href={`${BASE}/${p.id}`}>
                          {Icon.edit(14)} Corregir
                        </Link>
                        <Link
                          className="studio-btn studio-btn-ghost studio-btn-sm"
                          href={`/studio/marketing/noticias-web/retirar/${p.id}`}
                          style={{ color: "var(--color-status-danger, #c2353f)", marginLeft: "var(--s-3, 12px)" }}
                        >
                          Retirar
                        </Link>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="titulo-retiradas">
        <h2 id="titulo-retiradas" style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
          Retiradas ({retiradas.length})
        </h2>
        <p style={{ fontSize: 13, color: "var(--color-grey-500, #6B6B6B)", margin: "0 0 12px" }}>
          No se ven en el sitio. Volver a publicar la deja otra vez en /noticias con el mismo enlace.
        </p>
        {errorAccion ? (
          <div style={{ marginBottom: 12 }}>
            <Aviso tono="error">{errorAccion}</Aviso>
          </div>
        ) : null}
        {retiradas.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--color-grey-500, #6B6B6B)" }}>No hay noticias retiradas.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr>
                  <th scope="col" style={cabecera}>Titular</th>
                  <th scope="col" style={cabecera}>Retirada el</th>
                  <th scope="col" style={cabecera}>Motivo</th>
                  <th scope="col" style={{ ...cabecera, textAlign: "right" }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {retiradas.map((r) => (
                  <tr key={r.id} data-row-id={r.id} className={flashClassFor(r.id)}>
                    <td style={{ ...celda, fontWeight: 600, maxWidth: 420 }}>{r.title}</td>
                    <td style={{ ...celda, whiteSpace: "nowrap" }}>{fecha(r.retiradaEl)}</td>
                    <td style={celda}>
                      {r.motivo && r.motivo in MOTIVOS_RETIRO ? (
                        MOTIVOS_RETIRO[r.motivo as MotivoRetiro]
                      ) : (
                        <Badge tone="warning" size="sm">Motivo pendiente</Badge>
                      )}
                    </td>
                    <td style={{ ...celda, textAlign: "right" }}>
                      <ActionButton
                        variant="dark"
                        size="sm"
                        idleLabel="Volver a publicar"
                        loadingLabel="Publicando…"
                        successLabel="Publicada"
                        idleIcon={Icon.refresh(14)}
                        successIcon={Icon.check(14)}
                        onAction={async () => {
                          setErrorAccion(null);
                          const res = await volverAPublicar(r.id);
                          return res.ok ? undefined : { error: res.error };
                        }}
                        onError={setErrorAccion}
                        onSuccess={() => {
                          toast.success(`«${r.title}» está otra vez en el sitio`, {
                            link: { href: `${BASE}?highlight=${r.id}&hl-tone=success`, label: "Ver en Publicadas" },
                          });
                          router.refresh();
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
