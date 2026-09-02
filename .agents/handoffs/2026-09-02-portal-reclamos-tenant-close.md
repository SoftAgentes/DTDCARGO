# Cierre local · SDD-0363 · Reclamos y evidencias Portal

Fecha: 2026-09-02. Rol: worker aislado.
Estado: CORRECCIÓN LOCAL VERIFICADA · PUBLICACIÓN BLOQUEADA.

## Identidad y propiedad

- Tarea Codex: `01a05f15-80ff-77b1-9f3a-6b07d21df02d`, **Audita y limpia worktrees**.
- Rama: `codex/saneamiento-integral`.
- Worktree: `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\codex-saneamiento-integral`.
- Base local: `f1cd9743e9c61630233a1608896f1a331ef79d15` (Academia sin publicar).
- Base remota: `eabb230b257579d3b5527a8721eebc328d748f79`.
- `origin/main`: `2a2e81bf554dbe7bd4f05170847e8f02e988d320`, sin cambios.
- Sólo esta tarea Codex activa aparece para DTDCargo; no hay otra sobre el
  worktree worker. El principal queda reservado y no se mueve.
- Reproducción independiente del agente `academia_rls_regression`: sólo el
  test SQL. Principal: spec, migración, checklist, índice y handoffs.
- Allowlist de siete rutas exactas en SDD-0363. Índice inicial vacío; no hay
  cambios ajenos absorbidos. Commit selectivo que incorpora este documento:
  `fix(portal): SDD-0363 — aislar reclamos y evidencias por tenant`.

## Cambio y compatibilidad

Dos policies SELECT ahora exigen principal, vínculo activo, cliente vivo y
tenant + Shipping Mark coherentes. `client_id`, si existe, debe ser del
cliente. Su ausencia conserva el snapshot histórico propio; no se requiere
un embarque vivo. Evidencia exige además reclamo padre vivo/coherente.

No cambia CRUD interno, finanzas, indemnizaciones, RPCs, triggers, ACL, bucket
ni policies Storage. Se preserva el soft-delete interno de 0230. No se modifica
runtime TS/TSX, captura/retención de datos ni la duración de URLs firmadas.
La fachada de soporte sigue derivando ids desde la sesión antes de firmar.

## Evidencia ejecutada

| Verificación | Resultado |
|---|---|
| RED con `apply_fix=false` y 0419 ausente | exit 1 por visibilidad incorrecta; antes confirma ambas lecturas A→B |
| GREEN con archivo real 0419 | exit 0; identidad/tenant/padre, historia, equipo/dual y ocho preflights de drift |
| Preservación bidireccional | policies/ACL/funciones/triggers y datos/bucket/objetos intactos |
| Rollback del fixture | true; tabla de reclamos ausente al terminar |
| `node scripts/run-sql-tests.mjs` | 160 contratos pasan, rollback total |
| `node scripts/check-schema-rebuild.mjs` | 416 migraciones: 398 desde cero + 18 sólo-ledger; 219 tablas / dos tenants sintéticos |
| Vitest reclamos + soporte privado Portal | 47 pruebas / cuatro archivos pasan |
| Docs/índice, numeración, gobernanza, componentes y diff | pasan; 355 specs / 416 migraciones, sin colisiones nuevas |

Fixture exclusivo `dtd_reclamos_0363_codex_20260902`, sin red/puertos,
montaje `/sb` read-only. ID
`37384708c1ce8f8cbbc66fc85ef7a0dcb5f83f4f7738ca2251a0764fc9a60593`:
detenido tras revalidar etiquetas/ownership y verificada su ausencia.
Ningún contenedor ajeno fue detenido o eliminado.

## Gates pendientes y siguiente responsable

- Publicación bloqueada: auto-review rechazó el push previo de `f1cd9743` por
  requerir aprobación explícita del commit/destino. No se reintenta con este
  commit ni se usa otra herramienta para eludirlo. Ambos quedan locales.
- Destino previsto sólo tras autorización: rama `codex/saneamiento-integral`
  de `https://github.com/hailuwaycom-sketch/DTDCARGO`, sin merge ni deploy.
- CI alojado: el run verde `33671435585` corresponde a `eabb230b`; no demuestra
  Academia ni Reclamos. No se repiten build/E2E locales sin cambios de aplicación.
- Cloud: `0419_portal_reclamos_tenant_boundary.sql` NO aplicada. Requiere GO
  nominal individual, runbook y smoke autorizado. Sin RPC/deploy previo nuevos.
- La migración no demuestra ausencia de explotación ni estado de datos reales.
- No limpiar este worktree: activo, commits sin publicar y sin contención en
  main. Se preservan los dos worktrees y ambas ramas archive.
- Siguiente responsable: founder para gates externos; integrador exclusivo
  para main/limpieza. Esta tarea puede seguir con los slices locales del checklist.
- Tiempo/tokens del slice: n/a (la plataforma sólo muestra acumulado del objetivo).
