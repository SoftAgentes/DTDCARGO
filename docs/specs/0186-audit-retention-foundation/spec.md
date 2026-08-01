---
sdd: "0186"
title: "Fundamento verificable de retención de auditoría"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-30
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0166", "0174"]
confidencialidad: interno
---

# SDD-0186 — Fundamento verificable de retención de auditoría

## 1. Objetivo

Cerrar el gate E1 del Corte E sin inventar plazos legales: registrar fuentes,
jurisdicción, responsables y decisiones disponibles, y establecer el
comportamiento fail-closed mientras el fundamento material no exista. El
2026-07-31 la aprobación explícita del founder promovió el registro con el
[Calendario de retención v1.0](../../legal/retention-schedule-v1.md).

## 2. Decisión

El inventario original no encontró una ley, contrato, consentimiento ni
instrucción formal aprobada que determinara cuánto conservar o cuándo destruir
eventos de auditoría de DTDCargo. Esa ausencia quedó registrada sin fabricar
una fuente.

Desde la aprobación del calendario v1.0:

- existe calendario ejecutable por clase, con `fiscal` y `legacy_unknown`
  fail-closed;
- la conservación continúa sin purga automatizada ni lote implícito;
- exportación, bucket, expiración y retención sólo se abren en E2–E5;
- ningún hold puede usarse como permiso de eliminación;
- E2–E5 se implementaron después en SDD-0219–0222 y quedaron aplicados en
  Producción; este SDD conserva únicamente la decisión E1 y su fuente.

La directiva organizacional no se presenta como dictamen legal ni publica el
Acuerdo v3.0. Una obligación de plazo mayor y todo hold prevalecen.

## 3. Registro de fuentes

[`sources.md`](sources.md) es el registro controlado. La fuente aprobada
identifica jurisdicción, clase, plazo, inicio, tratamiento al vencer,
excepciones, responsable, revisión y aprobación humana. Una versión futura debe
preservar esos campos. Suposiciones o defaults técnicos no califican.

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

- ausencia original y promoción posterior declaradas sin fingir dictamen;
- destrucción y exportación permanecen sujetas a E2–E5;
- campos obligatorios para toda versión futura definidos;
- relación E1→E2–E5 explícita;
- documentación, enlaces y diff validados.

## 6. Resultado

E1 quedó cerrado inicialmente como `blocked-by-source`. Desde el 2026-07-31
queda `approved-source`: habilita abrir E2–E5, pero no autoriza por sí mismo una
migration en Producción ni un lote destructivo. Eventos `fiscal` y
`legacy_unknown` conservan confirmación humana fail-closed.
