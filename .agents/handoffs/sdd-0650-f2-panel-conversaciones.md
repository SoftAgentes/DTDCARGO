# Handoff · SDD-0650 F2 — Panel de conversaciones (migración 0554)

- Rama: `claude/0650-f2-panel-conversaciones-796dce` · base `main` `725e2ef81`.
- Spec: `docs/specs/0650-ficha-360-cliente/spec.md` §5 F2 (con las decisiones F2-1 a F2-10), §6, §10 y §11.
- Encargo del Director General (2026-11-17), con las decisiones D2, D3, D4 y D5 de Sam (2026-11-16).
- **La F2 no ejecuta ninguna puerta de producción.** Todo nace apagado: sin la 0554, sin `CHATWOOT_FICHA_TOKEN`, sin `CHATWOOT_INBOX_ARCHIVO_KOMMO_ID` o sin `CHATWOOT_TENANT_ID` la ficha se ve como en la F1; sin `CHATWOOT_FICHA_UNIR=1` el webhook no escribe uniones.
- Revisión de Opus (CHANGES_REQUESTED sobre `c312e60f4`) atendida: A1 i18n, A2 acotar por tenant (F2-11), M1 interruptor del webhook (F2-12), M2 pendiente de Sam en la spec, B1 a B5.
- 2ª ronda (sobre `9c2e5e91f`): N1 acotar por tenant en la base (unir y quitar solo service_role, con actor comprobado en la base), N2 el texto real de «sin permiso», N3 la llave de una tabla vieja en el preflight.

## Qué hace

1. **0554** `chatwoot_contact_links`: qué contacto de Chatwoot es de qué ficha, solo ids. RLS: la leen los de la Bandeja de su tenant. La escriben tres funciones: `chatwoot_unir_contactos` (solo service_role: webhook y relleno), `chatwoot_unir_contacto_manual` y `chatwoot_quitar_union` (editar la Bandeja, con motivo, auditadas). Al borrar la ficha se borran sus uniones.
2. **Webhook**: `unirContactoAFicha` une el contacto cuando `chatwoot_registrar_evento` (0504) cruzó el teléfono con una ficha. Sin la 0554 no hace nada.
3. **Ficha**: dentro de un `<Suspense>`, `PanelConversacionesFicha` → `cargarPanelConversaciones`: rol (Bandeja) → configuración → uniones (sesión, RLS) → Chatwoot en vivo con la cuenta de servicio, un contacto por llamada, `no-store`. Muestra hasta 6 conversaciones con 160 caracteres del último mensaje, autor, bandeja (marca «Archivo Kommo»), estado y fecha; «Nombre en el chat» si la ficha no tiene nombre. Sin poder ver datos de clientes (región `cn` no admin) no sale texto ni nombre.
4. **D3**: el enlace «Abrir» de una conversación del Archivo Kommo solo lo reciben Admin y Contabilidad; los demás ven el texto y el aviso «Hay conversaciones que tu rol no abre» (sin número).
5. **Unir / quitar**: Admin y Comercial, desde el panel (número de conversación + motivo).

## Puertas de producción (cada una con OK nominal de Sam; las hace el DG)

Orden recomendado. Ninguna se hizo.

1. **Aplicar la 0554** con `docs/runbooks/aplicar-migraciones-prod.md`, `name` exacto `0554_chatwoot_contact_links`, md5 del archivo en la PR. La llave de `chatwoot_contact_links` cambió entre versiones de la PR (de `tenant_id, chatwoot_contact_id` a solo `chatwoot_contact_id`): si en el entorno ya existe la tabla de una versión anterior (un ensayo), el preflight aborta con «ya existe con otra llave primaria»; se quita con el desarme y se vuelve a aplicar. En producción no debe existir: comprobarlo antes con `select to_regclass('public.chatwoot_contact_links')` (nulo). Después, retirar su entrada de `pendingBelowCutoff` y de `pending-migration-symbol-declarations.json` (ids `0554-*`). Aplicada sola no escribe nada: el webhook sigue apagado hasta `CHATWOOT_FICHA_UNIR=1`.
1b. **Encender la unión por webhook** (`CHATWOOT_FICHA_UNIR=1`, otro OK). Desde ahí une contacto y ficha cuando el teléfono cruzó con una sola (escribe en producción, solo ids). **Una unión no se reevalúa** si después el teléfono cambia de dueño (otra persona con ese número, o la ficha corrige su teléfono): queda unida hasta que alguien la quite con «Quitar» en el panel (Admin o Comercial, con motivo, auditado) o con `chatwoot_quitar_union`.
2. **Crear la cuenta de servicio de Chatwoot** para la ficha (D2): un usuario de servicio **administrador** de la cuenta (un agente solo ve las conversaciones de sus bandejas: medido en la A1 de la 0649), su token de acceso en el entorno del ERP como `CHATWOOT_FICHA_TOKEN` (nunca en Git ni con `NEXT_PUBLIC_`) y el id de la bandeja «Archivo Kommo» en `CHATWOOT_INBOX_ARCHIVO_KOMMO_ID`. Comprobar que `CHATWOOT_TENANT_ID` es el tenant dueño de la cuenta: sin él, o con otro, el panel queda apagado. Reiniciar el contenedor del ERP. Alternativa a decidir con Sam: reusar el usuario de servicio de E1 en vez de crear otro (menos cuentas; mezcla permisos).
3. **Relleno único desde el Archivo Kommo** (en el VPS, sale con solo ids). Los contactos que creó el cargador llevan `additional_attributes.client_id` (`infra/ops/kommo-historial/cargar-archivo-kommo.rb:186-197`). Pasos propuestos, a ensayar primero en el entorno de prueba de la 0590:
   - En el contenedor Rails de Chatwoot, con `bundle exec rails runner`, listar pares `{contact_id, client_id}` de la cuenta donde `additional_attributes ->> 'client_id'` es un uuid. Escribir **solo** esos dos campos a un archivo en `/tmp` del contenedor; no imprimir nombres, teléfonos ni correos.
   - Partir en lotes de ≤5000 y llamar `POST /rest/v1/rpc/chatwoot_unir_contactos` con service_role: `{"p_tenant_id": "<CHATWOOT_TENANT_ID>", "p_origen": "kommo", "p_pares": [...]}`. La función devuelve solo conteos (`unidos`, `ya_estaban`, `otra_ficha`, `sin_ficha`); anotar esos conteos en el acta, nada más.
   - Borrar el archivo de pares al terminar.
   - Los contactos que el cargador **reusó** por teléfono o correo no llevan `client_id`: no entran por aquí (los une el webhook o «Unir este chat»).
4. **Miembros del Archivo Kommo y acceso de Contabilidad** (D3): usuario de Chatwoot para cada persona de Contabilidad que deba abrir el Archivo, miembro de la bandeja «Archivo Kommo», vínculo en Studio (`chatwoot_agent_links`) y un **acceso extra por persona** al módulo Bandeja (SDD-0622/0635). Necesita la decisión de Sam de abajo.
   **Condición:** lo que de verdad impide abrir el Archivo Kommo es la **membresía en Chatwoot**, no Studio. Studio solo quita el enlace de la ficha; «Abrir» lleva a la Bandeja, que muestra Chatwoot con el usuario de cada persona. Antes de encender el panel, verificar en Chatwoot quién es miembro de «Archivo Kommo»: solo Admin y las personas de Contabilidad que Sam nombre. Un Comercial o Soporte que sea miembro abriría el Archivo desde la Bandeja aunque la ficha no le dé el enlace.

## Necesita a Sam

- **M2 (D2 sin cambios, decisión pendiente):** quien edita la Bandeja puede unir y leer el último mensaje de conversaciones de bandejas de las que no es miembro en Chatwoot. Detalle en la spec, §5 F2.

- **Dónde entra Contabilidad al Archivo Kommo** (la spec lo dejaba a la F2). Propuesta de la F2 (F2-7): acceso extra **por persona** a la Bandeja, no al rol entero. Con eso ve el panel y abre el Archivo; también abre la Bandeja entera de Studio (en Chatwoot solo ve las bandejas de las que es miembro). Si Sam quiere «solo el Archivo», es otra pieza (una vista propia), fuera de la F2.
- **D3, lectura literal** (F2-6): Comercial y Soporte ven el texto del Archivo Kommo en la ficha y no lo abren. El encargo del DG decía «rol sin acceso al Archivo Kommo no recibe ni el texto ni el enlace»; la F2 lo cumple para el rol sin Bandeja y sigue la letra de Sam para Comercial y Soporte. Si el DG o Sam quieren ocultarles también el texto del Archivo, es un cambio de una línea en `armarPanel` (`lib/studio/chatwoot/ficha-conversaciones.ts`) y sus pruebas.
- **Cuenta de servicio nueva o reusada** (puerta 2).

## Evidencia

Lo que se corrió, con su estado, va en la PR (sección «Pruebas»). Chequeos pesados (install, typecheck, vitest amplio, build) solo con turno del DG.

## Revisión de datos personales (`revisar-datos-ve`, acotada a la F2)

Resumen: 4 CORRECTO, 0 ENCONTRADO, 3 NO VERIFICABLE. Sin datos sensibles (el texto libre de un mensaje puede contener cualquier cosa, incluida salud: por eso no se guarda, se corta a 160 y sale solo a la Bandeja).

| Dato | Estado | Evidencia |
|---|---|---|
| Texto del último mensaje | CORRECTO | No se guarda: no hay columna (`0554_chatwoot_contact_links.sql:109`); 160 caracteres (`ficha-conversaciones.ts:19`); nota interna sin texto (`:92`); región (`:147`); sin caché (`router-api.ts:64`); logs con código (`ficha-panel.ts:70`, `:109`) |
| Nombre del contacto | CORRECTO | Solo si la ficha no tiene nombre y la región lo permite (`ficha-conversaciones.ts:159`, `page.tsx:318`); nunca teléfono/correo (`nombreVisibleDe`) |
| Unión chat ↔ ficha | CORRECTO (contrato) | RLS `0554…sql:136`; cascada `:111`; ficha borrada `:434`; negativos en el contrato §3 |
| Auditoría | CORRECTO (contrato) | `entity_audit_log` sin nombres (contrato §4j y §5g) |
| Borrado de punta a punta en una base real | NO VERIFICABLE | Solo en PGlite y Postgres de CI; la 0554 no está aplicada en ningún entorno |
| Lo que Chatwoot registra de las lecturas de la cuenta de servicio | NO VERIFICABLE | Configuración del VPS (logs de Rails); fuera del repo |
| Retención de `entity_audit_log` | NO VERIFICABLE | Política general del Studio, no de la F2 |

Marco: CRBV art. 28 (acceso y finalidad) y 60 (intimidad) como referencia; PIPL por el equipo de China: el texto y el nombre no salen del servidor para región `cn` no admin (SDD-0531). No es asesoría legal.

## Impacto documental

- Spec 0650 actualizada (§5 F2, §6, §10, §11). Sin cambios en BRAND ni en el Norte.
- `docs/runbooks/aplicar-migraciones-prod.md` no cambia; las puertas viven aquí hasta que el DG las ejecute.

## Borrar y restaurar una ficha

- Borrado lógico (`deleted_at`): el disparador de la 0554 borra sus uniones y deja **una** fila en `entity_audit_log` (`chatwoot_contact_unlinked`, solo los ids de los contactos y `motivo: ficha_borrada`).
- Restaurar la ficha **no** restaura las uniones: se vuelven a unir por el webhook (con `CHATWOOT_FICHA_UNIR=1`), el relleno o «Unir este chat».
- Borrado físico: la cascada desde `clients` las borra sin fila de auditoría (el Studio no borra fichas físicamente; SDD-0509).

## Mejoras opcionales de la 0554 (revisión de Opus, 3ª ronda)

Para cuando se vuelva a tocar el SQL antes de aplicarla; no bloquean (la PR está aprobada así):

1. El caso 4p del contrato no prueba que `request.jwt.claim.sub` quede igual cuando la función **falla**, ni mata un mutante que restaure siempre `''` en vez del valor anterior.
2. La postcondición no revisa `anon` en `chatwoot_contact_links_actor_puede` (sí `authenticated` y `service_role`).
3. **Condición de mantenimiento:** la comprobación del actor fija solo `request.jwt.claim.sub`. Si `user_has_module` (0538) o `get_user_tenant_id` llegan a depender de `auth.jwt()` o `auth.role()`, hay que revisar `chatwoot_contact_links_actor_puede`.

## FUERA DE ALCANCE DETECTADO

- Las uniones de una ficha fusionada no se mueven al fusionar: va en la SDD-0651 (fusión v2).
- Las conversaciones que la 0504 cruzó antes de la 0554 no tienen id de contacto guardado: entran al panel con su siguiente mensaje (webhook) o con «Unir este chat».
- «Usar este nombre» (D5, segunda parte) para quien edita clientes: no entra en la F2.
