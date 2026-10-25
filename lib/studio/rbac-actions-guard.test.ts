// @vitest-environment node
/**
 * Anti-drift de RBAC · POR ACCIÓN — SDD-0085, rehecho en SDD-0500.
 *
 * Toda server action del Studio debe apoyarse en un guard de `rbac-guard.ts`
 * como backstop server-side, porque las actions son invocables directo como un
 * endpoint (el sidebar y `requireModuleView` sólo cubren la UI).
 *
 * ## Qué medía antes y por qué no servía
 *
 * La versión anterior hacía `GUARDS.some((g) => src.includes(g))` sobre el
 * archivo entero. Eso fallaba en tres sentidos independientes, cada uno
 * suficiente por sí solo (ver `docs/engineering/project-rules.md` §«Contratos
 * que miden el comportamiento, no el texto», caso 1):
 *
 *   1. **Por archivo, no por acción.** Un archivo con siete acciones gateadas y
 *      una abierta contiene la cadena y pasaba. Así `contabilidad/actions.ts`
 *      estuvo en verde con `setClosingDateAction` abierta adentro (SDD-0498).
 *   2. **Sólo abría `actions.ts` exacto.** Los 19 `<algo>-actions.ts` del Studio
 *      no los miraba nadie: ahí vivía el borrado sin gate de
 *      `tracking/[id]/document-actions.ts`, que sacaba el objeto del bucket.
 *   3. **Guard EN el archivo, no ANTES de la escritura.** Un `moduleEditDenial`
 *      en la acción de al lado ya daba verde.
 *
 * ## Qué mide ahora
 *
 * `scanActionsFile` (`__tests__/rbac-action-scan.ts`) parsea el AST de cada
 * archivo y exige, POR ACCIÓN EXPORTADA, dos cosas que fallan por caminos
 * distintos:
 *
 *   A. un guard incondicional domina el PRIMER acceso a datos;
 *   B. si la acción escribe, un guard de EDICIÓN domina la PRIMERA escritura.
 *
 * «Incondicional» es literal: un guard dentro de un `if`, de un `catch`, de un
 * bucle, de un callback o detrás de un `&&` no cuenta, porque no domina. El
 * analizador tiene su propia batería de casos infelices en
 * `rbac-action-scan.test.ts` — un detector sin sus propias pruebas es otra cosa
 * que nadie está midiendo.
 *
 * ## Las dos listas, y por qué son dos
 *
 * Poner el contrato estricto deja en rojo 39 acciones ajenas a la tarea que lo
 * escribió. Bajar la exigencia «hasta que se arregle todo» sería volver al
 * contrato que no medía, así que entran con lista explícita — y en DOS, porque
 * significan cosas distintas y se vacían distinto:
 *
 *   · `EXCEPCIONES` — el candado existe y está verificado, sólo que no es uno de
 *     los nombres que el analizador reconoce (la RPC lo hace, es la sesión del
 *     propio usuario, delega en otra acción gateada…). No se espera que se
 *     vacíen.
 *   · `DEUDA` — falta el gate, o hay uno artesanal más débil que el central.
 *     Cada entrada dice QUÉ se observó, no una justificación inventada. Esta
 *     lista está para vaciarse.
 *
 * **Lo que ninguna de las dos permite es una acción NUEVA sin candado**, que es
 * el 80 % del valor: nace roja y hay que defenderla por escrito en una PR.
 *
 * ## Cómo se arregla un rojo
 *
 * Agregá el guard al tope de la acción. Si de verdad no lo necesita, documentá
 * la excepción acá con su razón, y mantené la lista CORTA — cada entrada es una
 * excepción de seguridad que alguien debería poder defender en un review.
 *
 * ⚠️ **No muevas una entrada de `DEUDA` a `EXCEPCIONES` para que pase.** Si
 * elegís mal el gate, una tarea de seguridad AMPLÍA permisos, que es el error
 * más caro de acá: SDD-0498 lo esquivó por poco al ver que meter dos puertas
 * admin-only en la matriz de módulos las habría abierto a accounting, commercial
 * y marketing de refilón.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { scanActionsFile } from "./__tests__/rbac-action-scan";
import { listarArchivosDeActions, rutaRelativa } from "./__tests__/rbac-action-files";

/**
 * ⏱️ I/O-BOUND: este contrato RECORRE EL ÁRBOL DE ARCHIVOS del repo y parsea 73
 * módulos con el compilador de TypeScript.
 *
 * Aislado corre en ~1 s. Pero la suite tiene varios contratos que hacen lo mismo
 * y vitest los reparte en paralelo sobre cientos de archivos de test:
 * compitiendo por el mismo disco, la lectura se va a decenas de segundos y
 * expira contra el `testTimeout` global de 20 s. Falla un conjunto DISTINTO cada
 * corrida — la firma de la contención, no de una regresión.
 *
 * Los dos rojos de este contrato NO son el mismo y confundirlos es cómo se
 * pierde: el de CONTENIDO (una acción sin candado, o una entrada obsoleta) es el
 * hallazgo; el de TIEMPO es contención de la máquina y se resuelve corriendo con
 * la máquina quieta, nunca saltando la prueba ni relajando su tope.
 *
 * El timeout se sube ACÁ y no en `vitest.config.ts` a propósito: subirlo global
 * relajaría los otros ~5.000 tests, donde 20 s ya es señal de que algo va mal.
 */
vi.setConfig({ testTimeout: 120_000 });

/** Clave: `<ruta relativa a app/studio/(app)>::<acción>`. */
type Lista = Record<string, string>;

/**
 * Acciones cuyo candado EXISTE y se verificó, pero no con un nombre que el
 * analizador reconozca. No se espera que esta lista se vacíe.
 */
const EXCEPCIONES: Lista = {
  "actions.ts::signOut":
    "Cierra la sesión del PROPIO usuario (`supabase.auth.signOut()`); no hay privilegio de módulo que pedir.",

  "debug/actions.ts::recheckAllAction":
    "Re-corre los health checks del panel de diagnóstico; no muta datos de negocio.",

  "admin/feature-flags/actions.ts::toggleFeatureFlagAction":
    "Gatea con `platformAdminDenial` (SDD-0355), que es MÁS estricto que cualquier guard de la matriz: exige `is_platform_admin()`, no `admin` del tenant. El control real es la policy `feature_flags_platform_admin_update` (migr 0355), como dice la cabecera del archivo. (La razón anterior de esta allowlist —«valida role==='admin' inline»— quedó desactualizada cuando la 0355 subió el candado.)",

  // Las cuatro del archivo comparten `requireAdmin`, que resuelve el rol con
  // `getStudioRole` → `getStudioAccess`, o sea CON el filtro `disabled_at` de la
  // 0200. SDD-0271 argumenta por escrito por qué es admin duro y no la matriz:
  // acá se decide a qué chat de Telegram llegan los avisos internos, y un
  // override por rol (SDD-0252) no debería poder abrirlo.
  "admin/alertas-telegram/actions.ts::createTelegramDestinationAction":
    "SDD-0271: `requireAdmin` exige `admin` duro vía `getStudioRole` (fail-closed a `disabled_at`). RLS admin-only por tenant en telegram_destinations / telegram_alert_routes (migr 0386).",
  "admin/alertas-telegram/actions.ts::regenerateTelegramLinkCodeAction":
    "SDD-0271: mismo `requireAdmin` del archivo; ver `createTelegramDestinationAction`.",
  "admin/alertas-telegram/actions.ts::toggleTelegramRouteAction":
    "SDD-0271: mismo `requireAdmin` del archivo; ver `createTelegramDestinationAction`.",
  "admin/alertas-telegram/actions.ts::deleteTelegramDestinationAction":
    "SDD-0271: mismo `requireAdmin` del archivo; ver `createTelegramDestinationAction`.",

  "dashboard/actions.ts::saveDashboardConfigAction":
    "SDD-0114: cada usuario edita SU PROPIA config de dashboard (fila `user_dashboard_prefs`, RLS por dueño). No muta datos de negocio ni de otros usuarios, y además filtra los ids con `canAccessModule` antes de persistir.",
  "dashboard/actions.ts::resetDashboardConfigAction":
    "SDD-0114: borra la config propia del usuario; ver `saveDashboardConfigAction`.",

  "bugs/actions.ts::markBugNotificationsReadAction":
    "Marca leídas las notificaciones PROPIAS: el update lleva `.eq(\"user_id\", userResp.user.id)` sobre la sesión, así que el alcance es el propio usuario.",
  "bugs/actions.ts::advanceBugStateAction":
    "El gate vive en la RPC `bug_advance_state`: lee `user_tenants` con `disabled_at is null` y exige `admin` para cambiar de estado (migr 0394, `:165-175`). SDD-0394 movió las transiciones a RPC-only justamente para cerrar el hueco de la policy.",
  "bugs/actions.ts::takeBugAction":
    "Misma RPC `bug_advance_state` que `advanceBugStateAction`; ver su entrada.",
  "bugs/actions.ts::replyBugMessageAction":
    "Bug Reporter abierto por diseño: cualquier miembro del staff responde en el hilo de un bug. La lectura de `user_tenants` NO es un gate — decide la ETIQUETA de autor (`admin` vs `user`), como ya anotó SDD-0498.",

  "mis-bugs/actions.ts::createBugAction":
    "Bugs propios del usuario: reportar está abierto por diseño a todo el staff.",

  "usuarios/actions.ts::sendAccessLinkBulkAction":
    "Delega ÍNTEGRAMENTE en `sendAccessLinkAction`, que lleva `moduleEditDenial(supabase, \"users\")` al tope (`:444`). El contrato no lo ve porque la delegación va dentro de un callback, y un guard dentro de un callback no domina EN GENERAL — la regla se conserva y la excepción se escribe acá.",
};

/**
 * Acciones a las que les FALTA el candado, o tienen uno artesanal más débil que
 * el central. Cada entrada dice qué se observó. Esta lista está para vaciarse.
 *
 * Tres familias, y conviene no confundirlas al priorizar:
 *
 *   · **gate artesanal fail-closed** — resuelve por `getStudioAccess` (o sea CON
 *     `disabled_at`) pero decide a mano con `canAccessModule(role, MODULE)` sin
 *     pasarle los overrides. Es más débil que `moduleViewDenial` en tres cosas:
 *     ignora los desvíos por rol de SDD-0252 (una REVOCACIÓN por override no se
 *     respeta), el alcance de almacén y el segundo candado de superadministrador.
 *     No es un agujero abierto; es defensa en profundidad incompleta.
 *   · **sólo sesión** — comprueba `auth.getUser()` y nada más: cualquier miembro
 *     del tenant pasa, sin importar su rol.
 *   · **sin candado de aplicación** — la RLS es lo único que queda.
 *
 * NINGUNA de estas se verificó contra producción; lo que se cita son los
 * archivos del repo.
 */
const DEUDA: Lista = {
  // ── gate artesanal fail-closed: getStudioRole + canAccessModule sin overrides ──
  "academia/actions.ts::loadCourseEditorTreeAction":
    "Gate artesanal de vista: `getStudioRole` + `canAccessModule(role, MODULE)` SIN overrides. Migrar a `moduleViewDenial(supabase, \"academia\")`.",
  "academia/actions.ts::lookupStudentCiAction":
    "Gate artesanal de vista (mismo patrón); el lookup devuelve nombre y Shipping Mark a partir de una cédula. Migrar a `moduleViewDenial(supabase, \"academia\")`.",
  "club/actions.ts::lookupMemberCiAction":
    "Gate artesanal de vista (mismo patrón que Academia). Migrar a `moduleViewDenial(supabase, \"club\")`.",
  "reclamos/actions.ts::updateClaimFinancialsAction":
    "Gate artesanal de producto: `getStudioRole` + `role !== \"accounting\" && role !== \"admin\"` inline. Es fail-closed a `disabled_at`, pero es una cuarta forma de decidir permisos. La regla («solo Contabilidad edita la resolución financiera») NO es la fila del módulo `reclamos`, así que migrarla exige decidir su gate — no es mecánico.",

  // ── sólo sesión: cualquier miembro del tenant pasa ──
  "clientes/actions.ts::geocodeClientAddressAction":
    "Sólo `auth.getUser()`. No toca datos del tenant —llama a Nominatim—, pero gasta la cuota de geocodificación de la casa sin mirar el rol.",
  "gastos/actions.ts::resolveExpenseAlertAction":
    "Sólo `auth.getUser()`: resuelve a mano una alerta de gastos sin comprobar el módulo `expenses`.",
  "gastos/actions.ts::exportExpensesCsvAction":
    "Sólo `auth.getUser()`, y lo que sale es un ARCHIVO con los gastos del mes. Mismo razonamiento que `exportRecoverySmsCsvAction` en SDD-0497: una exportación es tan invocable como una mutación.",
  "documentos/actions.ts::addDocumentVersion":
    "Sesión + `resolveTenant` a mano (`rpc(\"get_user_tenant_id\")`); sin gate de módulo antes de subir una versión nueva al bucket.",
  "bitacora/collab-actions.ts::getTaskCommentsAction":
    "Sesión + `getUserTenantId()` a mano; sin gate del módulo `bitacora`.",
  "bitacora/collab-actions.ts::listTaskAttachmentsAction":
    "Sesión + tenant a mano, y FIRMA URLs del bucket de bitácora. Valida el shape del path antes de firmar, pero no el rol.",
  "usuarios/actions.ts::updateMyProfileAction":
    "Edición del perfil PROPIO. Probablemente excepción legítima (como `dashboard`), pero el alcance al propio `user_id` no se verificó en esta tarea: queda en DEUDA hasta comprobarlo, no en EXCEPCIONES.",
  "usuarios/actions.ts::updateMyPreferencesAction":
    "Preferencias PROPIAS; mismo pendiente de verificación que `updateMyProfileAction`.",
  "usuarios/actions.ts::linkTelegramAccountAction":
    "Vincula la cuenta de Telegram del PROPIO usuario; mismo pendiente de verificación.",
  "usuarios/actions.ts::unlinkTelegramAccountAction":
    "Desvincula la cuenta de Telegram del PROPIO usuario; mismo pendiente de verificación.",

  // ── sin candado de aplicación: sólo queda la RLS ──
  "bugs/actions.ts::updateBugAdminAction":
    "Sin gate de aplicación: hace `from(\"bug_reports\").update(...)` directo. El candado vive en la DB —policy `bug_reports_admin_update` más el grant por columna de migr 0394 (`:80`)—, y el propio código lo delata al tratar el error `42501`. Defensa en profundidad perdida, no agujero.",
  "cotizador/actions.ts::lookupSuggestedRate":
    "Sin candado: resuelve la tarifa sugerida de un cliente (`clientIdByMarkbox` + `resolveRateForClient`). Lo que devuelve es precio.",
  "tracking/[id]/actions.ts::lookupRateForNewDestination":
    "Sin candado: busca tarifa por destino. Mismo caso que `lookupSuggestedRate`.",
  "facturacion/actions.ts::lookupShipmentForInvoice":
    "Sin candado: `from(\"shipments\").select` por código. Lectura acotada sólo por la RLS de tenant.",
  "facturacion/actions.ts::lookupInvoiceBillingOptions":
    "Sin candado: `from(\"clients\").select` con los datos de facturación del cliente.",
  "documentos/actions.ts::signDocumentUrl":
    "Sin candado de módulo. Desde SDD-0508 recibe el id de la fila, no un path: firma el `storage_path` de una fila de `documents` que la RLS deje leer, en el bucket que dice la fila (sólo `documents` o `bitacora`). Lo que acota es la RLS de `documents` y la de `storage.objects`.",
  "documentos/actions.ts::listDocumentVersionsAction":
    "Sin candado: lista el historial de versiones de una cadena documental.",
  "nomina/actions.ts::listPayrollRunLinesAction":
    "Sin candado, en un módulo que es dinero Y PII de empleados. El comentario del código dice «la RLS por tenant+rol ya restringe» — puede ser cierto y aun así el gate de aplicación falta.",
  "nomina/actions.ts::listSettlementLinesAction":
    "Sin candado; mismo caso que `listPayrollRunLinesAction`.",
  "tarifas/actions.ts::previewRatesImportAction":
    "Sin candado, pero NO toca datos: `return parseRatesCsv(csv)` sobre el texto que mandó el propio llamante. El riesgo es el menor de la lista; se deja acá para no cambiar comportamiento fuera del encargo.",
};

const listaDe = (clave: string): "EXCEPCIONES" | "DEUDA" | null =>
  clave in EXCEPCIONES ? "EXCEPCIONES" : clave in DEUDA ? "DEUDA" : null;

describe("RBAC anti-drift · por acción (SDD-0085 · SDD-0500)", () => {
  const archivos = listarArchivosDeActions();
  const reportes = archivos.flatMap((file) => {
    const rel = rutaRelativa(file);
    return scanActionsFile(readFileSync(file, "utf8"), rel).map((r) => ({ rel, r }));
  });

  /**
   * Los totales van APARTE del veredicto por acción y a propósito. Si alguien
   * «arregla» un rojo moviendo una acción de un archivo a otro, el veredicto
   * vuelve a cuadrar y el total no. Dos aserciones que fallan por caminos
   * distintos valen más que una más estricta.
   */
  // SDD-0507 sumó `clientes/adjuntos-actions.ts` con una sola acción,
  // `firmarAdjuntoAction`, que pasa el veredicto por acción sin entrar en
  // ninguna de las dos listas (gate de vista `clients` antes de firmar).
  // SDD-0522 sumó `embarques/actions.ts` (74 → 75, exactos 54 → 55) con
  // `deleteShipmentsAction`, que llama a `capabilityDenial(…, "delete_shipments")`
  // antes de tocar nada y pasa el veredicto sin entrar en ninguna lista.
  // SDD-0531 sumó `tracking/[id]/datos-reservados-actions.ts` (75 → 76, con
  // prefijo 20 → 21) con una sola acción, `updateShipmentSinUbicacion`.
  it("la superficie escaneada es la esperada (76 archivos, no sólo los `actions.ts`)", () => {
    const exactos = archivos.filter((f) => f.endsWith(`${"/"}actions.ts`) || f.endsWith("\\actions.ts"));
    const conPrefijo = archivos.length - exactos.length;
    expect({ total: archivos.length, exactos: exactos.length, conPrefijo }).toEqual({
      total: 76,
      exactos: 55,
      conPrefijo: 21,
    });
  });

  // SDD-0513 sumó `operarios/actions.ts::generateOperarioPinAction` (428 → 429):
  // restablece el PIN con uno sorteado en el servidor y llama a
  // `moduleEditDenial(supabase, "operarios")` antes de sortear; pasa el
  // veredicto por acción sin entrar en ninguna de las dos listas.
  // SDD-0515 sumó `operarios/actions.ts::viewOperarioPinAction` (429 → 430):
  // «Ver PIN» llama a `moduleEditDenial(supabase, "operarios")` antes de leer
  // nada, y la RPC repite el candado con la matriz y audita en su transacción;
  // pasa el veredicto por acción sin entrar en ninguna de las dos listas.
  // SDD-0522 (430 → 431): suma `embarques/actions.ts::deleteShipmentsAction` y
  // cambia `cn/actions.ts::softDeleteReceiptAction` (UPDATE por RLS, gate de
  // edición de `cn`, sin UI) por `deleteReceiptsAction` (capability
  // `delete_warehouse_receipts` y la RPC de la 0476). Las dos nuevas llaman a
  // `capabilityDenial` antes de tocar nada.
  // SDD-0531 sumó `tracking/[id]/datos-reservados-actions.ts::updateShipmentSinUbicacion`
  // (431 → 432): guarda los datos del envío conservando la ubicación para quien
  // no puede verla; llama a `moduleEditDenial(supabase, "tracking")` antes de
  // leer nada y delega la escritura en `updateShipment`, que repite el candado.
  // SDD-0537 sumó `admin/carrier-actions.ts::bulkUpdateTariffPricesAction`
  // (432 → 433): cambio en lote del tarifario de transportistas; llama a
  // `resolveTenantAdmin` → `tenantAdminGate` antes de leer nada (el patrón del
  // resto del archivo) y la RLS de 0330 repite el candado de admin vivo.
  // SDD-0560 sumó `embarques/actions.ts::leerPlanDeBorradoAction` y
  // `embarques/actions.ts::ejecutarPasoDeBorradoAction` (433 → 435): el
  // asistente de borrado. Las dos llaman a `capabilityDenial(…,
  // "delete_shipments")` antes de leer nada y pasan el veredicto por acción sin
  // entrar en ninguna lista; cada paso delega en la acción de su módulo, que
  // repite su propio candado.
  // SDD-0566 sumó `contabilidad/actions.ts::setClosingModeAction`,
  // `fijarSuperclaveAction` y `restablecerSuperclaveAction` (435 → 438): el modo
  // del cierre y la superclave. Las tres llaman a `tenantAdminGate` antes de
  // tocar nada, como `setClosingDateAction`; la RLS admin-only de 0133
  // (accounting_settings) y las RPC de 0493 (`cierre_es_admin`) repiten el candado.
  it("el inventario de acciones exportadas no se mueve en silencio", () => {
    expect(reportes.length).toBe(438);
  });

  it("el tamaño de las dos listas está congelado", () => {
    // Bajar estos números es progreso y hay que actualizarlos; subirlos exige
    // defender por escrito cada entrada nueva en una PR.
    expect({
      excepciones: Object.keys(EXCEPCIONES).length,
      deuda: Object.keys(DEUDA).length,
    }).toEqual({ excepciones: 15, deuda: 24 });
  });

  for (const { rel, r } of reportes) {
    const clave = `${rel}::${r.name}`;
    it(`${clave} tiene un candado antes de tocar datos`, () => {
      const lista = listaDe(clave);

      if (!r.gated && !lista) {
        throw new Error(
          `${clave} (línea ${r.line}) ${r.problem}.\n` +
            `Agregá un guard de rbac-guard al TOPE de la acción, o —si de verdad no lo ` +
            `necesita— documentá la excepción en EXCEPCIONES / DEUDA de este archivo, con ` +
            `su motivo escrito. Una acción nueva no puede nacer sin candado.`,
        );
      }
      if (r.gated && lista) {
        throw new Error(
          `${clave} ya está gateada (${r.guard?.name} en la línea ${r.guard?.line}) → ` +
            `quitá su entrada obsoleta de ${lista}. Si era DEUDA, es una deuda pagada.`,
        );
      }
    });
  }

  it("ninguna entrada de las listas apunta a una acción que ya no existe", () => {
    const vivas = new Set(reportes.map(({ rel, r }) => `${rel}::${r.name}`));
    const huerfanas = [...Object.keys(EXCEPCIONES), ...Object.keys(DEUDA)].filter(
      (k) => !vivas.has(k),
    );
    expect(huerfanas).toEqual([]);
  });

  it("toda entrada lleva un motivo escrito, no un placeholder", () => {
    const flojas = Object.entries({ ...EXCEPCIONES, ...DEUDA })
      .filter(([, motivo]) => motivo.trim().length < 40)
      .map(([clave]) => clave);
    expect(flojas).toEqual([]);
  });
});
