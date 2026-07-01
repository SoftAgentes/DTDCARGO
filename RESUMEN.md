# RESUMEN · Portal → Norte · login + polish (Modo Forja)

**Rama:** `feat/portal-login-norte` · **Worktree:** `DTD-worktrees/portal-login`
**Commits (2, sobre `main`):** `8b07e82b` login · `a9db0df7` polish
**Estado:** ✅ typecheck + build verdes · **fast-forward limpio sobre main** (0 divergencia) · **sin push**
**Migraciones:** ninguna.

## Qué hace
Rediseña `app/portal/(auth)/login/LoginForm.tsx` al **hero de dos paneles del Norte**
(`_norte/portal/app.jsx` · `PortalLogin`): izquierda branding sobre navy ("Tus envíos
desde China, en un click." + stats 99.4%/8.2K/38d + patrón de círculos + footer),
derecha card blanca con el form magic-link. CTA "¿No tienes cuenta? Regístrate".

- **Toda la lógica preservada:** `useActionState`/`requestMagicLink`, estado `sent`
  (`MagicSent`), `notice`, `error`, `authedNotBound` (sign-out), `prefillEmail`.
- **Tema:** la ruta `(auth)` NO está bajo `[data-portal-theme]` → navy fijo, `text-white`
  estable (no aplica el gotcha de oscuro). Gradiente navy sancionado por el brand para el
  login hero; fuera de él, solo tokens `var(--*)`.
- **Input outlined** (borde 1.5px → wine en focus) por fidelidad al Norte.
- **Revisado por `ui-ux-designer`:** alta fidelidad, sin AI slop, nada bloqueante.

## Polish Norte (commit `a9db0df7`)
- **Referidos · "Tu nivel"**: icono star en cuadro wine-tint junto al nivel (Norte
  `PortalReferidos` L1813). Nuevo `StarIcon` en `components/Icon.tsx` (patrón del set).
- **Mensajes · "Otros canales"**: card con correo + teléfono fijo bajo el asesor
  (Norte `PortalSupport` "OTROS CANALES"), datos desde `CONTACT.ve`.
- Solo tokens `var(--*)`; tinte con `color-mix` (estable en oscuro).

## Verificación
```
tsc --noEmit        → EXIT 0
next build          → Compiled successfully, EXIT 0 (/portal/login · /portal/referidos · /portal/mensajes ƒ)
```
(No corrí los 3021 tests: ningún test toca LoginForm y ya pasaron sobre esta base al
integrar `feat/portal-hacia-norte`. Si querés el gate completo, `node scripts/verify.mjs`.)

## Nota de coordinación
Los commits previos de esta sesión (tema oscuro tokens `6cfbe3c2` + copy/tuteo `a8249fd1`)
YA los integraste vos en `main` (`75216bd1`). Este branch trae SOLO el login, que había
quedado sin commitear cuando limpiaste el worktree anterior — por eso lo rehíce acá.

## Para el Director
- Integrar: `git merge feat/portal-login-norte` → verify/build → push con OK.
