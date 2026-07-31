# Aplicación individual en Producción de C1 y D1–D5

| Control | Valor |
|---|---|
| Revisión | REV-AUD-042 |
| Fecha | 2026-07-31 |
| Proyecto | `xpfuzqombmjmxvprjgmi` |
| Autorización | Sam (founder), nominal para `0270` y `0289`–`0293` |
| Resultado | seis migraciones aplicadas y verificadas individualmente |

## Secuencia aplicada

| Orden | Migración | Postcondición comprobada |
|---:|---|---|
| 1 | `0270_audit_governed_query_rbac` | RPC gobernadas selladas; lectura cruda, policy y Realtime retirados |
| 2 | `0289_audit_d1_access_configuration` | dos tablas con RLS, tres RPC selladas y ACL internas |
| 3 | `0290_audit_d2_financial_domain` | función sellada y siete triggers financieros habilitados |
| 4 | `0291_audit_d3_commercial_cycle` | función sellada y cuatro triggers comerciales habilitados |
| 5 | `0292_audit_d4_logistics_r3` | bridge sellado, trigger activo y cinco RPC con path fijo |
| 6 | `0293_audit_d5_residual_and_writer_retirement` | tabla con RLS, cuatro RPC selladas, nueve triggers y writer directo retirado |

El ledger pasó de 293 a 299 filas y conserva los seis basenames exactos en el
orden anterior. PostgreSQL reportó versión 17.6. No se leyó payload, PII ni
filas de negocio.

## Incidente controlado de transporte

El primer intento de `0289` recibió un SQL truncado por el canal local usado
para leer un archivo de 44 KB y PostgreSQL lo rechazó con
`INTO specified more than once`. La transacción hizo rollback completo: no
quedaron tablas, RPC ni entrada de ledger. El archivo no tenía ese defecto.

El reintento reconstruyó y verificó los 44.029 bytes en ocho fragmentos
binarios antes de llamar `apply_migration`. No se modificó la migración y el
segundo intento cerró verde.

## Advisors

| Tipo | Antes | Después | Diferencia atribuible |
|---|---:|---:|---:|
| Seguridad INFO | 5 | 9 | +4 |
| Seguridad WARN | 120 | 127 | +7 |
| Rendimiento INFO | 430 | 436 | +6 |
| Rendimiento WARN | 116 | 116 | 0 |

Los cuatro INFO corresponden a tablas server-only con RLS y sin policies. Los
siete WARN corresponden a las RPC `SECURITY DEFINER` que el contrato expone
deliberadamente a `authenticated`: dos de C1, tres de D1 y dos de D5. Todas
derivan tenant/actor o capability internamente, revocan `anon` y fijan
`search_path=''`; se clasifican como excepción conocida del linter, no como
apertura accidental.

## Límites que permanecen

- D2/D3 continúan con no conformidad de motivo humano en callers legacy.
- D4 continúa con cinco RPC en `search_path=pg_catalog, public`; el bridge sí
  usa path vacío.
- La aplicación no autoriza lectura de negocio, Auth, Vercel, deploy ni nuevas
  migraciones.
- E2–E5 continúan fail-closed sin fuente legal o contractual aprobada.
