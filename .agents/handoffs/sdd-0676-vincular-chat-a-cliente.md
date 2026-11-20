# Handoff · SDD-0676 — «Vincular a cliente» en la Ficha DTD (migración 0566)

- Rama: `claude/kind-hugle-b4191a` · base `main` `65a3ad8db`.
- Spec: `docs/specs/0676-vincular-chat-a-cliente/spec.md`.
- Encargo del Subdirector de Chatwoot (2026-11-18), con el caso de Sam: el cliente que escribe por Instagram y queda «Sin ficha».
- **Nada se ejecutó en producción.** La 0566 está en espera; el código tolera que falte.

## Decisiones de Sam (literal)

Las cinco preguntas de la propuesta se le hicieron con una recomendación cada una. Sam contestó en la sesión del Subdirector de Chatwoot, el 2026-11-18, y el Subdirector lo pasó literal:

> «Las cinco preguntas recomendadas, correcto en todas.»

Es decir, la (a) en las cinco: 1) vinculan Admin y Comercial; 2) un chat unido a otra ficha se mueve con confirmación y motivo; 3) la tarjeta de lead se absorbe sin mover filas (reversible); 4) la búsqueda muestra código, nombre y cuatro dígitos; 5) el motivo es automático.

Origen: sesión del Subdirector de Chatwoot, 2026-11-18. La respuesta la recibió esa sesión, no esta: quedó registrada tal como llegó. Números asignados por el Director General: SDD-0676 y migración 0566.

## Qué hace

1. **0566**: `chatwoot_contact_links.canal_chat`; `crm_tarjetas.absorbida_en` y `absorbida_at`; `chatwoot_ficha_de_contacto`; `chatwoot_vincular_contacto` (une con canal, absorbe la tarjeta del lead, mueve con `p_mover`, audita); `chatwoot_registrar_evento` con `p_contact_id` (la firma de 13 parámetros se reemplaza por una de 14 con valor por defecto); `crm_entrada_chatwoot` y `crm_asesor_desde_chatwoot` con «unión primero, teléfono después»; `chatwoot_quitar_union` y el disparador de ficha borrada sueltan la tarjeta absorbida.
2. **Ficha DTD**: en «Sin ficha», botón «Vincular a cliente» (`VincularCliente.tsx`) para quien edita la Bandeja y ve Clientes. Acciones en `bandeja/vincular-actions.ts`.
3. **Reconocimiento**: `aplicarConversacion` manda el contacto a la base; `marcarContactoErp` escribe segmento y Shipping Mark en contactos vinculados de cualquier bandeja.
4. **Ficha del cliente**: chips «Canales vinculados» con logo; «Vincular otra red» guarda el canal; al quitar un canal que no es WhatsApp se limpian los atributos del contacto en Chatwoot.
5. **CRM**: el tablero no pinta las tarjetas absorbidas, la tarjeta del cliente lleva los logos de sus otros canales y la ficha de la tarjeta muestra «Antes, como lead de …».

## Puertas (cada una con OK nominal de Sam; las hace el Director General)

Ninguna se hizo.

1. **Fusionar la PR**, con revisión independiente (la lanza el Director General) y el CI en verde.
2. **Aplicar la 0566** con `docs/runbooks/aplicar-migraciones-prod.md`, `name` exacto `0566_chatwoot_vincular_canal`. Recomendado antes de publicar el web. Requiere la 0504, la 0506, la 0513 y la 0554 (su preflight para si faltan). Al aplicarla, retirar la entrada de `supabase/migrations-baseline.json` y los grupos `0566-…` de `supabase/pending-migration-symbol-declarations.json`.
3. **Smoke** con una conversación de prueba de Instagram: tabla de `docs/runbooks/chatwoot-ficha-dtd.md` › «Vincular a cliente». Pide un usuario Comercial o Admin vinculado como agente y uno de Soporte para el negativo.

Para que el segmento y el Shipping Mark lleguen al contacto hace falta `CHATWOOT_ATRIBUTOS_CONTACTO=1` (SDD-0649), que tiene su propio OK.

## Necesita a Sam (no frena la PR)

1. **Nombre visible de una tarjeta absorbida**: se conserva para poder deshacer. La anonimización de 12 meses no la alcanza si no está en «Perdido». Opciones en la spec, §9.
2. **Ficha borrada con chats de otras redes**: el segmento y el Shipping Mark de un contacto de Instagram no se limpian solos al borrar la ficha.
3. **`CHATWOOT_FICHA_UNIR`**: el chip de WhatsApp solo sale si ese contacto tiene unión. Según el registro del Director General (2026-11-18) la variable NO está encendida en producción (no medido después). Esta pieza no depende de ella.

## Evidencia

En esta PC no se corrió `pnpm install`, typecheck, vitest ni build: piden turno del Director General y el worktree no tiene `node_modules`. El portón es el CI de la PR. Lo que sí se corrió aquí (Node solo, sin dependencias):

| Comprobación | Estado |
|---|---|
| Cada mutante de `chatwoot-vincular-canal.migration.test.ts` encuentra su texto exactamente una vez en la migración (script propio, 15 textos) | PASÓ |
| `node scripts/check-pending-migration-symbols.mjs` | ver la PR |
| `pnpm install --frozen-lockfile` en el worktree (2026-11-18, con turno del Director General) | PASÓ (pnpm 12.3.4, 2 min 41 s) |
| Vitest acotado: los 15 archivos de la tarea y sus guardas (`rbac-actions-guard`, `spec-migration-refs`, contratos de avisos, fechas y controles; incluye el contrato de la 0566 en PGlite con mutantes y el ensayo del desarme) | PASÓ: 15 archivos, 746 pruebas |
| Vitest de `lib/studio/chatwoot` entero, después del arreglo del 42883 | PASÓ: 48 archivos y 1.046 pruebas; 5 archivos y 37 pruebas saltadas (las que ya se saltan sin su entorno) |
| `tsc --noEmit` (con `prune-next-types`) | PASÓ |
| ESLint de todo el repo | PASÓ: 0 errores, 37 avisos, ninguno en archivos de esta tarea |
| Vitest completo y build | NO EJECUTADO en local: el turno era para la corrida acotada. Los cubre «Calidad continua» del CI |
| CI, cabeza `3941cf343`: «Contratos SQL» | FALLÓ: aserción 4i del contrato. Era el contrato (leía la tabla antes de registrar el evento), no la migración. Corregido en `ecbbff714` |
| CI, cabeza `ecbbff714`: «Contratos SQL» | PASÓ |
| CI, cabeza `ecbbff714`: «Calidad continua» | FALLÓ en Unitarios: 3 pruebas de `caida-webhook.scenario.test.ts` (de 20.704; el resto pasó, y antes ESLint, Frontera RSC, TypeScript y Edge Functions). Sin la 0566, Postgres directo responde `42883` y el respaldo de `aplicarConversacion` solo aceptaba `PGRST202`. Corregido: acepta los dos |
| Smoke en un Chatwoot real | NO EJECUTADO |
| Migración contra producción o el entorno de prueba | NO EJECUTADO |

## `/ui-check` (hecho por el autor sobre el diff; conviene una segunda lente)

- Solo tokens `var(--*)`; fuentes del Studio; sin gradientes ni emojis.
- Componentes del sistema: `ActionButton`, `Aviso`, `CanalLogo`, `studio-btn`, `studio-input`, `studio-label`.
- Nada que se oprima baja de 32 px: resultados de 36 px o más, chips de 32 px.
- Estados: cerrado, buscando, sin resultados, error, confirmación, chat unido a otra ficha, enviando y hecho.
- Accesibilidad: etiqueta con `htmlFor`, estado de la búsqueda en `role="status"`, foco al abrir, el logo del chip es decorativo porque el nombre del canal va en texto.
- Sin anchos fijos nuevos.
- Ajuste aplicado: un `gap: 2` pasó a `var(--s-1)`.
- No verificado: la pestaña a 320 px de ancho dentro de Chatwoot, con datos reales de nombres largos (el código corta con `overflowWrap: anywhere`).

## Revisión de datos personales (`revisar-datos-ve`)

Tabla completa en la spec, §5: 0 ENCONTRADO, 9 CORRECTO, 4 NO VERIFICABLE. Los NO VERIFICABLE son el borrado contra una base real, la retención del nombre visible de la tarjeta absorbida, los atributos viejos tras borrar una ficha y lo que ve un Agente de Chatwoot. No es asesoría legal.

## Revisión independiente del 2026-11-18 (Opus, lanzada por el Director General sobre `0e5b0c9ff`): CHANGES_REQUESTED

Texto recibido del Director General por mensaje entre sesiones; no leí el informe completo.

| Punto | Qué pedía | Estado |
|---|---|---|
| B1 (bloqueante) | `unirChatAction` y `quitarUnionAction` solo exigían editar la Bandeja; con un desvío de rol alguien podía vincular sin ver Clientes | Corregido: las dos pasan por `puedeVincularContacto`. Pruebas nuevas: desvío de rol (unir y quitar) y acceso por persona. Spec §4.8 corregida |
| B2 (bloqueante) | En «ya_estaba» se absorbía la tarjeta sin auditar | Corregido en la 0566: audita con actor, motivo y tarjeta. Contrato, bloque 10 (10a a 10d), y mutante nuevo |
| 3 | Doble clic: el 23505 de la llave con la misma ficha debe responder «ya_estaba» | Hecho en la 0566. **Sin prueba**: hacen falta dos transacciones a la vez y ni el contrato ni PGlite las abren |
| 4 | La auditoría del borrado de ficha incluye las tarjetas soltadas | Hecho (`tarjetas_soltadas`). Contrato 8d y mutante nuevo |
| 6 | El desarme se niega si hay uniones con canal, salvo override explícito | Hecho: `set local dtd.desarme_0566_perder_canal = 'si'`. Ensayo nuevo que comprueba que se niega |
| 7 | El desarme restaura los `comment on function` | Hecho, copia literal de la 0554, la 0513 y la 0504. El ensayo lo comprueba |
| 1 y 5 | Quedan como límites, no como cambios | Anotados abajo con el texto del Director General |

Comprobado en local después de estos cambios y de traer `main` (`bab0dafcc`), con turno del Director General, 2026-11-18:

| Comprobación | Resultado |
|---|---|
| Vitest: `conversaciones-actions`, `rbac-actions-guard`, `spec-migration-refs`, `crm-tablero-vinculos` y la carpeta `app/studio/(app)/crm` (`main` tocó `CrmTableroKanban.tsx`) | PASÓ: 22 archivos, 778 pruebas |
| Vitest: `chatwoot-vincular-canal.migration.test.ts` (contrato con los bloques 8d y 10, 17 mutantes, ensayo del desarme y su negativa) | FALLÓ la primera vez por una cadena partida en la propia prueba (error mío al editar); corregida, PASÓ: 20 pruebas |
| `tsc --noEmit` | FALLÓ la primera vez por la misma cadena; PASÓ después |
| ESLint | FALLÓ la primera vez por lo mismo (1 error); PASÓ después: 0 errores, 37 avisos, ninguno en archivos de la tarea |
| Vitest completo, build y Contratos SQL en Postgres 17 | NO EJECUTADO en local: CI |
| Rama del doble clic (punto 3) | NO EJECUTADO: sin prueba concurrente |

**Límites aceptados por la revisión** (texto del Director General, 2026-11-18; las líneas que cita son de la cabeza revisada, `0e5b0c9ff`, y la 0566 cambió después):

- **1.** «La base no repite "ve Clientes" ni la edición del CRM. chatwoot_contact_links_actor_puede (0554:235-265) solo mira la Bandeja, y la absorción cambia crm_tarjetas sin crm_puede_editar. Desde el navegador no se pueden llamar: las RPC son solo de service_role y el postflight lo verifica. Enumerar fichas por PostgREST ya existía y esta PR no lo empeora.»
- **5.** «Lo que no se revierte: phone_last10 y el asesor heredado no vuelven al deshacer (0566 :232, :221-227).»
- **3.** De acuerdo con el Director General: queda hecho, sin prueba concurrente.

## Segunda revisión (2026-11-18): APROBADO sobre `252dab687`

Texto del Director General por mensaje entre sesiones: B1, B2, 3, 4, 6 y 7 resueltos y sin regresiones. La PR queda en cola de fusión; no se le suben commits. La 0566 se aplica solo con el OK nominal de Sam.

**Menores que quedan para después** (no bloquean; van en una PR posterior):

- La aserción 10d del contrato cuenta la auditoría del contacto 950 sin filtrar por `tenant_id`. Conviene acotarla al tenant.
- En la rama de carrera de `chatwoot_vincular_contacto` (doble clic, 23505 con la misma ficha) se responde «ya_estaba» sin completar `canal_chat` si la fila que ganó no lo traía. La rama normal de «ya_estaba» sí lo completa.

Esta nota se escribió después de la aprobación y está en un commit local sin subir, para no mover la cabeza aprobada.

## Corrección de la 0566 antes de aplicarla (2026-11-18, rama `claude/0566-correccion-portal`)

**Autorización de Sam** (texto recibido del Director General por mensaje entre sesiones; la recibió su sesión, no esta): «Ok, te encargo la corrección al 0566». La #689 ya estaba fusionada (`031ef7ad7`) y la 0566 sin aplicar.

**Problema (lo midió el Director General leyendo `main`).** La 0566 dejaba sin cliente una conversación cuando un evento traía contacto, sin unión y sin teléfono. El chat del portal (0519) fija su cliente sin teléfono y con el vínculo en otra tabla: el primer evento posterior se lo habría quitado. No lo vi al escribir la 0566: mi contrato no cargaba nada del portal.

**Qué cambia** (detalle en la spec, §4.9):

- `chatwoot_contact_links` es el registro único, también para el portal (origen y canal `portal`); `chatwoot_portal_vincular` se redefine en la 0566 y deja ahí la unión, auditada.
- Ningún evento automático quita un cliente: unión → teléfono con ficha única → se conserva. Incluye el teléfono que dejó de coincidir.
- Solo quitar la unión y borrar la ficha dejan conversaciones sin cliente, y lo auditan con el número.
- Columna nueva `chatwoot_conversations.chat_contact_id`.
- La unión del portal no se quita ni se mueve a mano (`55000`); su chip no trae «Quitar».
- El contacto del portal queda fuera de la escritura de segmento y Shipping Mark en Chatwoot.
- Relleno de los contactos del portal que ya existían: `supabase/cargas/portal-uniones-0566/` (función de conteo, función de relleno, README). **No corrido en ningún entorno.** Lleva OK de Sam aparte.
- Desarme: restaura también `chatwoot_portal_vincular`, borra las uniones de origen `portal`, devuelve el CHECK del origen y quita la columna nueva.
- Menores de la segunda revisión, cerrados: 10d con `tenant_id` y la rama de carrera completa `canal_chat`.
- Runbook: «Smoke después de aplicar la 0566», con los pasos para el WhatsApp y el Instagram secundarios de Sam.

**Agregado del Director General (2026-11-18, por mensaje entre sesiones):** Sam ofrece dos lugares para el smoke (entorno de prueba antes de producción, o producción directo) y el runbook deja los dos caminos. La limpieza en producción es con «Quitar», sin borrar filas. El web sale a producción SIN la 0566: Sam aceptó dejarla pendiente. No verifiqué que el entorno de prueba tenga un Chatwoot con los canales secundarios de Sam conectados; el runbook lo dice así.

**Decisiones mías, para que la revisión las mire:**

1. Origen nuevo `portal` (rehace el CHECK del origen de la 0554) en vez de reusar `webhook`: así la base distingue la unión que no se puede quitar.
2. Borrar la ficha deja sin cliente **todas** sus conversaciones, también las cruzadas por teléfono. Sin eso, con la regla nueva seguirían apuntando a una ficha borrada.
3. El desarme **borra** las uniones del portal en vez de convertirlas a otro origen: el web actual las trataría como uniones normales (se podrían quitar y recibirían el Shipping Mark).
4. Si un contacto del portal ya está unido a mano a otra ficha, ni `chatwoot_portal_vincular` ni el relleno lo tocan: los eventos de ese contacto cruzarían a esa otra ficha. El conteo del relleno lo informa (dato 3). Caso raro, pero existe.

**Revisión independiente de la #696 (Opus, sobre `2aaf99462`): CHANGES_REQUESTED.** Texto del Director General por mensaje entre sesiones; no leí el informe completo. El escenario del portal, la seguridad SQL, el relleno y el desarme quedaron bien.

| Punto | Qué pedía | Estado |
|---|---|---|
| M1 (bloquea) | La RPC devuelve ahora el cliente conservado y `unirContactoAFicha` lo tomaba como cruce por teléfono: con `CHATWOOT_FICHA_UNIR=1` cada conservación se volvía una unión permanente | Corregido: la RPC devuelve `origen_cliente` y el manejador une solo con `telefono`. Contrato 4o a 4s, dos mutantes, y pruebas del manejador y del envoltorio. **No lo vi yo**: no revisé quién más leía el cliente devuelto |
| B1 | Carrera con el borrado de la ficha | Revalidación en el `update` (probada: 8h, 8i y un mutante) y `for share` sobre la ficha encontrada (leída, **no ejercida**: pide dos transacciones a la vez) |
| B2 | Orden de despliegue | Web primero, 0566 después: cabecera de la migración, espera del baseline, spec y runbook |
| B3 | Guarda del desarme | No cuenta las uniones del portal (probado en el ensayo) y la nota de que su borrado no se audita |

**Evidencia de esta corrección**

| Comprobación | Resultado |
|---|---|
| Gate de símbolos, con las declaraciones regeneradas | PASÓ (0 rojos, 7 amarillos) |
| Anclas de los 25 mutantes: cada texto aparece una sola vez en la migración | PASÓ |
| Vitest, con turno del Director General: prueba de la migración (contrato en PGlite, 25 mutantes, ensayos del desarme y del relleno), `lib/studio/chatwoot`, los contratos del portal en PGlite, las pruebas de Studio tocadas, guardas e i18n | PASÓ: 82 archivos y 2.121 pruebas; 5 archivos y 37 pruebas saltadas (las que ya se saltan sin su entorno) |
| `tsc --noEmit` | FALLÓ la primera vez: el tipo `UnionVisible` de la ficha del cliente no conocía el origen `portal` (4 errores, error mío; vitest no lo ve porque no comprueba tipos). Corregido, PASÓ |
| ESLint | PASÓ: 0 errores, 37 avisos, ninguno en archivos de la tarea. Corrió antes del arreglo de una línea del tipo; no lo repetí |
| CI, cabeza `3685bc8d4`: «Contratos SQL» en Postgres 17 | FALLÓ: la aserción 4h esperaba que el evento devolviera vacío y ahora devuelve el cliente conservado. Era el contrato; corregido en `9f5f97b1b` |
| CI, cabeza `9f5f97b1b`: «Contratos SQL» | PASÓ |
| Tras los cambios de la revisión de la #696 (M1, B1, B2, B3), con turno: vitest de la prueba de la migración (contrato en PGlite, 28 mutantes, ensayos del desarme y del relleno), `lib/studio/chatwoot` entero, contratos del portal y `spec-migration-refs` | PASÓ: 56 archivos y 1.288 pruebas, 37 saltadas |
| `tsc --noEmit` tras esos cambios | PASÓ |
| ESLint tras esos cambios | NO EJECUTADO en local: CI |
| Vitest completo y build | NO EJECUTADO en local: CI |
| Aplicar la 0566 o el relleno en algún entorno | NO EJECUTADO |
| Smoke del runbook | NO EJECUTADO |

## FUERA DE ALCANCE DETECTADO

- `chatwoot_unir_contacto_manual` (0554) queda sin llamadores cuando la 0566 esté aplicada; se puede retirar en una migración posterior.
- `clasificarContacto` (redirección del número de leads) sigue solo por teléfono: un contacto de WhatsApp sin teléfono (BSUID) vinculado a mano no recibe la redirección de cliente.
- El `segmento` de la Ficha DTD (`FichaDtd.segmento`) sigue en `null`, como lo dejó la SDD-0585.
- La cabecera de `0554_chatwoot_contact_links.sql` todavía dice «NO APLICADA», aunque el candado la registra con fecha 2026-11-18. No se toca: una migración aplicada no se edita.
