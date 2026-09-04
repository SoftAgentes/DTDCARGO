# Auditoría local · Academia Portal por principal y tenant

Fecha: 2026-09-03

Alcance: SDD-0387, capa de aplicación y fixtures locales.

Fuera de alcance: aplicar 0418, Cloud, datos reales, push, `main`, despliegue y
limpieza.

## Hallazgo reproducido

Las lecturas de Academia obtenían el Shipping Mark mediante
`get_portal_client_markbox`, mientras la acción resolvía el tenant por separado.
Los queries explícitos no fijaban `tenant_id`. Una relación activa pero
incoherente podía alcanzar catálogo, inscripción, diploma o progreso de otro
tenant antes de que la migración 0418 aportara la defensa RLS preparada.

La prueba RED falló 7/7: confirmó consultas con principales inválidos, escritura
de progreso con relación incoherente y ausencia de filtros de tenant. El
inventario exacto del flujo de inicio contiene nueve operaciones, no diez; esa
expectativa se corrigió sin alterar el defecto causal.

## Correctivo local

- Las tres lecturas y `setLessonComplete` derivan un único principal canónico.
- Sesión, vínculo, cliente vivo o coherencia tenant/cliente inválidos cortan
  antes de cualquier consulta de Academia o DML.
- Cursos, módulos y lecciones fijan `tenant_id`; inscripción, diploma y progreso
  fijan además el Shipping Mark del principal.
- Alta y baja de progreso fijan tenant, Shipping Mark, curso y lección, y
  conservan inscripción obligatoria, idempotencia, mensajes y revalidaciones.

## Evidencia ejecutada

- Prueba focal SDD-0387: 7/7 verde.
- Conjunto Portal: 874/874 en 62 archivos.
- TypeScript y ESLint focal: verdes.
- Gates de documentación, numeración, gobernanza, componentes y diff: verdes.
- No se creó una migración nueva. 0418 continúa preparada y sin aplicar.

## Revisión focal de datos personales

- Datos ya existentes: Shipping Mark, inscripción, progreso de lecciones y
  diplomas. No se agregaron campos, categorías, terceros ni destinos.
- **CORRECTO:** la aplicación minimiza el acceso al principal autenticado y fija
  tenant/cliente antes de leer o escribir.
- **NO VERIFICABLE:** retención, borrado, backups, contenido académico real,
  diplomas reales y comportamiento de Cloud/0418, porque no se consultaron datos
  alojados ni se aplicó la migración.

Esta revisión no afirma cumplimiento legal ni operativo. Sólo demuestra el
correctivo y sus contratos locales dentro del alcance indicado.
