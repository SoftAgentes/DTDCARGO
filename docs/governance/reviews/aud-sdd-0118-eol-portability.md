# Revisión de portabilidad EOL del gate SDD-0118

| Control | Valor |
|---|---|
| Revisión | REV-AUD-030 |
| Fecha | 2026-07-29 |
| Alcance | test determinista del generador SDD-0118 |
| Resultado | aprobado e implementado localmente |
| Aprobación | 2026-07-29 · Sam (founder) |

## Problema

El generador SDD-0118 ya normalizaba CRLF a LF durante `--check`, pero su test
unitario comparaba los archivos leídos del checkout Windows de forma byte a
byte contra strings LF. Seis asserts fallaban aunque el SQL normalizado fuera
idéntico.

No existía drift de payload, digest, migración ni prueba transaccional.

## Corrección

El test usa un único helper `readNormalized()` que transforma únicamente
`\r\n` a `\n` antes de comparar. No altera espacios, contenido SQL, digests,
orden, tags dollar-quoted ni comportamiento del generador.

La corrección es deliberadamente test-only. No se reescriben migraciones ni se
acepta una diferencia semántica bajo la etiqueta de formato.

## Aceptación

- los 12 casos SDD-0118 pasan en Windows;
- `node scripts/build-sdd-0118-repair.mjs --check` continúa fail-closed;
- los artefactos 0271–0276 no cambian;
- `git diff --check` permanece verde.

## Límite

REV-AUD-030 no autoriza aplicar migraciones, modificar Cloud, reconstruir
payloads históricos ni abrir otro replay efímero.
