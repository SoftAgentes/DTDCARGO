# Cierre técnico · saneamiento integral para transición Cloud → Codex

Fecha: 2026-09-02

Rol: worker
Estado: LISTO PARA PUBLICAR · BLOQUEADO ÚNICAMENTE EN EL GATE EXPLÍCITO DE PUSH

## Identidad Git

- Repositorio: `https://github.com/hailuwaycom-sketch/DTDCARGO.git`
- Worktree: `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\codex-saneamiento-integral`
- Rama: `codex/saneamiento-integral`
- Base auditada: `origin/main@2a2e81bf554dbe7bd4f05170847e8f02e988d320`
- Divergencia medida antes de SDD-0340: 0 detrás / 32 delante; este commit
  agrega el paquete 33.
- Este lote no integra `main`; el worker publica únicamente su rama cuando el
  founder autorice el push exacto.

## Trabajo rescatado y cerrado

1. `5dde643f` — `fix(db): revocar TRUNCATE a roles públicos`.
2. `152055a2` — `docs: actualizar recepción para Codex`.
3. `89cc962f` — `feat(studio): SDD-0315 — neutralizar fórmulas CSV`.
4. `a8fff64c` — `fix(studio): SDD-0316 — minimizar logs inbound`.
5. `7cc03fef` — `fix(admin): SDD-0317 — retirar secreto CBM de URL`.
6. `c8e07855` — `perf(portal): SDD-0318 — consultar documentos en lote`.
7. `35270881` — `fix(crm): SDD-0319 — compartir reloj fuera del render`.
8. `1c07d1f2` — `docs: actualizar arranque de Codex`.
9. `2511f280` — `fix(deps): actualizar Vite y cerrar advisories nuevos`.
10. `8725a341` — `test(e2e): SDD-0320 — ejecutar Tier 1 sin secretos`.
11. `b14f1d25` — `test(e2e): SDD-0321 — acotar concurrencia y teardown`.
12. `d5c72bfd` — `chore(test): cargar Vitest como ESM explícito`.
13. `1faff60b` — `perf(studio): SDD-0322 — consultar relaciones de órdenes en lote`.
14. `09273cc8` — `fix(a11y): SDD-0323 — cerrar barreras Web Quality`.
15. `fix(a11y): SDD-0324 — unificar tabs del Studio` — el hash es el commit
    `b0c8bb83`.
16. `04f8ef94` — `fix(admin): SDD-0325 — limitar intentos CBM`.
17. `6d6c41d4` — `fix(telegram): SDD-0326 — preparar secreto fuera de URL`.
18. `899f516a` — `fix(mobile): SDD-0327 — autenticar cookie de operario`.
19. `53d91357` — `fix(db): SDD-0328 — cerrar bypass de verificación`.
20. `e937bf3b` — `test(e2e): SDD-0329 — aislar caché de Next`.
21. `05075516` — `chore(deps): retirar configuración pnpm obsoleta`.
22. `0fdd2c70` — `fix(studio): SDD-0330 — retirar Nominatim`.
23. `9bd4eb41` — `chore(tooling): fijar Node 24 y pnpm 11`.
24. `fix(studio): SDD-0331 — retirar consultas de identidad inseguras` — el
    commit `927878a6`.
25. `fix(infra): SDD-0332 — retener llave KMS del backup` — el commit que
    precede este cierre.
26. `fix(studio): SDD-0333 — validar configuración de integraciones` — el
    commit `18f5074e`.
27. `chore(config): SDD-0334 — retirar Payload legado` — el commit que contiene
    el hash `4cf0c60a`.
28. `test(portal): SDD-0335 — contener service_role` — el commit que contiene
    este handoff y el checklist de arranque Codex.
29. `fix(portal): SDD-0336 — resolver marca por principal` — el commit que
    contiene este handoff y la migración 0401 todavía no aplicada.
30. `fix(portal): SDD-0337 — resolver hitos por principal` — el commit que
    contiene este handoff y la migración 0402 todavía no aplicada.
31. `fix(portal): SDD-0338 — resolver asesor por principal` — el commit que
    contiene este handoff y la migración 0403 todavía no aplicada.
32. `fix(portal): SDD-0339 — resolver referidos por principal` — el commit que
    contiene este handoff y la migración 0404 todavía no aplicada.
33. `fix(portal): SDD-0340 — acotar firma de adjuntos de compra` — el commit que
    contiene este handoff; no crea migración.

Los allowlists exactos de cada cambio de comportamiento viven en SDD-0315 a
SDD-0340. Los últimos lotes retiran la consulta externa CNE/SENIAT, alinean el
ciclo de vida del bucket WORM histórico con su llave KMS, eliminan falsos verdes
de configuración, retiran el contrato de entorno del Payload descontinuado y
congelan la expansión de `service_role` en Portal. SDD-0336 ejecuta el primer
slice del retiro: dos lecturas de marca dejan de depender de `service_role`.

## Verificación vigente

El último `node scripts/verify.mjs` canónico terminó sin fallos de gate en
SDD-0336; SDD-0337 a SDD-0340 pasaron después sus gates proporcionales:

- 14 de 15 gates medidos, ninguno falló.
- ESLint, frontera RSC, TypeScript y cuatro Edge Functions: OK.
- Vitest posterior a SDD-0340: 514 archivos / 5.905 pruebas pasaron.
- Documentación, numeración, componentes y gobernanza: OK.
- SQL: 145 contratos pasaron con rollback total.
- Rebuild: 401 migraciones; 383 aplicadas desde cero y 18 sólo-ledger;
  aislamiento multi-tenant verificado en 219 tablas y 2 tenants.
- E2E: 150 pasaron, 18 se omitieron por requerir entorno alojado y cero
  fallaron. Un worker de WebKit agotó 300 s al cerrar en Windows; el verificador
  lo clasificó como aviso conocido y no como regresión.
- Build de producción: OK, 158 páginas estáticas generadas.
- `migrations-applied`: NO MEDIDO porque este worktree no tiene credenciales.

Además, SDD-0331 pasó sus contratos focales (2 archivos / 5 pruebas), ESLint,
TypeScript, `docs:check`, `governance:check`, `components:check` y
`git diff --check`.

SDD-0333 valida configuración compuesta sin contactar proveedores; su evidencia
focal se registra en el handoff específico del cambio.

SDD-0334 retira únicamente configuración local sin consumidores; no toca el
piloto vigente de adjuntos ni variables alojadas.

SDD-0335 agrega un gate de inventario para Portal y deja el backlog ejecutable
en `docs/audits/2026-09-02-codex-arranque-checklist.md`.

SDD-0336 baja ese inventario de 11 rutas / 23 construcciones a 10 / 21 y pasa
Vitest focal, suite completa, 142 contratos SQL, rebuild, TypeScript, ESLint,
documentación, gobernanza y componentes.

SDD-0337 centraliza la visibilidad de hitos en una RPC sin parámetros, elimina
la implementación TypeScript duplicada y baja el inventario a 10 rutas / 19
construcciones. Pasó Vitest focal/completo, 143 contratos SQL, rebuild,
TypeScript, ESLint, documentación, gobernanza, componentes y diff.

SDD-0338 resuelve el asesor asignado mediante una RPC sin parámetros, exige una
vinculación Portal y membresía del asesor activas en el mismo tenant, y baja el
inventario a 10 rutas / 18 construcciones. Pasó 6 pruebas focales, la suite
completa de 5.904 pruebas, 144 contratos SQL, rebuild, TypeScript y ESLint.

SDD-0339 mueve el snapshot de Referidos a una RPC sin parámetros y minimiza su
respuesta a facturación agregada, montos del programa y filas visibles sin datos
de contacto. Baja el inventario a 9 rutas / 17 construcciones y pasó 7 pruebas
focales, la suite completa de 5.901 pruebas, 145 contratos SQL, rebuild,
TypeScript y ESLint.

SDD-0340 encapsula la firma de adjuntos de prealerta en un módulo `server-only`
que relee primero los documentos permitidos por RLS y no acepta storage paths del
caller. Baja el inventario a 8 rutas / 16 construcciones y pasó 6 pruebas focales,
la suite completa de 5.905 pruebas, TypeScript y ESLint.

## Gates alojados no cruzados

- La migración `0399_revoke_truncate_anon_authenticated.sql` existe en Git y
  pasó contratos/rebuild locales; NO fue aplicada a Cloud o Producción.
- La migración `0400_revoke_public_verify_rpc_execute.sql` existe en Git y pasó
  contratos/rebuild locales; NO fue aplicada a Cloud o Producción.
- La migración `0401_portal_brand_por_principal.sql` existe en Git y pasó
  contratos/rebuild locales; NO fue aplicada a Cloud o Producción.
- La migración `0402_portal_hidden_statuses_por_principal.sql` existe en Git y
  pasó contratos/rebuild locales; NO fue aplicada a Cloud o Producción.
- La migración `0403_portal_advisor_por_principal.sql` existe en Git y pasó
  contratos/rebuild locales; NO fue aplicada a Cloud o Producción.
- La migración `0404_portal_referidos_por_principal.sql` existe en Git y pasó
  contratos/rebuild locales; NO fue aplicada a Cloud o Producción.
- El cambio Telegram requiere configurar/verificar el header secreto en el
  consumidor alojado antes de considerarlo operativo.
- No se hizo deploy ni se modificaron datos, secretos o configuración alojada.
- No se hizo push. La autorización literal pendiente es:
  `Autorizo git push -u origin codex/saneamiento-integral al remoto https://github.com/hailuwaycom-sketch/DTDCARGO.git`

## Worktrees, ramas y tareas preservadas

- Quedan dos worktrees de DTDCargo: el checkout principal y este worktree.
- El checkout principal estaba limpio, pero atrasado respecto a `origin/main`;
  no se movió ni se sobrescribió.
- `codex/archive-primary-pnpm-20260902` quedó semánticamente contenido por este
  lote; será candidato a borrado sólo después de publicar e integrar esta rama.
- `codex/archive-cloud-handoff-20260828` conserva evidencia documental única y
  debe mantenerse hasta preservarla o supersederla deliberadamente.
- Este worktree NO se puede retirar todavía: su rama aún no está publicada ni
  integrada/contenida en `origin/main`.
- No se detectaron otras tareas Codex activas de DTDCargo que deban archivarse.

## Próximo cierre seguro

1. Recibir la autorización literal de push indicada arriba.
2. Refrescar `origin/main`, confirmar divergencia y publicar únicamente
   `codex/saneamiento-integral`.
3. Validar la rama remota y decidir/integrar el lote en `main` con un gate
   separado.
4. Aplicar las migraciones 0399, 0400, 0401, 0402, 0403 y 0404 de una en una, cada una con
  autorización Cloud específica y el runbook obligatorio.
5. Retirar este worktree únicamente después de probar que sus commits están
   contenidos; mantener las ramas archive hasta auditar su contención.
