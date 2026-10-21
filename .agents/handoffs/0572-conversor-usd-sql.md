# Handoff · SDD-0572-b · Conversión anual USD compatible

Estado vigente: **EN PROGRESO · SQL/PGlite parcial validado; cierre pendiente**.
Base: a30d85859c788070ffc3459a29e389cab015c7eb. Claim adquirido y guard PASÓ.
Owner: worker-0572b-01a15a4e-ddf0-7d82-8656-d9dc56b58468.
Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0572-conversor-usd-sql.
Rama: codex/sdd-0572-conversor-usd-sql. PR futura en borrador contra
codex/sdd-0572-conversor-usd-reemplazos (#310), sin merge/deploy/DB real.
Árbol de partida limpio, node_modules ausente y sin consumidores propios.
Turno pesado exclusivo recibido del Director; etapas locales seriales.

## Contrato de asignación aceptado antes de producto
# Asignación Worker · SQL 0572-b · 20 de octubre de 2026

$worker

## Objetivo, propiedad y base

Completar localmente la transición compatible de los dos agregados anuales a la conversión canónica USD, con subtotal exacto, contador de facturas sin tasa y estado verdadero hasta Portal, Fidelización, Reportes y CRM. Entregar implementación, pruebas, revisión atendida, commits selectivos, handoff y PR en borrador. Ejecuta hasta completar; no basta un plan.

- Task ID: `0572-conversor-usd-sql`.
- Owner: agente `/root/worker_0572_cierre`, sesión escritora única de este worktree.
- Worktree verificado: `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0572-conversor-usd-sql`.
- Rama: `codex/sdd-0572-conversor-usd-sql`.
- Base inmutable: `a30d85859c788070ffc3459a29e389cab015c7eb`, cabeza de PR #310, incluye main `d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8`.
- Claim propio propuesto: `worker-0572b-01a15a4e-ddf0-7d82-8656-d9dc56b58468`. Ejecuta guard y claim desde este árbol antes de editar; verifica raíz/rama. No reclames ni edites el árbol 0572-a, que se conserva.
- SDD reutilizada: `docs/specs/0572-conversor-usd-reemplazos/spec.md`, sección b con estado de implementación local separado de a e integración.
- Handoff propio: `.agents/handoffs/0572-conversor-usd-sql.md`. Guarda este contrato y allowlist antes del primer cambio de producto; conserva historia/validaciones de a.
- Migración asignada por Director tras inventario de 480 refs más worktrees: **0498_annual_billing_fx_v2**. No tomar otro número ni editar migraciones aplicadas. La secuencia de nombres propia del repositorio prevalece sobre el formato genérico de una skill.

## Autorización y límites

Sam autorizó continuar localmente la 2.1, hacer push de entregas y abrir PR en borrador durante el bloqueo de Actions. Se permiten preparación de dependencias sin secretos, datos sintéticos, PostgreSQL/PostgREST desechables locales, pruebas, commits y push selectivos de esta rama. PR en borrador contra `codex/sdd-0572-conversor-usd-reemplazos`, para que muestre solo el delta b y declare dependencia de #310. No marcar lista para merge; el Director revisa cabeza y base finales. Adjunta cualquier PR creada y comunica URL/SHA.

**No merge, auto-merge, publicación de web, VPS, cambios de cuenta/pagos, datos reales, lecturas de filas productivas, migraciones reales, credenciales productivas, instalación del publicador ni env copiados.** 0495 ya se aplicó una vez: no repetirla, renumerarla ni sellarla aquí. 0496/0497/0498 siguen sin aprobación nominal de aplicación. Se conserva el orden humano de integración #301 → #304/#306 → #307 → 0573 y sellos; esta PR local no lo elude. No usar main como árbol escritor, no reset, add -A, force push ni limpieza de recursos ajenos.

## Diseño aprobado y contratos de aceptación

Alternativa A de `C:\tmp\director-traspaso-20261020\0572b-transicion-compatible-codex.md`, revalidada contra d410/a30: Portal conserva nombre sin argumentos, jsonb, identidad, propietario, ACL y campos legados, y añade `billing_v2`. Studio v1 se conserva íntegra; nueva `studio_client_annual_billing_v2(p_as_of date)` tabular, sin parámetros de tenant/cliente. No usar overload ambiguo ni drop/recreate de v1. La retención temporal de conversiones legadas y su retiro posterior se declara como deuda de compatibilidad; no afirmar eliminación universal de CASE históricas.

1. Portal v2: `{version:2, subtotal_usd:string|null, sin_tasa_count:bigint, conversion_state:'completo'|'sin_tasa'|'datos_invalidos'}`. Studio v2: TABLE `client_markbox text, subtotal_usd text, sin_tasa_count bigint, conversion_state text`. Decimal canónico con exactamente dos decimales; contador seguro no negativo. DTO ausente, mal formado, incoherente o duplicación de clave no se vuelve cero.
2. Conversión exclusivamente por `to_usd` de0495 y la tasa congelada de cada factura. Sin catálogo de respaldo, nuevas divisiones ni fórmula paralela. Se aprueba un ayudante puro interno de0498 en esquema privado, con visibilidad/nombre declarados en la spec y sin USAGE/EXECUTE para roles API. Puede invocar el helper canónico y capturar únicamente la terna exacta SQLSTATE22023 + hint dtd-fx + mensajes FX_AMOUNT_INVALID/FX_RATE_MISSING/FX_CURRENCY_UNKNOWN, preservando la prioridad del conversor. Cualquier otro error se relanza. No duplicar la fórmula ni capturar todo22023/WHEN OTHERS como falta de tasa. Suma conversiones redondeadas por factura, dos decimales half away from zero. Conserva signo y cero válido. Una factura se cuenta una vez, antes de joins multiplicadores.
3. `completo`: subtotal válido y contador0; `sin_tasa`: subtotal válido y contador>0, incluso subtotal0 si todas excluidas. `datos_invalidos`: subtotal null y contador solo de faltas de tasa válidamente clasificadas. Error de transporte/permisos/SQL/caché/páginas/shape es lectura `no_disponible`, distinto de ausencia de principal y de falta de tasa. Diagnóstico sanitizado, no detalles sensibles a UI.
4. Helper compartido nuevo `lib/shared/annual-billing.ts`: valida y conserva decimal/céntimos exactos. No amplíes fx.ts. Un importe grande conserva su string exacto; solo usa un motor/formateador numérico existente si demuestra recuperar los centavos. Si no, el derivado monetario queda no disponible y el subtotal exacto permanece consultable. No `Number(...) || 0`, clamp que borre negativos ni bigint en props que Next no pueda serializar.
5. Studio conserva filtros y permisos efectivos de0411, incluidos defaults/overrides y miembros deshabilitados; v2 EXECUTE solo authenticated, revoca PUBLIC/anon/service_role. No ampliar RLS, leer facturas desde app ni elevar sesión. Portal conserva principal activo, cliente vivo, mismo tenant y minimización. Guarda STABLE/SECURITY DEFINER/search_path vacío y nombres calificados. Comparar catálogo/ACL efectiva de v1 antes/después, no presumir service_role revocado en0411.
6. V2 conserva filas con elegibles aunque subtotal0/negativo/todas excluidas: no HAVING positivo. Paginación estable y hasta página vacía, avanza por recibidas, no corta por página breve. Error intermedio, tope de páginas o clave repetida impide declarar lectura global completa. Fija un único p_as_of por lectura. Más de1.000 grupos y límite de500 con solo excluidos al final debe conservarlos. No prometer snapshot transaccional entre páginas.
7. Preserva las ventanas actuales deliberadamente diferentes: Portal fallback created_at::date de sesión y un año calendario hasta sin cota superior; Studio fallback UTC y p_as_of±1 respecto de current_date, límite superior inclusivo. No introducir Caracas silenciosamente ni365 días. Sus cambios vendrán en entrega posterior conjunta.
8. Portal mantiene recompensas/referidos aunque la métrica anual sea parcial/no disponible. Fidelización comparte la lectura entre listado/distribución; nivel/progreso incompletos dicen Por revisar, sin asignar Bronze por defecto ni modificar tier manual, beneficios o créditos.
9. Reportes preserva subtotal/contador/estado por cliente/asesor y CSV; no convierte error en Map vacío ni descarta solo-excluidos. Conserva los cambios de completitud de #310. Datos no financieros disponibles siguen visibles ante fallo de la métrica.
10. CRM conserva estado por lead y contraste ERP. allConvertedLeads no puede certificar un cruce parcial al agotar páginas; Reportes no absorbe ese error como {}. CRM/page filtra hoy valueByLead a números y el tablero vuelve al precio Kommo si falta ERP: para un cliente convertido debe transportar estado ERP y no sustituirlo silenciosamente por valor nominal. No rediseñar pipeline/KPIs globales.
11. Agregados sobre leads deduplican el contador por markbox dentro de cada conjunto. Un cliente puede pertenecer a varios asesores: no sumar esos conteos como total único del tenant. La atribución histórica de ingresos por lead conserva su alcance y deuda de KPI, sin certificarse globalmente.
12. DB nueva + app anterior mantiene legado; DB nueva + app nueva usa v2; app nueva + DB/caché vieja muestra métrica no disponible sin fallback v1, cero o lectura directa de facturas. Rollback de app permanece compatible. Migración con preflight/postflight, caché PostgREST y procedimiento futuro de release descritos en spec/handoff; nada real aplicado.

## Allowlist exacta aprobada

Solo estas 41 rutas. Se acepta el arnés HTTP durable propuesto por el Worker, sin incorporarlo a los gates ni cambiar su política de omisiones. No es necesario modificarlas todas si una no lo requiere; cualquier ampliación se propone al Director con causa y evidencia antes de escribir.

```text
supabase/migrations/0498_annual_billing_fx_v2.sql
supabase/tests/0498_annual_billing_fx_v2.test.sql
supabase/migrations-baseline.json
supabase/pending-migration-symbol-declarations.json
lib/studio/__tests__/annual-billing-fx-v2.migration.test.ts
scripts/tests/annual-billing-fx-v2-postgrest.mjs
lib/shared/annual-billing.ts
lib/shared/__tests__/annual-billing.test.ts
lib/portal/portal-referral-queries.ts
lib/portal/__tests__/portal-referral-query.test.ts
lib/portal/__tests__/referrals.test.ts
app/portal/(app)/referidos/page.tsx
app/portal/(app)/referidos/__tests__/page.test.tsx
lib/studio/fidelizacion/queries.ts
lib/studio/fidelizacion/__tests__/queries.test.ts
lib/studio/__tests__/listados-sin-eliminados.test.ts
app/studio/(app)/fidelizacion/page.tsx
app/studio/(app)/fidelizacion/_components/FidelizacionClient.tsx
app/studio/(app)/fidelizacion/_components/FidelizacionClient.annual-billing.test.tsx
app/studio/(app)/fidelizacion/__tests__/annual-billing-page.test.tsx
lib/studio/reports/queries.ts
lib/studio/reports/types.ts
lib/studio/reports/__tests__/queries.test.ts
lib/studio/reports/export-csv.ts
lib/studio/reports/__tests__/export-csv.test.ts
app/studio/(app)/reportes/_components/ReportesClient.tsx
app/studio/(app)/reportes/_components/ReportesClient.annual-billing.test.tsx
lib/studio/kommo-analytics.ts
lib/studio/__tests__/kommo-analytics.test.ts
lib/studio/__tests__/kommo-analytics-paging.test.ts
app/studio/(app)/crm/page.tsx
app/studio/(app)/crm/_components/KommoClient.tsx
app/studio/(app)/crm/_components/KommoBoardView.tsx
app/studio/(app)/crm/_components/DireccionTab.tsx
app/studio/(app)/crm/_components/KommoClient.annual-billing.test.tsx
app/studio/(app)/crm/_components/KommoBoardView.annual-billing.test.tsx
app/studio/(app)/crm/_components/DireccionTab.annual-billing.test.tsx
app/studio/(app)/crm/__tests__/annual-billing-page.test.tsx
docs/specs/0572-conversor-usd-reemplazos/spec.md
docs/specs/README.md
.agents/handoffs/0572-conversor-usd-sql.md
```

Baseline solo añade espera0498; no falsear sello0495 ni exenciones existentes. Declaración de símbolos solo la nueva degradación de la RPC si el gate la requiere y la conducta real la respalda; no modificar excepciones ajenas. Índice solo generado. No modificar las pruebas SQL antiguas para que cambien su resultado histórico ni inventar nuevas reglas de producto global.

## Validación y turno exclusivo

El Director completó knowledge:status de main a00:22:44Z, salida0/ok=false, y comprobó cero procesos pesados. **Recibes el turno pesado exclusivo** desde esta asignación hasta devolverlo expresamente. Serializa dentro de tu tarea: focales, tipos, PostgreSQL/Docker/PostgREST, verify/build/E2E/conocimiento. No ejecutes dos de esas etapas simultáneas ni arranques otra tarea. Director/revisor quedan en lectura y documentos.

Antes de producto lee la skill Worker y normas actuales, backend/Norte, BRAND/diseño para UI, governance-check y políticas normativas. Matriz SGE-00 por12 principios, NUM-01, ERR-01 y aplicables; no declarar conforme solo por gate. El validador de plugin ya pasó sobre la base, 28 políticas/5 componentes; es consistencia, no prueba del producto. Clasifica cumplimiento/no aplica/excepción/no conformidad con evidencias. Cambio de comportamiento R3 requiere SDD, alcance y revisión visible proporcional; no inventar un rediseño general.

Pruebas relevantes: fixture sintético antes/después para reproducir conversión nominal/CNY/falta de tasa/pérdida de contador; SQL real con migraciones requeridas y nueva0498, identidad/firma/ACL/legado, aislamiento tenants/roles/overrides, cero/signo/medio centavo/tasa8decimales/no finitos/límites/importe inválido/moneda desconocida, ventanas/límites/año bisiesto. PGlite complementa y no sustituye PostgreSQL ni HTTP. No añadir pgTAP: el arnés vigente usa DO/RAISE y rollback.

HTTP PostgREST local v14.17 con PostgreSQL17: POST p_as_of, RPC nueva/ausente/caché, tipo decimal/contador reales, grants/tenant y paginación con más de1.000 grupos/límite500. Fixtures/JWT de prueba únicamente. Si falta arnés, puedes preparar scripts efímeros fuera deGit en el directorio de evidencia; si se necesita una ruta persistente nueva, proponla antes. Puerto127.0.0.1, nombres/labels propios, no conectar ni reutilizar DB real. Docker Desktop puede iniciarse para estas pruebas; registra estado inicial y restaura solo lo que inicies. No borres contenedores/volúmenes/recursos ajenos ni hagas prune.

UI/componentes reales con fixtures, casos completo/parcial/todas excluidas/inválido/error/monto grande, CSV con filas/estado/celdas nulas; ancho390 y escritorio, claro/oscuro si cambia apariencia. Conserva evidencia de límites, no certifiques autenticado/producción/dispositivo físico si no se ejecuta. Revisión React después de múltiples TSX.

Ejecuta focales necesarios y `corepack pnpm verify` canónico al estabilizar candidato; conserva logs, stdout/stderr, SHA/tiempos y el JSON E2E original **antes de que verify lo elimine al pasar a build** (puede vigilar/capturar solo la existencia del archivo sin cambiar el runner). No repetir suites sin causa nueva. No cambiar tests para ocultar fallos, límites/watchdogs/gates o políticas. Ledger productivo sin credenciales es NO EJECUTADO; no aplicar DB para ponerlo verde. Registra todos los SKIPs y distingue salida0 de CIERRE INCOMPLETO.

Conocimiento del worktree al cierre: Graphify/Archify/preview según runbook, sin publicar bóveda desde rama no integrada ni regenerar por reflejo para ocultar ausencias. Si status es costoso, prográmalo tras pruebas, nunca en paralelo. Actualización semántica estructural global fuera del alcance se registra pendiente.

Cierre: diff exacto de las rutas aprobadas y protecciones de migraciones/FX; commits coherentes, guard/rama comprobados, push sin force, PR en borrador con base/SHAs/dependencias/validación/omisiones. Notifica primer candidato para revisión independiente; atiende hallazgos. Entrega handoff durable con impacto documental, pendientes propios frente a fuera de alcance, procesos/puertos/containers propios cerrados y claim liberado cuando nadie lo consuma. No cierres con un resultado inventado si falta una comprobación.

## Referencias comprobadas por el Director

La propuesta histórica tiene bases M8e9/F5d84/R9c254; hoy prevalecen d410/a30 y esta asignación. Revisor actual: `C:\tmp\director-traspaso-20261020\0572b-revision-diseno-actual.md` cuando lo cierre.

Documentación primaria consultada: PostgreSQL17 CREATE FUNCTION (no cambio de retorno con CREATE OR REPLACE), PostgREST14 Functions as RPC y Schema Cache, guía Supabase Database functions. Índice changelog Supabase consultado el20oct; los cambios recientes de TLS/gateway/PG no justifican una actualización de plataforma en este encargo. Se mantiene el stack fijado del repo; no ejecutar detecciones/cambios en producción.

- https://www.postgresql.org/docs/17/sql-createfunction.html
- https://docs.postgrest.org/en/v14/references/api/functions.html
- https://docs.postgrest.org/en/v14/references/schema_cache.html
- https://supabase.com/docs/guides/database/functions

Directorio de evidencia propio: `C:\tmp\director-traspaso-20261020\0572b-codex-validation\`.

## Primer checkpoint de SQL — 2026-10-21 00:50 UTC

Estado: **EN PROGRESO**. Candidato SQL separado de la app todavía sin commit;
no es cierre, integración, aplicación ni aceptación íntegra de 0572-b.

- 0498 añade la RPC Studio v2 y billing_v2 Portal; mantiene v1 íntegra y compara
  OID/owner/ACL y payload legado. Clasificador privado sin grants API, conversor
  canónico, decimal exacto, sin DML ni modificación de las migraciones anteriores.
- Preflight exige la frontera 0414 actual (no la policy invoices_team_select),
  forma de fachadas y huella Portal0404. Reaplicación/instalación parcial abortan.
- Fixture usa definición REAL get_user_tenant_id extraída de0453. auth.uid,
  current_studio_role y dos fachadas auxiliares de catálogo son fixtures
  explícitas; no se certifica equivalencia con Auth productivo.
- PGlite **PASÓ 17/17, 0 SKIP, exit0**, 00:48:48–00:49:33Z. Contrato normal,
  control sin expansión, tres abortos de preflight y doce mutantes funcionales.
  Mutantes en memoria, sin alterar el SQL del árbol. Carga1201 verifica que no
  se recalcula la clasificación por cada agregado. Ventana bisiesta prueba
  aritmética calendario; no reloj productivo simulado.
- Evidencia externa:
  C:/tmp/director-traspaso-20261020/0572b-codex-validation/sql-mutants-1.log,
  sql-mutants-1.json y sql-mutants-1-receipt.json.
- **PostgreSQL17/HTTP14.17, tipos/lint finales, UI en navegador y verify:
  NO EJECUTADOS** en este checkpoint. Arnés HTTP en preparación no incluido
  aún. El SQL no está aprobado para producción.
- Baseline agrega exclusivamente espera0498. Se conserva la espera0495 que
  heredó la base; el Director ya aplicó0495, pero su sello no pertenece a b.
- App en preparación: rojo funcional inicial5/32 y primer verde lectores31/31
  (el caso RPC-error dejó de esperar null y ahora exige rechazo; no se perdió
  cobertura). Focal161/162 detectó pérdida real de centavos en puente numérico;
  corregido con ida/vuelta por representación decimal corta, sin cambiar la
  expectativa 90071992547409.91. Componentes/RSC suplementarios31/31 pasan.
  Estos resultados no se atribuyen al commit SQL ni a una suite general.
- Documentación/Graphify/Archify/Obsidian: guardado local en esta tarea;
  integración/estructura/cobertura semántica/preview/publicación pendientes.
  No se publica la bóveda desde esta rama.
