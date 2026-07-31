# Revisión técnica D4 R3 — search_path vacío

| Control | Valor |
|---|---|
| Revisión | REV-AUD-045 |
| SDD | SDD-0189 |
| Migración | `0296_audit_d4_empty_search_path` |
| Fecha | 2026-07-31 |
| Resultado | cumplimiento local · Producción pendiente |

## Veredicto

El slice corrige exactamente el path legacy de las cinco RPC R3 identificadas
por REV-AUD-021. La consulta metadata-only a Producción confirmó firmas, owner,
ACL y cuerpos. Cuatro funciones ya calificaban sus referencias no-pg_catalog;
`operario_action` requería cualificar dos tipos antes de vaciar el path.

La migración transforma únicamente esos dos casts en el cuerpo instalado y
usa `ALTER FUNCTION` para el path. No cambia lógica de negocio, firmas, owner
ni ACL.

## Evidencia

- reproducción del fallo de un enum no cualificado con path vacío;
- fixture con ambos enums y las cinco firmas;
- ejecución positiva de las cinco RPC tras el cambio;
- owner `postgres`, `SECURITY DEFINER` y path vacío;
- ejecución sólo para `service_role`; `anon` denegado;
- PostgreSQL 15 y 17 efímeros terminan en rollback.

## Clasificación

| Política | Evidencia | Clasificación |
|---|---|---|
| AUD-01 v1.0 | cinco fronteras R3 con path vacío y bridge transaccional intacto | cumplimiento local |
| SGE-00 | cambio acotado, reproducible y fail-closed ante drift | cumplimiento |
| AUD-02 | no cambia lectura, retención ni exportación | no aplica |

Producción permanece fuera de alcance. `0296` exige autorización nominal
individual y no está incluida en la autorización previa de `0270` y
`0289`–`0293`.
