# Handoff — SDD-0618, E7 `dtd-bot` (programa SDD-0582)

- **Owner:** Claude Worker «E7 bot», sesión `cb282af0` (claim `claude-e7-bot-cb282af0`). Coordina el Subdirector de Chatwoot; fusiona el DG.
- **Objetivo:** etapa E7 (filas 7.1 a 7.11), todo apagado de nacimiento. Diseño en [`docs/specs/0618-bot-propio-e7/spec.md`](../../docs/specs/0618-bot-propio-e7/spec.md).
- **Permisos:** PR en borrador desde `main`, sin fusionar. Sin OK nominal de Sam: nada de 7.1, 7.2, 7.5, modelos pagados, encender el bot ni escribir en Kommo, Meta o el Chatwoot vivo.

## Piezas

| Pieza | Rama / PR | Estado |
|---|---|---|
| A · SDD | #447 | **en main** (tren 3, `9019d3997`, 2026-11-08 16:38Z) |
| C · 7.4 base y reglas duras | #448 | **en main** (tren 3). CI: 152/152; 11/11 mutantes de la revisión del DG |
| D · 7.6 a núcleo puro | #449 | **en main** (tren 3). CI: 125/125; 4/4 mutantes de la revisión del DG |
| B · 7.3 respaldo de Kommo | — | lectura hecha con Sam el 2026-11-08 (ver abajo); falta guardar cifrado en el VPS |
| E1 · 7.6 b, la 0522 | #459, `codex/e7-bot-cola` | migración y contratos; migrate-first (SDD-0618 §6). Revisión del DG en `a45994da2`: CHANGES_REQUESTED (B1 y B2), corregido |
| E2 · manejador, trabajador, watchdog, PoC | — | después de aplicar la 0522 |
| F, G · 7.7 y 7.8 | — | después de E |

Los worktrees de C y D se limpiaron con evidencia el 2026-11-08 16:45Z (registro en las notas de la sesión del Subdirector).

## 7.3 — lectura de Kommo (2026-11-08)

- **Autorización:** Sam, por el DG: lectura en Chrome, con él guiando, solo lectura. Guardar en el VPS, aparte: a la pregunta con las opciones A (cifrar en `/srv/backups/kommo/conocimiento-20261108/` con las llaves de E5) y B (no guardar), Sam respondió literal: «A».
- **Fuentes de IA (7):** el DOCX v7 es el mismo archivo que está en el repo (`docs/specs/0062-crm-erp-cierres-automaticos/assets/DTDCARGO_Kommo_KnowledgeSource_v7_2026-08-06.docx`, commit `9a5d7b0f8`): Kommo cuenta 35 subsecciones = 34 secciones + la portada. `faq-knowledge-base.md` cambió después (por ejemplo, la 15 hoy es «Un solo nombre: DTD Cargo»). Las 5 de texto solo viven en Kommo: «DTD FAQ 1» y «DTD FAQ 2» (5.000 caracteres cada una, el tope de Kommo), «Datos clave» (2.194), «Productos y servicios» (2.308) y «Descripción del negocio» (1.993). La URL `dtdcargo.com` indexó 3 páginas (Servicios, Academia y una más); el resto quedó «Actualizando» desde agosto.
- **Agentes (4, todos desactivados, última actividad 15.10.2026):** rol de 1.457 caracteres, idéntico en los cuatro. Pautas: Cotizador 14, Reenganche 12, asistente de ventas 42, «Atención al cliente de comercio minorista» 13. Fuentes: Cotizador y Reenganche, DOCX + «Conocimiento general» (vacía); asistente de ventas, DOCX + las 3 de texto; minorista, solo el DOCX. Las dos FAQ no las usa ningún agente (su «+1» es otra función de IA de Kommo).
- **«Analiza mi contestación»:** Sam dijo que es lo que los agentes leen de las fuentes de conocimiento; no es una función aparte.
- **Incidente:** en la lista de fuentes abrí por error el lápiz de **cambiar nombre** de «DTD FAQ 1». Lo cancelé con «Cancelar»: no se guardó nada y el nombre quedó igual (visto en pantalla).
- **Alcance del «A»:** cubre los cinco textos de las fuentes. Las pautas de los 4 agentes van en una pregunta aparte (la de la descarga), pendiente.
- **Pendiente:** guardar los textos cifrados (opción A), con OK por paso y Sam presente: la descarga y la escritura en el VPS. El archivo sin cifrar se borra apenas quede cifrado, con evidencia `test ! -e`. Al repo solo nombres, tamaño y sha256 del cifrado. Hasta entonces viven solo en Kommo.

## E1 (la 0522): evidencia

- **Contrato:** `supabase/tests/0522_chatwoot_bot.test.sql` (Postgres con Docker en «Contratos SQL») y `lib/studio/__tests__/chatwoot-bot.migration.test.ts` (PGlite), con control rojo, reaplicar, preflight sin 0519 y mutantes.
- **Primera corrida (`a0b9beac8`):** FALLÓ 19/27 por `pg_catalog.least`/`greatest` (no son funciones de pg_catalog); corregido en `c026327df`, después 27/27.
- **Revisión del DG en `a45994da2`:** B1 (`contesta_solo` quedaba vivo si un UPDATE sacaba la bandeja de `inbox_ids` o cambiaba el tenant, y una exclusión movida no apagaba) y B2 (sin postflight). Las pruebas nuevas van en un commit propio, antes del arreglo, para ver el rojo previo. Evidencia de la corrida en la PR.

## Pendientes para la pieza E2 (revisión del DG de la #459)

- `tomar` no debe entregar un turno tarde (ya pasado el límite más la gracia): mejor que lo cierre `vigilar`.
- Apagar o excluir una bandeja tiene que cancelar los turnos abiertos de esa bandeja.

## Pendientes para la 7.6 b y la próxima edición de la spec

- §9: cargar `CHATWOOT_INBOX_INSTAGRAM_ID` y `CHATWOOT_INBOX_ARCHIVO_ID` en producción es una puerta con su propio OK de Sam (nota del DG).
- `sinEtiquetas` quitó etiquetas que eran instrucciones para el modelo: «escalar · NO afirmar cobertura» (29), «escalar · Comercial/Legal» (30), «no ofrecer como servicio activo» (32), «cuando NO preguntó por restricciones» (22). Vuelven como pautas del bot, aparte del texto al cliente.
- `pide_dato_sensible`: sumar el código por SMS, OTP, código de verificación y token, con rojo previo y mutante.
- La ficha 27 pide el correo por chat: revisar con revisar-datos-ve.
- Falsos positivos aceptados por el DG: «Pedido 1234567», «2.500.000 unidades».

## Impacto documental

- Canónico: la SDD-0618. El checklist de SDD-0582 no cambia todavía (ninguna fila se acepta).
- Graphify, Archify y Obsidian: NO EJECUTADO en esta tarea; lo hace el DG desde main.

## FUERA DE ALCANCE DETECTADO

- Teléfono de la bodega en China distinto entre FAQ #28 (`+86 180 0689 1419`) y `lib/design-tokens.ts:326` (`+86 186 0689 1419`). El bot no da ninguno.
- Contradicciones para Sam (SDD-0618 §1.1): proveedor (F «Gemini + GLM» frente a 3.4 «Solo GLM») y tope (US$25 de E0-D3 frente a US$50 de la 3.4).
