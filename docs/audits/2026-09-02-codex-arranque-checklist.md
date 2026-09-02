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
- Rama de saneamiento actual: el commit que contiene este checklist, con árbol
  limpio, 0 detrás / 47 delante; la rama remota todavía no existe.
- Checkout principal: limpio en `22cec0c2`, 20 detrás / 0 delante.
- Worktrees: 2; principal + `codex-saneamiento-integral`.
- Tareas Codex de DTDCargo: sólo la tarea activa de este saneamiento.
- Specs reales: 346; 252 `done`, 1 `superseded` y 93 sin cierre documental
  (78 `in-progress`, 8 `proposed`, 4 `approved`, 3 `draft`).

El paquete local y sus commits están enumerados en
`.agents/handoffs/2026-09-02-saneamiento-integral-close.md`. No se hizo push,
merge a `main`, Cloud, Producción ni deploy.

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
  base. El SELECT directo queda admin-only en SDD-0353/migración 0410.
- [x] Facturación anual de Fidelización/CRM minimizada: SDD-0354/migración 0411
  agrega en Postgres y entrega sólo Shipping Mark + USD trailing-12m a roles
  autorizados; la aplicación ya no recibe moneda, tasa, estado ni fechas de
  cada factura.
- [x] Gate canónico posterior a SDD-0348 sin fallos: 14/15 pasos medidos; sólo
  Cloud quedó `SKIP` por falta deliberada de credenciales. E2E: 150 pasaron y 18
  Tier 3 se omitieron; build: 158 páginas. Suite unitaria posterior a SDD-0348:
  523 archivos / 5.942 pruebas, todas verdes.

## P0 · terminar el saneamiento Git y publicar

- [ ] Recibir autorización literal para publicar la rama:
  `Autorizo git push -u origin codex/saneamiento-integral al remoto https://github.com/hailuwaycom-sketch/DTDCARGO.git`.
- [ ] Hacer `fetch`, revalidar `origin/main`, confirmar árbol limpio y publicar
  únicamente `codex/saneamiento-integral`.
- [ ] Verificar la rama remota y revisar el diff publicado.
- [ ] Confirmar en GitHub el primer resultado real del workflow
  `Calidad continua`; el contrato local no sustituye una corrida alojada.
- [ ] Autorizar por separado la integración a `main`; no confundir push de rama
  con merge o deploy.
- [ ] Confirmar que el último commit del lote toca código para que
  `vercel.json` no cancele el build como `doc-only`.
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
  separada; el facade y el cierre de `mail_logs` no existen en Cloud todavía.
- [ ] Aplicar `0411_client_annual_billing_facade.sql` con autorización específica
  separada; el agregado minimizado no existe en Cloud todavía.
- [ ] Reconfigurar el webhook Telegram alojado para usar el header secreto,
  desactivar la compatibilidad query y verificar `getWebhookInfo`.
- [ ] Confirmar deployment Vercel y smoke de público, Studio, Portal y móvil.
- [ ] Medir ledger, grants, policies, buckets y versión real de las cuatro Edge
  Functions sin leer PII ni filas de negocio.

## P1 · seguridad por slices

- [ ] Continuar RBAC de aplicación en la base por slices: lectura minimizada de
  facturas/dinero y autorización documental por entidad. Cada slice
  necesita SDD, contrato SQL, migración propia y gate Cloud separado; no hacer
  un sweep. SDD-0350 ya cerró la escritura directa de `invoices`, preservando
  temporalmente el SELECT tenant-wide que consumen módulos no financieros.
  SDD-0351 cerró las seis tablas administrativas de Mailing; SDD-0353 sustituyó
  la lectura de Cobranzas y dejó `mail_logs` admin-only. SDD-0352 cerró el CRUD
  directo de conciliación bancaria. SDD-0354 retiró las filas financieras del
  agregado anual usado por Fidelización, CRM y Reportes; quedan Conversaciones
  y Órdenes de venta antes de cerrar el SELECT general.
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
  lockfile congelado. Se activará al integrar el workflow en `main`; la primera
  corrida alojada sigue siendo un gate pendiente. Docker/E2E/Cloud necesitan
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

1. Publicar la rama y revisar el diff remoto.
2. Integrar a `main` con autorización separada y verificar deploy/smoke.
3. Aplicar 0399, 0400, 0401, 0402, 0403, 0404, 0405, 0406, 0407, 0408, 0409,
   0410 y 0411 de una en una;
   completar Telegram.
4. Limpiar worktree y rama de archivo contenida.
5. Ejecutar el programa P1 por slices; seguir con facades de lectura financiera
   y autorización documental por entidad.
6. Reconciliar specs y deuda P2 sin mezclarla con seguridad alojada.

## Stop conditions

- No hay push sin la autorización literal registrada arriba.
- No hay merge, deploy, migración, secreto o escritura de datos implícitos.
- Un `SKIP` documenta una parte no medida; no se presenta como verde.
- No se elimina worktree o rama mientras exista cambio no contenido o tarea
  activa apuntando a ese checkout.
