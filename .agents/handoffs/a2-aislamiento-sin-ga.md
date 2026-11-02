# Handoff A2 — aislamiento exige 0 GA/Ads en `.next/static`

Rama: `claude/a2-aislamiento-sin-ga-d5dbcb` · PR en borrador contra `main` (sin mergear).

## Qué cambió

- `infra/ops/staging/verificar-aislamiento.sh`:
  - GA (`G-25CD7BZH98`) y Ads (`AW-561290482`) deciden **solo** con `/app/.next/static`. Lo que aparezca fuera de static (servidor, `.map`) es AVISO informativo, no falla.
  - Por defecto `s_ga + s_ads > 0` ⇒ **FALLÓ**. Modo explícito para tolerarlo: `--tolerar-ga` (AVISO).
  - `--exigir-sin-ga` se conserva como alias sin efecto (ya es el valor por defecto), para no romper el runbook, el workflow ni handoffs que lo citan.
  - Si el contenedor no devuelve las cuentas de static, se decide con todo `.next` (más estricto, nunca más laxo), como antes.
  - Salida sin valores: solo conteos; los IDs no se imprimen (hay un caso de prueba).
- `infra/ops/web/smoke-web.sh`: revisado, **sin cambios**. `--sin-ga` (líneas 126-133) exige que ni la portada ni sus chunks traigan GA/Ads; coherente con el nuevo default.
- `infra/ops/tests/prueba-scripts-entorno-prueba.sh`: el doble de bundle por defecto pasa a «GA solo fuera de static»; casos nuevos: GA en static ⇒ FALLÓ, Ads en static ⇒ FALLÓ, GA solo en servidor/.map ⇒ PASÓ con aviso, sin cuentas de static ⇒ FALLÓ, `--tolerar-ga` ⇒ AVISO, alias ⇒ FALLÓ, sin IDs en la salida.
- Control rojo: con `VA_ANTERIOR=<ruta al script de HEAD previo>` la prueba comprueba que la versión anterior deja pasar GA en static (rc=0). Se corrió manualmente contra `git show <base>:infra/ops/staging/verificar-aislamiento.sh`.

## Documentación (ampliada por el Director General)

Hecho en esta misma PR, solo esas líneas: `docs/runbooks/entorno-prueba.md` (línea 24 y ~180) y el mensaje de `.github/workflows/build-image-prueba.yml` (~170). A4 cerró la #355 sin incluirlos.

## Pruebas

- `bash infra/ops/tests/prueba-scripts-entorno-prueba.sh` suelta: PASÓ (84 PASÓ · 0 FALLÓ · 3 NO VERIFICADO, rc=0). Con `VA_ANTERIOR` apuntando al script previo: 85 PASÓ, incluido el control rojo (la versión anterior deja pasar GA en static, rc=0).
- `prueba-aplicar-migracion.sh` y `prueba-smoke-web-credenciales.sh` sueltas: rc=0 (36 PASÓ; 15 PASÓ · 1 NO VERIFICADO).
- `vitest run scripts/__tests__/entorno-prueba`: 37 de 38 pasan; falla «las pruebas con dobles salen con 0 FALLÓ» (`expected 3840 to be 0`, un código de salida de bash, sin líneas `FALLÓ`), reproducido 2 veces. Ese test corre las tres pruebas anteriores **en paralelo**; sueltas dan rc=0. **NO CONCLUYENTE**: no se comprobó si ocurre también en `main` ni cuál de las tres sale con 3840; el Director pidió no seguir con corridas pesadas (RAM < 2 GB). Pendiente: repetir con una corrida a la vez / PC libre.
- NO EJECUTADO: `pnpm verify`, build, suites Docker.
- No aplican pruebas de producto (`pnpm verify`, build): el cambio es solo de scripts de ops; no se tocó código de la app.
- No se tocó el VPS ni se ejecutó nada contra él.

## FUERA DE ALCANCE DETECTADO

- `build-image-prueba.yml` y el runbook mencionan `--exigir-sin-ga` (ver arriba).
- `dobles-prueba.sh` mantiene como default `3 0 0 2 1 1 1 2 1` (GA en static); la prueba lo sobreescribe con `export DOBLE_BUNDLE`. Conviene alinear el default del doble en una tarea aparte.

## Checklist

Listo: script, pruebas, control rojo, handoff.
Pendiente: repetir vitest «dobles» una prueba a la vez y contra `main` (turno del Subdirector), revisión del Director, decisión de merge.
