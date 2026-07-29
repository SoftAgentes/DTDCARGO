# No-Olvidar — documentación operacional (SDD-0025)

Caja fuerte interna de contraseñas y secretos de DTD Cargo. **Custodial**, solo empleados.
Esta carpeta es la política de operación; el código vive en `lib/studio/no-olvidar/`, la spec en
`docs/specs/0025-no-olvidar/spec.md`.

## Índice

| Doc | Para qué | Cuándo se lee |
|---|---|---|
| [runbook.md](runbook.md) | Setup post-deploy (KEK, admins, config), rotación de KEK, aplicar migraciones | Al desplegar y en cada rotación |
| [recovery-procedure.md](recovery-procedure.md) | Recovery M-of-N paso a paso (user + admins) | Cuando un empleado pierde el acceso |
| [admin-handbook.md](admin-handbook.md) | Política: admins actuales, admin que se va, sospecha de breach | Referencia de admins; ante incidentes |
| [threat-model.md](threat-model.md) | Amenazas, mitigaciones V1, riesgos residuales aceptados | Review de seguridad; decisiones de scope |
| [review-bundle/README.md](review-bundle/README.md) | Brief para el code review crypto externo (§7.6) | Antes de mergear a `main` |
| [contratar-revisor.md](contratar-revisor.md) | Aviso listo para publicar, cómo filtrar candidatos, qué NO compartir | Para destrabar el gate: contratar al criptógrafo |

## Estado (2026-07-10)

- **Fase 2 (crypto core)** implementada en la rama `feat/no-olvidar` + endurecimiento (migr 0224).
- **NO mergeado a `main`**: gate = code review crypto externo (§7.6, `review-bundle/`).
- **NO desplegado**: migraciones `0017` + `0224` sin aplicar a prod; KEK sin crear.
- **Fase 3 (UI/actions/pages)**: pendiente.

## Las 3 verdades que el equipo debe tener siempre presentes

1. **Es custodial.** Si TODOS los admins se confabulan, pueden ver todo. Aceptado para uso interno.
2. **En web no se pueden bloquear los screenshots.** Las defensas son best-effort + watermark
   forense. Asumí que cualquier cosa revelada en pantalla puede ser fotografiada.
3. **La KEK es el corazón.** Si se pierde la KEK y su backup offline, se pierde TODO el No-Olvidar.
   Si se filtra la KEK, se compromete todo. Tratarla como el activo más sensible de la empresa.
