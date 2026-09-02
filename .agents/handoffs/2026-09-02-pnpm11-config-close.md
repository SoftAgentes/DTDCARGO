# Cierre local · configuración pnpm 11 y rama archivo

Fecha: 2026-09-02
Rama: `codex/saneamiento-integral`

## Resultado

- Se retiró `pnpm.onlyBuiltDependencies` de `package.json`. pnpm 11 lo ignoraba
  y emitía una advertencia en cada comando.
- La política vigente ya vive en `pnpm-workspace.yaml` mediante `allowBuilds`,
  que es la ubicación documentada por pnpm 11/12.
- Se corrigió la referencia desactualizada en
  `docs/architecture/stack-tecnico.md`.
- No se modificó `pnpm-lock.yaml` ni se instalaron dependencias.

## Auditoría de `codex/archive-primary-pnpm-20260902`

El commit archivado `d390092f` no es apto para cherry-pick:

- contiene la misma migración conceptual a `allowBuilds` que ya está en la
  rama saneada;
- su `pnpm-workspace.yaml` tiene menos overrides que el actual;
- su lockfile retrocede versiones y elimina overrides incorporados después,
  incluidos `@babel/core`, Hono, Browserslist, PostCSS y Undici.

Por tanto, su intención válida quedó contenida por una configuración más nueva.
La rama archivo debe conservarse hasta publicar la rama saneada; después puede
retirarse al comprobar de nuevo la contención y el remoto.

## Evidencia ejecutada

- `JSON.parse(package.json)`: OK.
- `pnpm --version`: `11.1.2`, sin la advertencia de `pnpm` en el manifest.
- `pnpm config get allowBuilds`: cuatro aprobaciones efectivas:
  `better-sqlite3`, `esbuild`, `sharp`, `unrs-resolver`.
- `docs:check`, ESLint focal y `git diff --check`: OK.
- El gate integral inmediatamente anterior cerró 14/15 pasos sin fallos; el
  único no medido fue `migrations-applied` por ausencia de credenciales Cloud.

## Límites conservados

- Sin push, integración, instalación, migraciones, Cloud, Vercel o Producción.
- No se borró todavía ninguna rama archivo.
