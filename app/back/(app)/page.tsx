import { createClient } from "@/lib/db/server";

export const metadata = {
  title: "Dashboard · Back",
};

/**
 * Dashboard del back. KPIs simples + próximos pasos hasta que tengamos
 * widgets reales (actividad reciente, ediciones recientes, etc.).
 */
export default async function BackDashboard() {
  const supabase = await createClient();

  // Counts de las tablas back_*. RLS las limita al tenant del user.
  const [servicios, noticias, glosario, assets] = await Promise.all([
    supabase.from("back_servicios").select("*", { count: "exact", head: true }),
    supabase.from("back_noticias").select("*", { count: "exact", head: true }),
    supabase.from("back_glosario").select("*", { count: "exact", head: true }),
    supabase.from("back_assets").select("*", { count: "exact", head: true }),
  ]);

  const kpis = [
    { label: "Servicios", count: servicios.count ?? 0, href: "/back/servicios" },
    { label: "Noticias", count: noticias.count ?? 0, href: "/back/noticias" },
    { label: "Glosario", count: glosario.count ?? 0, href: "/back/glosario" },
    { label: "Media", count: assets.count ?? 0, href: "/back/assets" },
  ];

  return (
    <div>
      <span style={eyebrowStyle}>Dashboard</span>
      <h1 style={h1Style}>Bienvenido al back.</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          maxWidth: 820,
        }}
      >
        {kpis.map((kpi) => (
          <a
            key={kpi.label}
            href={kpi.href}
            style={{
              background: "white",
              border: "1px solid #E8E6E2",
              borderRadius: 14,
              padding: 22,
              textDecoration: "none",
              color: "inherit",
              transition: "border-color 0.15s",
            }}
          >
            <div
              style={{
                font: "700 11px/1.4 Archivo, sans-serif",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#6B6B6B",
              }}
            >
              {kpi.label}
            </div>
            <div
              style={{
                font: "900 40px/1 'Archivo Black', Archivo, sans-serif",
                color: "#0F1E3D",
                marginTop: 8,
                letterSpacing: "-0.02em",
              }}
            >
              {kpi.count}
            </div>
          </a>
        ))}
      </div>

      <div
        style={{
          marginTop: 48,
          padding: 28,
          background: "white",
          border: "1px dashed #C9C5BE",
          borderRadius: 14,
          maxWidth: 820,
        }}
      >
        <h3
          style={{
            font: "900 16px/1.2 'Archivo Black', Archivo, sans-serif",
            color: "#0F1E3D",
            margin: "0 0 10px",
          }}
        >
          Próximos pasos
        </h3>
        <ol
          style={{
            font: "500 14px/1.6 Archivo, sans-serif",
            color: "#333",
            paddingLeft: 22,
            margin: 0,
          }}
        >
          <li>
            <strong>Seed inicial</strong> (migración 0031): mover los 16
            servicios, 3 noticias y el glosario desde{" "}
            <code style={codeStyle}>lib/design-tokens.ts</code> a las tablas{" "}
            <code style={codeStyle}>back_*</code>. Los counts arriba quedan en
            cero hasta hacerlo.
          </li>
          <li>
            <strong>CRUD de servicios</strong>: lista + drawer de edit + server
            actions con field-level whitelist por rol.
          </li>
          <li>
            <strong>Read-side wiring</strong>: cuando el seed esté, conectar el
            sitio público para leer de Supabase en vez de constants.
          </li>
        </ol>
      </div>
    </div>
  );
}

const eyebrowStyle: React.CSSProperties = {
  font: "700 11px/1.4 Archivo, sans-serif",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#7F0F1A",
};

const h1Style: React.CSSProperties = {
  font: "900 40px/1.05 'Archivo Black', Archivo, sans-serif",
  letterSpacing: "-0.02em",
  color: "#0F1E3D",
  margin: "8px 0 36px",
};

const codeStyle: React.CSSProperties = {
  background: "#F2F0EC",
  padding: "1px 6px",
  borderRadius: 4,
  font: "500 12.5px/1.2 ui-monospace, monospace",
};
