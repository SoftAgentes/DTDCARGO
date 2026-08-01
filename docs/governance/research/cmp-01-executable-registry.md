# Diseño del registro ejecutable CMP-01

| Control | Valor |
|---|---|
| Política | [CMP-01 v1.1](../policies/cmp-01.md) |
| Revisión | [REV-SGE-010](../reviews/cmp-01-registry-design.md) |
| Schema | [`component-registry.schema.json`](../templates/component-registry.schema.json) |
| Estado | estable para PLG-P3 |

## 1. Decisión

El repositorio conserva dos planos separados:

1. `docs/governance/policies/` contiene reglas normativas y su aprobación;
2. los futuros registros de componentes describen implementación, evidencia y
   madurez sin copiar ni modificar esas reglas.

El registro agregado será generado, nunca editado a mano. Un validador puede
rechazar inconsistencias, pero no promover un componente. Solo una revisión
humana aprobada cambia `experimental`, `proposed`, `canonical`, `deprecated` o
`retired`.

## 2. Estructura futura

```text
docs/governance/
├── components/
│   └── <component-id>.json       # registro fuente por componente
├── generated/
│   └── component-registry.json  # agregado reproducible
├── templates/
│   └── component-registry.schema.json
└── reviews/
    └── cmp-<component-id>-<gate>.md
```

Los archivos fuente son evidencia versionada, no una política paralela. Cada
referencia normativa apunta al documento aprobado y a su versión.

## 3. Schema del registro

El schema JSON adjunto exige en cada componente:

- identidad estable, propósito, owner y estado CMP;
- ruta/export de implementación;
- políticas aprobadas que implementa, por código, versión y ruta;
- contrato de API y tokens consumidos;
- evidencia de teclado, foco, lector de pantalla, contraste, movimiento,
  light/dark y breakpoints;
- ejemplos correctos e incorrectos como rutas, no blobs embebidos;
- pruebas ejecutables con ruta y caso;
- consumidores verificados;
- reemplazo y plan cuando está deprecated;
- revisión, aprobador y próxima fecha.

No admite `additionalProperties`: un campo nuevo exige versionar el schema.

## 4. Reglas de fuente

- `policyRefs` solo acepta políticas cuyo documento diga `aprobada`,
  `implementada` o `verificada`;
- una política draft/investigada puede aparecer en `recommendationRefs`, nunca
  en `policyRefs`;
- el registro no copia el texto completo de una política;
- `implementation.path` debe vivir en el repositorio y no puede apuntar a
  `docs/governance/`;
- evidencia y tests apuntan a rutas; no se incrustan capturas, secretos, PII o
  resultados externos crudos;
- `generatedAt` y `sourceCommit` pertenecen solo al agregado generado.

## 5. Validaciones deterministas futuras

| Validación | Resultado de fallo |
|---|---|
| JSON Schema y versión soportada | error |
| ID único y kebab-case | error |
| ruta/export de implementación existente | error |
| policy code/version/path coherentes | error |
| policy aprobada para `policyRefs` | error |
| test/evidencia/ejemplo inexistente | error |
| consumidor inexistente o no importador | error |
| token no canónico | error para `canonical`, warning previo |
| `canonical` sin evidencia accesible completa | error |
| `deprecated` sin reemplazo/plan | error |
| `retired` con consumidor verificado | error |
| fecha de revisión vencida | warning; error solo en gate aprobado |
| secreto, URL firmada, email o payload embebido | error |
| diferencia entre agregado generado y fuentes | error |

Las comprobaciones AST/import y tokens pueden usar scripts de baja libertad.
La calidad semántica, accesibilidad real y promoción continúan bajo revisión
humana.

## 6. Criterios de promoción

### Experimental → proposed

- problema real y owner identificados;
- búsqueda documentada de canónicos;
- API y propósito estables para un piloto;
- cero duplicación injustificada;
- test básico y un consumidor candidato;
- revisión `REV-CMP` aprobada.

### Proposed → canonical

- revisión de diseño aprobada;
- teclado, foco, lector de pantalla, contraste y movimiento reducido;
- light/dark, móvil y breakpoints verificados;
- tests unitarios y de integración aplicables;
- al menos un consumidor real verificado;
- ejemplos correcto/incorrecto;
- cero bloqueador SGE-00;
- owner y fecha de revisión futura.

### Canonical → deprecated

- reemplazo canónico o decisión de retiro;
- nuevos usos bloqueados;
- inventario de consumidores y plan por slices;
- fecha y responsable;
- compatibilidad temporal explícita.

### Deprecated → retired

- búsqueda AST/textual con cero consumidores;
- export y documentación retirados en el mismo gate;
- vínculo durable al reemplazo o motivo;
- tests y generated registry verdes;
- revisión de retiro aprobada.

Un script jamás cambia `status` como efecto lateral.

## 7. Allowlist del futuro gate de implementación

1. `docs/governance/components/<component-id>.json`
2. `docs/governance/generated/component-registry.json`
3. `scripts/build-component-registry.mjs`
4. `scripts/validate-component-registry.mjs`
5. `scripts/__tests__/component-registry.test.ts`
6. `package.json`
7. `pnpm-lock.yaml`, solo si el validador declara dependencias directas
8. `docs/governance/reviews/cmp-<component-id>-<gate>.md`
9. `docs/governance/README.md`
10. una nueva línea base

El primer gate poblará **un solo componente** existente. No cataloga en masa ni
modifica el componente. El basename concreto se define en su SDD después de
revalidar el repo.

## 8. Criterio de estabilidad para PLG-01

El registro se considera estable para implementar el plugin cuando:

- schema v1 pasa validación y tiene fixture positivo/negativo;
- un componente recorre `proposed → canonical` con revisión real;
- un caso deprecated demuestra reemplazo y consumidores;
- agregado reproducible no tiene diff;
- políticas draft no pueden elevar severidad;
- el formato no necesita campos manuales fuera del schema;
- el owner confirma alcance personal versus repo/team.

El primer gate quedó poblado con `ConfirmDialog` y revisado en
[REV-SGE-012](../reviews/cmp-confirm-dialog-canonical.md). Schema v1.1,
`SegmentedControl` canónico y el caso `LLMModeToggle` deprecated quedaron
aprobados en [REV-SGE-017](../reviews/cmp-01-v1-1-deprecated.md). El criterio
P1 está demostrado; instalar el plugin o crear marketplace sigue requiriendo
gates posteriores.
