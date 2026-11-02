# SDD-0596 · tramo 1: un error no borra lo escrito en el portal

- **Fecha:** 2026-11-02. **Owner:** `claude-sweet-curie-8102cb`.
- **Ruta:** `DTD-worktrees/error-no-borra-portal`. **Rama:** `codex/error-no-borra-portal`. **Base:** `7be2ed9e5`.
- **SDD:** 0596, asignada por el Director. Reserva local sin publicar: `codex/sdd-reserve-0596-error-no-borra-lo-escrito`, `refs/dtd/reservations/0596`.
- **Límite:** **PR retenida. No entra a `main` antes de publicar: espera a que termine la salida a producción**, por indicación del Director.
- **Permisos:** PR en borrador. Sin merge, sin deploy, sin producción. Corridas pesadas con turno del Director.

## OBJETIVO ORIGINAL

Sam, literal: «Haz esta tarea aquí: "Que un error no borre lo escrito en los paneles"». El Director pidió medir antes las rutas en uso real y llevarle la lista.

Decisión de Sam, literal: «Sí, portal primero», a la pregunta «¿Arreglamos primero el portal, antes que los paneles de Nómina?». En esta sesión la pregunta llegó como «¿Incluyo el portal en este encargo como primer tramo?».

## Resultado

Tras una respuesta con error, 13 formularios en 11 archivos de portal, `entrar` e `invitar` perdían lo escrito. Ahora lo conservan. Causa, lista de campos por formulario, decisión y tramos en `docs/specs/0596-error-no-borra-lo-escrito/spec.md`.

## COMPLETADO

- `lib/shared/submit-keeping-draft.ts`: el ayudante.
- Los 13 formularios conservan `action` y añaden `onSubmit={submitKeepingDraft(...)}`.
- `AcceptInvitationForm` conserva nombre y apellido y sigue vaciando la clave.
- `AcceptanceForm` queda igual que en `main`: las casillas no se conservan, a propósito.
- `app/portal/conservar-lo-escrito.test.tsx`: un caso por formulario, lo que no debe conservarse, envío, doble envío y limpieza al guardar.
- Medidos y sin tocar: `RegisterForm`, `PaymentReportForm`, `DataChangeEditor`, `BillingIdentityForm`, `ReferralInviteForm`. También sin tocar: `CedulaPhotoRow`, donde el vaciado es lo correcto.
- Archivos medidos en Chrome: con el arreglo se conservan, así que la pantalla no necesita pedir que se vuelvan a elegir.
- Datos personales clasificados con `revisar-datos-ve`, en la spec. `/ui-check` del diff, sin cambios visuales.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `conservar-lo-escrito.test.tsx`, ayudante desactivado, una corrida con `--maxWorkers=1` | FALLÓ, como se esperaba: 14 de 29 en rojo |
| La misma prueba con el ayudante | PASÓ, 29 de 29 |
| Chrome 152, `CotizacionRequestForm`, con clics y teclas reales | PASÓ: antes se perdían servicio, descripción, CBM y cajas; ahora se conservan, también al reintentar. Un `required` vacío bloquea el envío y la URL no cambia |
| Chrome 152, archivos en `NewPurchaseForm` | PASÓ con el arreglo: el reintento envía los archivos. En `main`, el rótulo muestra el archivo mientras el campo queda vacío |
| Chrome 152, `PaymentReportForm` | PASÓ: conserva todo, con el archivo |
| Componentes reales, `RegisterForm` y otros tres | PASÓ: nada perdido con una respuesta de error |
| Lectura de las pruebas vecinas (`NewPurchaseWizard`, `PurchaseStepDetalle`, `PortalAddresses`, `SuppliersClient`, `PortalClaims`, `entrar-dos-filas`, `action-result-contract`) | Ninguna depende de `action` ni del reinicio. **Por lectura, sin correrlas** |
| `docs:check`, `sdd:check` | Ver el cuerpo de la PR |
| Mutantes | **NO EJECUTADO:** el Director retuvo el turno; avisará |
| `next dev` con server action real, y envío antes de hidratar (criterio 6) | **NO EJECUTADO:** mismo motivo. **Es la comprobación más importante que falta** |
| ESLint y `tsc` completos, pruebas vecinas, suite y `pnpm verify` en local | NO EJECUTADO: sin turno. Corren en el CI de la PR |
| Graphify, Archify, Obsidian | NO EJECUTADO: los publica el Director desde main |

Las medidas usan una acción simulada, con la forma de la respuesta de la acción real.

**Sin medir:** lector de pantalla, portal con sesión real, y archivos en `NewPurchaseWizard`, `PurchaseStepDetalle` y `PortalClaims`.

## COMMITS

- `384b95d65`: `fix(portal): SDD-0596 — un error no borra lo escrito en el portal`.
- `71106aa3d`: spec y handoff, primera versión.
- El commit que contiene esta versión no se autorreferencia.

## PR / BRANCH

Rama `codex/error-no-borra-portal`, en la PR en borrador [#358](https://github.com/SoftAgentes/DTDCARGO/pull/358) contra `main`, **retenida**.

## PENDIENTES DE ESTA TAREA

1. Con turno del Director: `next dev` con server action real y sin hidratar, mutantes, ESLint, tipos y pruebas vecinas.
2. «Calidad local sin secretos» en verde.
3. Smoke en el portal con sesión real: provocar un error en una cotización y comprobar que lo escrito sigue ahí, con archivos adjuntos en una compra.
4. Integrar después de publicar.

## FUERA DE ALCANCE DETECTADO

1. **Cuando la acción lanza:** corte de red o, por lectura, un cuerpo por encima de `bodySizeLimit`. Se pierde todo, y reintentar podría duplicar. Pide decisión; la recomendación está en la spec.
2. **ERR-01:** los mensajes no dicen qué se conservó, y `AcceptInvitationForm` no avisa que la clave se vació. No se cambian textos en este tramo.
3. **Tramo 2, Nómina:** 15 paneles arreglados en `codex/error-no-borra`, commits locales sin publicar, para una PR aparte. Sus mutantes también esperan turno. La integración la decide el Director.
4. **Tramo 3, resto del ERP y apps móviles:** 76 archivos en total tienen `<form action>` con campos sin estado. Sin tocar.
5. **`PortalMessageForm`** avisa «El mensaje es muy largo» sólo desde el servidor. Con el arreglo ya no se pierde el texto, pero un `maxLength` o un contador evitarían el viaje.

## HANDOFF AL DIRECTOR

- La decisión de Sam está registrada arriba y en la spec.
- **`AcceptanceForm`:** recomiendo no conservar las casillas, y por eso salió de la allowlist. Queda igual que en `main`.
- **Archivos:** no hace falta un aviso. `main` tenía un defecto peor: el rótulo mostraba un archivo que ya no estaba, y el servidor descartaba en silencio el archivo vacío del reintento.
- El ayudante es idéntico en las dos ramas, así que combinan en cualquier orden. La spec también es idéntica en las dos.
- Cuando des el turno, el orden es: `next dev` primero, porque puede cambiar el diseño; después los mutantes.

### Impacto documental

Spec 0596 nueva e índice regenerado. No cambian políticas.
