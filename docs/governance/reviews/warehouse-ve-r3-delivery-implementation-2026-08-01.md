# REV-SGE-042 · Entrega R3 manual gobernada en Almacén VE

| Control | Valor |
|---|---|
| Fecha | 2026-08-01 |
| Spec | SDD-0231 |
| Hallazgo origen | REV-SGE-039 |
| Migración local | `0321_warehouse_ve_delivery_governance.sql` |
| Producción | No aplicada |

## Residuo corregido

La transición a `delivered` ya no acepta receptor vacío ni separa el update del
timeline. El RPC resuelve rol activo y tenant, bloquea el shipment, valida el
estado, exige receptor y motivo, y escribe estado + timestamp + receptor +
timeline + AUD-01 en una sola transacción.

Un trigger bloquea el `UPDATE` directo. Tracking deja de presentar su bypass
genérico y enlaza a Almacén VE. La UI denomina el acto “Confirmar entrega
manual”, identifica primero al receptor y ejecuta la decisión sólo después de
una confirmación canonical con motivo, presión sostenida y request ref estable.

## Frontera honesta con el POD sellado

`dispatch_pods` pertenece a ODs de Despacho y no existe una relación 1:1
comprobable entre una OD y el shipment maestro de Almacén VE. El slice no
inventa ese vínculo. La constancia manual registra en AUD-01
`attestation_kind=manual` y `sealed_dispatch_pod=false`; la UI advierte que no
sustituye la foto y firma selladas de la PWA.

## Evidencia local

- 9/9 pruebas focales del validator y wrapper RPC.
- TypeScript `tsc --noEmit` y ESLint focal verdes.
- UI check liviano: ConfirmDialog canonical, receptor y consecuencia visibles,
  estados pending/error, foco seguro y cero tokens o patrones nuevos.
- 56/56 contratos SQL en PostgreSQL 17 efímero, incluido 0321.
- El contrato 0321 demuestra anti-bypass, roles, membresía, tenant, estado,
  receptor, atomicidad, replay, referencia reutilizada, timeline con actor,
  hito terminal y rollback total ante falla de AUD-01.
- Reconstrucción verde: 317 archivos evaluados, 300 migraciones aplicadas desde
  cero, 17 sólo-ledger y aislamiento sobre 219 tablas.
- Docs, 27 políticas, 4 componentes y plugin read-only 7/7 verdes.
- El registry distribuido fue regenerado con el sincronizador oficial; la caché
  instalada no recibió edición manual.
- `git diff --check` verde.

## Alcance que no se amplió

- No se modificó el POD de la PWA, Storage, Despacho, TMS, notificaciones o
  captura de foto/firma.
- No se creó una relación falsa shipment↔OD ni se declaró equivalencia legal.
- No se aplicó 0321 a Cloud ni se tocó Vercel o `main`.
- Las migraciones 0316–0320 permanecen aisladas y sin aplicar.

## Estado de cobertura

Este slice valida un fallback R3 representativo de Almacén VE. No promueve el
módulo completo a `VA`: liberación, reparto, incidencias, filtros y demás
acciones conservan su clasificación previa.

## Gate nominal

Aplicar a Producción exige una autorización que nombre exactamente
`0321_warehouse_ve_delivery_governance`. Esa autorización no se infiere de la
autorización general de commits ni de los gates 0316–0320.
