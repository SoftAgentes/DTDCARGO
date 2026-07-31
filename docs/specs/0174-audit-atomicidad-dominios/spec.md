---
sdd: "0174"
title: "Auditoría — atomicidad por dominios"
status: in-progress
author: "Sam (founder) + Codex"
created: 2026-07-29
updated: 2026-07-30
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
| D1 implementación | verificada localmente | [REV-AUD-018](../../governance/reviews/aud-d1-access-config-implementation.md) |
| D2 | cumplimiento parcial; motivo legacy no conforme | [REV-AUD-019](../../governance/reviews/aud-d2-financial-domain.md) |
| D3 | cumplimiento parcial; motivo legacy no conforme | [REV-AUD-020](../../governance/reviews/aud-d3-commercial-cycle.md) |
| D4 | cumplimiento parcial; `search_path` legacy no conforme | [REV-AUD-021](../../governance/reviews/aud-d4-logistics-r3.md) |
| D5 | verificado localmente | [REV-AUD-022](../../governance/reviews/aud-d5-residual.md) |

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

## 7. Resultado D1–D5 y próximo gate

La implementación local usa `0289_audit_d1_access_configuration`, reemplaza
las 24 acciones obligatorias por fronteras transaccionales e incorpora un
workflow durable intención → Auth → confirmación/compensación. No declara
atomicidad ACID entre PostgreSQL y Supabase Auth.

D1 está integrado localmente y pendiente de su gate de Producción individual.
D2 y D3 están integrados con una no conformidad acotada de motivo en callers
legacy. Su adopción restante exige slices R2/R3 separados. D4 conserva una no
conformidad de `search_path` legacy. D5 incorpora idempotencia, lease y
reconciliación durable. La spec permanece `in-progress` y `0289`–`0293`
requieren autorización literal e individual para Producción.
