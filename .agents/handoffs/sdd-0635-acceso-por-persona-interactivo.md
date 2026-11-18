# Handoff · SDD-0635 · Acceso por persona interactivo (etapas 1 y 2: diseño y pantalla)

- **Fecha:** 2026-11-15
- **Owner / sesión:** Worker 0635 (Claude Code), iniciada por la sesión `local_25e2dded-103b-4eaa-b10e-6527564b9cad`; claim `local_0635-worker`
- **Worktree:** `DTD-worktrees/0635-acceso-por-persona`
- **Rama:** `codex/0635-acceso-por-persona`, desde la reserva `ef4d2f7f7`; trae `origin/main` hasta `bd873493e` (merge `f92acabb6`)
- **SDD:** `docs/specs/0635-acceso-por-persona-interactivo/spec.md`, estado `approved`
- **Estado de tarea:** lista para revisión independiente (la lanza el Director General). Sin merge.
- **Permisos del encargo:** commits, push de la rama propia y PR. Sin merge, sin migraciones, sin producción.

## OBJETIVO ORIGINAL

Rediseñar la pestaña Acceso de la ficha de usuario (actuar sobre cada módulo, persona frente a rol, «ver y
editar» a la vista, «Almacén» solo cuando aplica, Actividad completa) y la matriz «Roles y permisos»
(encabezados fijos, palabras en vez de «V·E», «de fábrica» en vez de «desvío del default»). Sam aprobó la
maqueta vía el Director General: «Esa me gustó. Y crea la sombra para los bordes fijos.» Decisiones de §12 con
la opción recomendada.

## COMPLETADO

- **Etapa 1 (diseño):** spec, maqueta navegable, 13 capturas y `/ui-check` (commits `c6f7a8c1e`, `da174a8eb`, `232fa9065`).
- **Aprobación:** spec a `approved`, §12 con el texto pedido por el DG y la 12.8 (sombra). Token nuevo
  `--shadow-sticky-top` / `--shadow-sticky-left` en `app/studio/tokens.css` (claro, oscuro e impresión),
  documentado en `BRAND.md` §Sombras y `BRAND-DECISIONS.md` BD-070 (`16f0d2b0c`). BD-070 y no BD-038: el
  registro del proyecto de marca ya usa BD-037 a BD-069.
- **Etapa 2 (pantalla), sin base de datos:**
  - Ficha: franja «solo para <persona>», `MapaAcceso` (todos los módulos con estado escrito, plegado de los que
    no se pueden dar, detalle con origen y tres opciones, «sobra», `Esc` sin cerrar la ficha),
    `CambiosPendientes` (un motivo, un guardado, una llamada por módulo, fallo a medias), aviso al cerrar o
    cambiar de pestaña con cambios sin guardar, «Todo Comercial» que llena la bandeja.
  - `RolYAlcanceCard`: «Almacén que ve» solo en roles con lado; «N personas tienen el rol… el piso»; el
    diálogo de cambio de rol lista los extras que conserva.
  - Actividad: una línea de tiempo con extras, rol, almacén (D1, `entity_audit_log` entidad `membership`) y
    suspensiones (`user_role_audit` disable/enable), filtros Todo · Rol y estado · Accesos extra. Solo lectura
    con el cliente de servicio, mismos candados que antes.
  - Matriz: contenedor con desplazamiento propio, roles/columna/grupo/leyenda fijos con las sombras del token,
    ícono + palabra (forma corta bajo 1180 px), «Cambiado», panel por celda (`PermisoCeldaPanel`) con personas
    afectadas, extras que quedan «sobra», «Volver a lo de fábrica» y «Aplicar a las N». Elegir lo de fábrica
    llama `reset` en vez de guardar un desvío igual. Mismas acciones y candados.
- **Observaciones de la revisión Opus de `ae1d1381d` (APPROVED con observaciones), commit nuevo encima:**
  1. La matriz envuelve `setRoleModuleAccessAction` / `resetRoleModuleAccessAction` en `try/catch`: si lanza,
     la celda vuelve, sale de «guardando» y avisa. Con pruebas de rechazo para las dos.
  2. Un desvío guardado igual a lo de fábrica se ve («Cambiado (igual a fábrica)»), cuenta en «Solo los
     cambiados» y se limpia con «Volver a lo de fábrica».
  3. El aviso «sobra» del panel sigue la regla de la ficha: con el rol en «Solo ver», un extra que edita no sobra.
  4. Desplazar la tabla o la página, o cambiar el tamaño de la ventana, cierra el panel y el foco vuelve a la celda.
  5. La fila de grupo se pega bajo el alto medido de la fila de roles (`--mx-head-h`, `ResizeObserver`).
  6. `UserDetailDrawer.test.tsx`: aviso de descarte al cerrar y al cambiar de pestaña. El «atrás» del navegador
     queda pendiente con su razón en spec §3.3.
  7. Spec §8: lectura de `user_role_audit` clasificada «no aplica», con razón.
  8. Spec §3.3: un sensible no pasa por la bandeja; no se alcanza sin sensibles en `COVERED`.
  - Opcional (px sueltos → `var(--s-*)`): no aplicado. Los px que quedan (6, 10, 14, 3) no están en la escala
    de 4 de `--s-*`; cambiarlos movería la maqueta aprobada.
- Corregido de paso: al cambiar el nivel de un extra con vencimiento, el código viejo cortaba el ISO en UTC y
  corría el vencimiento un día; ahora se lee en hora de Caracas (`fechaCaracas`).

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit` (proyecto completo) | PASÓ |
| `eslint` sobre los archivos tocados | PASÓ |
| Vitest dirigido: `AccesoPanel`, `MapaAcceso`, `CambiosPendientes`, `RolYAlcanceCard`, `PermissionsSection`, `actividad-acceso` | PASÓ (21 + 23 + 8 + 11 pruebas en las corridas) |
| Mutante: sin filtro de tenant en `user_role_audit` | Detectado (4 rojas); restaurado |
| Contrato CSS de bordes fijos y sombras con token | PASÓ (`PermissionsSection.test.tsx`) |
| `/ui-check` del diff | PASÓ: sin colores sueltos, sin emojis, tuteo |
| `pnpm docs:check` / `pnpm sdd:check` | PASÓ (620 specs; solo choques históricos conocidos) |
| Vitest tras la revisión: `PermissionsSection` (16) y `UserDetailDrawer` (4) | PASÓ |
| Mutantes tras la revisión: regla vieja de «sobra» y `catch` que relanza | Detectados (3 rojas); restaurado |
| Navegador con sesión real (desplazamiento de la matriz, aceptación 14) | PENDIENTE CON DUEÑO: Sam, en pantalla al publicar (aceptado por el DG) |
| `pnpm verify` y Vitest amplio | NO EJECUTADO por indicación del DG: el portón es el CI de GitHub más la revisión |

## PR / BRANCH

https://github.com/SoftAgentes/DTDCARGO/pull/588 contra `main` desde `codex/0635-acceso-por-persona`.

## PENDIENTES DE ESTA TAREA

- CI de GitHub verde sobre la cabeza nueva; fusión por el portón (la hace el DG).
- Aceptación 14 (matriz desplazada en el navegador real): pendiente con dueño, Sam, al publicar.
- «Atrás» del navegador con cambios sin guardar: pendiente con razón (spec §3.3).

## Impacto documental

- Spec 0635 aprobada; §3.1 anota que el chip usa «Ve / Edita». Allowlist ampliada con el token y su documentación.
- `BRAND.md` §Sombras y BD-070. La 0622 §5.4 queda superada en lo visual por la 0635 (anotarlo al fusionar).

## FUERA DE ALCANCE DETECTADO

- La matriz por rol no guarda historial ni motivo (etapa 3, con migración y OK propio).
- `useDialogA11y` escucha `Esc` en `document` y cierra el cajón aunque haya un detalle abierto dentro; la ficha
  lo resuelve escuchando antes en `window`. Conviene que el hook respete capas internas.
- La skill `/ui-check` dice que el Studio usa Nunito + Sora; `tokens.css` usa Archivo.

## HANDOFF AL DIRECTOR

- Sin migraciones, RPC ni RLS nuevas. «Aplicar a las N» usa `setRoleModuleAccessAction` /
  `resetRoleModuleAccessAction` con sus candados de siempre.
- Ownership: claim `local_0635-worker`; no se borró worktree ni rama.
