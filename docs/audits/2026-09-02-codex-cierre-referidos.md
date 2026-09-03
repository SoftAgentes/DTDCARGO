---
title: "Codex: cierre técnico de la cobertura de Referidos"
tipo: auditoria-operativa
autor: Codex
estado: verificado-local-y-git
created: 2026-09-02
updated: 2026-09-02
review-by: 2026-09-09
confidencialidad: interno
---

# SDD-0309 · se cierra la cobertura, no la operación real

La tarea antigua pedía proteger con contratos SQL la acreditación automática
ya construida. No pedía volver a implementarla. Se marca `done` ese alcance
técnico después de verificar código integrado, ejecución y controles causales.
El runtime, las migraciones y el contrato SQL permanecen sin cambios.

## Evidencia de Git

- Base del cierre: `2f1242b7ffec9f835d8875025aaeedaf94935197`.
- `git merge-base --is-ancestor de94ba47 origin/main`: exit0.
- Main auditado: `2a2e81bf554dbe7bd4f05170847e8f02e988d320`.
- Diff vacío contra main para `supabase/tests/0250_referral_settings.test.sql`
  y las tres migraciones reales `0197_referral_auto_accredit.sql`,
  `0238_referrals_accredited_at.sql` y `0250_referral_settings.sql`.
- El inventario de definiciones identifica0250 como último cuerpo del trigger
  de acreditación y0197 como dueño del enlace INSERT/UPDATE de invoices.

## Matriz ejecutada

PostgreSQL17 de la imagen local
`sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d`.
Contenedor propio `dtd_referral_close_3dd66432a2`, con `--network none`, sin
puertos ni volúmenes. `psql -X`, `ON_ERROR_STOP=1`, base local `postgres`.
Los includes del contrato se expandieron en memoria; no se alteró SQL en Git.

| Variante | Resultado exigido y observado | Limpieza posterior |
|---|---|---|
| Contrato sin modificar | GREEN: siete criterios en seis bloques | rollback=true |
| Sin filtro de estado pendiente en el UPDATE | `CONTRATO 2 ROTO` | rollback=true |
| Sin guarda inicial de factura borrada | `CONTRATO 4 ROTO` | rollback=true |
| Sin tenant en lookup y UPDATE, conjuntamente | `CONTRATO 5 ROTO` | rollback=true |

Los siete criterios son emisión inicial, premio desde settings, segunda
factura sin reacreditar, borrador sin premio, factura borrada sin premio,
cruce de tenant rechazado y transición borrador→emitida con premio.

Cada reemplazo exigió exactamente un ancla de línea completa en0250 antes
de crear el contenedor. Un primer preflight detectó un ancla ambigua y abortó
sin recursos; se corrigió el anclaje, no el contrato ni la función.
Tras cada conexión se comprobaron ausentes `tenants`, `referrals`, `invoices`
y el tipo `referral_status`. Al terminar se verificaron ownership por labels,
parada y eliminación automática del contenedor; `docker ps -a` confirmó ausencia.

## Revisión y límites

Revisión independiente aprobada sobre spec, contrato y las tres migraciones.
El revisor comprobó también Git; las ejecuciones anteriores son del agente
principal y no se atribuyen al revisor.

- No hay lectura de filas de negocio/PII, consulta de metadatos alojados,
  aplicación de migraciones, acreditación real ni comunicación externa.
- Las cifras de producción y los120 contratos de la spec original se
  conservan como observaciones del2026-08-26, no como medición vigente.
- El fixture sustituye el helper de tenant: no prueba autorización por rol
  ni RLS. La mutación tenant retira ambos filtros juntos; no prueba que cada
  uno sea necesario por separado. Tampoco cubre concurrencia.
- Registrar un premio no equivale a aplicarlo a facturación. SDD-0137 y la
  primera operación real quedan fuera de este cierre; no se inventa un GO.
- Mejora opcional señalada: algunas comparaciones del contrato usan `<>` y
  no detectan por sí solas un resultado NULL. No invalida los tres controles
  causales ejecutados; no se presenta como cobertura universal del trigger.
- No se repiten suites globales de aplicación, build, navegador, SQL/rebuild
  ni advisors por un cambio documental. La matriz focal sí se ejecutó ahora.
  Las6.477 pruebas del incremento anterior son evidencia previa, no nueva.

## Allowlist y seguimiento

Sólo cinco rutas: esta acta, `docs/specs/0309-el-referido-que-nunca-corrio/spec.md`,
el índice generado `docs/specs/README.md`, el checklist único de arranque y
`.agents/handoffs/2026-09-02-saneamiento-integral-close.md`.

Se regenera el índice y se validan docs, numeración, gobernanza, componentes y
diff antes del commit selectivo. Sin nueva spec ni migración. El inventario
queda en361 specs:267 done,1 superseded y93 abiertas (78 in-progress,8 proposed,
4 approved,3 draft). El checklist conserva **51/105**, porque la casilla global
de reconciliar specs todavía está abierta; no se añaden casillas para inflarlo.

Publicación pendiente del SHA final y su CI. No se reintenta el push rechazado,
no se integra main y se conservan ambos worktrees hasta demostrar contención.
