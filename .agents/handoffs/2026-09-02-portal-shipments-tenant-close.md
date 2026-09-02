# Cierre local · SDD-0359 · Envíos Portal por tenant y principal

Fecha: 2026-09-02
Rol: worker
Rama: `codex/saneamiento-integral`
Base del slice: `fa420f3f`
Estado: terminado localmente; sin push, integración, deploy ni Cloud.

## Alcance y evidencia del fallo

Las tres policies históricas de `shipments`, `shipment_documents` y
`shipment_events` permitían que un cliente Portal leyera el dominio de otro
tenant con el mismo Shipping Mark. El fixture aplica 0080, 0086 y 0196 reales
y prueba los tres accesos antes de aplicar 0416.

0416 reemplaza exclusivamente las tres policies Portal. Exige vínculo activo,
cliente vivo y tenant coincidente. Documentos e hitos requieren envío vivo del
propietario; el documento además conserva coherencia con su markbox denormalizado.
No agrega funciones elevadas, privilegios ni cambios de datos o Storage.

La allowlist exacta de siete archivos está en SDD-0359. El contexto privado de
SDD-0345 sigue obteniendo ids y documentos por RLS antes de firmar o elevar;
esta migración refuerza esa lectura sin modificar el código de aplicación.

## Verificación

- 157 contratos SQL con rollback total; incluye antes/después, tenants A/B,
  cuentas revocadas/invitadas/retiradas/incoherentes, principal dual, padres
  retirados, hijos inconsistentes, Portal read-only y CRUD interno conservado.
- Snapshot de policies de equipo y ACL idéntico después de la migración.
- 6 archivos / 37 unitarios focales de Portal y documentos aprobados.
- Rebuild: 413 migraciones; 395 desde cero y 18 sólo-ledger; comprobación
  estructural de 219 tablas con dos tenants sintéticos.
- La aplicación no cambió: baseline canónico posterior a SDD-0357, 527 archivos
  / 5.957 unitarios; 150 E2E aprobados / 18 omitidos; build de 158 páginas.
- Cloud no medido; ningún SKIP equivale a conformidad alojada.
- Índice regenerado; docs, numeración (351 specs / 413 migraciones), gobernanza,
  componentes y `git diff --check` aprobados.

## Límites y siguiente gate

No es una auditoría completa de todas las policies Portal ni una nueva matriz
de roles del Studio. Prealertas, academia, reclamos y otros dominios conservan
sus propios slices pendientes. No se interpreta la copia local como Producción.

0416 puede aplicarse con las dependencias históricas 0080/0086/0196, sin app nueva,
pero requiere autorización individual y smoke de envíos, documentos e hitos.
Push, integración, aplicación Cloud, deploy y limpieza siguen separados.
