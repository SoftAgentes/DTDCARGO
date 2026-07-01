/**
 * Módulo de Marketing · Dashboard "buenos días" (SDD-0119).
 *
 * Vista de inicio del módulo de Marketing. Es del ROL/área de marketing
 * (lo ve quien tenga acceso vía RBAC), NO de una persona concreta: el saludo
 * es dinámico según el usuario autenticado ("Buenos días, {nombre}").
 *
 * Cascarón V1 (este commit):
 *  - Header con saludo + rol supervisora.
 *  - "Tareas del día" → placeholder; las auto-generará el Motor de Noticias +
 *    calendario + motores multicanal (specs 0088/0089/0090/0091).
 *  - Grid de navegación del módulo (HUB · Calendario · Motor de Noticias ·
 *    Academia · Comunidad) — HUB/Calendario son rutas internas placeholder;
 *    Motor/Academia/Comunidad enlazan a sus módulos existentes.
 *  - "Reportar fricción" → semilla de la cola de automatización para Sam.
 *
 * Guard: requireModuleView("marketing") (RBAC SDD-0085). Datos del usuario
 * server-fetched; el saludo reusa el patrón del dashboard operativo.
 */

import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { Icon, type IconName } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";

export const metadata = { title: "Marketing · DTD Studio" };
export const dynamic = "force-dynamic";

const VE_TZ = "America/Caracas";

function firstNameFromUser(
  meta: Record<string, unknown> | undefined,
  email: string | undefined,
): string | null {
  const fromMeta =
    (meta?.first_name as string | undefined) ??
    (meta?.given_name as string | undefined) ??
    (typeof meta?.full_name === "string"
      ? (meta.full_name as string).split(" ")[0]
      : undefined) ??
    (typeof meta?.name === "string" ? (meta.name as string).split(" ")[0] : undefined);
  if (fromMeta && fromMeta.trim().length > 0) return fromMeta.trim();
  if (email) {
    const local = email.split("@")[0]?.split(/[.+_-]/)[0];
    if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return null;
}

function greetingForHourVE(now: Date): string {
  const hourStr = new Intl.DateTimeFormat("es-VE", {
    timeZone: VE_TZ,
    hour: "numeric",
    hour12: false,
  }).format(now);
  const hour = parseInt(hourStr, 10);
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function eyebrowDateVE(now: Date): string {
  const fmt = new Intl.DateTimeFormat("es-VE", {
    timeZone: VE_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(now);
  return fmt.replace(/\./g, "").toUpperCase();
}

type Section = {
  href: string;
  icon: IconName;
  title: string;
  desc: string;
  status: "Disponible" | "Próximamente";
};

const SECTIONS: Section[] = [
  {
    href: "/studio/marketing/hub",
    icon: "download",
    title: "HUB de marca",
    desc: "Logos descargables, fondos y portadas por red, plantillas de marca y herramientas.",
    status: "Disponible",
  },
  {
    href: "/studio/marketing/calendario",
    icon: "clock",
    title: "Calendario de contenido",
    desc: "Fechas clave de Venezuela y China que alimentan las tareas del día.",
    status: "Disponible",
  },
  {
    href: "/studio/marketing/noticias-web",
    icon: "doc",
    title: "Motor de Noticias",
    desc: "Genera noticias SEO/GEO y atomiza en sugeridos por red (TikTok · IG · Facebook).",
    status: "Disponible",
  },
  {
    href: "/studio/academia",
    icon: "star",
    title: "Academia",
    desc: "Cursos de formación (cómo comprar en Alibaba) e insumos para la comunidad.",
    status: "Disponible",
  },
  {
    href: "/studio/club",
    icon: "users",
    title: "Comunidad",
    desc: "Club DTD: miembros, eventos y la semilla del grupo privado de importadores.",
    status: "Disponible",
  },
];

export default async function MarketingPage() {
  await requireModuleView("marketing");

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();

  const now = new Date();
  const firstName = firstNameFromUser(
    userResp.user?.user_metadata,
    userResp.user?.email,
  );
  const greeting = greetingForHourVE(now);
  const subject = firstName ?? "equipo";

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div
          className="studio-eyebrow"
          style={{ marginBottom: 10, color: "var(--wine)" }}
        >
          MARKETING · {eyebrowDateVE(now)}
        </div>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "0 0 8px", color: "var(--ink)" }}
        >
          {greeting}, <span style={{ color: "var(--wine)" }}>{subject}</span>.
        </h1>
        <p
          style={{
            font: "400 14px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "64ch",
          }}
        >
          Llega, revisa y dale play. El ERP absorbe lo repetitivo; tú te enfocas
          en crear contenido, lives y comunidad.
        </p>
      </div>

      {/* Tareas del día */}
      <section style={{ marginBottom: 28 }}>
        <div className="studio-eyebrow" style={{ marginBottom: 12 }}>
          Tareas del día
        </div>
        <div
          style={{
            border: "1px dashed var(--border)",
            borderRadius: 14,
            padding: "28px 24px",
            background: "var(--bg-surface)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span style={{ color: "var(--ink-mute)", flexShrink: 0 }}>
            {Icon.flag(22)}
          </span>
          <div>
            <p
              style={{
                font: "600 14px/1.4 var(--f-sans)",
                color: "var(--ink)",
                margin: "0 0 4px",
              }}
            >
              Aún no hay tareas auto-generadas
            </p>
            <p
              style={{
                font: "400 13px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: 0,
                maxWidth: "64ch",
              }}
            >
              El Motor de Noticias, el calendario y los motores multicanal van a
              llenar esta bandeja. Tú revisas y das play (rol supervisora).
            </p>
          </div>
        </div>
      </section>

      {/* Herramientas del módulo */}
      <section style={{ marginBottom: 28 }}>
        <div className="studio-eyebrow" style={{ marginBottom: 12 }}>
          Herramientas
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {SECTIONS.map((s) => {
            const soon = s.status !== "Disponible";
            return (
              <Link
                key={s.href}
                href={s.href}
                className="studio-card-link"
                style={{
                  display: "block",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: "18px 18px 16px",
                  background: "var(--bg-surface)",
                  textDecoration: "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      alignItems: "center",
                      justifyContent: "center",
                      background: "var(--wine-tint)",
                      color: "var(--wine)",
                      opacity: soon ? 0.55 : 1,
                    }}
                  >
                    {Icon[s.icon](18)}
                  </span>
                  <Badge tone={soon ? "neutral" : "success"} size="sm">
                    {s.status}
                  </Badge>
                </div>
                <h3
                  style={{
                    font: "700 15px/1.3 var(--f-sans)",
                    color: "var(--ink)",
                    margin: "0 0 6px",
                    opacity: soon ? 0.72 : 1,
                  }}
                >
                  {s.title}
                </h3>
                <p
                  style={{
                    font: "400 13px/1.5 var(--f-sans)",
                    color: "var(--ink-soft)",
                    margin: 0,
                    opacity: soon ? 0.72 : 1,
                  }}
                >
                  {s.desc}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Reportar fricción */}
      <section>
        <div className="studio-eyebrow" style={{ marginBottom: 12 }}>
          Automatización
        </div>
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "20px 22px",
            background: "var(--bg-surface)",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <span style={{ color: "var(--wine)", flexShrink: 0 }}>
            {Icon.spark(22)}
          </span>
          <div style={{ flex: 1 }}>
            <p
              style={{
                font: "600 14px/1.4 var(--f-sans)",
                color: "var(--ink)",
                margin: "0 0 4px",
              }}
            >
              ¿Algo te quita tiempo?
            </p>
            <p
              style={{
                font: "400 13px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: 0,
                maxWidth: "64ch",
              }}
            >
              Reporta lo que sea repetitivo o que no te gusta hacer (edición,
              montaje). Entra a la cola de automatización con IA del ERP. Por
              ahora, anótalo en la sesión semanal con Sam.
            </p>
          </div>
          <span
            className="studio-eyebrow"
            style={{ fontSize: 10, color: "var(--ink-mute)", flexShrink: 0 }}
          >
            Próximamente
          </span>
        </div>
      </section>
    </div>
  );
}
