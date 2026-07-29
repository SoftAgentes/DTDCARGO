# Inventario Corte E — exportación, hold y retención

| Control | Valor |
|---|---|
| SDD | [SDD-0166](spec.md) |
| Fecha | 2026-07-29 |
| Modo | read-only · repositorio + metadatos Cloud |
| Datos de negocio/PII | no consultados |

## Resultado

| Capacidad | Repositorio | Cloud |
|---|---|---|
| solicitudes de exportación audit | no existe | no existe tabla |
| legal holds | no existe | no existe tabla |
| calendario de retención | no existe | no existe tabla |
| bucket `audit-exports` | no existe | no existe |
| job de expiración/purga audit | no existe | no existe |
| CSV/NDJSON/manifiesto audit | no existe | no aplica |

La búsqueda excluyó exportaciones funcionales de otros dominios: no constituyen
el contrato AUD-02.

## Dependencias

- AUD-02 v1.0 ya aprueba acceso admin-only, redacción por defecto, doble
  decisión, URL firmada de hasta 15 minutos y artefacto temporal de hasta 24
  horas;
- Corte C local aporta consulta gobernada, pero `0270` no está en Cloud;
- Corte D sigue abierto mediante SDD-0174;
- no existe fundamento aprobado para plazos legales, jurisdicciones, backups o
  anonimización al vencer.

## Decisión fail-closed

Hasta aprobar un calendario verificable:

- no se purga ningún evento;
- no se crea job de purga;
- no se habilita exportación;
- no se crea bucket;
- un hold solo puede diseñarse como preservación adicional, nunca como permiso
  de borrado.
