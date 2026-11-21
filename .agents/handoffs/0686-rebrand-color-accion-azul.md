# Handoff — SDD-0686 · Color de acción azul en web, Portal y ERP

- Fecha: 2026-11-20
- Owner: Worker «Rebrand Design» (Claude Code), bajo el Director General
- Worktree: `.claude/worktrees/rebrand-design-aa6ba9`
- Rama: `claude/sdd-0686-color-accion-azul` (parte de `claude/rebrand-design-aa6ba9` más `origin/main` `2ea18799a`)
- SDD: `docs/specs/0686-rebrand-color-accion-azul/spec.md`, estado `in-progress`. Reserva del Director: `codex/sdd-reserve-0686` (`c20842933`).
- Aprobación: Sam, 2026-11-20, a «¿Apruebas la spec de la SDD-0686 para empezar con las fases 0 y 1?»: «Sí, empieza». Cubre implementar las fases 0 y 1; no cubre fusionar ni publicar.
- Estado de tarea: **fases 0 y 1 escritas y guardadas en commits locales; la fase 1 no se ha ejecutado** (vitest y verify esperan el turno de PC). Sin push, sin PR.
- Permisos: commits locales selectivos. Push y PR, con orden del Director. Sin merge, sin producción, sin base de datos.

## OBJETIVO ORIGINAL

Sam decidió el 2026-11-20 pasar el color de acción del vino al azul en web, Portal y ERP, porque el vino se lee como negativo o «borrar». Citas literales en la spec, §1.

## COMPLETADO

- Rama propia creada desde la de análisis y puesta al día con `origin/main` (merge limpio, 49 commits).
- Spec real con BD-076 (número del Director General) y la condición de publicación entre las fases 1 y 2 (§8.1).
- **Fase 0 (documentos):**
  - `docs/design/studio/_norte/BRAND-DECISIONS.md`: entrada BD-076, enmienda de color en BD-037, cierre previsto de EXC-0654-01 y filas del índice.
  - `BRAND.md`: fila «Acción» separada de «Marca»; sección «Azul de acción, rojo de peligro, vino de identidad»; tokens de acción en claro y oscuro; vino como identidad; el azul de acción no es alerta; par de relleno del botón principal; `--wine-text` reservado a identidad; badge `wine` en revisión; cierre previsto de EXC-0654-01.
  - VIS-01 v1.1 (§3 roles, distancia de tono acción/peligro ≥ 90°, nota de adopción) y BTN-01 v1.2 (§2), con sus filas en `docs/governance/README.md` y la cápsula regenerada.
  - Nota de enmienda local al tope de §Sistema de color del Norte (`_norte/CLAUDE.md`), como en SDD-0441.
  - `app/studio/CLAUDE.md`: `primary` en azul de acción, regla para código nuevo y badge `wine` en revisión.
- **Fase 1 (código, sin ejecutar):** seis tokens `--accion*` en claro, oscuro e impresión (`app/studio/tokens.css`); foco global en `--accion`; en `studio.css` el vino pasa de 74 a 24 líneas de declaración (reparto y motivos en la spec, «Fase 1 · reparto aplicado»); alias `--studio-wine` y `--studio-wine-deep` retirados; `claridad-controles-contract.test.ts` mide `--on-accion` sobre `--accion`; contrato nuevo `color-accion-contract.test.ts`. Los contrastes que exige el contrato los calculé con node sobre los valores reales: todos pasan (el más bajo, 4,88:1, es el texto de acción sobre su tinte en oscuro).
- **Observaciones de la revisión de la PR #715**, traídas aquí por orden del Director: handoff de análisis cerrado con su PR, borrador enlazado a las tres specs y «acciones sobre varias filas» en lugar de «acciones por lote».

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `docs:check` (con `node scripts/build-docs-index.mjs --check`) | **PASÓ** |
| `sdd:check` (con `node scripts/check-numbering.mjs`) | **PASÓ** |
| `governance:check` (con `node scripts/build-governance-capsule.mjs --check`) | **PASÓ** (29 políticas), tras regenerar la cápsula |
| Pruebas que lean el texto cambiado | Ninguna lee `BRAND.md`, BTN-01, VIS-01 ni las guías: búsqueda en `*.test.*` y `scripts/` |
| `verify`, vitest, build | **NO EJECUTADO**: falta el turno de PC del Director. Lo primero será el vitest de `app/studio/_components/__tests__/` (contratos de color, claridad, tema oscuro, apariencia, pestañas y avisos) y después `verify` |
| Imagen de prueba y recorrido visual | **NO EJECUTADO** |

## PENDIENTE DE ESTA TAREA

Estado del 2026-11-20, tarde:
- Sam cerró todas las decisiones de §10: tono B, BD-076 reglas 6 a 9 (Shipping Mark, badge `wine`, correos/PDF/Chatwoot y logo) y el dashboard en tinta.
- Fase 2, grupos 1 y 2, en la rama local `claude/sdd-0686-fase2-g1` (`e1864b03e` y `ad71ada61`), apilada sobre la PR #722.
- Se pidió turno de PC al Director para vitest; sin respuesta.

1. **Vitest con turno (2026-11-20, rama de la fase 2, `fd14803a4`), todo PASÓ:**
   - contratos `app/studio/_components/__tests__/`: 361/361;
   - módulos: tracking 128/128, embarques 201/201, facturacion 107/107, crm 247/247, cn 95/95, clientes 235/235, cobranzas 33/33 y dashboard 24/24;
   - marco, primitivas y los 13 módulos de un badge: 470/470.

   En la #722 (`d32d6d3e9`), los contratos dieron 355/355. NO EJECUTADO: `tsc` del proyecto, lint, build, e2e y el recorrido visual. Las correcciones de la revisión de la #736 (catálogo del dashboard) se prueban de nuevo con turno.
2. PR #736 abierta en borrador, apilada sobre la #722, que quedó APPROVED en `d32d6d3e9`. La #736 recibió CHANGES_REQUESTED sobre `fd14803a4` por el catálogo del dashboard, ya corregido. Entra a `main` junto con la #722 (§8.1).
3. ~~Grupo 3~~ Hecho el 2026-11-21 en la rama `claude/sdd-0686-fase2-g3` (desde `origin/main` `72d7f04ec`; la #722 y la #736 ya están en `main`): 27 tonos `"wine"` de `lib/studio` y 69 archivos en línea de admin, marketing, academia, mailing, inspecciones, usuarios, bitácora y `_components/` fuera de `ui`. Allowlist y reparto en la spec, §5 «Fase 2 · grupo 3». Contrato `color-accion-fase2-g3-contract.test.ts`. Fusionado en `main` con la #739 (`f569411d6`), tras dos rondas de revisión (contraste del resumen navy, vino por clase y token web, noticias-web en bloque claro).
4. Grupo 4 (dinero), 2026-11-21, rama `claude/sdd-0686-fase2-g4` desde `f569411d6`: 49 archivos de contabilidad, financiero-china, seniat, fiscal, cotizador, nómina, proveedores, tesorería y gastos. Tabla de estados de dinero en la spec, §5 «Fase 2 · grupo 4». Contrato `color-accion-fase2-g4-contract.test.ts` y detector común `vino-detector.ts`. Fusionado con la #740 (`cae9687e2`).
5. Grupo 5 (operación de la oficina), 2026-11-21, rama `claude/sdd-0686-fase2-g5`: despacho, calendario, tms, operarios, etiquetas, cola-qr, tarifas y reclamos, sin vino. Feriado de China a atención. Orden de los grupos 6 a 8 en la spec. Pendiente: tintes `--cal-cn-*` de `tokens.css`. Fusionado con la #741 (`d81f7c504`).
6. Grupo 6 (reportes y dirección), 2026-11-21, rama `claude/sdd-0686-fase2-g6`: reportes, dirección, bugs, mis-bugs, costing, legal y ve. Margen negativo a peligro; «en ventana» a atención; gráficas en tinta. Queda el encabezado impreso del constructor de reportes (identidad). Fusionado con la #742.
7. Grupo 7 (naviera, fidelización y órdenes), 2026-11-21, rama `claude/sdd-0686-fase2-g7` desde `main` con la #742. Abarca naviera, fidelización, documentos, órdenes de compra, órdenes de venta, club e inventario, sin vino.
   - Sobrecapacidad del contenedor a peligro; carga suelta pendiente a atención.
   - `carriers.tone` cae a neutral al leerlo (`carrierTone`, con su prueba), sin tocar la base.
   - Arrastres de la #742: donut en grados de 82 %, 66 % y 50 % con trazo, y sin el `--wine` muerto en las impresas de legal. Fusionado con la #744 (`af943ed7c`).
8. Grupo 8 y cierre de la fase 2, 2026-11-21, rama `claude/sdd-0686-fase2-g8`: conversaciones, menciones, rendiciones, servicios, ajustes, el panel de Chatwoot, los restos de cobranzas y embarques, y los comentarios compartidos, sin vino.
   - El contrato del grupo 8 recorre todo `app/studio` y solo admite la lista de identidad y primitivas, con su cuenta exacta.
   - Los impresos fiscales y el del constructor anclan `--wine-text` al valor claro.
   - `Avatar` pasa a neutral por decisión de Sam (2026-11-21): sin tono `wine`, con `neutral` por defecto y las iniciales en `--ink`.
   - Ronda de la revisión de la #745:
     - contador de la barra superior en tinta, chip de @mención en acción y destello de permiso en éxito;
     - `studio.css` congelado en el contrato de cierre (18, por regla);
     - el detector ve `eyebrow-wine` y `data-tono="vino"`;
     - Menciones sin leer en `--ink`.
   - ~~Pendientes para la fase 3~~ Sam decidió las tres familias el mismo día («Apruebo las tres»). Van en `claude/sdd-0686-pendientes-studio-css`, apilada sobre la #745: Tracking en tinta y acción, «Todo» en tinta sólida, «Cambiado» en acción y la alerta de proveedores como pastilla ámbar con icono. `studio.css` queda con 1 uso (el alias del eyebrow).
9. Revisión visual de `main` (`d590ea3f3`), 2026-11-21, rama `claude/sdd-0686-revision-visual`:
   - login con navy fijo y enlaces en `--accion-soft`;
   - brillo de fondo azul tenue;
   - `EmptyState` con el patrón de eyebrow;
   - roles en neutro;
   - leyenda de la gráfica y columnas de clientes;
   - «Módulo desactivado» y el selector CN/ES en `--ink-soft`;
   - 44 títulos sin sufijo doble;
   - margen para el botón flotante.

   La banda de bienvenida pasa a navy de marca por decisión de Sam (opción A). El logo de la barra lo decidió Sam el 2026-11-21 («hoy»): identidad aceptada, `BrandMark` no se toca. Las cifras KPI se decidieron después (ver 10). Pendiente: 115 usos de `--ink-mute` como texto.
10. Cifras KPI en tinta (Sam, opción A), 2026-11-21, rama `claude/sdd-0686-kpi-tinta`:
   - `KpiCard` sin `valueColor` y con `status`;
   - las 81 cifras semánticas, a tinta con su estado aparte;
   - las barras «Cobrado» y la cobertura de Dirección, en tinta;
   - contrato con mutante.

   Sam aprobó sus palabras de estado el 2026-11-21 («Apruebo las palabras de estado de las cifras KPI»). El logo de la barra quedó decidido el mismo día: identidad aceptada.
4. ~~`Avatar` con tono `wine`~~ Resuelto en el grupo 8: neutral (Sam). En el Studio, «Comentarios» ya no usa `.eyebrow-wine`, pero el portal y la web sí (fase 3).
5. Fases 3 a 5. Aplicar los correos y Chatwoot necesita un OK de producción aparte (regla 8).

## FUERA DE ALCANCE DETECTADO

- Si la PR #715 entra a `main` por **squash**, esta rama tendrá conflictos de «añadido en los dos lados» en los cuatro archivos del análisis que corrige. Se resuelven tomando la versión de esta rama. Con merge normal no hay conflicto.
- Los enlaces del borrador a las specs 0687 y 0688 no resuelven hasta que esas specs lleguen a `main`.
- ~~`BRAND.md:33` y el logo `mono-light`.~~ Resuelto el 2026-11-20 con la regla 9 de BD-076: el logo no va sobre el azul.
