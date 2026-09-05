# Cierre worker — SDD-0373 · frontera Web Push

Fecha: 2026-09-04

Estado: **CANDIDATA INDIVIDUAL A `main`**. La implementación está publicada,
los gates deterministas, el ledger y los 18 E2E autenticados están verdes. Esta
ventana coordinadora no fusiona la PR ni despliega Producción.

## Tarea y aislamiento

- Tarea: `01a06db1-798e-73c3-bc68-9d72a6caef01` — Endurece validación Push Portal.
- Rol: worker aislado.
- Worktree: `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\push-endpoint-hardening`.
- Rama: `codex/push-endpoint-hardening-20260904`.
- Base verificada: `origin/main@2a2e81bf554dbe7bd4f05170847e8f02e988d320`.
- Commit de implementación: `ac65d8d24f0352cab336c596379e3c86df612674`.
- Base recuperada: `origin/main@b265ce2b39d03ed89f1173812203638b02280c7b`
  mediante merge no destructivo; incorpora sólo la PR #25 ya autorizada.
- PR: `https://github.com/hailuwaycom-sketch/DTDCARGO/pull/22`, abierto
  contra `main`, no draft y `mergeStateStatus=CLEAN` al cerrar.

La inspección de tareas mostró otras ventanas activas de DTDCargo en el
checkout principal, incluida una dedicada a revisar ramas del PR. Ninguna otra
tarea reportó este worktree como `cwd`; por eso no se modificó `main` ni se
intentó integrar desde esta ventana.

## Rutas propias

- `app/api/m/push/resubscribe/route.ts`
- `app/api/m/push/subscribe/route.ts`
- `app/api/portal/push/subscribe/route.ts`
- `app/api/studio/push/__tests__/subscribe-boundary.test.ts`
- `app/api/studio/push/__tests__/subscribe-identity.test.ts`
- `app/api/studio/push/subscribe/route.ts`
- `docs/audits/2026-09-04-push-local.md`
- `docs/specs/0373-push-delivery-boundary/spec.md`
- `docs/specs/README.md`
- `lib/studio/notify/__tests__/push-subscription-fixture.ts`
- `lib/studio/notify/__tests__/push-subscription.test.ts`
- `lib/studio/notify/__tests__/send-operario-push.test.ts`
- `lib/studio/notify/__tests__/send-user-push-boundary.test.ts`
- `lib/studio/notify/__tests__/send-user-push.test.ts`
- `lib/studio/notify/push-subscription.ts`
- `lib/studio/notify/send-operario-push.ts`
- `lib/studio/notify/send-user-push.ts`
- `.agents/handoffs/2026-09-04-push-endpoint-hardening-close.md`

No se tocaron lockfiles, dependencias, archivos de entorno, migraciones,
configuración de Vercel ni datos Cloud.

## Verificación

- Auditoría read-only de `/cerrar`: árbol limpio antes del handoff, upstream
  configurado y `behind=0`, `ahead=0` respecto de la rama remota.
- Suite Push enfocada: 6 archivos y 322 pruebas aprobadas.
- Evidencia de implementación ya registrada: suite Vitest completa con 501
  archivos y 6181 pruebas, TypeScript, ESLint enfocado, documentación,
  gobernanza, componentes y build con 158 páginas, todos aprobados.
- El E2E autenticado canónico enumeró 18 tests en 4 archivos y terminó **18/18**
  en `chromium`, `mobile-chrome` y `mobile-safari`, con un worker, 0 omitidos,
  0 inesperados y 0 inestables.
- Checks del PR antes del recibo final: Vercel, Vercel Agent Review y Vercel
  Preview Comments aprobados. Un nuevo push puede renovar el Preview automático;
  eso no equivale a un deploy de Producción.

## Publicación y gates externos

- Push de rama: publicado en
  `origin/codex/push-endpoint-hardening-20260904` sin force-push.
- Integración: pendiente de un integrador exclusivo; esta ventana no ejecutó
  merge, rebase, pull ni push a `main`.
- Migraciones: ninguna creada ni aplicada.
- Cloud/Supabase: sólo fixtures sintéticos en un branch efímero sin datos de
  Producción; branch eliminado y presencia posterior limitada a `main`.
- Push real: no se usaron claves VAPID, endpoints, usuarios ni notificaciones
  reales.
- Deploy: no se hizo deploy manual ni de Producción. La publicación de evidencia
  puede renovar el Preview automático de la PR; sigue siendo una superficie de
  revisión y no un despliegue a `main`.

## Limpieza y siguiente responsable

La limpieza física queda bloqueada mientras el commit no esté contenido en
`main` y el PR permanezca abierto. No se elimina el worktree ni la rama local o
remota. El siguiente responsable es la ventana integradora que revise y fusione
el PR #22; después podrá verificar ancestry y limpiar este worktree de forma
segura.

## Reapertura coordinada · 2026-09-04

La tarea coordinadora `01a06e5e-5b71-7ed2-8f9d-13cc4006d0ec` revalidó la rama
desde el mismo worktree aislado, sin usar datos de negocio ni ejecutar
mutaciones alojadas.

- `node scripts/verify.mjs` con `VERIFY_SKIP_E2E=1`: exit 0, **13 de 15** pasos
  medidos; 501 archivos/6181 pruebas Vitest, 139 contratos SQL, reconstrucción
  de 395 migraciones y build de 158 páginas, todos verdes.
- `migrations-applied`, ejecutado aparte en modo lectura contra el ledger real:
  rojo porque `0399_revoke_truncate_anon_authenticated` y
  `0400_revoke_public_verify_rpc_execute` llevan más de 24 horas aplicadas sin
  archivo en `origin/main`; `0445_portal_profile_edit_limit` aparece amarilla,
  todavía dentro de la ventana de 24 horas. Ninguna pertenece a SDD-0373 y esta
  rama no las absorbe.
- E2E: no medido. No existen las siete variables del entorno efímero exigido
  por `docs/runbooks/e2e-supabase-efimero.md`; las credenciales disponibles
  corresponden a Producción y no se reutilizan para pruebas.
- GitHub al revalidar: PR abierta, `MERGEABLE/CLEAN`; Vercel, Agent Review y
  Preview Comments verdes en `240b144b`.

Los tres gates de reapertura quedaron cerrados por la coordinadora: la PR #25
recuperó en `main` los archivos 0399, 0400 y 0445; `migrations-applied` quedó
verde; y el selector E2E autenticado aprobó 18/18 en un branch efímero que fue
destruido. La SDD queda en `done` y #22 puede presentarse como candidata
individual. El merge de #22 continúa pendiente de autorización separada.

### Revalidación posterior a PR #25

La PR #25 se integró en `main` mediante el commit
`b265ce2b39d03ed89f1173812203638b02280c7b`. Después de actualizar
`origin/main`, `node scripts/check-migrations-applied.mjs` terminó con exit 0:
398 archivos, 408 entradas de ledger, sólo la migración histórica `0017` como
pendiente conocida y **ninguna migración nueva sin aplicar**. El gate
`migrations-applied` de esta candidata queda verde; no se ejecutó ninguna
escritura en Supabase.

El commit `c1e44555` de SDD-0373 en la PR #21 es una implementación duplicada:
si #22 se integra, ese slice no debe volver a entrar desde #21.
