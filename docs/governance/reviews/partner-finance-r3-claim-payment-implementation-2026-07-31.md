# REV-SGE-036 · Pago R3 gobernado en Financiero China

| Control | Valor |
|---|---|
| Fecha | 2026-07-31 |
| Spec | SDD-0227 |
| Hallazgo origen | REV-SGE-035 |
| Migración local | `0317_partner_claim_payment_governance.sql` |
| Producción | No aplicada |

## Residuo corregido

La transición `reconocido_proveedor → pagado_en_china` ya no depende de un
`UPDATE` directo con éxito ambiguo. El RPC gobernado resuelve admin y tenant,
bloquea la fila, valida estado/fecha/motivo/request ref, ejecuta el cambio y
escribe AUD-01 en una sola transacción. Un trigger bloquea el bypass por
PostgREST y el índice parcial hace única la request ref dentro del tenant.

La UI reemplaza el avance de un clic por `ConfirmDialog`: muestra proveedor,
monto, fecha y consecuencia, exige motivo y requiere presión sostenida con
alternativa accesible. El doble envío se bloquea y los errores técnicos se
traducen a mensajes públicos.

## Evidencia local

- 20/20 pruebas focales de validator/query existentes y nuevas.
- TypeScript `tsc --noEmit` verde.
- 52/52 contratos SQL en Postgres 17 efímero, incluido 0317.
- La prueba SQL demuestra: anti-bypass, admin/tenant, replay único, referencia
  reutilizada, rol insuficiente, tenant ajeno, actor y payload durable.
- Reconstrucción verde: 313 archivos evaluados, 296 migraciones aplicadas desde
  cero, 17 sólo-ledger y aislamiento sobre 219 tablas.
- Docs, 27 políticas, 4 componentes y plugin read-only 7/7 verdes.

`pnpm verify` no produjo recibo canónico: tres ejecuciones alcanzaron el pool
completo de Vitest y fueron terminadas por timeouts externos de 5 s, 124 s y
304 s. El último corte dejó 48 procesos hijos del worktree; se identificaron por
ruta absoluta y se detuvieron sin tocar otras ventanas. No apareció un fallo de
assertion. Los gates del slice se ejecutaron y pasaron por separado. El chequeo
`migrations-applied` se omitió de forma canónica por ausencia de credenciales en
este worktree; 0316 y 0317 permanecen deliberadamente sin aplicar.

## Alcance que no se amplió

- No se cambió el monto ni el asiento ya creado al dar de alta el cruce.
- No se gobernaron en este slice `aplicado_a_cliente`, `cerrado`, cargos,
  conversiones ni cierre del estado de cuenta.
- No se aplicó 0317 a Cloud ni se tocó Vercel.
- La migración 0316 de Nómina permanece aislada y sin integración a `main`.

## Estado de cobertura

Este slice valida una acción R3 representativa de Financiero China. No promueve
todo el módulo a `VA`: el cierre de período conserva una secuencia de dos
escrituras y los demás hitos financieros requieren muestras futuras.

## Gate nominal

Aplicar a Producción exige una autorización que nombre exactamente
`0317_partner_claim_payment_governance`. Esa autorización no se infiere de la
autorización general de commits ni del gate pendiente de 0316.
