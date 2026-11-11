import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { canAccessModule } from "../../lib/studio/rbac";
import { KPI_CATALOG } from "../../lib/studio/dashboard/dashboard-catalog";

// SDD-0357: inventario de llamadas literales, NO autorización genérica ni
// análisis de flujo. Nuevos callers requieren revisión de su guard y su tenant.
const BASELINE = {
  "app/portal/(app)/facturas/[code]/reportar/actions.ts": 1,
  "app/studio/(app)/cobranzas/actions.ts": 1,
  "app/studio/(app)/cobranzas/recibo/[code]/page.tsx": 1,
  // SDD-0465: +1 por la lectura previa de `softDeleteInvoice` (id, status,
  // invoice_code, deleted_at), detrás de moduleEditDenial("invoices") y con el
  // cliente de sesión bajo RLS; decide el mensaje antes del UPDATE condicionado.
  // SDD-0487: +1 en `lookupInvoiceBillingOptions`, que lee sólo `bill_to_kind`
  // del borrador que se edita, con el cliente de sesión bajo RLS
  // (`invoices_accounting_select`: accounting/admin del tenant).
  "app/studio/(app)/facturacion/actions.ts": 12,
  // SDD-0496: −1. El UPDATE final de `applyReferralCredit` (paid_amount +
  // status del abono no monetario) pasó a `apply_referral_credit` (0471), que
  // toma la factura FOR UPDATE. Queda SÓLO la lectura previa de `invoiceId`
  // (:425), con el cliente de sesión bajo RLS y detrás de
  // moduleEditDenial("accounting") (:393): decide el mensaje de error, no la
  // autoridad — la RPC revalida cliente, estado, moneda, compra nueva y saldo
  // bajo el lock.
  "app/studio/(app)/fidelizacion/actions.ts": 1,
  "lib/portal/portal-legal-queries.ts": 3,
  "lib/portal/portal-queries.ts": 2,
  // SDD-0560: +1 archivo y +1 lectura. `leerFacturas`, del asistente de borrado
  // de embarques, lee `id, invoice_code, status, paid_amount` de las facturas
  // vivas y no anuladas de UN embarque (el predicado de la guarda `invoices` de
  // la 0476). Revisión del contrato:
  //   · candado: sólo la llaman `leerPlanDeBorradoAction` y
  //     `ejecutarPasoDeBorradoAction`, con `capabilityDenial(…, "delete_shipments")`
  //     (admin) al tope, antes de leer nada;
  //   · tenant: cliente de SESIÓN bajo `invoices_accounting_select` (0414,
  //     accounting/admin del propio tenant); nunca el admin client;
  //   · uso: decide qué paso ofrecer, no la autoridad: la lista tiene que cuadrar
  //     con el conteo de la RPC de la 0476 y cada paso lo revalida la acción de
  //     Facturación. Al cliente cruza sólo el código y el estado.
  "lib/studio/borrado/asistente-servidor.ts": 1,
  // SDD-0496: aquí estaba `lib/studio/accounting/referral-credit-posting.ts`: 2.
  // SALE del inventario. `revertReferralCreditsForInvoice` leía la factura y le
  // escribía el pagado con guard optimista y relectura; las dos cosas pasaron a
  // `revert_referral_credits` (0471). El módulo ya no nombra `invoices`: sólo
  // llama a la RPC con el cliente del usuario y anula los asientos con el admin
  // client. NO confundir con `lib/studio/fidelizacion/referral-credit-queries.ts`,
  // de abajo, que es otro archivo y al que la 0495 le SUMÓ una lectura.
  // SDD-0488: −4. Las escrituras de la factura al cobrar, identificar y anular
  // pasaron a las RPC de 0467, y la anulación ya no lee la factura. Quedan las
  // dos lecturas previas del cobro y de la identificación (sólo mensajes).
  "lib/studio/collections-actions.ts": 2,
  // SDD-0557: +1 archivo y +2 lecturas, las dos de solo lectura con el cliente
  // de SESIÓN bajo `invoices_accounting_select` (0414, accounting/admin del
  // propio tenant); nunca el admin client.
  //   · `ingresoDelPeriodo` lee `status, issued_at, currency, fx_rate,
  //     base_amount, fund_class, deleted_at` de las facturas del período: es
  //     la cifra oficial de ingreso. Sus callers están detrás de su candado:
  //     Contabilidad (layout, `accounting`), Reportes (layout, `reports`) y
  //     Dirección (página admin-only). Al cliente cruzan solo sumas y conteos.
  //   · `cuadreDelLibro` lee código, estado, fecha, moneda y montos de las
  //     facturas no borrador para «Por contabilizar» (Contabilidad, layout
  //     `accounting`). Al cliente cruzan código, fecha, moneda y monto; sin
  //     nombre ni RIF del cliente.
  // SDD-0573 I2: +1 metadata por IDs fuera de emisión en contextoDelIngreso,
  // llamado siempre por ingresoDelPeriodo con mayor (también precalculado).
  // Sesión/RLS, tenant en documentos/headers/cuentas y validación relacional;
  // layouts accounting/reports y Dirección admin-only. Sólo agregados al cliente.
  "lib/studio/accounting/libro-control-queries.ts": 3,
  // SDD-0572: −1 al eliminar latestVesFxRate (display desde facturas).
  // Revenue conserva cliente de sesión, candados de Costing y RLS del tenant.
  // El display usa ultimaTasa/fx_rates con ese mismo cliente, nunca admin.
  "lib/studio/costing/queries.ts": 1,
  "lib/studio/dashboard/dashboard-kpi-queries.ts": 1,
  // SDD-0495: +1 por `strandedReferralCredits`, que mira si las facturas donde
  // se aplicó un crédito de referido quedaron 'anulada' (el crédito varado que
  // avisa la pantalla de Fidelización).
  //
  // En SDD-0495 era el único caller que leía con el CLIENTE ADMIN (SDD-0576
  // incorpora abajo el readback acotado de Warehouse), y la
  // razón es este mismo contrato: al exigir revisar «el guard y el tenant»
  // apareció que `invoices_accounting_select` (migr 0414) niega el SELECT a
  // `commercial` y `support`, que son justo los roles de esa pantalla — con el
  // cliente de sesión el aviso devolvía cero filas y no se pintaba nunca. La
  // matriz de módulos de `rbac.ts` y la RLS de la tabla NO dicen lo mismo.
  //
  // Candados, decididos por el Director el 2026-09-20: `tenant_id` explícito en
  // la query, resuelto por la base con `get_user_tenant_id` y nunca recibido del
  // llamador (sin sesión no se consulta nada); los ids salen de `referrals` del
  // propio tenant, re-filtrados antes de ir al admin; se pide sólo `id`; y al
  // cliente cruza únicamente el bit derivado, sin código, id, monto ni estado de
  // factura. Los tres candados tienen prueba y mutante en
  // `lib/studio/fidelizacion/__tests__/stranded-referral-credits.test.ts`.
  //
  // Seguimiento declarado en la SDD-0495: una RPC `security definer` que
  // responda «de estos ids, cuáles están anuladas en mi tenant» es la forma
  // correcta y quita el admin de acá. Exige migración y OK nominal de Sam.
  "lib/studio/fidelizacion/referral-credit-queries.ts": 2,
  "lib/studio/fiscal/queries.ts": 1,
  // SDD-0487: `domicilioFiscalSellado` lee sólo `client_fiscal_address` de una
  // factura ya autorizada por su caller, con el cliente de sesión bajo RLS: el
  // PDF del Studio (canAccessModule(role, "invoices") + getInvoiceByCode) y el
  // del Portal (getMyInvoiceForPrincipal + «invoices portal self read»).
  "lib/studio/invoice-client-doc.ts": 1,
  "lib/studio/invoice-queries.ts": 3,
  // SDD-0558: aquí estaba `lib/studio/kommo-contact-status.ts`: 1. SALE del
  // inventario. El job de Kommo leía las facturas de los clientes vinculados
  // con el cliente ADMIN y sumaba el saldo en TS; ahora lo pide a
  // `client_outstanding` (0492), la definición única del saldo por cliente, por
  // `listClientOutstanding` en `client-queries.ts`. No nombra `invoices`.
  "lib/studio/payment-queries.ts": 1,
  // SDD-0574: +1 archivo y +1 lectura. `reporteSinFacturar` («Embarques sin
  // facturar», 4.5 del plan contable) lee `id, invoice_code, shipment_id,
  // client_markbox, status` de las facturas vivas de un lote de envíos, para
  // saber qué recepción ya tiene factura fiscal. Revisión del contrato:
  //   · candado: la llaman SOLO dos server components — la página del reporte,
  //     bajo el layout de Reportes (`requireModuleView("reports")`: accounting
  //     + admin), y Dirección (`requireModuleView("direccion")` + rol admin);
  //   · tenant: cliente de SESIÓN bajo `invoices_accounting_select` (0414,
  //     accounting/admin del propio tenant); nunca el admin client;
  //   · uso: solo lectura (ni escribe `invoices` ni toca `lib/studio/accounting`);
  //     decide «facturada / pre-factura / sin factura» por envío y Shipping Mark.
  //     Al cliente cruza el código de la pre-factura, nunca montos de factura.
  // Columnas avisadas a la sesión «Contabilidad» el 2026-10-20 (pedido del Director).
  "lib/studio/rate-snapshots/sin-facturar.ts": 1,
  "lib/studio/renditions/queries.ts": 3,
  "lib/studio/reports/queries.ts": 4,
  // SDD-0576: cliente ADMIN ya recibido por el motor Warehouse, detrás de sus
  // gates y de RPC outcome=invoiced con UUID válido. Solo si issued_at está
  // AUSENTE: select id/tenant_id/issued_at de esa factura, tenant confiable y
  // deleted_at IS NULL; limit 2 detecta ambigüedad, se exige exactamente 1 fila
  // coherente y calendario válido. Error no habilita poster, reloj ni otra RPC.
  // No cambia el guard/RLS ni autoriza lecturas generales de facturas.
  "lib/studio/sales-orders/actions.ts": 1,
};

function filesUnder(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

// SDD-0486: lectura en paralelo con tope. Leer los ~1.600 archivos uno por uno
// sumaba la latencia de cada apertura (en Windows, el escaneo del antivirus). Con 32
// lecturas a la vez, la lectura baja de ~2 s a ~0,6 s con la máquina quieta.
async function readAll(paths, limit = 32) {
  const sources = new Array(paths.length);
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < paths.length) {
      const i = next++;
      sources[i] = await readFile(paths[i], "utf8");
    }
  }));
  return sources;
}

// SDD-0486: un literal cuyo valor es "invoices" aparece tal cual en el fuente, salvo
// que use escapes (`"invo\x69ces"`, continuación de línea), y entonces lleva una barra
// invertida. Un archivo sin ninguna de las dos cosas no puede sumar llamadas, así que
// no hace falta parsearlo. El conteo no cambia. Solo se parsean ~360 de ~1.600 archivos.
function mayCallInvoices(source) {
  return source.includes("invoices") || source.includes("\\");
}

function invoiceCalls(source) {
  // Sin punteros al padre: el recorrido usa forEachChild y no los necesita.
  const ast = ts.createSourceFile("source.tsx", source, ts.ScriptTarget.Latest, false);
  let count = 0;
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const method = ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : ts.isElementAccessExpression(callee) && ts.isStringLiteralLike(callee.argumentExpression)
          ? callee.argumentExpression.text
          : null;
      const arg = node.arguments[0];
      if (method === "from" && arg && ts.isStringLiteralLike(arg) && arg.text === "invoices") count++;
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return count;
}

describe("SDD-0357 · frontera de lectura de facturas", () => {
  // L07, ronda 3: tope propio de 60 s. La prueba lee unos 1.600 módulos y, bajo la
  // carga de `pnpm verify`, tardó 22,4 s y 20,8 s contra el tope global de 20 s. En
  // la suite completa local llegó a 92 s (SDD-0486). La lectura en paralelo y el
  // prefiltro la bajan de ~5,6 s a ~1,5 s con la máquina quieta. El inventario
  // exigido no cambia.
  it("congela el inventario de callers de producción sin contar comentarios o fixtures", async () => {
    const paths = ["app", "lib", "supabase/functions"]
      .flatMap((root) => filesUnder(resolve(root)))
      .filter((path) => /\.[cm]?[jt]sx?$/.test(path) && !/(__tests__|\.test\.|\.spec\.)/.test(path));
    const sources = await readAll(paths);
    const actual = {};
    paths.forEach((path, i) => {
      const count = mayCallInvoices(sources[i]) ? invoiceCalls(sources[i]) : 0;
      if (count) actual[relative(process.cwd(), path).replaceAll("\\", "/")] = count;
    });
    expect(actual).toEqual(BASELINE);
    // SDD-0496: 19 → 18 archivos. Sale `referral-credit-posting.ts` entero.
    // SDD-0560: 18 → 19. Entra `lib/studio/borrado/asistente-servidor.ts`.
    // SDD-0557: 19 → 20. Entra `lib/studio/accounting/libro-control-queries.ts`.
    // SDD-0558: 20 → 19. Sale `lib/studio/kommo-contact-status.ts` entero.
    // SDD-0574: 19 → 20. Entra `lib/studio/rate-snapshots/sin-facturar.ts`.
    // SDD-0576: 20 → 21 por el readback de fecha persistida de Warehouse.
    expect(Object.keys(actual)).toHaveLength(21);
    // El total va aparte del mapa a propósito: si alguien «arregla» el mapa
    // moviendo una llamada de un archivo a otro, el mapa vuelve a cuadrar y
    // este número no.
    // SDD-0495: 44 → 45 por la lectura de `strandedReferralCredits`.
    // SDD-0496: −3 sobre eso (−1 en fidelizacion/actions, −2 al salir
    // referral-credit-posting), las tres a las RPC de la 0471. Los dos cambios
    // tocan archivos DISTINTOS y no se solapan: la lectura que sumó la 0495
    // está en `fidelizacion/referral-credit-queries.ts`, y ninguna de las tres
    // que quité está ahí. Número recalculado sobre el árbol fusionado, no
    // deducido de la aritmética.
    // SDD-0560: 42 → 43 por la lectura de `leerFacturas` (asistente de borrado).
    // SDD-0557: 43 → 45 por `ingresoDelPeriodo` y `cuadreDelLibro`.
    // SDD-0558: 45 → 44. La lectura de Kommo pasó a la 0492; recalculado sobre
    // origin/main bb6bb3e4 con la 0555, la 0556, la 0557 y la 0560 ya fusionadas.
    // SDD-0574: 44 → 45 por la lectura de `reporteSinFacturar`.
    // SDD-0573 I2: una lectura literal de metadata adicional, mismas 20 rutas del compuesto.
    // SDD-0572: 46 → 45, solo sale la lectura de display latestVesFxRate.
    // SDD-0576: 45 → 46, exclusivamente issued_at ausente tras emisión real.
    expect(Object.values(actual).reduce((sum, count) => sum + count, 0)).toBe(46);
  }, 60_000);

  it("reconoce llamadas literales y no confunde ejemplos o comentarios con código", () => {
    expect(invoiceCalls(`// db.from("invoices")
      const example = 'db.from("invoices")';
      db.from("clients"); db.from("invoices"); db["from"]('invoices');
    `)).toBe(2);
  });

  it("el prefiltro deja pasar todo archivo que pueda llamar a invoices, también con escapes", () => {
    // Ninguno contiene la palabra tal cual: sólo la barra invertida los delata.
    for (const source of ['db.from("invo\\x69ces")', 'db["fr\\u006fm"]("\\u0069nvoices")', 'db.from("invo\\\nices")']) {
      expect(source).not.toContain("invoices");
      expect(invoiceCalls(source)).toBe(1);
      expect(mayCallInvoices(source)).toBe(true);
    }
    expect(mayCallInvoices('db.from("clients"); db.from(`payments`)')).toBe(false);
  });

  it("mantiene los cuatro widgets financieros detrás del candado invoices", () => {
    for (const id of ["monthRevenue", "invoicesDue", "pendingCollect", "avgTicket"]) {
      expect(KPI_CATALOG.find((kpi) => kpi.id === id)?.module).toBe("invoices");
    }
    for (const role of ["commercial", "operations", "warehouse", "support", "marketing"]) {
      expect(canAccessModule(role, "invoices", { [`${role}:invoices`]: { view: true, edit: true } })).toBe(false);
    }
    expect(canAccessModule("accounting", "invoices")).toBe(true);
    expect(canAccessModule("admin", "invoices")).toBe(true);
  });
});
