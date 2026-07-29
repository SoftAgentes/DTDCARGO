# Diseño correctivo del Corte E — exportación, hold y retención

| Control | Valor |
|---|---|
| SDD | [SDD-0166](spec.md) |
| Diseño | Corte E · E0 v1.0 |
| Inventario | [E0 read-only](inventario-corte-e-2026-07-29.md) |
| Revisión | [REV-AUD-016](../../governance/reviews/aud-corte-e.md) |
| Estado | aprobado técnicamente; implementación no abierta |

## 1. Secuencia obligatoria

1. **E1 · fundamento:** calendario por clase/jurisdicción, fuente, responsable,
   fecha, revisión y tratamiento al vencer.
2. **E2 · holds:** modelo append-only de creación y liberación; dos decisiones
   humanas para liberar; precedencia sobre expiración/purga.
3. **E3 · exportación:** solicitud durable, redacción, aprobación, job,
   manifiesto/hash, Storage privado, descarga reautorizada y expiración.
4. **E4 · expiración de artefactos:** borrar solo archivos temporales vencidos,
   nunca eventos fuente; evento y recibo del lote.
5. **E5 · retención:** solo después de E1; dry-run, hold check, conteo/hash,
   autorización y purga controlada.

## 2. Fronteras

- E1 requiere fuente legal/contractual verificable; Codex no inventa plazos.
- E2–E5 requieren SDD propio antes de DB, Storage, jobs o UI.
- `audit-exports` será privado y separado de adjuntos de negocio.
- la ruta del objeto empieza por `tenant_id/request_id/`;
- la URL firmada dura como máximo 15 minutos;
- el artefacto temporal expira en máximo 24 horas salvo expediente/hold;
- toda descarga revalida sesión, tenant, capability, aprobación y vigencia;
- CSV neutraliza `=`, `+`, `-` y `@`; el manifiesto declara la transformación;
- el hash se sella/ancla fuera del mismo artefacto antes de afirmar integridad
  frente a un actor privilegiado.

## 3. Estado y transiciones

Exportación:

```text
requested -> awaiting_approval -> queued -> generating
          -> ready -> downloaded/expired
          -> failed/revoked
```

Hold:

```text
active -> release_requested -> released
```

No se actualiza historia sin evento. Las transiciones inválidas fallan. La
liberación exige solicitante y aprobador distintos o excepción R3 del founder.

## 4. Pruebas mínimas

- no-admin y tenant ajeno denegados;
- filtros/payload no allowlisted nunca llegan al archivo;
- CSV injection neutralizada;
- manifiesto, hash y conteo reproducibles;
- URL vencida, revocada o de tenant ajeno falla;
- hold bloquea expiración/purga;
- segundo aprobador obligatorio;
- job reintentado es idempotente;
- fallo de Storage no marca `ready`;
- dry-run de retención no borra;
- lote con hold conserva todas sus filas;
- PostgreSQL 15/17 y Storage efímero verificados.

## 5. Allowlist del próximo gate

El siguiente gate puede crear solo:

1. un SDD nuevo de Corte E;
2. su inventario de fuentes legales y decisiones humanas;
3. índice SDD y mapa módulo;
4. actualización trazable de SDD-0166;
5. revisión y línea base nuevas;
6. índice maestro de gobernanza.

No incluye migración, bucket, job, UI ni Cloud.
