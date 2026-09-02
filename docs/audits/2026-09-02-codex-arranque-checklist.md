---
title: "Arranque Codex: estado saneado y checklist ejecutable"
tipo: auditoria-operativa
autor: Codex
created: 2026-09-02
updated: 2026-09-02
review-by: 2026-09-09
confidencialidad: interno
---

# Arranque Codex · estado saneado y checklist ejecutable

Este documento es el punto de entrada operativo después del traspaso desde
Cloud. No reemplaza specs ni runbooks: ordena qué sigue, quién puede hacerlo y
qué autorización exige. Los números son una medición del 2026-09-02 y deben
refrescarse antes de cualquier operación Git o alojada.

## Snapshot comprobado

- Remoto: `https://github.com/hailuwaycom-sketch/DTDCARGO.git`.
- `origin/main`: `2a2e81bf554dbe7bd4f05170847e8f02e988d320`.
- Rama de saneamiento publicada: `codex/saneamiento-integral` en
  `a9895487d010f39edcc1c7b20915547f6a93d773`, 0 detrás / 53 delante de
  `origin/main`; local y remoto coincidían 0/0 al publicar el lote funcional.
- [PR #21 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/21):
  no integrable todavía. Primera corrida de `Calidad continua` falló por heap
  agotado en TypeScript; corrección de SDD-0349 pendiente de revalidación alojada.
- Vercel: deployment `6227630435` de GitHub en **Preview**, estado `success`,
  `production_environment=false`; no se promovió a producción.
- Supabase: proyecto correcto `xpfuzqombmjmxvprjgmi`, `ACTIVE_HEALTHY`; 406
  entradas de ledger. Comparación con 413 archivos y corte 238: 18 pendientes
  (0399–0416), cero huérfanas posteriores al corte y las 10 RPC nuevas ausentes.
- Checkout principal: limpio en `22cec0c2`, 20 detrás / 0 delante.
- Worktrees: 2; principal + `codex-saneamiento-integral`.
- Tareas Codex de DTDCargo: sólo la tarea activa de este saneamiento.
- Specs reales: 351; 257 `done`, 1 `superseded` y 93 sin cierre documental
  (78 `in-progress`, 8 `proposed`, 4 `approved`, 3 `draft`).

El paquete y sus commits están enumerados en
`.agents/handoffs/2026-09-02-saneamiento-integral-close.md`. La evidencia alojada
y los límites de la medición están en
[el acta de publicación](2026-09-02-codex-publicacion-y-preflight.md).
Se publicó la rama y se abrió el PR; Vercel produjo automáticamente un preview.
No se hizo merge a `main`, promoción, migración ni escritura en Cloud.

## Lo ya saneado localmente

- [x] Rescate selectivo del trabajo válido y separación de cambios ajenos.
- [x] Revocación local de `TRUNCATE` público y del RPC público de verificación;
  migraciones 0399 y 0400 preparadas, contratadas y todavía no aplicadas.
- [x] Neutralización CSV, minimización de logs inbound, cookies de operario
  autenticadas y secretos CBM/Telegram fuera de query en código propio.
- [x] N+1 principales, reloj de render, accesibilidad, tabs, aislamiento E2E y
  compatibilidad de tooling saneados.
- [x] Nominatim y consultas externas inseguras de identidad retiradas.
- [x] Node 24/pnpm 11 fijados; advisories de Vite/dependencias atendidos.
- [x] Llave KMS del backup WORM retenida junto con el bucket en el IaC histórico.
- [x] `/studio/debug` exige configuración completa; Payload CMS legado retirado
  del contrato activo de entorno.
- [x] Escritura directa de facturas cerrada en la base: sólo `accounting` y
  `admin` activos del tenant conservan INSERT/UPDATE; `authenticated` ya no
  tiene DELETE físico. SDD-0350/migración 0407 están preparados localmente.
- [x] Administración de Mailing alineada con su RBAC: plantillas, firmas,
  reglas, configuración, blacklist y programados exigen admin activo también
  en RLS; las RPC internas quedaron reservadas a `service_role`. SDD-0351/0408
  están preparados localmente; `mail_logs` conserva lectura por compatibilidad.
- [x] Conciliación bancaria alineada con Contabilidad: extractos y movimientos
  exigen `accounting|admin` también en RLS y ya no exponen privilegios fuera del
  CRUD esperado. SDD-0352/migración 0409 están preparados localmente.
- [x] Lectura cruda de `mail_logs` retirada de Cobranzas: una RPC por facturas
  entrega sólo Shipping Mark, flags y fecha; emails/metadata no salen de la
  base. SDD-0358 separa el release: 0410 agrega la RPC compatible y 0415
  restringe el SELECT a admin después de desplegar y probar el consumidor.
- [x] Facturación anual de Fidelización/CRM minimizada: SDD-0354/migración 0411
  agrega en Postgres y entrega sólo Shipping Mark + USD trailing-12m a roles
  con acceso efectivo (incluidos overrides); la aplicación ya no recibe moneda,
  tasa, estado ni fechas de cada factura.
- [x] Saldo de Conversaciones minimizado por hilo: SDD-0355/migración 0412
  deriva cliente/tenant, respeta overrides y devuelve sólo saldo/moneda; excluye
  facturas anuladas y no convierte errores de lectura en un saldo cero.
- [x] Referencias de facturas en Órdenes de venta minimizadas: SDD-0356/0413
  entrega sólo id, código, monto y estado a la UI, respeta permisos efectivos,
  consulta por lotes y propaga errores en vez de inventar listas vacías.
- [x] SELECT interno de facturas alineado con `accounting|admin` en SDD-0357/0414.
  Portal exige vínculo activo, cliente vivo y tenant coincidente; el test
  reproduce y cierra el acceso cruzado con Shipping Mark igual en dos tenants.
  Las tres RPCs minimizadas siguen funcionando bajo la RLS restrictiva.
- [x] Gate canónico posterior a SDD-0357 sin fallos: 14/15 pasos medidos;
  `migrations-applied` quedó `SKIP` por falta deliberada de credenciales.
  Unitarios: 527 archivos / 5.957 pruebas. SQL: 155 contratos. Rebuild: 411
  migraciones (393 desde cero + 18 sólo-ledger), 219 tablas y 2 tenants de prueba.
  E2E: 150 pasaron y 18 Tier 3 omitidos, sin fallos ni bloqueo de teardown.
  Build: 158 páginas. Este resultado local no demuestra estado alojado.
- [x] Transición de Mailing separada en expansión y restricción (SDD-0358), sin
  fallback de la aplicación al SELECT crudo. Ambas fases reutilizan el mismo
  contrato SQL y conservan idéntica respuesta mínima de Cobranzas.
  Validación posterior: 3 unitarios focales, 156 contratos SQL y rebuild de
  412 migraciones (394 desde cero + 18 sólo-ledger); 219 tablas / 2 tenants.
- [x] Dominio Envíos Portal ligado a principal y tenant (SDD-0359/0416): envíos,
  documentos e hitos rechazan coincidencias de Shipping Mark entre tenants.
  Hijos exigen padre vivo y relación coherente; las policies de equipo y ACL
  se conservan. 157 contratos SQL, 37 unitarios focales y rebuild de 413
  migraciones (395 desde cero + 18 sólo-ledger) aprobados localmente.

## P0 · terminar el saneamiento Git y publicar

- [x] Publicar únicamente `codex/saneamiento-integral` después de verificar
  remoto privado, permiso ADMIN, alcance de archivos y ausencia de patrones de
  credenciales en las líneas añadidas. La revisión de autorización permitió el
  push exacto; el bloqueo anterior quedó resuelto.
- [x] Verificar hash remoto, upstream correcto, 0/0 y diff de los 53 commits.
- [x] Abrir el PR #21 en borrador, sin merge ni promoción de producción.
- [x] Corregir el OOM del primer CI mediante límite explícito de heap sólo en
  TypeScript/build: regresión 6/6, TypeScript sin caché (~2,8 GiB) y build de 158
  páginas aprobados localmente. No se quitó ningún gate.
- [ ] Confirmar en GitHub el primer resultado real del workflow
  `Calidad continua`; el contrato local no sustituye una corrida alojada.
- [ ] Autorizar por separado la integración a `main`; no confundir push de rama
  con merge o deploy.
- [ ] Antes de integrar, resolver compatibilidad de aplicación y migraciones:
  el merge puede disparar Vercel. No publicar una app que llama RPCs ausentes.
- [ ] Verificar el efecto real de `ignoreCommand` antes del release: los
  commits exclusivamente documentales no justifican forzar un build. Al
  integrar código, confirmar que el commit final no oculte cambios funcionales
  anteriores y que Vercel publique el SHA esperado.
- [ ] Después de integrar, comprobar que el HEAD del worktree es ancestro de
  `origin/main`; sólo entonces retirar el worktree.
- [ ] Actualizar el checkout principal limpio desde el remoto sin reset ni
  sobreescritura.
- [ ] Borrar `codex/archive-primary-pnpm-20260902` sólo después de demostrar que
  su intención está contenida en `origin/main`.
- [ ] Mantener `codex/archive-cloud-handoff-20260828`: conserva un handoff único
  no integrado. Su contenido es histórico y debe preservarse o declararse
  supersedido antes de borrar la rama.

## P0 · gates alojados independientes

- [ ] Aplicar `0399_revoke_truncate_anon_authenticated.sql` con autorización
  específica, de una en una y siguiendo
  `docs/runbooks/aplicar-migraciones-prod.md`.
- [ ] Aplicar `0400_revoke_public_verify_rpc_execute.sql` con otra autorización
  específica y el mismo runbook.
- [ ] Aplicar `0401_portal_brand_por_principal.sql` con autorización específica
  separada; la RPC no existe en Cloud hasta completar ese gate.
- [ ] Aplicar `0402_portal_hidden_statuses_por_principal.sql` con autorización
  específica separada; la RPC no existe en Cloud hasta completar ese gate.
- [ ] Aplicar `0403_portal_advisor_por_principal.sql` con autorización específica
  separada; la RPC no existe en Cloud hasta completar ese gate.
- [ ] Aplicar `0404_portal_referidos_por_principal.sql` con autorización específica
  separada; la RPC no existe en Cloud hasta completar ese gate.
- [ ] Aplicar `0405_portal_perfil_privado_por_principal.sql` con autorización
  específica separada; la RPC no existe en Cloud hasta completar ese gate.
- [ ] Aplicar `0406_portal_packing_lists_por_principal.sql` con autorización
  específica separada; la RPC no existe en Cloud hasta completar ese gate.
- [ ] Aplicar `0407_invoices_write_rbac.sql` con autorización específica
  separada; el RBAC de escritura no existe en Cloud hasta completar ese gate.
- [ ] Aplicar `0408_mailing_admin_rbac.sql` con autorización específica
  separada; el RBAC admin-only no existe en Cloud hasta completar ese gate.
- [ ] Aplicar `0409_bank_reconciliation_rbac.sql` con autorización específica
  separada; el RBAC financiero no existe en Cloud hasta completar ese gate.
- [ ] Aplicar `0410_collections_mail_context.sql` con autorización específica
  separada; sólo agrega el facade y conserva temporalmente el SELECT histórico.
- [ ] Aplicar `0411_client_annual_billing_facade.sql` con autorización específica
  separada; el agregado minimizado no existe en Cloud todavía.
- [ ] Aplicar `0412_conversation_outstanding_facade.sql` con autorización
  específica separada; el contexto mínimo no existe en Cloud todavía.
- [ ] Aplicar `0413_sales_order_invoice_facade.sql` con autorización específica
  separada; las referencias mínimas no existen en Cloud todavía.
- [ ] Aplicar `0414_invoices_read_rbac.sql` con autorización específica separada
  sólo DESPUÉS de confirmar 0411–0413 aplicadas y la app con facades desplegada.
  El preflight SQL no puede certificar la versión real del frontend.
- [ ] Aplicar `0415_mail_logs_read_rbac.sql` con autorización específica separada
  sólo DESPUÉS de confirmar 0410 aplicada y el consumidor nuevo de Cobranzas
  desplegado y probado. Esta segunda fase completa el cierre admin-only de
  `mail_logs`; el catálogo SQL no certifica la versión de la aplicación.
- [ ] Aplicar `0416_portal_shipments_tenant_boundary.sql` con autorización
  específica separada y smoke de envíos/documentos/hitos. No exige una RPC
  nueva ni deploy previo; la frontera sólo está corregida localmente.
- [ ] Reconfigurar el webhook Telegram alojado para usar el header secreto,
  desactivar la compatibilidad query y verificar `getWebhookInfo`.
- [x] Confirmar que el deployment automático de la rama fue Preview, no
  producción. Su estado `success` no sustituye un smoke funcional.
- [ ] Confirmar deployment de producción y smoke de público, Studio, Portal y
  móvil después de los gates de migración/integración.
- [x] Medir ledger y las 10 RPC nuevas mediante metadatos, sin leer PII ni filas
  de negocio; todas siguen ausentes. Preflight 0399: TRUNCATE en 179 tablas para
  `anon` y 204 para `authenticated`, sobre 249 tablas de `public`.
- [ ] Completar preflights de grants/policies por migración, buckets y versión
  real de las cuatro Edge Functions, sin leer datos de negocio.
- [ ] Clasificar los avisos alojados por dominio: 20 INFO y 184 WARN; no son
  204 vulnerabilidades confirmadas. No abrir policies ni revocar RPCs
  legítimas sólo para reducir el contador del asesor.

## P1 · seguridad por slices

- [ ] Continuar RBAC de aplicación en la base por slices: lectura minimizada de
  facturas/dinero y autorización documental por entidad. Cada slice
  necesita SDD, contrato SQL, migración propia y gate Cloud separado; no hacer
  un sweep. SDD-0350 ya cerró la escritura directa de `invoices`, preservando
  temporalmente el SELECT tenant-wide que consumen módulos no financieros.
  SDD-0351 cerró las seis tablas administrativas de Mailing; SDD-0353 sustituyó
  la lectura de Cobranzas y SDD-0358 separó su expansión 0410 del cierre
  admin-only 0415 posterior al deploy. SDD-0352 cerró el CRUD
  directo de conciliación bancaria. SDD-0354 retiró las filas financieras del
  agregado anual usado por Fidelización, CRM y Reportes; SDD-0355 minimizó el
  saldo de Conversaciones y SDD-0356 retiró la lectura directa de Órdenes de
  venta. SDD-0357 cerró el SELECT interno y ligó Portal al tenant después de
  comprobar los consumidores financieros, Portal y procesos controlados de
  servicio. El inventario AST congela 18 archivos / 45 llamadas directas.
- [ ] Auditar por dominio las otras policies Portal que comparan Shipping Mark
  sin tenant. SDD-0357 cubre `invoices` y SDD-0359 cubre `shipments`,
  `shipment_documents` y `shipment_events`. Faltan prealertas y sus documentos,
  academia, reclamos, reportes de pago y las demás entidades; no hacer un sweep
  ni declarar corregido todo el Portal por estos dos slices.
- [x] Retirar `service_role` de todos los RSC del Portal.
  SDD-0336 cerró el primer slice de marca: el baseline bajó de 11 rutas / 23
  construcciones a 10 rutas / 21 construcciones. SDD-0337 movió la visibilidad
  de hitos a una RPC por principal y lo bajó a 10 rutas / 19 construcciones.
  SDD-0338 movió el asesor asignado a otra RPC por principal y dejó el baseline
  en 10 rutas / 18 construcciones. SDD-0339 eliminó la elevación de Referidos y
  dejó el baseline en 9 rutas / 17 construcciones. SDD-0340 encapsuló las URLs
  firmadas de adjuntos detrás de una lectura RLS y dejó el baseline en 8 rutas /
  16 construcciones. Priorizar el facade de aceptación de facturas y las demás
  lecturas internas mediante RPCs autocontenidas ligadas a `auth.uid()`. SDD-0341
  consolidó códigos históricos y fotos privadas de Perfil y dejó el baseline en
  7 rutas / 14 construcciones. SDD-0342 movió los packing lists a una RPC por
  principal y encapsuló la firma de documentos después de una lectura RLS; dejó
  el baseline en 6 rutas / 12 construcciones. SDD-0343 retiró del RSC de detalle
  de compra sus dos elevaciones y las encapsuló detrás de una revalidación
  sesión/RLS; dejó el baseline en 5 rutas / 10 construcciones. SDD-0344 movió
  evidencia y conversación de Soporte a un contexto sin parámetros que revalida
  la sesión; dejó el baseline en 4 rutas / 9 construcciones. SDD-0345 encapsuló
  firma, avisos, naviera y aceptación del detalle de envío detrás de su lectura
  RLS; dejó el baseline en 3 rutas / 7 construcciones. SDD-0346 movió packing
  online, consolidaciones y próximo zarpe del listado de envíos a un contexto
  que deriva todos sus ids desde sesión/RLS; dejó el baseline en 2 rutas / 4
  construcciones. SDD-0347 encapsuló facturas pendientes, naviera y zarpe del
  home detrás de identidad e ids de sesión; dejó el baseline en 1 ruta / 1
  construcción. SDD-0348 encapsuló la lectura legal de aceptación, sin cambiar
  su acción, hash o evidencia; el baseline final quedó en 0 rutas / 0
  construcciones. El test
  `portal-service-role-boundary.test.mjs` congela el inventario; no lo aprueba.
- [ ] Definir con operación la retención de colas y borradores browser que
  contienen fotos, firma, documento, GPS, Shipping Mark o tokens. TTL/purga de
  logout sin esa decisión puede perder entregas pendientes.
- [ ] Rediseñar la autenticación del webhook Kommo. La documentación oficial de
  [webhooks de eventos](https://developers.kommo.com/docs/webhooks-general)
  sólo permite configurar URL + eventos y no documenta firma/cabecera; por eso
  no se puede reemplazar localmente `?secret=` por un header sin romper el
  proveedor. Evaluar gateway que inyecte credencial, rotación y redacción de
  access logs.
- [ ] Diseñar CSP con nonce para la app y aislar la excepción del visor Marca.
  No retirar `'unsafe-inline'`/`'unsafe-eval'` sin browser/build: Next y los
  documentos navegables pueden romperse.

## P1 · reproducibilidad y operación

- [x] Preparar CI independiente para lint, frontera RSC, TypeScript, Edge
  Functions, unitarios, docs, numeración, constantes, componentes, gobernanza
  y build sin secretos. SDD-0349 fija actions por SHA, usa permisos de lectura y
  lockfile congelado. El PR #21 activó la primera corrida alojada, que falló por
  heap agotado en TypeScript; la corrección de memoria conserva todos los gates
  y necesita otra corrida. Docker/E2E/Cloud necesitan
  una estrategia explícita de costo y credenciales antes de activarse en GitHub.
- [ ] Crear bootstrap no productivo reproducible para Auth/Portal/E2E; hoy un
  clon limpio no puede ejecutar el sistema completo sólo con el repo.
- [ ] Verificar en los proveedores, sin asumir por código: Kommo live/dry-run,
  Resend, SeaRates, Telegram, VAPID, monitor externo y adjuntos/restore.
- [ ] Si AWS vuelve a usarse, confirmar cuenta/región, Object Lock, suscripción
  SNS y restore; el template local no prueba estado alojado.

## P2 · ordenar el producto sin falsos cierres

- [ ] Reconciliar las 93 specs no cerradas por rebanadas de dominio. Cambiar un
  front-matter sólo con evidencia en `main` y estado alojado cuando aplique.
- [ ] Crear logger/redacción/correlación central y aumentar cobertura directa de
  crons y Edge Functions.
- [ ] Medir Core Web Vitals y fijar budgets de CSS/fuentes por superficie.
- [ ] Resolver la deriva Brand Book/generador usando únicamente un Norte nuevo;
  no republicar desde copias locales incompletas.
- [ ] Decidir si HailuWay sigue como integración health-only y si SeaRates se
  conserva, reemplaza o termina; no podar endpoints sólo por un snapshot viejo.
- [ ] Retirar variables muertas del entorno alojado después de comprobar sus
  consumidores allí; el repo ya no declara Payload legado.

## Orden de trabajo recomendado

1. Completar y revisar el CI del PR #21; la rama y su diff ya están publicados.
2. Preparar la secuencia de release con preflight por migración. SDD-0358 ya
   separó expansión y restricción de Mailing; todavía no se ejecutó el release.
3. Con autorizaciones individuales, dejar disponibles las RPCs necesarias
   antes de publicar sus consumidores; comprobar cada migración 0399–0413 sin
   asumir que el orden numérico sustituye una prueba de compatibilidad.
4. Autorizar integración y deploy de la app; verificar los cuatro flujos de
   lectura mínima y Portal. Aplicar 0414 y 0415 sólo después del smoke de sus
   consumidores, cada una con su propio OK y de una en una.
   Aplicar 0416 con su gate/smoke de dominio independiente; completar Telegram
   y los demás gates alojados por separado.
5. Limpiar worktree y rama de archivo sólo cuando estén contenidos en main.
6. Seguir P1 por dominio: aislamiento Portal restante y documentos por entidad;
   reconciliar specs y deuda P2 sin mezclarlas con seguridad alojada.

## Stop conditions

- Los pushes de seguimiento quedan limitados a la rama propia y al alcance
  saneado; no incluyen `main`, force-push ni ramas ajenas.
- No hay merge, deploy, migración, secreto o escritura de datos implícitos.
- Un `SKIP` documenta una parte no medida; no se presenta como verde.
- No se elimina worktree o rama mientras exista cambio no contenido o tarea
  activa apuntando a ese checkout.
