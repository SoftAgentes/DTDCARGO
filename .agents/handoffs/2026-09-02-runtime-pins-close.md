# Cierre local · runtime y snapshot técnico

Fecha: 2026-09-02
Rama: `codex/saneamiento-integral`

## Resultado

- `package.json` declara `packageManager: pnpm@11.19.0`.
- `engines` acepta únicamente Node 24 y pnpm 11.
- El snapshot técnico dejó de presentarse como un monorepo y refleja las
  versiones, dependencias, pruebas y migraciones medidas en el checkout actual.
- Se retiraron del documento Payload, GraphQL y `to-ico`, ausentes del manifest
  y del código vigente.

## Criterio

Node se fija por línea LTS (`>=24 <25`) para no bloquear parches de seguridad.
pnpm se fija de forma exacta porque `packageManager` identifica la herramienta
que debe reproducir el lockfile; `engines.pnpm` impide otra línea mayor.

Fuentes consultadas el 2026-09-02:

- <https://pnpm.io/package_json>
- <https://nodejs.org/en/about/previous-releases>

## Archivos

- `package.json`
- `docs/architecture/stack-tecnico.md`
- `.agents/handoffs/2026-09-02-runtime-pins-close.md`

## Gates

- `pnpm install --frozen-lockfile`: verde con pnpm 11.19.0; 949 entradas
  pasaron las políticas de supply chain y no hubo resolución nueva.
- `pnpm docs:check`: verde.
- `pnpm-lock.yaml`: sin cambios.
- No modifica dependencias ni toca Cloud, datos, despliegues o Producción.
