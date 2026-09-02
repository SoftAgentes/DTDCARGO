# Cierre local · SDD-0361 · Compras y proveedores Portal

Fecha: 2026-09-02
Rol: worker
Rama: `codex/saneamiento-integral`
Base: `a4f1ba5f1e50ed786820a84685ea7a1a562e7494`
Estado: cierre técnico local; migración Cloud e integración pendientes.

## Resultado

0417 modifica siete policies Portal de proveedores CN, prealertas y documentos.
Exige vínculo activo, cliente vivo, tenant y propietario coherentes; UPDATE
valida fila original y resultado. Documentos verifica también padre vivo y
coherencia de tenant/Shipping Mark. No cambia UI, RPC, ACL, equipo o Storage.

TDD separó la preparación del fixture de la implementación. La ejecución RED
local aplicó 0080/0105/0118/0229 reales y reprodujo tres lecturas cruzadas y dos
cambios de tenant indebidos con identidades sintéticas. La prueba falló por
visibilidad A/B, no por archivo ausente. No se probó contra Producción.

## Evidencia

- 158 contratos SQL aprobados; rollback total y contenedores propios retirados.
- 0417 cubre altas propias con RETURNING, edición propia, negativos de tenant,
  propietario y principal; documentos incoherentes; principal dual; equipo,
  servicio, ACL y policies de Storage conservados.
- Preflight real rechaza policy adicional, policy ausente y RLS deshabilitada.
- Rebuild completo: 414 migraciones, 396 desde cero + 18 sólo-ledger;
  aislamiento estructural de 219 tablas con dos tenants sintéticos.
- 13 archivos / 156 unitarios de compras, proveedores y documentos aprobados.
- Índice regenerado; docs, numeración, gobernanza y componentes aprobados.
- La app no cambió. Baseline completo `a4f1ba5f`: CI `33664422658` aprobado,
  527 archivos / 5.961 unitarios y build de 158 páginas. CI del nuevo SHA aparte.

## Alcance y publicación

Siete archivos autorizados en la allowlist de SDD-0361. Publicar únicamente la
rama existente y mantener PR #21 en borrador; no fusionar, promover ni aplicar
Cloud. La migración exige su autorización nominal y smoke independiente.
El checklist registra 19 migraciones preparadas sin aplicación en esta tarea.

No se certifica todo el Portal. Academia, reclamos, reportes de pago y otras
entidades mantienen slices pendientes; secuencias/transiciones y relación
proveedor/cliente requieren reproducción separada. No se borraron otros
worktrees, ramas, contenedores de otros proyectos o datos de negocio.
