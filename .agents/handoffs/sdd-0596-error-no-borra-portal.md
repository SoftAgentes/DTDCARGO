# SDD-0596 · tramo 1: un error no borra lo escrito en el portal

- **Fecha:** 2026-11-02. **Owner:** `claude-sweet-curie-8102cb`.
- **Ruta:** `DTD-worktrees/error-no-borra-portal`. **Rama:** `codex/error-no-borra-portal`. **Base:** `7be2ed9e5`.
- **SDD:** 0596, asignada por el Director. Reserva local sin publicar: `codex/sdd-reserve-0596-error-no-borra-lo-escrito`, `refs/dtd/reservations/0596`.
- **Límite:** **PR retenida. No entra a `main` antes de publicar**, por indicación del Director.
- **Permisos:** PR en borrador. Sin merge, sin deploy, sin producción. Corridas pesadas con turno del Director.

## OBJETIVO ORIGINAL

Sam, literal: «Haz esta tarea aquí: "Que un error no borre lo escrito en los paneles"». El Director pidió medir antes las rutas en uso real y llevarle la lista. Con ella, a «¿Incluyo el portal en este encargo como primer tramo?», Sam respondió: «Sí, portal primero».

## Resultado

Tras una respuesta con error, 13 formularios en 12 archivos de portal, `entrar` e `invitar` perdían lo escrito. Ahora lo conservan. Lista completa, causa, decisión y tramos en `docs/specs/0596-error-no-borra-lo-escrito/spec.md`.

## COMPLETADO

- `lib/shared/submit-keeping-draft.ts`: el ayudante.
- Los 13 formularios conservan `action` y añaden `onSubmit={submitKeepingDraft(...)}`.
- `AcceptInvitationForm` conserva nombre y apellido y sigue vaciando la clave.
- `app/portal/conservar-lo-escrito.test.tsx`: un caso por formulario, más envío, doble envío y limpieza al guardar.
- Sin tocar: `RegisterForm`, que ya conserva, y `CedulaPhotoRow`, donde el vaciado es lo correcto.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `conservar-lo-escrito.test.tsx`, sin el arreglo, `--maxWorkers=1` | FALLÓ, como se esperaba: 15 de 17 en rojo |
| La misma prueba con el arreglo | PASÓ, 17 de 17 |
| Chrome 152, `CotizacionRequestForm`, con clics y teclas reales | PASÓ: antes se perdían servicio, descripción, CBM y cajas; ahora se conservan, también al reintentar. Un `required` vacío bloquea el envío y la URL no cambia. Acción simulada |
| Lectura de las pruebas vecinas (`NewPurchaseWizard`, `PurchaseStepDetalle`, `PortalAddresses`, `SuppliersClient`, `PortalClaims`, `entrar-dos-filas`, `action-result-contract`) | Ninguna depende de `action` ni del reinicio. **Por lectura, sin correrlas** |
| `docs:check`, `sdd:check` | Ver el cuerpo de la PR |
| Mutantes | **NO EJECUTADO:** el Director retuvo el turno; avisará |
| `next dev` con server action real, y envío antes de hidratar (criterio 6) | **NO EJECUTADO:** mismo motivo. **Es la comprobación más importante que falta** |
| ESLint y `tsc` completos, pruebas vecinas, suite y `pnpm verify` en local | NO EJECUTADO: sin turno. Corren en el CI de la PR |
| Graphify, Archify, Obsidian | NO EJECUTADO: los publica el Director desde main |

**Sin medir:** archivos de `FileField`, lector de pantalla, portal con sesión real.

## COMMITS

- Commit de código: `fix(portal): SDD-0596 — un error no borra lo escrito en el portal`.
- El commit que contiene este handoff y la spec no se autorreferencia.

## PR / BRANCH

Rama `codex/error-no-borra-portal`, en PR en borrador contra `main`, **retenida**. El número queda en la propia PR.

## PENDIENTES DE ESTA TAREA

1. Con turno del Director: `next dev` con server action real y sin hidratar, mutantes, ESLint, tipos y pruebas vecinas.
2. «Calidad local sin secretos» en verde.
3. Smoke en el portal con sesión real: provocar un error en una cotización y comprobar que lo escrito sigue ahí, con archivos adjuntos en una compra.
4. Integrar después de publicar.

## FUERA DE ALCANCE DETECTADO

1. **Tramo 2, Nómina:** 15 paneles arreglados en `codex/error-no-borra`, commit local sin publicar. Sus mutantes también esperan turno. La integración la decide el Director.
2. **Tramo 3, resto del ERP y apps móviles:** 76 archivos en total tienen `<form action>` con campos sin estado. Sin tocar.
3. **`PortalMessageForm`** avisa «El mensaje es muy largo» sólo desde el servidor. Con el arreglo ya no se pierde el texto, pero un `maxLength` o un contador evitarían el viaje. No es parte de esta tarea.

## HANDOFF AL DIRECTOR

- Sam decidió «Sí, portal primero»; está registrado arriba.
- El ayudante es idéntico en las dos ramas, así que combinan en cualquier orden.
- Cuando des el turno, el orden es: `next dev` primero, porque puede cambiar el diseño; después los mutantes.

### Impacto documental

Spec 0596 nueva e índice regenerado. No cambian políticas.
