---
title: Borrado logico Portal - evidencia local
tipo: auditoria-tecnica
autor: Codex
created: 2026-09-03
updated: 2026-09-03
review-by: 2026-09-10
confidencialidad: interno
---

# SDD0377 / 0427 · direcciones Portal

Estado: implementación local verificada; cierre global de pruebas en SDD0378.
No aplicada a Cloud. No push, main, despliegue ni datos reales.

## Causa y decisión

SELECT del Portal exige deleted_at IS NULL. PostgreSQL comprueba también la
visibilidad del nuevo registro durante UPDATE: marcarlo devuelve42501. El
Server Action heredado silenciaba el error, sin estado de retorno; no era
un fallo del botón ni se arreglaba exponiendo históricos.

El comando público INVOKER sólo llama a un comando privado DEFINER con
owner/search_path sellados. Este último resuelve auth.uid, vínculo activo,
cliente vivo y dirección propia coherente. No acepta tenant ni principal del
formulario. SHARE protege revocación/rename; UPDATE revalida una transferencia
tras esperar. Un lock agotado o serialización aborta con rollback recuperable.

Se agrega el tipo client_delivery_address al catálogo existente. Borrado y
append_audit_event son una transacción. Antes/después sólo contienen deleted_at
e is_default. El GUC de motivo externo se neutraliza y restaura. Error/NULL
del log revierten el borrado. No cambia default ni hay restauración automática.

La Server Action usa sesión, no admin, exige true explícito y sólo entonces
revalida. No convierte un error posterior de caché en fracaso de una mutación
ya confirmada. UI conserva dos pasos; impide doble envío/cancelación durante
el envío, mantiene error accesible y permite retry; éxito sólo tras confirmación.

## Evidencia reproducible

- SQL RED: apply_fix=false, PostgreSQL17 real, UPDATE42501, exit3 y rollback
  íntegro comprobado por otra conexión. No mock de RLS.
- SQL GREEN: 63 aserciones persistidas y controles de savepoint/rollback;
  migraciones de catálogo0258/0261 y writer0267/0294 reales.
- Identidades inválidas, tenants distintos con mismo Shipping Mark, cliente
  ajeno, históricos, nulidad, ACL efectiva pública/privada, grants exactos,
  idempotencia, rename, auditoría fallida/NULL, GUC y reejecución fail-closed.
- ACL por defecto inesperada: RED causal concedía EXECUTE a un rol sintético;
  postflight ahora aborta ante cualquier grantee/grant option fuera del contrato.
  Contrato SQL y runner conservados en el commit local6ae46e81, sin push.
- Concurrencia: 8 escenarios con conexiones reales y barrera pg_stat_activity:
  dos borrados/commit, rollback, revocación previa/posterior, tenant independiente,
  transferencia de dirección, baja cliente, timeout55P03 y snapshot viejo40001.
  El número8 agrupa la independencia con la revocación posterior.
- Todos los contenedores tenían ID/nombre/label propios verificados, sin red
  y datos en tmpfs; se retiraron sólo esos contenedores y se comprobó ausencia.
- Server Action RED: 15/15 fallaban causalmente; después15/15 GREEN.
- UI independiente: 1/6 pasaba,5/6 fallaban; después6/6 GREEN.
  Sumando los6 existentes:27/27 focales. React/hooks reales; sólo acciones fake.
- Control adicional de Cancelar: foco quedaba en BODY (RED test:158).
  Corregido con referencia del botón; GREEN focal1/1 (los5 restantes excluidos
  por filtro, no omitidos por falta de entorno).
- Browser sintético: Chromium, componente real y globals.css recompilado,
  390×900/1280×900,10estados sin overflow,0errores/warnings y0tráfico externo.
  Confirmación/teclado, pending, error/foco, retry, éxito y rechazo correctos.
  Capturas e informe actual: outputs/playwright/portal-address-browser-2026-09-03T22-05-50-322Z/.
  Corrida posterior al ajuste: Cancelar devuelve foco al disparador, incluso
  en la otra fila durante pending/error; probado con teclado y ratón.
  No valida shell completo, next/font, Next/Server Actions reales ni Postgres
  conectado al navegador. No es smoke autenticado ni Safari real.
- Gate conjunto:15/17 pasos ejecutados, exit1 por test. Lint, RSC1592,
  tipos,4Edge, docs, numeración, componentes,28políticas,169contratos SQL,
  ambas carreras PostgreSQL, rebuild424 (406schema+18ledger) y build158
  aprobados. migrations-applied SKIP por credenciales; E2E separado para
  diagnosticar su lifecycle con JSON conservado.
- Unitarios del gate: primer intento6956/6957, RED de foco de Cancelar
  agregado mientras corría la suite (corregido, no flaky). Segundo6954/6957:
  todos los casos Portal pasan; tres timeouts10s de subprocesso del CLI de
  worktrees. SDD0378 conserva el rojo e investiga aislamiento/planificación.

Comandos: node scripts/check-portal-address-concurrency.mjs;
node scripts/check-portal-address-browser.mjs;
node node_modules/vitest/vitest.mjs run app/portal/(app)/perfil/...
y node scripts/verify.mjs (E2E diagnosticado aparte conservando su JSON).

## Gobernanza y revisión de interfaz

| Norma | Evidencia del slice |
|---|---|
| SGE00.01/11 | cumplimiento: verbo y consecuencia explícitos; histórico conservado, no promesa de supresión física |
| SGE00.02/06/07 | cumplimiento: estado pendiente y error recuperable, sin retiro optimista ni éxito falso |
| SGE00.03, MP01 | cumplimiento P2/R2; confirmación inline heredada SDD0268, excepción de patrón explícita |
| SGE00.04, AUD01/AUD02 | cumplimiento local: evento mínimo durable, actor/tenant/entidad/tiempo/resultado/correlación |
| SGE00.05 | cumplimiento local: SQL negativo y concurrencia, no sólo ocultar UI |
| SGE00.08 | cumplimiento: conserva dos pasos, sin campos ni contexto nuevos |
| SGE00.09 | excepción heredada: PortalFieldError reutilizado, confirmación local sin importar Studio ni nueva primitiva global |
| SGE00.10 | teclado/foco/nombre/alert verificados; no certificación WCAG completa, zoom200% y lector real no medidos |
| SGE00.12 | cumplimiento: sólo GO local; gates alojados conservados |

UI-CHECK read-only: sin nueva paleta, fuente, ancho fijo ni rediseño. Tokens y
PortalFieldError existentes; espera/disabled/error/éxito visibles. Captura móvil
revisada: texto legible y sin corte. La prueba usa fallback de fuentes y no
certifica contraste del shell completo ni todas las condiciones de accesibilidad.

## Privacidad · revisión técnica acotada de 12 puntos

No es revisión jurídica ni certificación integral. Sólo este delta.

| Puntos de checklist | Resultado |
|---|---|
| 1 Inventario / 2 Minimización | CORRECTO en delta: identificadores existentes y metadatos mínimos; sin nuevo formulario postal. 0427:87–112 |
| 3 Consentimiento / 11 Aceptación electrónica | NO VERIFICABLE aquí: no cambia el alta ni un flujo de aceptación; el botón no se presenta como firma |
| 4 Caminos reales / 5 Borrado | ENCONTRADO: P2 conserva histórico; no hay restauración ni supresión física en este flujo. UI lo advierte. PortalAddresses:264 |
| 6 Trazabilidad | CORRECTO local: auditoría atómica + correlación servidor. address-actions:115;0427:101 |
| 7 Política pública | NO VERIFICABLE aquí: no se modifica ni se infiere suficiencia de la política |
| 8 Terceros / 9 Transferencias | Sin tercero/destino nuevo en delta; NO VERIFICABLE la operación alojada |
| 10 Decisiones automatizadas | Sin decisión comercial automatizada nueva; borrado explícito del titular validado por sesión |
| 12 Titulares no usuarios | NO VERIFICABLE globalmente; el evento no duplica texto postal ni referencias de terceros |

No se inventó retención ni plazo de purga. Los logs de este borrado no incluyen
error crudo del proveedor, dirección, email ni tokens (address-actions:127/132/139).
Los logs de alta/edición/default preexistentes quedan fuera de este slice.

## Pendientes y orden de release

- Suite conjunta posterior:7149/7149 en553archivos,421,24s, sin reintento.
 Gate0378:16/17 medidos (Cloud SKIP), E2E150/18 sin errores globales y build158.
 El E2E no incluye autenticación Portal real; el navegador de direcciones
 sigue siendo un arnés sintético del componente. Evidencia en acta0378.
- Aplicación nominal de0427, posterior a sus dependencias0425 y auditoría;
  metadatos pre/postflight y permisos efectivos antes de publicar consumidor.
- Hay28 migraciones preparadas no aplicadas:0401–0428; el conteo se deriva
  del último ledger verificado0400, no de una nueva lectura Cloud en este slice.
- No cerrar la casilla amplia Portal/RBAC ni inflar56/106 por este correctivo.
- Reanudar objetivo original sigue siendo control externo de la app.
