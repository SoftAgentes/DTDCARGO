/**
 * /studio/admin/ia · Pantalla «IA» (SDD-0704 F1-A): el gasto del mes y el tope de la Oficina, y las cuentas con su
 * tipo de cobro y la tarifa de cada modelo. Solo el superadministrador (lo exige el layout y la base).
 *
 * Nunca muestra llaves. Las cifras van en tinta y con coma decimal. Lo que afloja el freno lo corta la base si no hay
 * AAL2 ni una contraseña de hace menos de 5 minutos (`ia_exigir_aal2_si`, D-5): el formulario la pide.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/db/server";
import { isPlatformAdmin } from "@/lib/studio/platform-admin";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { AVISOS_IA, costoEfectivoOficina, leerPantallaIa, tonoDelAviso } from "@/lib/studio/ia/pantalla";
import { TOPE_MENSUAL_MAXIMO_USD, configDespachador } from "@/lib/studio/oficina/despachador-config";

import { AvisoResultado } from "../oficina-virtual/_components/AvisoResultado";
import { AVISOS_FUNCIONES, leerFunciones } from "./funciones";
import { PestanaCuentas } from "./_components/PestanaCuentas";
import { PestanaFunciones } from "./_components/PestanaFunciones";
import { PestanaGasto } from "./_components/PestanaGasto";

export const metadata = { title: "IA" };
export const dynamic = "force-dynamic";

type Pestana = "funciones" | "gasto" | "cuentas";
const PESTANAS: Array<{ clave: Pestana; etiqueta: string }> = [
  { clave: "funciones", etiqueta: "Funciones" },
  { clave: "gasto", etiqueta: "Gasto" },
  { clave: "cuentas", etiqueta: "Cuentas y tarifas" },
];

export default async function IaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Gate propio de la página (SDD-0624), además del layout.
  await requireModuleView("admin");
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) notFound();

  const sp = await searchParams;
  const uno = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const tab = uno("tab");
  const activa: Pestana = tab === "cuentas" ? "cuentas" : tab === "gasto" ? "gasto" : "funciones";
  const r = uno("r");
  const avisos: Readonly<Record<string, string>> = { ...AVISOS_IA, ...AVISOS_FUNCIONES };

  const [lectura, funciones] = await Promise.all([
    leerPantallaIa(supabase),
    activa === "funciones" ? leerFunciones(supabase) : Promise.resolve(null),
  ]);
  const entorno = configDespachador();
  const costo = lectura.ok
    ? costoEfectivoOficina(lectura.datos, { topeMensualUsd: entorno.topeMensualUsd, precios: entorno.precios, techoUsd: TOPE_MENSUAL_MAXIMO_USD })
    : null;

  return (
    <div style={{ maxWidth: 960 }}>
      <Link href="/studio/admin" style={{ font: "500 12px/1 var(--f-sans)", color: "var(--ink-soft)", textDecoration: "none" }}>
        ← Volver a Administración
      </Link>
      <span className="studio-eyebrow" style={{ display: "block", marginTop: 12 }}>
        Sistema · SDD-0704
      </span>
      <h1 className="studio-display" style={{ fontSize: 30, margin: "8px 0", color: "var(--ink)" }}>
        IA
      </h1>
      <p style={{ font: "400 13px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "0 0 16px", maxWidth: "76ch" }}>
        Cuánto se gastó este mes, el tope de la Oficina_Virtual y lo que cobra cada cuenta. Las llaves no se ven aquí.
        En «Funciones» eliges el modelo de A1 y A2, con hasta dos de respaldo.
      </p>

      {r && avisos[r] ? (
        <AvisoResultado key={uno("n") ?? r} tono={tonoDelAviso(r)}>
          {avisos[r]}
        </AvisoResultado>
      ) : null}

      <nav aria-label="Secciones de IA" className="studio-tabs" style={{ marginBottom: 20 }}>
        {PESTANAS.map((p) => (
          <Link
            key={p.clave}
            href={`/studio/admin/ia?tab=${p.clave}`}
            aria-current={p.clave === activa ? "page" : undefined}
            data-activa={p.clave === activa ? "true" : undefined}
            className="studio-tab"
          >
            {p.etiqueta}
          </Link>
        ))}
      </nav>

      {activa === "funciones" ? (
        funciones?.ok ? (
          <PestanaFunciones datos={funciones.datos} />
        ) : (
          <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink)" }}>
            {funciones?.motivo === "sin_migracion"
              ? "Falta aplicar la migración 0571. Mientras tanto, A1 y A2 siguen con su modelo de siempre."
              : AVISOS_IA.error}
          </p>
        )
      ) : !lectura.ok ? (
        <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink)" }}>
          {lectura.motivo === "sin_migracion" ? AVISOS_IA.sin_migracion : AVISOS_IA.error}
        </p>
      ) : activa === "gasto" && costo ? (
        <PestanaGasto datos={lectura.datos} costo={costo} techoUsd={TOPE_MENSUAL_MAXIMO_USD} />
      ) : (
        <PestanaCuentas datos={lectura.datos} />
      )}
    </div>
  );
}
