# REV-SGE-020 · NUM-01 v1.1 y NumericInput canónico

| Control | Valor |
|---|---|
| Revisión | REV-SGE-020 |
| Fecha | 2026-07-30 |
| Aprobó | Sam (founder) |
| SDD | [SDD-0185](../../specs/0185-num-01-expresiones-decimales/spec.md) |
| Riesgo | R3 · montos y porcentajes fiscales |
| Decisión | aprobada y verificada localmente |

## Matriz

| Hallazgo | Evidencia previa | Clasificación | Resolución |
|---|---|---|---|
| `10+` emitía `null` | callback por keystroke | no conformidad | conservar último canónico y validar al confirmar |
| `0.1 + 0.2` exponía artefacto binario | `number` + `new Function` | no conformidad | enteros escalados `BigInt` |
| `1,5 + 2,5` daba `40` | normalización global | no conformidad | normalización por literal |
| `1.200,50 + 2.300,50` daba `50` | normalización global | no conformidad | grupos de miles validados por literal |
| monto de retención server-side | action recalcula | cumplimiento | conservar autoridad del servidor |
| barrido de inputs legacy | fuera del slice | no aplica | gates posteriores por riesgo |

## Diseño aprobado

El parser usa una gramática cerrada para operadores básicos y elimina
`new Function`. Las sumas, restas y multiplicaciones son exactas sobre enteros
escalados; la división conserva 30 decimales y redondea half-up. El API
histórico mantiene `{value,error}` y el componente consume un resultado
detallado con estado y decimal canónico.

`NumericInput` separa texto en edición, último valor válido y valor enviado. Un
operador final no destruye el dato anterior. El input visible usa Constraint
Validation para bloquear submit; el hidden conserva el decimal anterior hasta
que la nueva expresión sea válida. El error se muestra al confirmar y luego se
resuelve en vivo conforme a FRM-01.

## Adopción R3

`WithholdingDrawer` sustituye exclusivamente los inputs `base` y `pct`. El
preview puede operar con el resultado del componente, pero
`createWithholdingAction` continúa recalculando el monto y validando límites.
No se declara atomicidad ni autoridad financiera en el cliente.

## Criterio CMP-01

`NumericInput` puede quedar `canonical` porque:

- API y contrato están documentados por SDD-0185;
- teclado, foco, lector, contraste y validación tienen pruebas;
- Retenciones es un consumidor R3 verificado;
- los ejemplos legacy se mantienen inventariados, sin barrido;
- la siguiente revisión queda fijada para 2027-01-30.

## Evidencia final

| Gate | Resultado |
|---|---|
| Parser + componentes + slice | 62/62 pruebas |
| Suite Vitest | 4.160/4.160 pruebas, 319 archivos |
| TypeScript | verde |
| ESLint proporcional | verde, cero warnings |
| `components:check` | 4 fuentes válidas, agregado reproducible |
| `governance:check` | 27 políticas, cápsula vigente |
| `docs:check` | verde |
| Build | Next.js 16.2.6 producción, Webpack, 152 rutas |
| `git diff --check` | verde |

El build Turbopack inicial no compiló porque el `node_modules` del worktree es
un junction externo a su raíz. El build Webpack soportado por Next.js compiló,
ejecutó TypeScript y generó todas las rutas; la limitación es ambiental y no se
oculta como evidencia de producto.
