# Handoff · SDD-0572-b · Conversión anual USD compatible

Estado vigente: **IMPLEMENTACIÓN Y REVISIÓN LOCAL COMPLETADAS; verify CIERRE INCOMPLETO (16/17); PR311 DRAFT; integración y release pendientes**.
Base: a30d85859c788070ffc3459a29e389cab015c7eb. Claim adquirido y guard PASÓ.
Owner: worker-0572b-01a15a4e-ddf0-7d82-8656-d9dc56b58468.
Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0572-conversor-usd-sql.
Rama: codex/sdd-0572-conversor-usd-sql. PR311 en borrador contra
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

## Suplemento SQL/HTTP y focales — 2026-10-21 00:58 UTC

- Checkpoint publicado: f9cc1dd101fc4e06ed7007b1a6a14c1bd5471cff.
  PR311 abierta por Director, en borrador y apilada sobre #310:
  https://github.com/SoftAgentes/DTDCARGO/pull/311 .
- Migración0498 **idéntica** a f9cc1dd. Contrato corregido tras primer PostgreSQL:
  el test cambiaba current_date al cambiar zona después de medianoche UTC.
  Ahora fija fecha antes de SET TIMEZONE y sitúa created_at en límite inferior;
  un mutante que usa fecha de sesión es detectado. No fue defecto de0498.
- Focal ampliado **PASÓ247/247 en18archivos,0SKIP,exit0**,00:54:39–00:56:18Z,
  focal-all-1.log/json/receipt. Incluye PGlite18/18 con13mutantes funcionales.
- PostgreSQL17.11 **PASÓ37aserciones y ROLLBACK**, postgrest-2/postgres-contract.log.
  El intento1 falló por fixture temporal; recibo conservado. El intento2 pasó
  contrato y seis hitosHTTP, pero falló paginación del arnés: Range header no
  pagina POST RPC. Corregido a offset/limit/order en query como SDK real.
- HTTP PostgREST14.17 **PASÓ**, postgrest-3/receipt.json, exit0:
  función ausente404/PGRST202 antes del DDL;0498 real con COMMIT; NOTIFY y
  recarga en caliente en el mismo contenedor; compatibilidad v1/Portal;
  tenant/roles/ambigüedad0453/ACL/overrideOR;1202grupos en500/500/202/0,
  último solo sin tasa; importe99999999999999000000.00 exacto.
  Fue HTTP-only: no repitió SQL37 verde de la corrida2.
- Límite de reciboHTTP3: las aserciones de StartedAt igual antes/después y
  respuestas negativas se ejecutaron, pero los valores crudos individuales
  no quedaron guardados. **NO DISPONIBLES**, sin reconstruirlos. Se conserva
  harness-executed.mjs y hash en la evidencia; el arnés durable agrega esos
  campos para futuras ejecuciones. No se repite una corrida verde por reporte.
- Docker29.9.1 iniciado oculto (ausente inicialmente); contenedores y redes
  propios de las tres corridas eliminados y docker ps vacío. Desktop sigue
  activo durante el turno para los gates canónicos futuros, sin recursos ajenos.
- Tipos final1 **FALLÓ** por un argumento de fecha faltante en el test nuevo de
  DireccionTab; corregido a reloj sintético explícito. Tipos finales, lint,
  navegador, verify y revisión financiera siguen pendientes; no cierre general.
- Adaptación app/DTO/consumidores sigue local y fuera del checkpointSQL.
  No se atribuyen los resultados de esos bytes al SHA publicado.

## Candidato de aplicación · 2026-10-21 01:16 UTC

Publicado posteriormente en a734aa61f01fd70d734b4d2ddb32672d0c748a4c,
local/remoto iguales y árbol limpio; PR311 actualizada como checkpoint parcial.
Al pasar los archivos nuevos al índice, diff-check detectó dos EOF con línea
en blanco en pruebas RSC nuevas; corregidos sin cambiar aserciones. Diff
completo a30→a734 PASÓ después del commit. App congelada para revisión.

- SQL publicado en f9cc1dd y suplemento inmutable en
  3b74e42b1618a856d812455ca565f69f530efb53. Revisión SQL independiente del
  Director: fixture temporal cerrada, sin nuevos hallazgos sobre contrato/ACL.
  La migración conserva blob55c625d93c50aee8ba67d89b5f8bcc3947bbee77 y
  SHA256cd6a612fc646f16099424266e974f0258347e663208193d6d5f062ce5b3fce6b.
- DTO exacto compartido, lectores v2, propagación por Portal/Fidelización/
  Reportes/CSV/CRM y rechazo de cruce truncado implementados. Puente numérico
  exige representación decimal corta reversible; el importe exacto grande
  sigue visible aunque no sea apto para derivar un nivel con Number.
- Verde funcional ampliado previo:247/247,18archivos,0SKIP. Suplemento visual
  posterior:28/28 en4archivos,0SKIP,exit0. Cinco casos nuevos de entrada ERP
  ausente/nominal legítimo:20/20 en2archivos,0SKIP,exit0. No sumar estas cifras
  como pruebas únicas: hay solapamiento; los recibos delimitan cada corrida.
- Mutantes app: primera medición10muertos/3vivos,13restaurados. 09/10 revelaron
  falta de regresión UI para convertido con lectura global disponible pero
  entrada individual ausente; se añadieron esos casos y controles del nominal
  legítimo. 12 tenía foco incorrecto: el contrato de tier:null ya estaba en la
  prueba RSC real. Suplemento SOLO09/10/12:3muertos por aserción funcional y
  3restaurados. Resultado final13/13 detectados, sin ocultar primera medición.
  Evidencia: app-mutants/result.json y app-mutants-supplement/result.json,
  logs individuales, copias originales y huellas de restauración.
- UI sintética con componentes reales, adaptadores mínimos de navegación/
  acciones inactivas y sesión ficticia; sin DB/env. Siete superficies a390 y
  1280, claro/oscuro, parcial/cero/signo/solo excluidas/inválido/no disponible/
  importe grande según recibos. after-measurements.json: documento390/390 y
  1280/1280; cero pageerrors. Las cuatro tablas llegan por Tab y flechas al
  extremo, con cifras/estado consultables. Ajustes de overflow y wrap solo en
  consumidores permitidos; no se modifica KpiCard compartido.
- Evidencia visual: visual-fixture/after-*.png, keyboard-*.png,
  after-measurements.json, accessibility.json y source-hashes.json. CSSzoom2
  observa392/390 en Reportes: aproximación de reflow, **no** certificación de
  zoom nativo200%, lector de pantalla ni WCAG integral. El tema Portal inicial
  mal configurado era de la fixture; corregido con data-portal-theme, sin
  atribuir ese falso hallazgo al producto.
- Servidor fixture PID32044/puerto47576 y suplemento baseline PID43812/48413
  cerrados; cleanup.json y baseline-cleanup.json confirman cero procesos hijos
  y cero listeners. Navegadores propios cerrados en finally.
- Typecheck final2 **PASÓ exit0**, 01:14:31–01:14:54Z. Lint inicial34rutas
  FALLÓ por optional-chain con non-null assertion en testPortal y un import de
  tipo sin uso; ambos corregidos. Suplemento de las dos rutas **PASÓ exit0**.
  Persisten dos advertencias idénticas a a30: Date.now en render Board y
  setState síncrono en effect de KommoClient. No se suprimen ni se rediseña
  reloj/aging. Los ajustes de lint no cambian comportamiento de producto.
- Guard, índice, numbering y sintaxis del arnés HTTP **PASÓ**. Índice permanece
  idéntico: no hubo cambios de metadatos que exijan regeneración.
- pending-migration-symbols **FALLÓ**: el nombre privado convertir coincide
  con literales «Convertir a cliente»/«Facturas sin convertir». El detector
  busca token simple, no invocación SQL, y los declara llamadas alcanzables.
  La declaración de la RPC v2 sí pasa. Se propuso al Director nombre privado
  específico y revalidación de SQL/HTTP; no se inventa degradación de homónimos
  ni se relaja el gate. Log original pending-symbols.log conservado.
- Verify canónico y revisión financiera siguen pendientes. No se declara
  aceptación completa, integración ni producción. Claim activo;
  el Worker conserva el turno pesado hasta terminar y devolverlo expresamente.

### FUERA DE ALCANCE DETECTADO

Portal ShareHero: la fila de recompensa$80/Próximamente excede su caja a390
(112px de caja/184px contenido) y la tarjeta superior la recorta. Reproducido
con página a30 y candidata, mismo adaptador sintético y DTO completo; esa
comparación solo atribuye la tarjeta de recompensa, no toda la app anterior.
ShareHero normalizado idéntico SHA256a2104ade299287175059cc55886163b994b51067db0eb9640b51f79d2afc9efe.
reward-comparison.json y reward-a30-390.png/reward-candidate-390.png preservan
medición y captura. No se tocó recompensa, créditos ni su diseño.

### Release y conocimiento pendientes

La futura aplicación de0498 requiere paquete desde SHA revisado, previa de
solo metadatos y OK nominal de Sam por el Director. Ejecutar preflight, DDL en
transacción, postflight de identidad/ACL/shape, recarga de caché y comprobación
con roles autorizados antes de publicar app. Nunca aplicar aquí por un gate.
Rollback de app es compatible con DB nueva por campos/v1 preservados; no se
propone borrar0498 aplicada ni restaurar conversiones mediante DML. Ante falla
del preflight, detener y reconstruir paquete; no saltar huellas ni permisos.

Documentación queda en spec/handoff propios, sin inventar regla nueva. Graphify
estructural, cobertura semántica, Archify, preview y Obsidian quedan separados
de implementación/PR. Status de cierre pendiente después de verify; sin
regeneración masiva ni publicación compartida desde rama no integrada.

## Renombre privado autorizado · 2026-10-21 01:21 UTC

Director aprobó cambiar SOLO annual_billing_private.convertir por
annual_billing_private.convertir_factura_anual_usd en0498 no aplicada y sus
contratos/arnés. Son17 referencias en15 líneas de4rutas, sin cambiar fórmula/cuerpo/ACL/
esquema ni las fachadas API. Evita declarar como degradación textos que no
llaman SQL y conserva el detector sin modificaciones. Se exige revalidar
PGlite/mutantes, PostgreSQL y HTTP sobre el nuevo blob, con revisión SQL nueva;
los recibos anteriores se conservan como históricos, no atribuidos al nuevo
hash. App a734 permanece intacta durante este suplemento.

Docker: observados10contenedores ajenos supabase_*_loop3d-pr55-20261020 al
iniciar el suplemento. No se gestionan ni se reutilizan; si siguen activos,
Desktop se conservará para no cortar un consumidor ajeno. Recursos de b
seguirán teniendo nombres/labels propios y limpieza limitada a esos recursos.

### Suplemento validado del renombre

- `rename-proof.json` acredita que las cuatro rutas de SQL/contrato/arnés solo
  sustituyen el identificador privado respecto de a734. El blob de0498 es
  `5b302b5cad00529fcc5731aa570fd620794c4689`, SHA256
  `dbbae6fc8b61489acc0c1fa4ada2790ae992bcc834181ef7e9e8c0c612f85315`.
  Las siete fuentes de la fixture visual siguen idénticas a a734.
- PGlite `sql-rename-1` **PASÓ 18/18, 0 omitidos, exit0** entre
  01:21:34 y01:22:15Z; incluye los13 mutantes SQL y su restauración.
- PostgreSQL17.11 y PostgREST14.17 `postgrest-4` **PASÓ exit0**, entre
  01:22:54.525 y01:23:11.463Z:37 aserciones SQL con ROLLBACK; HTTP antes de
  crear0498, DDL confirmado, recarga en caliente y respuestas posteriores.
  StartedAt antes/después es el mismo `2026-10-21T01:23:04.129331339Z`.
  El recibo conserva12 respuestas negativas sintéticas, páginas500/500/202/0,
  importe grande exacto y versiones/digests. Los dos contenedores y la red
  propios se limpiaron correctamente; no se intervino Loop3D.
- `pending-symbols-rename` **PASÓ exit0** a01:24:10Z:0 rojos y2 amarillos
  declarados (0495 heredada y0498). Sin cambiar detector, inventar callSites
  ni declarar textos de UI como fallbacks SQL. El fallo anterior se conserva
  como histórico, no se sobrescribe su evidencia.
- Lectura de capacidad antes de PG4: CPU host3%, memoria libre aproximada6GiB,
  contenedores ajenos entre0 y1.12%CPU. Es una observación puntual de metadatos,
  no prueba de ausencia universal de trabajo. Docker permanece por consumidores
  ajenos; recursos de esta tarea ya no están activos.
- Revisión SQL del nuevo blob y verify canónico pendientes. El Director
  confirmó además un P2 de app en a734: fusionar disponibilidad del cruce de
  leads y RPC anual oculta el nominal legítimo de un lead confirmado no
  convertido. Reparación autorizada dentro de41rutas después de este suplemento,
  con rojo lector/RSC/componentes y controles de convertido/cruce fallido.

## Reparación de los dos P2 de revisión · 21oct01:32UTC

Autorizada por Director dentro de las41rutas, sobre app a734 y suplemento SQL
0de5122760449ebfdee78fa63e0dd9170eb22603. Ningún cambio SQL adicional.

- CRM: `convertedAvailable` representa cruce completo y `billingAvailable`
  representa lectura anual disponible. Se transportan separados por la página
  RSC a Board/Worklist. Solo un no convertido confirmado puede usar su nominal;
  un convertido o identidad desconocida mantiene ERP no disponible. La cabecera
  nominal depende del cruce, no del éxito de la RPC anual. Si la columna no
  tiene convertidos y el cruce es completo, la contribución ERP vacía es cero.
- Portal: únicamente NULL real significa ausencia de principal. Se exige
  objeto escalar y markbox string con trim no vacío antes de normalizarlo.
  Arrays, undefined, primitivos y tipos inválidos provocan AnnualBillingError
  shape; la página ya muestra un mensaje sanitizado. Un principal válido con
  v2 ausente/errónea conserva código, recompensas, créditos y referidos,
  degradando únicamente la métrica y el nivel.
- ROJO CRM inicial:11fallos/20pasó. Incluía tres errores de fixture del asesor
  por faltar una constante del módulo de queries. Se corrigió el doble con
  importación parcial de constantes reales; `p2-crm-red-2` se ejecutó sobre los
  cuatro blobs originales a734 y las nuevas regresiones:11fallos reales (dos
  por nominal9876 ausente y nueve por contrato/flags). La restauración exacta
  de las cuatro fuentes reparadas está acreditada con hashes en el recibo.
- ROJO Portal: `p2-portal-red-2`30fallos/19pasó: shape se aceptaba como programa
  o ausencia. Conserva null real y v2 inválida con principal válido como
  controles. La primera corrida tenía arrays interpretados como tuplas por
  it.each; se envolvieron como datos y se repitió el foco, sin cambiar producto.
- Primer verde:115/118 por los tres errores de fixture citados; no se declara
  aprobado. Verde definitivo `p2-green-2` **PASÓ9archivos/118pruebas/0omitidas,
  exit0**,01:30:04–01:30:20Z. El bloque integrado ejecuta lector real, transporte
  RSC y componentes reales con respuestas sintéticas de sesión; no mockea el
  agregador bajo prueba ni usa DB/PII.
- `p2-mutants/result.json`: **10/10detectados,10/10restaurados**, fatal=null.
  Mutaciones de fusión de flags, cabecera nominal, fallback con identidad
  desconocida/convertido y shape/ausencia Portal. Cada resultado conserva
  aserciones fallidas, log, copia previa y hashes. Los13mutantes de app y13SQL
  anteriores siguen siendo evidencia histórica, no se suman como nueva corrida.
- Typecheck `p2-types` **PASÓexit0**,01:31:21–01:31:32Z; lint de34rutas
  `p2-lint` **PASÓexit0**,01:32:04–01:32:13Z, con las dos advertencias de reloj
  preexistentes ya contrastadas contra a30. Revisión del nuevo candidato pendiente.
  Verify y suplemento visual se ejecutarán después de estabilizar estos P2;
  ninguna revisión previa de a734 se atribuye automáticamente a la reparación.

## Cierre local del candidato 3b1de986 · 21 de octubre de 2026

Producto, pruebas y SQL quedaron congelados en
`3b1de9861de7bf15e614d89eb13cd2de6cb54fb0` durante el suplemento visual,
la corrida canónica y knowledge:status. El cierre posterior solo modifica
esta nota y la spec; su equivalencia de runtime se comprueba contra ese SHA.
La base de revisión continúa siendo `a30d85859c788070ffc3459a29e389cab015c7eb`
de #310. No se cambia a main ni se adelanta la integración coordinada.

### Revisión y suplemento visual

Los dos P2 quedaron cerrados por revisión independiente sobre 3b1de986, sin
nuevo hallazgo material conocido. El revisor financiero leyó los consumidores
y la evidencia; el revisor de contratos cotejó el transporte, SQL intacto y
las regresiones. Ninguno de esos dictámenes sustituye las ejecuciones del
Worker ni certifica producción. Informes externos en
`C:/tmp/director-traspaso-20261020/`:

- `0572b-revision-financiera-ui-candidato.md`, SHA256
  `bce64a3d0aedff6087ba5bada0654a05ba2f84c77748a320b451023bf65eff45`.
- `0572b-revision-contratos-app-candidato.md`, incluido el addendum E2E,
  SHA256 `5d15310ffa1687798bd6fd456817e682773e5acd55ac2364963de44201973015`.
- `0572b-revision-sql-validacion.md`, suplemento 0de aceptado, SHA256
  `785facdd0307e76f66a376a008a3ffe590097ad4d600846cafebb77a009a9f4e`.

La fixture `visual-fixture-p2/` usa los componentes reales y datos ficticios
de 3b1de986: ocho combinaciones CRM y siete Portal. Comprueba nominal legítimo
9876 con RPC anual fallida, ERP no disponible para convertido/identidad
desconocida, shape inválido visible, null real vacío y principal válido con
v2 inválida. Conserva capturas a390/1280 y claro/oscuro según cada caso.
La primera inspección **FALLÓ** al esperar visible una sección que debía estar
vacía para null, después de confirmar 13 casos. El suplemento espera attached
y confirma los dos restantes: **PASÓ**. No se reetiqueta el primer recibo.
El ajuste de colores de la fixture Portal fue del adaptador, no del producto.
`summary.json`, `receipt-initial.json`, `receipt-supplement.json`,
`readable-captures.json` y `source-hashes.json` conservan fuentes y límites.
No es Studio/Portal autenticado real, zoom nativo200%, lector de pantalla ni
auditoría WCAG integral. El Director aceptó esa evidencia acotada.

### Corrida canónica completa, con cobertura incompleta

`corepack pnpm verify` sobre 3b1de986 terminó con **exit0 real**, desde
`2026-10-21T01:35:58.749Z` hasta `2026-10-21T02:02:55.354Z`:
26min56.605s. Resultado literal: **CIERRE INCOMPLETO — 16/17 medidos;
migrations-applied sin medir**. El ledger productivo es validación de release;
su omisión no autoriza aplicar0498 ni invalida los contratos locales ejecutados.

| Control | Resultado observado | Evidencia y límite |
|---|---|---|
| harness | PASÓ | 237/237, 0 omitidos; 93.7496091s. |
| lint | PASÓ con advertencias | 0 errores, 15 warnings. Las dos advertencias de reloj en rutas modificadas ya se contrastaron con a30; no se atribuyen las otras a esta tarea sin auditoría. |
| rsc-boundary | PASÓ | 1707 módulos; sin cruces prohibidos detectados. |
| typecheck | PASÓ | Control canónico completo. |
| edge-functions | PASÓ | Compilan las cuatro entradas. |
| test | PASÓ con omisión | Primer intento:12538 aprobadas/1 omitida;876 archivos aprobados/1 omitido;524.90s. |
| docs:check | PASÓ | Índice coherente, metadatos sin cambio. |
| numbering | PASÓ | Sin colisión nueva; baseline histórico conservado. |
| feature-constants | PASÓ | Seis banderas coinciden. |
| components:check | PASÓ | Registro coherente. |
| governance:check | PASÓ | Cápsula coherente; no sustituye matriz ni revisión. |
| migrations-applied | NO EJECUTADO / SKIP | Sin URL/credenciales de producción; ningún acceso productivo para poner verde. |
| pending-migration-symbols | PASÓ | 0 rojos,2 amarillos declarados y3 homónimos descartados. |
| sql-tests | PASÓ | 247/247 contratos PostgreSQL efímero, incluido0498 vigente. |
| schema-rebuild | PASÓ | 490 migraciones:472 aplicadas+18 ledger-only;219 tablas y2 tenants sintéticos. |
| e2e | PASÓ con aviso según política vigente | 177 aprobadas,1 flaky recuperado,20 omitidas y1 error global de cierre;9.7min. No es una salida limpia de Playwright. |
| build | PASÓ | Build de producción completo y tsconfig restaurado;30.5s corresponde solo a compilación Turbopack. |

No hay tiempos individuales disponibles para todas las etapas en el log; no
se inventan a partir de los polls. Evidencia bajo
`C:/tmp/director-traspaso-20261020/0572b-codex-validation/`:
`verify-candidate.log`, `verify-candidate-receipt.json` y resumen derivado
`cierre-canonico-3b1.json`. Los dos primeros son los originales de la corrida.

La unitaria omitida es el corpus real de proformas, condicionado a
DOCUMENT_IMPORT_CORPUS. No se cargaron documentos comerciales para ejecutarla.
Los20 SKIPs E2E corresponden a18 casos de comentarios/gastos/buscador/finiquito
que requieren credenciales y fixtures aislados, y2 capturas del carrusel
reservadas por diseño al proyecto Chromium. No son cobertura de esos journeys.

El caso Chromium `e2e/auth.spec.ts:81` falló inicialmente con
`page.goto: net::ERR_ABORTED` en el token sintético inválido y pasó su retry;
se conserva como flaky. Playwright informó además
`worker-17 process did not exit within 300000ms after stop, force-killed it`.
El verificador heredado aceptó la salida no cero con `[OK] e2e (con aviso)`;
no hubo timeout del watchdog ni repetición de la suite. La frase automática
que lo atribuye a WebKit/Windows es texto del runner, **no un diagnóstico
causal demostrado**. Política/configuración permanecen idénticas a la base.

**JSON E2E original NO DISPONIBLE.** El capturador original por sondeo registró
captures=[] y el archivo ya estaba ausente al comenzar build. El ciclo heredado
lo elimina antes de cada intento, incluido build. No se reconstruyó ni repitió
la suite. El observador auxiliar fs.watch **FALLÓ** por assertion `_wcsnicmp`
en Node24/Windows; terminó y no alteró verify ni el producto. Su recibo
`e2e-original-watch-receipt.json` se conserva como incidencia de captura
separada, no como fallo de una prueba del conversor.

### Recursos, conocimiento y entrega

Sesión de verify cerrada y árbol limpio en3b1de986. Los recibos
`cleanup-after-verify.json` y `cleanup-final-heavy.json` comprueban cero
procesos propios conocidos, cero descendientes registrados con la misma
identidad y cero listeners de las fixtures/E2E. Un PID antiguo de Vitest fue
reutilizado por conhost del runtime CUA, con otro padre y fecha posterior:
se identificó y no se intervino. Los recursos PostgreSQL/HTTP propios quedaron
retirados; docker ps no mostró contenedores activos al cierre. Se conserva
Docker Desktop por el uso compartido observado durante la tarea.

`node scripts/knowledge-sync.mjs status` terminó exit0,02:04:16.896Z–
02:06:23.173Z, pero **ok=false**. Es una comprobación de lectura completada,
no un cierre verde de conocimiento. `knowledge-status.log`, su recibo y
`knowledge-summary.json` registran por separado:

- Guardado canónico: spec y handoff propios actualizados; integración pendiente.
- Graphify0.9.61 estructural **INVALID**: no existe graph.json en este worktree;
  4997 fuentes pendientes y3672 missing. No se copió el grafo de otra rama.
- Cobertura semántica global **INVALID**,0/1325 verificados; piloto **PENDING**,
  0/16. No se extrajo ni se presentó cobertura inexistente.
- Archify **PENDING / NO DISPONIBLE**, falta runtime2.16.0 en el worktree.
- Preview local **NO EJECUTADA**, faltan prerrequisitos de grafo/Archify;
  regeneración masiva fuera de esta ventana autorizada.
- Bóveda compartida **PENDING**, revisión registrada6da8aebc. Publicación y
  revisión visible en Obsidian **NO EJECUTADAS** desde esta rama.

El turno pesado se devolvió expresamente al Director a02:07:40Z, después de
confirmar cero procesos propios de status. Restan únicamente documentación y
Git; no nuevas suites ni reconstrucciones. El Director coordina recuperación
de derivados y publicación después de integración sobre main comprobado.
No se convierte ningún pendiente de esta nota en una política nueva.

### OBJETIVO ORIGINAL

Entregar la transición compatible anualUSD con subtotal exacto, contador y
estado verdadero hasta Portal/Fidelización/Reportes/CRM, sin modificar v1,
migraciones aplicadas ni datos reales, como PR en borrador revisable.

### COMPLETADO

Implementación local, regresiones rojas/verdes, mutantes, SQL/HTTP reales
efímeros, UI sintética, dos reparaciones de revisión y cierre canónico con
omisiones registradas.0498 conserva blob
`5b302b5cad00529fcc5731aa570fd620794c4689` y SHA256
`dbbae6fc8b61489acc0c1fa4ada2790ae992bcc834181ef7e9e8c0c612f85315`.

### VALIDACIÓN

La tabla anterior delimita17 controles; no sumar focales históricos como casos
únicos. Los rojos y problemas de fixture/captura permanecen documentados.
Integración, aplicación0498, pruebas con Auth/datos productivos y despliegue
**NO EJECUTADOS**. CI remoto **NO DISPONIBLE como evidencia de aprobación**:
las corridas de3b1de986 terminaron startup_failure; no se supone que el pago
o el cambio de tarjeta haya habilitado Actions.

### COMMITS

f9cc1dd:SQL;3b74e42b:contrato temporal/HTTP;a734aa61:DTO/consumidores;
0de51227:renombre privado;3b1de986:P2 CRM/Portal. El commit posterior de
cierre será exclusivamente esta nota y la spec; su SHA final y equivalencia
se conservan en Git/PR y `final-git-receipt.json` externo.

### PR / BRANCH

[PR311 en borrador](https://github.com/SoftAgentes/DTDCARGO/pull/311), rama
`codex/sdd-0572-conversor-usd-sql`, base de revisión #310 en a30d8585.
Publicar el cierre documental no autoriza merge ni release. El claim se libera
al finalizar esa escritura/publicación; el recibo final confirma su resultado.

### PENDIENTES DE ESTA TAREA

Revisión del cierre documental por Director; CI recuperado; actualización de
base/revalidación final según orden humano y dependencia0573; integración
autorizada; paquete0498 desde SHA revisado, previa y OK nominal para release;
ejecución de ledger/cache/Auth/journeys productivos solo con sus permisos.
Recuperación de Graphify/Archify/preview y revisión visible de Obsidian en
ventana coordinada. La SDD general sigue in-progress, no se declara aceptación
íntegra mientras esas capas permanecen pendientes.

### FUERA DE ALCANCE DETECTADO

Se conservan el recorte de recompensa Portal reproducido contra a30 y los dos
warnings de reloj CRM preexistentes. La causalidad del cierre de worker-17 no
se resuelve aquí; tampoco se amplían timeout, política del runner, ni alcance
de staging0540. Retiro de v1, KPI global único por cliente/lead,2.3/G,BCV/Caracas,
impuestos, históricos y cambios de cuenta permanecen fuera del encargo.

### HANDOFF AL DIRECTOR

Validar el SHA documental final y su delta de dos rutas respecto de3b1de986;
conservar PR311 DRAFT y la dependencia #310. El producto/SQL ya revisado no
cambia. Usar los recibos originales para aprobación local y los permisos
separados para integración/release. Owner histórico de esta tarea:
worker-0572b-01a15a4e-ddf0-7d82-8656-d9dc56b58468; comprobar liberación efectiva
en el recibo final/harness, no inferir liveness por el historial de esta nota.
