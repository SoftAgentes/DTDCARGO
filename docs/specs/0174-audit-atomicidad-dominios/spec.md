---
sdd: "0174"
title: "Auditoría — atomicidad por dominios"
status: in-progress
author: "Sam (founder) + Codex"
created: 2026-07-29
updated: 2026-07-29
supersedes: null
superseded_by: null
related: ["0021", "0024", "0040", "0041", "0044", "0123", "0166"]
confidencialidad: interno
---

# SDD-0174 — Auditoría · atomicidad por dominios

## 1. Decisión

Se ejecuta el Corte D de [SDD-0166](../0166-auditoria-gobernada-aud-01-aud-02/spec.md)
mediante cinco gates independientes:

1. D1 · acceso y configuración;
2. D2 · núcleo financiero;
3. D3 · ciclo comercial;
4. D4 · logística R3;
5. D5 · cobertura residual y retiro del writer best-effort.

Cada gate exige inventario cerrado, allowlist propia, RPC/transacción de
dominio, prueba de fallo del evento y revisión separada. Abrir este SDD no
autoriza migraciones, Cloud ni un bundle D1–D5.

## 2. Contrato

Una mutación obligatoria solo cumple AUD-01 cuando la mutación de negocio y
`append_audit_event` comparten una transacción. Un helper TypeScript posterior
o best-effort no cumple atomicidad.

Toda frontera nueva:

- deriva actor y tenant desde sesión confiable;
- valida capability y estado;
- bloquea la fila cuando existe riesgo de carrera;
- usa allowlist mínima para `before_data` y `after_data`;
- nunca serializa secretos, tokens, cuentas completas ni blobs;
- exige motivo para R3, revocación, suspensión, anulación y override;
- revoca `EXECUTE` a `PUBLIC` y `anon`;
- fija `search_path=''`;
- falla y revierte si no puede persistir el evento.

## 3. Excepción de efectos externos

Supabase Auth, correo, mensajería y otros proveedores no comparten transacción
PostgreSQL. Estos flujos deben:

1. registrar intención durable e idempotente;
2. ejecutar el efecto externo;
3. confirmar o compensar;
4. conservar un estado reconciliable y observable.

No se declara atomicidad distribuida donde no existe. D1 debe diseñar esta
máquina antes de modificar suspensión/reactivación de usuarios.

## 4. Estado por gate

| Gate | Estado | Evidencia |
|---|---|---|
| D0 | aprobado | [REV-AUD-014](../../governance/reviews/aud-corte-d.md) |
| Apertura SDD | aprobada | [REV-AUD-015](../../governance/reviews/aud-d1-access-config.md) |
| D1 inventario | aprobado | [inventario D1](inventario-d1-acceso-configuracion-2026-07-29.md) |
| D1 diseño | aprobado | [REV-AUD-017](../../governance/reviews/aud-d1-access-config-design.md) |
| D1 implementación | pendiente | allowlist publicada; no se creó migración |
| D2 | pendiente | no abierto |
| D3 | pendiente | no abierto |
| D4 | pendiente | no abierto |
| D5 | pendiente | no abierto |

## 5. Criterios de aceptación por operación

- éxito produce exactamente un evento;
- tenant ajeno y capability insuficiente fallan;
- estado inválido no muta;
- repetición idempotente no duplica;
- fallo forzado del evento revierte la mutación;
- payload no contiene claves prohibidas;
- motivo es obligatorio cuando corresponde;
- ACL, owner y `search_path` están probados;
- PostgreSQL 15 y 17 terminan en rollback;
- aplicación, Cloud y Producción conservan gates separados.

## 6. Fuera de alcance

- comentarios cerrados por SDD-0168;
- ciclo tenant/fixtures de SDD-0172;
- consulta gobernada de Corte C;
- exportación, hold, purga y retención de Corte E;
- aplicar `0268` o `0270` en Cloud;
- definir plazos legales sin fuente aprobada.

## 7. Próximo gate

El [diseño D1](diseno-d1-acceso-configuracion.md) quedó aprobado sin declarar
atomicidad ACID entre PostgreSQL y Supabase Auth. El siguiente gate, todavía no
abierto, es crear localmente la allowlist exacta de implementación después de
revalidar el correlativo reservado. D2–D5 permanecen cerrados.
