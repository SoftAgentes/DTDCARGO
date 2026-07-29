# Decisión de destino para PLG-01

| Control | Valor |
|---|---|
| Revisión | REV-SGE-013 |
| Política | [PLG-01 v1.0](../policies/plg-01.md) |
| SDD | [SDD-0178](../../specs/0178-plugin-gobernanza-erp-studio/spec.md) |
| Fecha | 2026-07-29 |
| Resultado | destino repo/team aprobado |

## Decisión

El futuro plugin `erp-studio-governance` será **repo/team**, no personal.

Rutas futuras:

```text
<repo-root>/.agents/plugins/marketplace.json
<repo-root>/.agents/plugins/plugins/erp-studio-governance/
```

El `source.path` futuro será `./plugins/erp-studio-governance`, relativo al
directorio del marketplace. La ruta exacta sigue el contrato validado de
`plugin-creator`; no se sustituye por una ruta absoluta o una copia personal.

## Razones

1. la fuente normativa es `docs/governance/` dentro de DTDCargo;
2. el plugin debe registrar `sourceCommit` y viajar con la revisión del equipo;
3. un destino personal puede quedar desfasado o actuar fuera del repositorio;
4. repo/team permite revisar scaffold, marketplace e instalación como cambios
   selectivos y reproducibles;
5. no existe capacidad genérica que justifique instalarlo globalmente.

## Gates

- P2 queda decidido;
- P1 continúa cerrado: falta el caso CMP `deprecated` y la siguiente versión
  del schema;
- P3 requiere autorización explícita de scaffold;
- crear el marketplace conserva un gate propio;
- instalarlo exige otro gate y un nuevo task/thread para cargar capacidades;
- MCP, app, hooks, CI y marketplace remoto siguen fuera de alcance.

## Evidencia negativa

No se creó:

- `.agents/plugins/marketplace.json`;
- carpeta o manifest de plugin;
- skill, hook, script o asset del plugin;
- instalación local/personal;
- entrada de marketplace;
- MCP, app, Cloud o Vercel.

REV-SGE-013 aprueba únicamente la ubicación futura.
