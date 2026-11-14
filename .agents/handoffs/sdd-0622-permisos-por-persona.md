# Handoff — SDD-0622 · Rol base + accesos adicionales por persona

- **Owner / sesión:** `sdd-permisos-persona` (Worker, lanzado desde la sesión del Director)
- **Worktree:** `DTD-worktrees/sdd-permisos-por-persona` (fuera del checkout principal)
- **Rama:** `codex/sdd-permisos-por-persona` (base `origin/main` ad50537f1)
- **Reserva:** `codex/sdd-reserve-0622-permisos-por-persona` (commit 9f2f9aa52, incorporada por cherry-pick; reserva local, sin publicar)
- **Fecha:** 2026-11-09

## Objetivo original
Reservar número SDD y redactar **solo la spec** de «rol base + accesos adicionales por persona» en ERP Studio
(caso Alejandro: contabilidad + CRM). Sin código de producto ni migraciones.

## Completado
- SDD **0622** reservado (siguiente libre según `sdd:next`: spec 0622, migración 0525).
- `docs/specs/0622-permisos-por-persona/spec.md` en `status: draft`: contexto, reemplazo explícito del punto D
  de SDD-0139, comparación con QuickBooks/Odoo/Zoho (de memoria, marcada como no verificada), diseño
  (`studio_user_module_grants`, RPC solo admin, candado LOCKED, solo suma, auditoría, `user_has_module`),
  pantalla, fases, 12 pruebas de aceptación, riesgos y decisiones pendientes.
- Fase 1 adelantada como lectura de `supabase/migrations`, anexada en §5.3 con archivo:línea.
- Índice `docs/specs/README.md` regenerado.

## Validación
- `docs:check`: PASÓ (603 specs).
- `sdd:check` (check-numbering): PASÓ — «sin números repetidos»; los avisos son choques históricos ya aplicados.
- `git diff --check`: PASÓ.
- `pnpm verify`, build y pruebas de producto: NO APLICAN (cambio solo de documentación).
- Verificación en línea de cómo lo hacen QuickBooks/Odoo/Zoho: NO EJECUTADA (§4 de la spec lo declara).

## Hallazgos clave de la auditoría (resumen)
- `crm_puede_usar()` exige `admin`/`commercial` (`0506_crm_modelo.sql:186-194`): sin cambio en la base, el CRM
  seguiría cerrado para Alejandro aunque la UI lo mostrara.
- `document_entity_authorized` (`0444_unlinked_document_entity_rbac.sql:73-150`) ya consulta
  `studio_role_module_overrides`: punto central para sumar los accesos por persona.
- `quotes`, `sales_orders`, `suppliers`: RLS solo por tenant; alcanza con la capa de aplicación.
- Nómina exige admin/accounting en SQL (`0160_nomina_employees.sql:71-85`): la base la sigue exigiendo por rol; si se concede por extra hay que cubrirla (por confirmar con Sam).

## Decisiones de Sam (recogidas en la spec §9)
- 2026-11-09: extras por módulo; vencimiento opcional; «elegir módulos» para Alejandro; opción «Personalizado» (§5.5).
- **2026-11-11 (cambia lo anterior):** los extras SÍ pueden abrir módulos sensibles (dinero y solo-administrador), concedidos por admin o superadmin, con **doble aviso** («Esta persona puede hacer estas modificaciones, ¿estás seguro?»). La RPC exige `p_confirm_sensitive` y registra la confirmación en `entity_audit_log`. No se toca el CHECK de la 0357. Las capabilities (`CAPABILITIES`) quedan fuera.

## Pendientes de esta tarea (de Sam)
- R1 escalada con `users`/`admin` (mitigación propuesta en §8).
- R2 módulos del superadministrador: quién los otorga y si el receptor pasa `is_platform_admin()`.
- R3 dinero por persona como fase propia (fase 8), con migración y OK de Sam; inventario con archivo:línea en §12.2.
- Nómina; si `documents` es transversal para `custom`; si `clients` con edición incluye la fusión de fichas; diseño de §5.5.
- La Fase 1 sigue siendo lectura de texto: repetir contra el catálogo de una base efímera.
- La reserva 0622 sigue sin publicar como rama de reserva; la PR lleva la spec.

## FUERA DE ALCANCE DETECTADO
- `rbac.ts` (cabecera) todavía dice que los overrides por usuario están descartados; se actualizará con la
  implementación, no en esta tarea.
- `lib/studio/rbac.ts`: la cabecera aún describe la matriz como no editable en DB, aunque 0252/0357 ya
  agregaron desvíos por rol. Es un comentario desactualizado, no un fallo.
- `sdd:next` tarda varios minutos en esta máquina (786 refs + ~30 worktrees); aviso de rendimiento, sin tocar.

## Impacto documental y conocimiento
- Spec nueva e índice de specs actualizado. Graphify, Archify y vista Obsidian: NO EJECUTADOS en esta tarea;
  el Director los revisa al cierre. `pnpm knowledge:status`: NO EJECUTADO.
- Sin secretos, PII ni datos de negocio; la auditoría de la base fue solo lectura de archivos de migración.

## Enmienda 2026-11-11 (encargo del Director, tras la revisión de la PR #509)
- Spec enmendada para coincidir con lo implementado: allowlist exacta (57 archivos, calculada de
  `git diff --name-only origin/main...origin/claude/impl-permisos-por-persona-10d044`, cabeza entonces a44b77066), migraciones
  definitivas 0538 (grants + user_has_module), 0539 (CRM + document_entity_authorized) y 0540 (RLS por módulo)
  —numeradas 0529, 0530 y 0531 en esta enmienda; renumeradas el 2026-11-14, ver abajo—,
  nombres definitivos de las RPC (`studio_grant_user_module`) y §13 con el estado de la implementación.
- R1, R2 y R3 quedan registradas como decididas por el Director el 2026-11-11 con la autorización de Sam
  («hazlo como creas tú»), según lo informó la sesión coordinadora; no las confirmé con Sam directamente.
- Siguen a decisión de Sam (§13.3): revocar sin superadmin; extras al reactivar a la persona; RPC que concede módulos
  aún no cubiertos. Y de antes: nómina, `documents` para `custom`, fusión de fichas, diseño de §5.5.
- Validación: docs:check PASÓ, sdd:check PASÓ, git diff --check PASÓ. No se verificó el contenido de la PR #509 más
  allá de su handoff y de la lista de archivos del diff.

## Renumeración 2026-11-14 (Worker W-488, encargo del Director)
- **Worktree:** `.claude/worktrees/agent-ab638f828c2bb96b2`, rama local
  `w488/sdd-permisos-por-persona` que empuja a `origin/codex/sdd-permisos-por-persona` (la rama local con ese nombre está
  tomada por el worktree original, limpio en 41b8c58e0; no se tocó).
- Base 41b8c58e0 + `git merge --no-edit origin/main` (4a59f10bf), sin conflictos.
- Spec §11 y §13.1: 0529/0530/0531 (migraciones y `.test.sql`) pasan a 0538/0539/0540, nombres exactos de
  `origin/claude/impl-permisos-por-persona-10d044` (cabeza bed937852, PR #509); cabeza citada a44b77066 → bed937852;
  «la 0531 no lo arregla» pasa a 0540.
- Nota nueva en §11 del cruce con la SDD-0624 (PR #515, cabeza 013c39c5a, abierta): su 0528 crea
  `public.studio_can_read_money()` solo por rol (`accounting`/`admin`, comprobado en el archivo); la fase 8 la redefinirá
  para sumar extras; mientras tanto queda fail-closed. `git grep` confirma que 0538-0540 no la tocan.
- No se tocaron `status: approved`, «aprobada por Sam», R1-R3 ni «caso Alejandro».

### Evidencia
- Allowlist §11 contra `git diff --name-only <merge-base da8d123ee> origin/claude/impl-permisos-por-persona-10d044`:
  57 = 57, `diff` vacío, sin diferencias.
- `git diff --check`: PASÓ.
- `pnpm docs:check` y `pnpm sdd:check`: NO EJECUTADO (worktree sin `node_modules`; no se instaló ni se enlazó; queda
  pedir turno).
- Producto (`pnpm verify`): NO APLICA, cambio solo de documentación. Ninguna migración aplicada.

### Pendientes de esta tarea
- Correr `pnpm docs:check` y `pnpm sdd:check` con turno y `node_modules`.
- Lo que depende de Sam sigue igual (estado `approved`, R1-R3).

### FUERA DE ALCANCE DETECTADO
- La 0528 vive solo en la PR #515 (no está en main); si la #515 cambia de número, la nota de §11 y las de §6/§9/§13
  que citan «0528» se vencen.
- En `supabase/migrations/` de main faltan 0528-0531 (0532-0537 ya fusionadas). La #515 ocupa 0528; el destino de
  0529-0531 lo coordina el Director.

## Confirmación de Sam 2026-11-14 (W-488, sobre c3c154e3c)
- Según lo transmitió el Director, Sam respondió en el chat del Director General, el 2026-11-14, a si confirma la spec
  0622 y R1, R2 y R3: «Sí, las confirmo». No la recibí directamente.
- Spec: en «Estado» (§ inicial) se agrega «Confirmada por Sam el 2026-11-14 en el chat del Director General: «Sí, las
  confirmo»»; junto a cada «decidido por el Director el 2026-11-11» de R1-R3 (§8, filas 9.6-9.8 de §9 y el párrafo de
  estado) se agrega «Confirmadas por Sam el 2026-11-14 en el chat del Director General: «Sí, las confirmo»».
- Sin cambios en el texto de R1-R3, «caso Alejandro» (sigue abierta) ni `status: approved`.
- Evidencia: `git diff --check` PASÓ; `pnpm docs:check` NO EJECUTADO (sin `node_modules`, no se instaló nada).
- Pendiente de esta tarea: sin cambio respecto de la sección anterior (correr `docs:check` y `sdd:check` con turno).

## Observaciones de la revisión independiente (W-488, sobre 96af83e56)
La revisión salió APROBADA CON OBSERVACIONES; commit solo de docs:
- §5.1 regla 2 (segundo candado) y §5.4 dejan de decir «hasta que Sam decida/resuelva R1 y R2»: usan la resolución
  vigente (R1 solo lectura; «mientras R2 siga en opción A»). En la línea 128 que citó la revisión no había esa frase.
- §5.1 regla 4 explica que admin y superadmin no son alternativas: conceder exige siempre rol `admin` en el tenant y
  `is_platform_admin()` es adicional solo para los 4 módulos del superadministrador. Comprobado en la 0538 de la #509:
  la RPC rechaza con `42501` a quien no tiene rol `admin` antes de mirar el módulo. Estado, §5.5 y §9.1 remiten ahí.
- Estado: «Confirmadas la spec y R1-R3; siguen abiertos §9.5, §9.1 (nómina) y §13.3».
- §8, dos riesgos de privacidad: los extras sobre `conversations`/`users` abren datos personales (0540) y la #509 debe
  pasar `revisar-datos-ve`; `reason` es texto libre que va a `entity_audit_log` y la persona lee su fila.
  Hallazgo en la #509: la UI limita el motivo a 5-500 (`reasonError`, `maxLength={500}`, igual que el CHECK de la 0538),
  pero **no** pide evitar datos personales y el ejemplo del campo usa un nombre de persona. Quedó escrito como
  **requisito para la #509**, no como algo existente.
- §11: «las numeraciones previas de esta tarea ya no valen», sin listar números ni la afirmación sobre la 0526.
- Frontmatter `updated: 2026-11-14`. Rutas locales con el usuario de Windows quitadas de este handoff (líneas 4 y 75);
  ninguna queda en los dos archivos.
- Sin cambios en «caso Alejandro», `status: approved` ni el texto de R1-R3.

### Evidencia
- `git diff --check`: PASÓ.
- `pnpm install --frozen-lockfile` (una vez, autorizado): PASÓ.
- `pnpm docs:check`: PASÓ («índice sincronizado con 615 specs»).
- `pnpm sdd:check`: PASÓ («sin números repetidos»; los avisos son choques históricos ya aplicados).
- vitest y `pnpm verify`: NO EJECUTADOS por indicación (cambio solo de docs).

### FUERA DE ALCANCE DETECTADO
- §5.1 regla 4 dice que la RPC usa `assert_studio_role(array['admin'])`; la 0538 compara `user_tenants.role` a mano
  (mismo efecto). No lo corregí porque no estaba en el encargo.
- El aviso de datos personales en el motivo y el ejemplo sin nombres son cambios de código de la #509, que es de otro Worker.
