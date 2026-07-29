# Validación de dependencias del registro CMP-01

| Control | Valor |
|---|---|
| Revisión | REV-SGE-015 |
| Fecha | 2026-07-29 |
| Alcance | dependencias ejecutables del registro CMP-01 |
| Resultado | contrato correcto; entorno local resincronizado y validado |
| Aprobación | 2026-07-29 · Sam (founder) |

## Diagnóstico

`component-registry.test.ts` no resolvía `ajv/dist/2020.js` desde el junction
compartido de `node_modules`. El repositorio ya declaraba y bloqueaba:

- `ajv@8.20.0`;
- `ajv-formats@3.0.1`;
- peer efectivo `ajv-formats@3.0.1(ajv@8.20.0)`.

Por tanto, no faltaba una dependencia normativa ni un cambio de lockfile. El
checkout principal que abastecía el junction tenía una instalación anterior al
registro CMP-01.

Una vez resuelta la dependencia, el validador expuso un drift normativo:
`ConfirmDialog` todavía referenciaba BTN-01 v1.0 después de que REV-SGE-014
aprobó v1.1. El gate actualiza únicamente esa referencia y regenera el agregado;
el componente permanece `canonical` y el schema sigue en v1.0.

## Corrección operativa

La instalación compartida apuntada por el junction fue resincronizada desde el
worktree con el lockfile vigente:

```text
pnpm install --frozen-lockfile
```

La instalación no cambia `package.json` ni `pnpm-lock.yaml`. El gate exige:

1. resolver `ajv/dist/2020.js` y `ajv-formats`;
2. pasar `component-registry.test.ts`;
3. pasar `components:check`;
4. confirmar BTN-01 v1.1 en la fuente y el agregado;
5. mantener limpio el diff de dependencias.

## Límite

REV-SGE-015 valida exclusivamente disponibilidad ejecutable. No cambia el
schema CMP-01, no crea un caso `deprecated`, no abre PLG-P3 y no crea plugin,
MCP, app o marketplace.
