# Cierre local · SDD-0326 secreto Telegram fuera de la URL

Fecha: 2026-09-02

Rol: worker
Estado: LISTO EN GIT · NO INTEGRAR NI DESPLEGAR ANTES DEL PREFLIGHT ALOJADO

## Identidad Git

- Repositorio: `https://github.com/hailuwaycom-sketch/DTDCARGO.git`.
- Worktree: `C:\\Users\\Trabajo\\Desktop\\Developer\\software\\DTD-worktrees\\codex-saneamiento-integral`.
- Rama: `codex/saneamiento-integral`.
- Base auditada: `origin/main@2a2e81bf554dbe7bd4f05170847e8f02e988d320`.
- Padre del lote: `04f8ef94a333c1f815999d732eb035ad7af34ce1`.
- Commit previsto: `fix(telegram): SDD-0326 — preparar secreto fuera de URL`.

## Cierre local

- `TELEGRAM_WEBHOOK_SECRET` autentica exclusivamente
  `X-Telegram-Bot-Api-Secret-Token` y valida el contrato oficial de 1–256
  caracteres alfanuméricos, `_` o `-`.
- Un header incorrecto no degrada al query; el secreto primario por `?secret=`
  se rechaza.
- La compatibilidad con la URL vieja exige el secreto separado y temporal
  `TELEGRAM_WEBHOOK_LEGACY_QUERY_SECRET`.
- Ausencia o formato inválido del primario falla cerrado con 503 y mensaje
  genérico. La autenticación ocurre antes del JSON y de cualquier acceso a DB.
- El healthcheck marca error si Telegram todavía reporta `?secret=` o si la
  variable legacy permanece configurada; nunca refleja el valor del secreto.
- El runbook fue reescrito para PowerShell, tuteo, rotación sin exponer valores,
  smoke y retiro final del legacy.

Fuente contrastada el 2026-09-02:
`https://core.telegram.org/bots/api#setwebhook`.

## Allowlist exacta

- `app/api/telegram/webhook/route.ts`
- `app/api/telegram/webhook/route.test.ts`
- `lib/studio/integration-health.ts`
- `lib/studio/__tests__/integration-health.test.ts`
- `.env.example`
- `docs/runbooks/setup-telegram-bot.md`
- `docs/specs/0326-telegram-secret-header/spec.md`
- `docs/specs/README.md`
- `.agents/handoffs/2026-09-02-telegram-secret-header-close.md`

## Verificación

- Contratos focales: 19/19 pasaron.
- ESLint focal, TypeScript, docs, componentes, gobernanza y `git diff --check`:
  OK.
- `node scripts/verify.mjs`: exit 0; 14 de 15 gates realmente medidos, ninguno
  falló.
- Vitest: 509 archivos / 5.938 pruebas pasaron.
- Documentación y numeración: 318 specs, 396 migraciones, OK.
- SQL: 140 contratos, rollback total.
- Rebuild: 396 migraciones; 378 aplicadas desde cero y 18 sólo-ledger;
  aislamiento verificado en 219 tablas y 2 tenants.
- E2E: 150 pasaron, 18 se omitieron y cero fallaron. Dos workers WebKit no
  cerraron dentro de 300 s en Windows; el watchdog los terminó y el verificador
  lo clasificó como aviso conocido.
- Build de producción: OK; 158 páginas estáticas generadas.
- `migrations-applied`: NO MEDIDO por ausencia deliberada de credenciales.

## Stop condition alojada

El estado del SDD permanece `in-progress`. Antes de integrar/desplegar, el
founder debe autorizar específicamente este corte y se debe seguir, en orden,
`docs/runbooks/setup-telegram-bot.md`:

1. guardar el secreto actual en
   `TELEGRAM_WEBHOOK_LEGACY_QUERY_SECRET` de Producción;
2. desplegar la compatibilidad;
3. rotar `TELEGRAM_WEBHOOK_SECRET` y desplegar;
4. ejecutar `setWebhook` con URL limpia y `secret_token`;
5. validar `getWebhookInfo` y `/start` sin perder updates;
6. retirar el secreto legacy, desplegar y repetir el smoke.

No se ejecutó ninguna de esas escrituras. Tampoco se hizo push, integración a
`main`, deploy, cambio de secretos, migración ni escritura en Cloud/Producción.

Autorización literal pendiente para publicar sólo la rama:
`Autorizo git push -u origin codex/saneamiento-integral al remoto https://github.com/hailuwaycom-sketch/DTDCARGO.git`

Este worktree no se puede retirar hasta publicar o integrar la rama y demostrar
la contención de todos sus commits. Las ramas archive con historia única se
mantienen preservadas.
