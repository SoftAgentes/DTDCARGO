# Handoff · Sesión «Contabilidad» · Diagnóstico contable y administrativo del ERP y plan hacia QuickBooks Online

| Campo | Valor |
|---|---|
| Fecha | 2026-10-18, Caracas 02:40 a 12:30 aprox. (UTC 06:40 a 16:30) |
| Task ID / owner | `contabilidad-2026-10-18` / sesión Worker «Contabilidad» (worktree `quizzical-lehmann-d70032`) |
| Claim del harness | `contabilidad-2026-10-18` (se libera al cerrar esta entrega; la sesión sigue abierta para las instrucciones de Sam) |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\quizzical-lehmann-d70032` |
| Rama | `claude/quizzical-lehmann-d70032` |
| Base | `origin/main` `e27c6747` (merge de la #273, cierre de SDD-0551); al momento de escribir, 0 commits detrás |
| SDD | No aplica: esta entrega es diagnóstico y plan (documentación en `docs/audits/`), sin cambio de comportamiento. Cada SDD propuesta se reserva al abrir su tarea con `pnpm sdd:next` |
| Estado de la tarea | lista para revisión (documentos escritos; sin push) |
| Permisos | commits locales de la rama propia. **Sin push ni PR hasta el OK de Sam** (regla «NO hacer push sin su OK»). Sin producción ni base de datos (no se leyó ninguna fila). Sin `pnpm verify` (cambio solo de documentación; cierre por `docs:check`) |

## OBJETIVO ORIGINAL

Sam pidió a esta sesión (2026-10-18): revisar si toda la contabilidad del ERP
«está bien y se están haciendo las cosas bien», con la mirada de un senior
contable y pensando en la persona que llevará la contabilidad, acostumbrada a
QuickBooks; concentrarse en los reportes; analizar qué debe hacer el sistema
automáticamente cuando llega un embarque (factura pendiente, estimado o
cotización); analizar otros sistemas de carga y cómo se conectan con QuickBooks;
proponer qué fortalecer en los reportes de una empresa de carga, qué datos clave
del cliente y qué debe verse en su estado de cuenta; y proponer el perfil del
cliente con pestañas al estilo QuickBooks, con historial de conversaciones y CRM.
Primero analizar lo que hay y armar un plan (UltraCode). El Excel de Yiwu con el
precio por CBM queda para cuando Sam lo vuelva a mandar.

## COMPLETADO

- **Diagnóstico y plan**: `docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`
  (resumen de una página; fortalezas; 24 problemas transversales B1-B24; ciclo del
  embarque hoy y documento por hito; QuickBooks Online: edición, API, patrón de la
  industria y arquitectura recomendada; lo fiscal venezolano; reportes faltantes y
  los ocho cuadres; perfil del cliente con cabecera y 8 pestañas; plan en 7 fases
  con 46 SDD propuestas, 35 con migración; 18 decisiones para Sam y la contadora,
  con quién decide y antes de qué; qué no hacer).
- Plan: síntesis del panel (ganó «integridad primero», 42/60, frente a 41 y 41),
  con injertos de los otros dos y un ajuste propio: adelantar 4.1, 4.2 y 4.5
  (tarifa congelada, envío por cliente, embarques sin facturar) a un carril paralelo
  desde la fase 2; la emisión fiscal automática al llegar (4.3) espera el número de
  control (3.1).
- Correcciones de hecho de los jueces aplicadas al documento: el Diario y el Mayor
  legales en bolívares salen del ERP (Código de Comercio arts. 32-33), QuickBooks es
  el libro gerencial en USD; la retención de ISLR no depende de ser Sujeto Pasivo
  Especial; una CreditMemo no tiene void por API (la NC se compensa con ND); un
  anticipo cobrado hace nacer el IVA (LIVA 13.3.e y 55.2); `invoices.control_number`
  no existe; `journal_entries` solo tiene `invoice_id` (unicidad por origen del lado
  de los documentos); `requestid` de 36 caracteres en lotes; `shipment_events` y
  `shipment_documents` ya existen; el CI ya corre 31 pruebas PGlite de migraciones;
  la cabecera «NO APLICADA» está en 32 migraciones y no prueba estado; los FCL 61-63
  de SDD-0543 van sin factura.
- **Anexo B** (investigación externa con fuentes): `docs/audits/2026-10-18-contabilidad-anexo-investigacion.md`.
- **Anexo C** (tres planes, nueve juicios y síntesis): `docs/audits/2026-10-18-contabilidad-anexo-planes.md`.
- **Anexo A** (14 informes de área con `archivo:línea` y veredictos):
  `docs/audits/2026-10-18-contabilidad-anexo-hallazgos.md`, generado de la última
  corrida de la verificación.
- Método ejecutado: 3 workflows UltraCode. (1) `contabilidad-entender`: 14 lectores
  por área + revisores escépticos con lente código y lente contable por hallazgo
  alto/medio + crítico de completitud. (2) `contabilidad-investigar`: 6
  investigadores con WebSearch/WebFetch + un verificador por afirmación clave.
  (3) `contabilidad-plan-panel`: 3 arquitectos (contadora primero, integridad
  primero, operación primero) + 3 jueces por plan + síntesis. Los workflows se
  cortaron varias veces por límite de sesión y se relanzaron desde caché.
- Lectura de reglas: AGENTS.md, skill Worker, runbook codex-engineering,
  project-rules, AGENT-BRIEF. Guard y claim del harness tomados antes de escribir.

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| `node scripts/harness-worktree.mjs guard` | worktree propio, rama `claude/quizzical-lehmann-d70032` | PASÓ |
| `node scripts/harness-worktree.mjs claim --owner contabilidad-2026-10-18` | sesión escritora | PASÓ (claim adquirido) |
| `corepack pnpm docs:check` | índice de specs tras agregar los documentos en `docs/audits/` | PASÓ («índice sincronizado con 538 specs»), corrido sobre el árbol con el diagnóstico y el anexo B |
| `git merge origin/main` | `a6b06205` en la rama (merge `e224a466`, sin rebase) | PASÓ, sin conflictos; el índice regenerado no cambió |
| `corepack pnpm docs:check` tras el merge | 539 specs | PASÓ |
| `corepack pnpm sdd:check` tras el merge | numeración de specs y migraciones | PASÓ («sin números repetidos»; avisa los choques históricos 0342, 0363 y 0394 ya aplicados, que no se renumeran) |
| `pnpm verify` | — | NO EJECUTADO: cambio solo de documentación; el cierre canónico de docs es `docs:check` y `sdd:check` (regla «el cierre se elige por el diff», confirmada por el Director) |
| Lectura de producción por esta sesión | — | NO EJECUTADO por diseño: esta sesión no leyó producción |
| Radiografía 1.1 en producción | 1 tenant, solo lectura, conteos y sumas sin nombres ni RIF | **Medido por el Director el 2026-10-18 (~23:00Z)**, con la autorización de Sam: «autorizo la radiografía 1.1 con conteos y sumas, sin datos personales». Resultado: 6 facturas, todas en USD; 0 asientos vivos; 0 anuladas con asiento vivo; **5 de 5 facturas emitidas, parciales o pagadas sin asiento**; el único recibo apunta a un asiento anulado; 0 reportes de pago; 0 CxP; 1.1.2 = 0 en el mayor contra un saldo abierto mayor que cero en facturas; 2.1.1 cuadra en 0. En Git solo van conteos y comparaciones, no montos |
| Verificación escéptica de hallazgos | 14 áreas | Ver el anexo A: cada hallazgo trae su estado (confirmado, refutado o sin verificar) y el veredicto de cada lente. La corrida sufrió cortes por límite de uso y se relanzó desde caché cuatro veces; el anexo se genera de la última |
| Panel de planes | 3 planes, 9 jueces, síntesis | PASÓ completo (13/13 agentes); errores de hecho de los jueces aplicados al documento |
| Investigación externa | 6 temas, 36 afirmaciones clave | 38/42 agentes; 4 verificadores sin correr por límite (sus afirmaciones quedan como «NO SOSTENIDA / sin resultado del verificador» en el anexo B) |

## COMMITS

- `9a9c2147` — diagnóstico, anexos A, B y C, y este handoff.
- Commit que contiene esta versión del documento — respuestas del Director
  (migraciones medidas contra el ledger, publicación por el VPS, reserva 0483).

## PR / BRANCH

- Rama `claude/quizzical-lehmann-d70032`, base `main`. **Sin push y sin PR**: se
  espera el OK de Sam para publicar la rama y abrir PR en borrador (solo
  documentación).

## PENDIENTES DE ESTA TAREA

- Respuestas de Sam y la contadora a las 18 decisiones de la sección 9 del
  documento. La fase 1 no depende de ninguna; las cuatro primeras (moneda
  funcional y diferencia en cambio, reparación histórica, dueño del cobro,
  anticipos) bloquean la fase 2.
- **La `0422` y la `0423` siguen pendientes en producción** (únicas esperas del
  baseline, desde el 2026-09-13). Mientras falte la 0422, la RPC heredada
  `confirm_payment_report` confirma pagos sin tope, sin moneda y sin auditoría
  (B24). Hoy no hay reportes de pago, así que el daño es latente, pero conviene
  aplicarlas antes de que el portal se use para reportar pagos y antes de la 2.7;
  cada una con previa, smoke del bloque 3 del guion L14 y OK nominal de Sam.
- Las lecturas extra del crítico de completitud (anexo A, áreas extra) agregaron
  B24 y profundizaron B19-B21: el crédito de referido puede aplicarse dos veces
  (nueva SDD 2.11, riesgo alto), la indemnización sale siempre de caja (nueva 4.9),
  las siete tablas del Socio China están abiertas por la API a cualquier empleado
  (5.4) y la compra asistida usa por defecto la cuenta 5.1 de flete (4.8). Plan:
  46 SDD, 35 con migración; 18 decisiones.
- Radiografía 1.1: hecha el 2026-10-18 (ver VALIDACIÓN). Su lectura cambia
  prioridades: B1, B2 y B4 no tienen casos hoy (riesgos latentes); **B3 es el
  problema vivo** (5 de 5 facturas emitidas sin asiento) y conviene repararlo con
  2.2 antes de cargar los consolidados en la base oficial. La próxima corrida debe
  cruzar `paid_amount` contra recibos: 3 facturas tienen cobro registrado y solo
  hay 1 recibo (inferencia, sin medir).
- Excel de Yiwu con «precio venta CBM»: entra en la fase 1 carril B (tarifa por
  CBM trazable por embarque) cuando Sam lo mande.
- Publicación de la rama y PR en borrador: pendiente del OK de Sam.

## FUERA DE ALCANCE DETECTADO

- `docs/architecture/contabilidad-qbo-online.md` (jun-2026) está desactualizado:
  afirma que no hay conciliación bancaria ni asiento de gasto, y existen desde
  SDD-0105 y SDD-0079. Conviene nota «Estado al 2026-10» o convertirlo en punto de
  partida de la spec del conector.
- Estados de spec desalineados con lo construido: 0245 y 0195 `proposed` con el
  código en producción; 0244 `in-progress` desde agosto; 0149 `in-progress` con
  texto que cita un unique distinto al de la migración 0219; 0062 `proposed`
  desde junio; 0315 marcada `done` en el índice mientras `lib/studio/export/csv.ts`
  declara que no neutraliza fórmulas y la prueba de contrato no está en el árbol.
  Una pasada de estados del Director, sin tocar código.
- SDD-0535 desplegada el 2026-10-15 con la prueba real pendiente (casos A y B);
  el accept de la bandeja de Kommo sale fuera de la cola.
- Recuperación de Kommo lee contactos con tope 5.000 que PostgREST recorta a 1.000
  sin aviso (`lib/studio/kommo-recovery.ts`); la regla ESLint solo caza literales.
- Nada en el repo impide editar una migración ya aplicada: el md5 solo está fijado
  en pruebas para 0421, 0473, 0474, 0475 y 0491; la puerta del servidor compara
  solo nombres. Propuesta del lector: un manifiesto con md5 y bytes de cada
  migración aplicada posterior a la 0238 y una prueba que lo compare (anexo A,
  MIG-05). Es ingeniería, no contabilidad.
- Portal: fechas de solo día formateadas con `new Date(iso).toLocaleDateString`
  dependen de la zona horaria del servidor (inferido).

## HANDOFF AL DIRECTOR

- **Siguiente acción:** leer `docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`
  (secciones 0, 8 y 9). La fase 1 (cinco SDD paralelizables sin decisiones
  externas: radiografía, portal, saldo único y cabecera del perfil, reportes sin
  migración, borrador conserva el embarque) puede abrirse ya si Sam lo autoriza;
  la radiografía contra producción necesita su autorización escrita y la ejecuta
  el Director. En paralelo, agendar con Sam y la contadora las decisiones 1-4 que
  bloquean la fase 2 (carril A mayor, carril B documentos y cobro, serializando
  `invoice-posting.ts`, RPC `0467`/`0468`, `verify` y migraciones).
- **Revisión:** los hallazgos B1, B2 y B3 están confirmados por dos lentes; el
  resto del anexo A trae el estado de cada veredicto. Revisar en especial los
  marcados INFERIDO.
- **Cambios compartidos:** ninguno en código. Solo documentación nueva en
  `docs/audits/` y este handoff.
- **Integración / publicación pendiente:** push de la rama y PR en borrador tras
  el OK de Sam; merge por el Director. Vercel está en pausa y sin Git desde el
  2026-10-16: publica el vigilante del VPS, que construye y publica cada merge a
  `main` en ~5 min aunque sea solo docs (inofensivo, confirmado por el Director el
  2026-10-18). Antes de la PR: `git fetch origin main` y `git merge origin/main`
  sin rebase, regenerar el índice y cerrar con `docs:check` y `sdd:check`.
- **Respuestas del Director (2026-10-18), registradas en el documento:**
  migraciones `0464`, `0466`, `0467`, `0468`, `0471`, `0477`, `0483`–`0489`,
  `0490` y `0491` confirmadas aplicadas contra el ledger (lectura de solo lectura
  del Director, ~22:40Z, 495 filas); siguiente migración libre `0492` (confirmar
  con el Director antes de usarla); la radiografía 1.1 la ejecutó el Director el
  2026-10-18 con autorización escrita de Sam (resultado en VALIDACIÓN); la reserva
  SDD-0483 es una tarea planeada y se conserva.
- **Sesiones consumidoras:** esta sesión «Contabilidad» sigue abierta para las
  instrucciones de Sam (incluido el Excel de Yiwu). Ownership del worktree: claim
  `contabilidad-2026-10-18` vigente mientras siga escribiendo.
- **Conocimiento:** `pnpm knowledge:status` NO EJECUTADO en esta entrega (sin
  cambios de código ni fuentes del grafo); el Director decide si los documentos de
  `docs/audits/` entran al piloto semántico.
