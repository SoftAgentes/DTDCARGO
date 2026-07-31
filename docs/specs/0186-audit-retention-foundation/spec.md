---
sdd: "0186"
title: "Fundamento verificable de retención de auditoría"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-30
updated: 2026-07-30
supersedes: null
superseded_by: null
related: ["0166", "0174"]
confidencialidad: interno
---

# SDD-0186 — Fundamento verificable de retención de auditoría

## 1. Objetivo

Cerrar el gate E1 del Corte E sin inventar plazos legales: registrar fuentes,
jurisdicción, responsables y decisiones disponibles, y establecer el
comportamiento fail-closed mientras el fundamento material no exista.

## 2. Decisión

El inventario no encontró una ley, contrato, consentimiento ni instrucción
formal aprobada que determine cuánto conservar o cuándo destruir eventos de
auditoría de DTDCargo.

Por tanto:

- la conservación continúa sin purga automatizada;
- no se crea calendario ejecutable de borrado;
- no se habilita exportación ni bucket;
- no se crea job de expiración o purga;
- ningún hold puede usarse como permiso de eliminación;
- E2–E5 permanecen sin implementación.

Ausencia de fundamento no equivale a retención infinita aprobada. Es un estado
preventivo reversible que sólo evita destrucción no autorizada.

## 3. Registro de fuentes

[`sources.md`](sources.md) es el registro controlado. Una fuente futura debe
identificar jurisdicción, clase de evento, plazo, inicio del cómputo,
tratamiento al vencer, responsable y evidencia verificable. Notas de chat,
suposiciones o defaults técnicos no califican.

## 4. Allowlist

- `docs/specs/0186-audit-retention-foundation/spec.md`
- `docs/specs/0186-audit-retention-foundation/sources.md`
- `docs/specs/0166-auditoria-gobernada-aud-01-aud-02/spec.md`
- `docs/governance/reviews/aud-corte-e1-foundation.md`
- `docs/governance/BASELINE-2026-07-30-12.md`
- `docs/governance/README.md`
- `docs/architecture/module-sdd-map.md`
- `docs/specs/README.md` generado

No incluye migración, Storage, job, UI, Cloud, Auth, filas o PII.

## 5. Aceptación

- fuente ausente declarada sin plazo fabricado;
- destrucción y exportación permanecen deshabilitadas;
- campos obligatorios para una futura fuente definidos;
- relación E1→E2–E5 explícita;
- documentación, enlaces y diff validados.

## 6. Resultado

E1 queda cerrado documentalmente con resultado `blocked-by-source` para
retención ejecutable. Este resultado no bloquea el núcleo repo-first ni D1–D5;
sí bloquea cualquier purga o exportación del Corte E.
