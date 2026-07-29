# Revisión de implementación de comentarios MP-01

| Control | Valor |
|---|---|
| Revisión | REV-MP-003 |
| SDD | [SDD-0168](../../specs/0168-mp-01-comentarios-permanencia-restauracion/spec.md) |
| Diseño | [DT-SDD-0168 v1.0](../../specs/0168-mp-01-comentarios-permanencia-restauracion/diseno-tecnico.md) |
| Fecha | 2026-07-23 |
| Resultado técnico | DB-1, APP y DB-2 verificados en Preview y Producción |
| Estado de publicación | integrado en `main`, Vercel Producción y E2E autenticado aprobados |

## 1. Veredicto

DB-1 y el gate APP ya no están en estado de diseño. El contrato de ciclo de
vida fue aplicado en Supabase Cloud y el recorrido autenticado de aplicación se
validó en un Preview aislado. DB-2 fue implementado, aplicado y verificado en
Cloud el 2026-07-28 en [REV-MP-004](mp-01-comments-db2.md), y la APP fue
revalidada después de DB-2 en
[REV-MP-005](mp-01-comments-preview-e2e.md). El correctivo final `592226e9`, su
evidencia `1f831b63` y el recibo `21b86297` fueron integrados en `main` mediante
`d93c56e4`, desplegados automáticamente a Producción y validados con smoke
público y recorrido E2E autenticado controlado.

## 2. Recibos de Supabase Cloud

El ledger de migraciones del proyecto `xpfuzqombmjmxvprjgmi` fue consultado en
modo read-only el 2026-07-23 y contiene:

| Versión | Basename | Alcance |
|---|---|---|
| `20260723135825` | `0261b_comments_acl_least_privilege` | ACL mínimo de las tres tablas de comentarios. |
| `20260723140120` | `0262_comments_lifecycle_contract` | DB-1: columnas, guard transicional, RPCs y auditoría atómica. |
| `20260723141742` | `0263_harden_postgres_public_default_table_acl` | Defaults de tablas futuras creadas por `postgres`; no corrige tablas históricas. |
| `20260723141803` | `0264_harden_comment_mentions_validate_execute` | Retiro de EXECUTE directo sobre el trigger de validación. |

Una consulta adicional, limitada a catálogos y privilegios, confirmó:

- las seis columnas lifecycle y ambas RPCs existen;
- `service_role` ejecuta las RPCs y `authenticated` no;
- el ACL de `comments` para `authenticated` coincide con 0261b;
- los defaults futuros `public/postgres` ya no conceden privilegios a
  `anon` ni `authenticated`;
- `comment_mentions_validate()` no tiene EXECUTE directo para
  `anon`, `authenticated` ni `service_role`;
- DB-2 retiró en Cloud el UPDATE general de `authenticated` y
  UPDATE/DELETE/TRUNCATE directo de `service_role`; el ledger y las
  postcondiciones están registrados en REV-MP-004.

No se consultaron cuerpos, menciones, identidades ni filas de negocio.

## 3. Evidencia APP y E2E

- El gate APP está en `ebb73709`.
- El seed y el recorrido automatizado están en `6979e816`.
- La detección de respuestas HTTP fallidas de Preview y Supabase está en
  `4658dba3`.
- El recorrido autenticado aislado completó
  `crear → eliminar → deshacer → eliminar → restaurar`, conservando identidad,
  mención, reacción y los cuatro eventos de auditoría esperados.
- La rama efímera de Supabase y sus variables exclusivas de Preview se
  eliminaron al terminar.
- `c429a09a` corrige el panel de recuperación que podía quedar obsoleto después
  de abrirse vacío.
- `c1a1c0e6` devuelve el foco a **Comentarios eliminados** cuando la restauración
  retira el control que abrió el diálogo.
- `592226e9` corrige el deadline de Deshacer ante relojes desajustados,
  estabiliza la persistencia observada por el E2E y elimina el error rrweb
  detectado en Preview.
- REV-MP-005 registra la repetición posterior a DB-2: 1 E2E aprobado, 25
  pruebas locales aprobadas, cero errores runtime/5xx y retiro confirmado del
  entorno efímero.
- El push hasta `1f831b63` fue fast-forward; Vercel terminó `READY`, GitHub
  reportó `success` y no se observaron errores runtime ni respuestas 5xx.
- El merge final `d93c56e4` fue publicado en `main`; Vercel Producción y GitHub
  reportaron `success`.
- El smoke público de Producción aprobó 14 de 14 casos.
- El E2E autenticado de Producción aprobó `1 passed` y la limpieza confirmó
  residuo cero en las tablas, Auth y auditoría del fixture.

Verificaciones locales posteriores:

- 7 archivos y 59 pruebas del dominio comentarios aprobados;
- 3 archivos y 28 pruebas de interacción, diálogo y avisos aprobados;
- TypeScript y ESLint puntual aprobados;
- lint completo previamente aprobado con cero errores;
- el worktree quedó limpio.

## 4. Cierre y límites

La integración, el despliegue y la validación funcional de Producción están
cerrados. Permanecen fuera de este SDD:

1. definir otro alcance para ACL históricos; 0263 solo corrige defaults futuros
   del rol `postgres`.
2. cualquier purga/hard-delete o retención automática;
3. ampliación de restauración a roles no administradores.

Ninguna evidencia de SDD-0168 habilita esos alcances.
