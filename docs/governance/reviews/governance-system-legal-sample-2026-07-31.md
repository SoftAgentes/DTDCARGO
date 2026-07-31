# REV-SGE-034 · Muestreo read-only de Sistema y Legal

| Control | Valor |
|---|---|
| Fecha | 2026-07-31 |
| Fuente normativa | LB-SGE-104 / REV-SGE-029 |
| Alcance | Legal y T&C, Bug Tracker, Mis reportes y No-Olvidar |
| Método | Inspección estática acotada + pruebas focales existentes |
| Mutaciones | Ninguna |

## Pregunta de auditoría

Se revisó si los cuatro módulos pendientes del grupo Sistema y Legal contienen
una acción R3 implementada que requiera un slice correctivo inmediato. No se
declaró un módulo completo por observar una sola superficie y no se reabrieron
los siete módulos del grupo que REV-SGE-029 ya clasifica como `VA`.

## Inventario y clasificación

| Módulo | Acción observada | Riesgo | Resultado acotado |
|---|---|---:|---|
| Legal y T&C | Consultar y exportar documentos, aceptaciones y expediente | El visor Studio es read-only; la aceptación P4 ocurre fuera de esta ruta | Evidencia adicional para `VA`, limitada a persistencia y pruebas automatizadas |
| Bug Tracker | Cambiar un bug a `resuelto` o `descartado` | R2: estado terminal interno, recuperable mediante una nueva incidencia o intervención administrativa | `BE`; no es un R3, pero existe una no conformidad de fricción y error visible |
| Mis reportes | Crear un reporte de bug | R1/R2: crea evidencia, no destruye un derecho ni ejecuta una obligación financiera o legal | `BE`; registro primario durable, evidencia secundaria best-effort y cobertura focal ausente |
| No-Olvidar | Ninguna; la ruta es un placeholder | R1 actual / R3 futuro | `NA+BE`; no hay flujo implementado que auditar |

## Evidencia comprobada

### Legal y T&C

- El visor Studio expone repositorio, bitácora de aceptaciones, descarga JSON e
  impresión; no define Server Actions de mutación
  (`app/studio/(app)/legal/_components/LegalClient.tsx:86-1249`).
- `legal_acceptances` se define como evidencia server-sellada, ligada a tenant y
  cliente, con RLS y trigger que rechaza `UPDATE` y `DELETE`
  (`supabase/migrations/0102_capa_legal.sql:79-138,169-185,292-305`).
- El cuerpo publicado recibe SHA-256 server-side; un documento publicado no se
  borra ni se reescribe, sólo puede archivarse con nota
  (`supabase/migrations/0297_legal_docs_body_hash.sql:40-110`).
- Pruebas focales ejecutadas: 9 archivos y 162 casos verdes en
  `lib/studio/legal/__tests__/` y
  `lib/portal/__tests__/portal-legal-queries.test.ts`.

Clasificación: MP-01 `cumplimiento`; AUD-01/AUD-02 `cumplimiento` para la
evidencia persistida; UPL-01 `no aplica` al flujo muestreado; ERR-01 y A11Y-01
`no verificable` en runtime. Esto aporta evidencia para promover Legal a `VA`
en la próxima baseline, pero no modifica retrospectivamente REV-SGE-029.

### Bug Tracker

- `bug_advance_state` valida actor, tenant y transición, bloquea la fila,
  actualiza el estado e inserta timeline en la misma función
  (`supabase/migrations/0028_bug_reporter.sql:309-399`).
- El Drawer envía directamente cada transición válida; `resuelto` y
  `descartado` no usan `ConfirmDialog`, no exigen motivo y no muestran resumen
  de consecuencias (`app/studio/(app)/bugs/_components/BugDrawer.tsx:681-732`).
- Las Server Actions propagan `error.message` de Postgres en transiciones,
  edición y mensajes (`app/studio/(app)/bugs/actions.ts:61-84,174-238,249-286`).
- Sólo se localizaron pruebas focales de notificaciones. Las 2 suites existentes
  pasaron 24/24, pero no cubren transición terminal, tenant, doble envío ni el
  contrato UI de confirmación.

Clasificación: MP-01 `cumplimiento` en RPC; AUD-01 `cumplimiento`; BTN-01
`cumplimiento`; HTD-01 `no conformidad` por ausencia de confirmación R2;
ERR-01 `no conformidad` por exposición de errores técnicos; A11Y-01
`no verificable` sin prueba de interacción. No se corrige dentro de esta
auditoría.

### Mis reportes

- La acción valida campos, sesión y tenant antes de crear
  (`app/studio/(app)/mis-bugs/actions.ts:50-115`).
- El registro principal se persiste antes de los anexos; `tech_data` y timeline
  son best-effort, por lo que el reporte puede existir sin esas evidencias
  (`lib/studio/bug-create.ts:106-162`).
- La acción todavía conserva un detalle técnico legacy en la respuesta de error
  (`app/studio/(app)/mis-bugs/actions.ts:117-122`).
- No se localizaron pruebas focales del alta completa, deduplicación, tenant ni
  degradación de anexos.

Clasificación: FRM-01 `cumplimiento`; MP-01 `cumplimiento`; AUD-01 `excepción`
para anexos best-effort; ERR-01 `no conformidad`; A11Y-01 `no verificable`.
Permanece `BE` y no constituye un R3.

### No-Olvidar

- La ruta sólo renderiza `EmptyState` “Próximamente · SDD-0025”
  (`app/studio/(app)/no-olvidar/page.tsx:1-11`).
- El SDD exige backup offline de KEK y revisión externa de criptografía antes de
  mergear (`docs/specs/0025-no-olvidar/spec.md:672-688,730-799`).

Clasificación actual: políticas de mutación `no aplica`; evidencia `BE`. La
implementación futura mantiene sus gates de criptografía y operación y no debe
nacer de un barrido transversal de gobernanza.

## Brechas y riesgo real

1. Bug Tracker permite cerrar o descartar en un clic y propaga errores técnicos.
   Es una brecha R2 acotada, no una operación irreversible R3.
2. Mis reportes no demuestra por pruebas la degradación controlada de evidencia
   secundaria y puede mostrar detalle técnico legacy.
3. Legal tiene buena evidencia durable, pero este muestreo no ejecutó runtime,
   accesibilidad manual ni una aceptación real.
4. No-Olvidar sigue bloqueado deliberadamente por gates externos y operativos.

## Slices futuros propuestos

### Slice S1 · Estados terminales de Bug Tracker

Allowlist propuesta, sujeta a revalidar correlativos antes de implementar:

- `docs/specs/<siguiente>-bug-terminal-state-governance/spec.md`
- `app/studio/(app)/bugs/actions.ts`
- `app/studio/(app)/bugs/_components/BugDrawer.tsx`
- pruebas focales nuevas del dominio Bug Tracker;
- una migración nueva y su contrato SQL sólo si el motivo obligatorio debe
  quedar forzado también en `bug_advance_state`;
- índices documentales generados y un recibo de implementación.

Aceptación mínima: `ConfirmDialog` para `resuelto` y `descartado`; motivo
obligatorio para `descartado`; doble envío bloqueado; errores públicos estables;
RPC mantiene tenant, rol, lock y timeline; pruebas de acción, componente y SQL.

### Slice S2 · Evidencia de Mis reportes

Primero agregar pruebas de alta, deduplicación, tenant y caída de anexos. Sólo si
esas pruebas demuestran pérdida material se diseña una corrección transaccional;
ERR-01 puede resolverse con códigos públicos estables en ese mismo slice.

## Resultado

No se encontró un R3 correctivo pendiente en el grupo Sistema y Legal. Legal
aporta evidencia suficiente para una promoción futura acotada; Bug Tracker y
Mis reportes conservan brechas R2/evidencia; No-Olvidar permanece no aplicable.
El siguiente muestreo R3 debe ir a un módulo financiero todavía `BE`, sin
integrar Nómina ni ejecutar la migración 0316.
