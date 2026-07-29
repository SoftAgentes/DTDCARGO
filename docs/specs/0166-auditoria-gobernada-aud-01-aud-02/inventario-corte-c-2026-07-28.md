# Inventario read-only del Corte C — 2026-07-28

| Control | Valor |
|---|---|
| SDD | [SDD-0166](spec.md) |
| Corte | C · consulta gobernada y RBAC |
| Gate | C0/B0 · solo lectura |
| Rama | `codex/sdd-0166-corte-c` |
| Base | `origin/main` · `fd0e4613010ff8bc2c42114bb06f985f3cdf2b4f` |
| Proyecto Cloud | DTD Cargo · `xpfuzqombmjmxvprjgmi` |
| Alcance Cloud | metadatos y agregados; cero payload o PII |
| Resultado | inventario completo; sin DDL, DML ni cambios Cloud |

## 1. Método y límites

Se revisaron el repositorio, los worktrees, el contrato de SDD-0166, AUD-01,
AUD-02, el viewer vigente, la matriz RBAC y metadatos de Cloud. Las consultas
Cloud se limitaron a `information_schema`, `pg_catalog`, policies, ACL,
funciones, índices y agregados por vocabulario.

No se extrajo `payload`, `before_data`, `after_data`, motivo, identificadores de
eventos, actores, entidades ni datos de negocio. El intento contra el MCP
read-only del proyecto devolvió `Unauthorized`; la misma consulta metadata-only
se completó mediante el conector Supabase autenticado.

## 2. Estado Git y concurrencia

El worktree aislado es:

```text
C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\sdd-0166-corte-c
```

Al cerrar el inventario:

- `HEAD` y `origin/main` coincidían en `fd0e4613`;
- el worktree estaba limpio;
- el checkout principal tenía otro commit local y no fue modificado;
- no existía `0269_*.sql` en el repositorio ni en los worktrees inspeccionados;
- `0269` es solo candidato y debe revalidarse antes de crear una migración.

## 3. Contrato Cloud vigente

`public.entity_audit_log` tiene las 17 columnas esperadas después de Corte B:
las nueve originales y las ocho añadidas por `0267`. El agregado seguro
reportó tres eventos, todos `actor_type=operario` y con
`source/result/sensitivity=legacy_unknown`.

La frontera vigente es:

| Objeto | Estado comprobado |
|---|---|
| Tabla | RLS habilitado |
| Policy | `entity_audit_log_tenant_select` para `authenticated` |
| ACL `authenticated` | `SELECT=true`; `INSERT=false` |
| ACL `service_role` | `INSERT=true`; `SELECT/UPDATE/DELETE=false` |
| Writer | `append_audit_event`, `SECURITY DEFINER`, solo `service_role` |
| Consulta gobernada | no existe RPC `audit_*` de lectura |
| Índices | PK, entidad, tenant/fecha y tenant/correlación |
| Realtime | publicación heredada; no se encontró consumidor local |

Los advisors no reportaron un hallazgo específico nuevo sobre
`entity_audit_log`. El baseline global conserva avisos preexistentes ajenos al
Corte C, entre ellos funciones `SECURITY DEFINER` expuestas y deuda de índices.
No se absorben en este corte sin trazabilidad propia.

## 4. Viewer y adaptador vigentes

El camino de lectura actual es:

```text
AdminPage
  -> getRecentAuditEvents()
  -> SELECT directo entity_audit_log
  -> AuditLogSection
```

Hallazgos:

- `getRecentAuditEvents` selecciona `payload` completo;
- un error de consulta se convierte silenciosamente en lista vacía;
- limita a 100 por defecto y 500 máximo, sin cursor;
- filtros por entidad y actor se aplican en el navegador;
- el componente serializa `JSON.stringify(e.payload)` en HTML;
- solo reconoce `user`, `operario` y `system`;
- cualquier actor desconocido se convierte falsamente en `system`;
- no hay filtros de correlación, fecha, fuente o resultado;
- no hay zona IANA explícita, estado de error ni fin de paginación;
- `requireModuleView("admin")` hace el módulo admin-only en aplicación, pero no
  expresa las capabilities `audit:view` y `audit:view_sensitive`.

## 5. Resolución de actores

Cloud confirma:

- usuarios: `user_tenants.user_id` y perfil en `user_profiles`;
- operarios: `operario_pins.id`, `tenant_id`, `display_name` y
  `display_name_cn`;
- los actores `system`, `agent` e `integration` no tienen un directorio
  humano uniforme.

El lector gobernado puede resolver nombres de usuario/operario dentro del
tenant. Si la fila no existe o el tipo no tiene directorio aprobado, debe
devolver `actor_resolved=false` y la UI mostrar **No resuelto**. Nunca
reescribe historia ni convierte el tipo.

## 6. Feature flag

Existe `feature_flags.audit_log` con default `true`, pero la sección Audit del
módulo Administración no está mapeada como módulo independiente. El rollback
del Corte C usará un flag server-side específico del adaptador:
`AUDIT_GOVERNED_VIEWER=false` permite volver temporalmente a la presentación
anterior, pero esa presentación seguirá consumiendo la RPC redacted. El flag
nunca reotorga `SELECT` sobre la tabla.

## 7. Hallazgos

| ID | Evidencia | Tratamiento en C |
|---|---|---|
| C0-01 | `authenticated` conserva `SELECT` de tabla | revocar después de instalar y probar RPC |
| C0-02 | no existe frontera DB admin-only | validar membership activa y `role=admin` dentro de cada RPC |
| C0-03 | payload crudo viaja al servidor/UI | lista devuelve solo metadatos y resumen allowlist |
| C0-04 | filtros client-side, sin cursor | filtros server-side y cursor opaco `(occurred_at,id)` |
| C0-05 | actor desconocido se falsifica como sistema | conservar tipo y marcar No resuelto |
| C0-06 | error se presenta como vacío | resultado discriminado `ok/error` |
| C0-07 | Realtime publicado sin consumidor local | retirar tabla de publicación en C1 |
| C0-08 | reveal sensible no tiene contrato ejecutable | RPC separada con motivo, AAL2 y evento de acceso |
| C0-09 | `0268` existe local pero no en Cloud | C1 tolera FK CASCADE o RESTRICT; no depende de aplicar `0268` |

## 8. Cierre

C0 confirma la brecha descrita por SDD-0166 y habilita redactar/revisar el
diseño correctivo. Este gate no crea `0269`, no cambia aplicación o Cloud, no
lee payload/PII y no declara el Corte C implementado.
