# Estabilidad bajo carga del guardia de servicios públicos

| Control | Valor |
|---|---|
| Revisión | REV-SGE-016 |
| Fecha | 2026-07-29 |
| Alcance | guardia anti-regresión de SDD-0164 |
| Resultado | timeout reproducido, causa aislada y escáner endurecido |
| Aprobación | 2026-07-29 · Sam (founder) |

## Evidencia de falla

La suite completa reprodujo el defecto sin modificar código:

```text
Test Files  1 failed | 301 passed (302)
Tests       1 failed | 4085 passed (4086)
shipment-public.test.ts  5255 ms
Error: Test timed out in 5000ms
```

El mismo archivo pasó cinco veces aislado. El guardia consumió entre 592 ms y
704 ms de ejecución interna. La diferencia se explica por contención de disco:
el caso recorría sincrónicamente todo el worktree y abría cada `.ts` y `.tsx`
mientras la suite ejecutaba cientos de archivos en paralelo.

## Corrección

El contrato de SDD-0164 no se debilita. El guardia continúa detectando los
literales históricos entrecomillados en cualquier `.ts` o `.tsx`, pero separa:

1. archivos versionados o modificados, buscados por `git grep`;
2. archivos no versionados y no ignorados, enumerados por `git ls-files` y
   revisados directamente.

El propio test queda excluido porque contiene los literales como casos de
rechazo. Los valores usados por el patrón se construyen por partes para evitar
una auto-coincidencia accidental.

No se aumenta el timeout global ni el timeout del caso. El límite estándar de
cinco segundos sigue detectando una regresión futura de rendimiento.

## Criterios de cierre

- reproducir el timeout original bajo carga;
- conservar las 10 aserciones funcionales del archivo;
- demostrar el guardia dentro de la suite completa sin timeout;
- ejecutar el archivo repetidamente para detectar inestabilidad;
- pasar typecheck, lint proporcional, `docs:check` y `git diff --check`;
- mantener `package.json` y `pnpm-lock.yaml` sin cambios.

## Límites

REV-SGE-016 no modifica producto, servicios, etiquetas ni el contrato público.
No abre CMP-01 v1.1, el caso `deprecated`, D1, D2–D5 o PLG-P3. Tampoco autoriza
Cloud, Vercel, migraciones o limpieza de worktrees.
