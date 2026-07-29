---
sdd: "0182"
title: "Validación progresiva de identidad en Club"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-29
updated: 2026-07-29
supersedes: null
superseded_by: null
related: ["0106", "0116", "0181"]
confidencialidad: interno
---

# SDD-0182 — Validación progresiva de identidad en Club

## 1. Objetivo

Aplicar FRM-01 v1.1 a un formulario de identidad acotado, sin crear una
abstracción transversal ni migrar todos los formularios.

## 2. Alcance

El campo cédula de alta en `ClubMemberDrawer` usa:

```text
pristine → blur/submit → invalid → live correction → resolved
```

La primera escritura no muestra error. Blur valida formato y luego consulta
identidad. Después del primer error, cada cambio revalida localmente; al
resolver, comunica formato correcto y reserva el lookup para blur. Submit
invalida y enfoca antes de llamar al servidor.

## 3. Accesibilidad

El input declara `aria-invalid` y `aria-describedby`. Error usa `role="alert"`;
checking, formato resuelto y resultado de identidad usan `role="status"`.
La validación local nunca sustituye la validación server-side.

## 4. Allowlist

- `app/studio/(app)/club/_components/ClubMemberDrawer.tsx`
- `app/studio/(app)/club/_components/ClubMemberDrawer.test.tsx`
- `docs/specs/0182-validacion-progresiva-identidad-club/spec.md`
- `docs/governance/BASELINE-2026-07-29-38.md`
- `docs/architecture/module-sdd-map.md`
- `docs/specs/README.md` generado

## 5. Aceptación

- primera escritura sin error prematuro;
- blur inválido con asociación accesible;
- corrección incompleta sigue inválida;
- resolución local inmediata sin lookup por tecla;
- blur válido ejecuta lookup y anuncia resultado;
- submit inválido enfoca y no llama la acción;
- tests, typecheck, lint, build, docs y `diff --check` verdes.

## 6. Resultado

Implementado y verificado localmente en el alta de Club. Otros campos y
formularios conservan sus propios gates.
