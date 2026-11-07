# SDD-0590 · Los tres hallazgos de la corrida real de E5 (handoff de Worker)

- **Owner:** Worker de Claude Code, sesión `95191146-c154-4468-af0e-d46ad5a1e391`, lanzada por el Subdirector de Chatwoot (`local_535053f4-40c2-4124-a280-63f4fc882820`).
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\jolly-lumiere-3a11de`.
- **Rama:** `claude/jolly-lumiere-3a11de`, desde `main` en `ecadbac91`.
- **SDD:** [0590](../../docs/specs/0590-kommo-historial-e5/spec.md), §10.16 «Hallazgos para una PR aparte» y §10.17, que trae el diseño, la allowlist y la evidencia de esta PR.
- **Objetivo:** que el próximo ensayo o carga se lea bien. No cambia lo cargado el 2026-11-07 ni toca producción.

## Alcance

1. `ensayo-archivo.sh`: con TERM sale con 143 y lo dice en la evidencia; la limpieza deja 0 contenedores, volúmenes y redes, y si no puede, lo dice y no sale con 0.
2. `pruebas/sonda-ensayo.rb`: la búsqueda por número (E10d, E10e, E10g) se mide sobre la consulta entera, y BQ1 elige el primer mensaje con una palabra apta.
3. `informe` antes de `empaquetar`, en el README y en el handoff `0590-e5-estado.md`; `empaquetar` se niega sin `informe.json`.

## Permisos y límites

- PR nueva desde `main`, en borrador. No se fusiona: lo hace el Director General.
- Nada en producción ni en el VPS. Las pruebas con contenedores corren en GitHub Actions, no en la PC.
- Solo datos inventados.

## Estado

En curso. El cierre, con la validación, los commits y la PR, se completa al terminar.
