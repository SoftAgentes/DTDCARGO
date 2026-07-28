# Revisión técnica del diseño de comentarios MP-01

| Control | Valor |
|---|---|
| Revisión | REV-MP-002 |
| SDD | [SDD-0168](../../specs/0168-mp-01-comentarios-permanencia-restauracion/spec.md) |
| Diseño | [DT-SDD-0168 v1.0](../../specs/0168-mp-01-comentarios-permanencia-restauracion/diseno-tecnico.md) |
| Fecha | 2026-07-22 |
| Resultado técnico | aprobado para implementación local por gates |
| Estado operativo | no implementado; migraciones, RBAC, deploy y Cloud no autorizados por esta revisión |
| Decisión | diseño autorizado por Sam (founder) + revisión técnica Codex |

## 1. Veredicto

El diseño técnico v1.0 es implementable, fail-closed y consistente con MP-01,
AUD-01, BTN-01, AVS-01 y la arquitectura actual del Studio.

Se aprueba técnicamente con una condición estructural: la entrega debe conservar
los tres gates `DB-1 → APP → DB-2`. Un bundle que revoque `UPDATE` antes del
deploy o una implementación que omita DB-2 no cumple el diseño.

## 2. Evidencia revisada

- SDD-0168 aprobado y defaults MP-D1 a MP-D7;
- migraciones 0090, 0093, 0209, 0210, 0215, 0258 y 0261;
- actions, queries, tipos, UI y pruebas actuales de comentarios;
- matriz/capabilities y guards RBAC;
- ToastProvider/ConfirmDialog implementados por SDD-0165;
- metadata Cloud de columnas, constraints, índices, triggers, funciones,
  policies, grants, catálogo AUD, tamaños y locks;
- buenas prácticas PostgreSQL para RLS, privilegios, constraints, índices,
  transacciones cortas, deadlocks y paginación keyset.

No se leyeron cuerpos, menciones, identidades ni filas de negocio.

## 3. Controles aprobados

| Control | Decisión |
|---|---|
| Frontera confiable | Server Action autenticada + RPC service-role-only. |
| Tenant/actor | derivados de sesión y revalidados en DB. |
| Contexto | solo `shipment` y `bitacora_task` en v1; resto fail-closed. |
| Permanencia | mismo registro; cero copy/replace/hard-delete. |
| Ventanas | reloj DB; 10 s, 30 días y 90 días exactos. |
| Atomicidad | row lock + UPDATE + evento audit en una transacción. |
| Idempotencia | operation id + último estado; cero evento duplicado. |
| Legacy | nullable y sin backfill inventado. |
| Auditoría | catálogo aditivo `comment`; payload transicional mínimo. |
| RBAC | capabilities admin-only y permiso adicional del módulo padre. |
| Bypass | grant por columna después de DB-2; RPC sin EXECUTE público. |
| Menciones | ocultamiento y badge unidos al estado del padre. |
| UI | R1/R2/R3 con primitivas existentes y deadline absoluto para undo. |
| Purga | inexistente y expresamente fuera de alcance. |

## 4. Riesgos residuales y tratamiento

### Ventana entre DB-1 y DB-2

DB-1 conserva temporalmente el delete heredado para no romper producción. El
riesgo existente no aumenta: el guard transicional congela los nuevos
metadatos y DB-2 se aplica únicamente después de verificar el deploy.

### Duplicación mínima RBAC app/DB

La matriz DB se limita a dos consumidores reales y se cubre con pruebas
contractuales. Agregar otro `entity_type` exige actualizar ambos planos en un
mismo gate.

### Pausa AVS versus ventana MP

La tarjeta puede pausarse por accesibilidad, pero `actionExpiresAt` mantiene la
autorización de Deshacer ligada al deadline del servidor. MP-01 gobierna la
ventana; AVS-01 conserva su comportamiento para avisos sin deadline.

### Service role

El navegador nunca recibe la clave. DB-2 retira UPDATE/DELETE/TRUNCATE directo
sobre `comments`; las funciones verifican membership, rol y contexto aunque el
caller sea privilegiado.

## 5. Condiciones antes de implementar

1. asignar basenames libres solo al abrir cada gate de migración;
2. redactar DB-1 y su prueba contractual en worktree propio;
3. revisar SQL, grants, RLS, lock budget y forward-fix;
4. aplicar DB-1 de forma individual únicamente con autorización exacta;
5. implementar APP y verificar local/Preview;
6. redactar/aplicar DB-2 en gate independiente después del deploy verificado;
7. ejecutar advisors y recibos después de cada DDL;
8. no presentar este dominio como cierre global del Corte D.

## 6. Decisión registrada

REV-MP-002 aprueba **el diseño**, no su ejecución. El siguiente gate es la
implementación local de DB-1 y sus pruebas. Código, migraciones, RBAC efectivo,
Vercel, Supabase Cloud y producción conservan autorizaciones separadas.
