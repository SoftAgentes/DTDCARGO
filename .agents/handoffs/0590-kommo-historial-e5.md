# Handoff — SDD-0590 · E5 «Historial de Kommo», pasos 5.1 y 5.2 (programa SDD-0582)

- **Owner:** Claude Worker (sesión lanzada por el Director «CRM Chatwoot»), claim `claude-0582-e5`
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\nostalgic-ishizaka-d59700`
- **Rama:** `codex/0582-e5-historial`, base `origin/main` `6d022e94b` (E0 ya integrada)
- **SDD:** 0590 (hija de la 0582), reservada el 2026-10-30 con `sdd:next --reserve kommo-historial-e5` (stub `cd25b03ce`, traído por cherry-pick)
- **PR:** [SoftAgentes/DTDCARGO#342](https://github.com/SoftAgentes/DTDCARGO/pull/342), borrador contra `main` (rama publicada con push normal, autorizado por el encargo)
- **Objetivo:** 5.1 (respaldo completo del historial de Kommo, cifrado con `age`, fuera de Git, en el VPS) y 5.2 (volumen por año y tipo, actividad en 12 meses, estimación de carga y tamaño en Chatwoot, revisar-datos-ve y recomendación de alcance), sin pausar entre ellos. **No** se carga nada en Chatwoot: eso es 5.3 en adelante y lleva otro OK de Sam.
- **Aceptación:** filas 5.1 y 5.2 en `entregado` con evidencia PASÓ / FALLÓ / NO EJECUTADO; script en el repo; respaldo `.age` en el VPS con sha256; informe de conteos sin datos personales; recomendación «todo» o acotado con el porqué.
- **Alcance:** `infra/ops/kommo-historial/`, `docs/specs/0590-kommo-historial-e5/`, filas 5.1 y 5.2 de `docs/specs/0582-chatwoot-piloto/checklist.md`, este handoff, `docs/specs/README.md` (índice generado). No se toca Chatwoot, Meta, la base de producción de Studio ni ningún otro módulo.
- **Permisos de esta tarea:** lectura de Kommo con datos personales (OK de Sam, abajo). Publicar rama y PR en borrador: autorizado por el encargo. Sin merge ni despliegue. Nada pesado sin turno del Director (hay cola de `pnpm verify`).

## Autorizaciones registradas

- Sam, 2026-10-30, por el selector (texto que pasó el Director): «¿Qué historial de Kommo pasamos a Chatwoot (bandeja "Archivo Kommo", solo lectura)?» → **«Todo el historial»**. «¿Autorizas leer el historial de Kommo (con datos personales) para medir el volumen y preparar esa carga?» → **«Sí, autorizo la lectura»**. Cubre leer y contar; el alcance «todo» es la preferencia de Sam y lo confirma el Director con los números. No cubre cargar en Chatwoot.
- Sam, 2026-10-31 (~09:40 UTC), en el chat del Director (texto copiado literal por el Director): 1. Respaldo `.age`: **«12 meses tras el corte (Recomendado)»** → archivo frío con fecha de borrado escrita: corte + 12 meses. 2. Leads sin servicio en el Archivo Kommo: **«Anonimizar a los 24 meses (Recomendado)»** → 24 meses desde el último mensaje; depende del vínculo con el ERP de 5.4. 3. Asesor en el Archivo: **«Nombre de pila (Recomendado)»**. 4. Bots: **«Sí, como «Bot Kommo» (Recomendado)»**. Son decisiones de retención y de presentación para 5.4–5.7 y 8.6; no autorizan cargar en Chatwoot ni arrancar 5.3.
- Director, 2026-10-31: el `.age` no se copia a R2/B2 por ahora (se revisa con el 2.º respaldo de 8.5); la revocación de la integración queda para el cierre de E5, después de 5.3; la política `/privacidad` no cambia y la fila 1.7 de E1 sigue como está. Instrucción: commit y push en esta rama; no arrancar 5.3 hasta su aviso.
- Sam, 2026-10-31 (~10:15 UTC), en el chat del Director (texto literal que pasó el Director): **«Acepto los 5 (Recomendado)»**. La pregunta cubría 2.7, 2.8, 3.4, 5.1 y 5.2 y decía que aceptar no fusiona ni despliega nada hasta el 1 de noviembre. → 5.1 y 5.2 **aceptados**; no autoriza merge ni despliegue.
- Sam, 2026-10-31, al Director: «Sí, bórralo (Recomendado)» → el Director borró con `shred` `/dev/shm/k0582` (55 bytes, del 2026-10-29 19:19 CET; no era de esta tarea). `/dev/shm` del VPS quedó vacío (según el Director; no lo volví a comprobar).

## Estado

| Paso | Estado | Qué hay | Qué falta |
|---|---|---|---|
| 5.1 | **aceptado** | Script `infra/ops/kommo-historial/respaldar-historial.py` 1.1.1 con 24 pruebas (verde en la PC y en el VPS); copia en `/srv/ops/kommo-historial/`. Respaldo `kommo-20261030T233814Z` en `/srv/backups/kommo/` (VPS, 0700): metadatos `tar.zst.age` de 7.500.141 bytes (sha256 `c92eef454dee…fd8a`, igual al `.sha256`), 3.577 adjuntos `.age` (2.099.458.961 bytes), `manifiesto.json` (3.578 entradas con sha256), `informe.*`; claves Sam-2026-10-29 y Emergencia-2026-10-29. Staging en tmpfs borrado por el script; token borrado a mano (02:35 UTC) | Nada en esta tarea: aceptación técnica del Director (2026-10-31 ~09:35 UTC) y de Sam (2026-10-31 ~10:15 UTC, «Acepto los 5 (Recomendado)»). Merge y despliegue aparte, no antes del 1 de noviembre. Fuera del respaldo por Kommo: 12 conversaciones con 403 y 15 adjuntos con 404 (spec §5.6) |
| 5.2 | **aceptado** | Spec §5 (volumen por año, canal, actividad, adjuntos, otras entidades, estimación Chatwoot, límites), `informe-volumen.md` (copia literal del informe, solo conteos), §6 revisar-datos-ve con los conteos y líneas vigentes, §7 recomendación: **todo lo legible + regla de retención escrita antes de 5.7** | Nada en esta tarea: aceptación técnica del Director (2026-10-31 ~09:35 UTC) y de Sam (2026-10-31 ~10:15 UTC, «Acepto los 5 (Recomendado)»). Merge y despliegue aparte, no antes del 1 de noviembre. Retención, asesor y bots: **decididos por Sam el 2026-10-31** (texto literal en «Autorizaciones registradas»; spec §6.3 y §7) |

## Lo que se hizo en sistemas externos

- VPS (lectura y archivos propios): `ls` de `/srv/ops`, `/srv/backups`, `/dev/shm`; herramientas; prueba de round-trip de `age` con llave efímera en `/dev/shm`; copia de `infra/ops/kommo-historial/` a `/srv/ops/kommo-historial/` (0700); carpeta `/srv/backups/kommo/` (0700). No se tocó `/dev/shm/k0582` (55 bytes, de otra sesión, no es un token de Kommo); lo borró el Director con `shred` el 2026-10-31 con el OK de Sam.
- Kommo (2026-10-31, ~00:30 CET, en el Chrome de Sam por Claude in Chrome, con su pedido literal «Abre Chrome, ahí está en Kommo, y crea la integración para ayudarle a seguir»): la integración «DTD 0582 historial (solo lectura)» de 0.6 seguía instalada, así que **no se creó otra**. En su pestaña «Llaves y alcances» se pulsó «Generar token de larga duración» con caducidad **30.11.2026**. El clic en «Copiar» lo negó el clasificador de la app (credencial); lo copió Sam y lo pegó con `pegar-token-kommo-e5-0582.ps1` a `/dev/shm/k0582-e5` (0600, 1035 bytes). `probar-token`: JWT, alcances `list_external_messages,crm`, 30 días, `GET /api/v4/account` HTTP 200, subdominio `dtdcargo`. No se tomaron capturas de la pestaña de llaves. Por el camino se abrió y cerró sin instalar la ficha de un widget de NOVA (clic desviado).

## Cierre (2026-10-31, 03:10 UTC)

**OBJETIVO ORIGINAL.** 5.1: respaldo completo del historial de Kommo, reproducible, cifrado con `age`, fuera de Git, en el VPS. 5.2: conteos por año y tipo, actividad en 12 meses, estimación de carga y tamaño en Chatwoot, revisar-datos-ve del inventario y recomendación «todo» o acotado. Sin cargar nada en Chatwoot ni tocar Meta ni la base de Studio.

**COMPLETADO.**
- `infra/ops/kommo-historial/`: `respaldar-historial.py` 1.1.1 (stdlib; `probar-token`, `extraer`, `informe`, `empaquetar`, `todo`), `pruebas/test_respaldar.py` (24 pruebas con servidor falso: paginación, 429, 404, 403 tolerado solo por conversación, lectura cortada, token solo a hosts de Kommo, 0600, reanudación con ancla, eventos únicos, informe sin PII, paquete y round-trip) y `README.md` (reglas, procedimiento, restauración, opciones).
- Respaldo `kommo-20261030T233814Z` (detalle en la tabla de estado y en la spec §4.3). Tres tramos: 23:38–01:05 (403 en una conversación, tratado como fatal por la 1.0.0), 01:17–02:11 (`IncompleteRead` en un adjunto) y 02:13–02:34 UTC; cada corte se corrigió en el script con prueba y la corrida se reanudó sobre el mismo staging. 0 × HTTP 429.
- Spec `docs/specs/0590-kommo-historial-e5/spec.md` §1–§8 completas; `informe-volumen.md`; checklist 5.1 y 5.2 en `entregado` (`avance-checklist.mjs`: «Entregados sin aceptar: 5.1, 5.2»); `docs/legal/privacidad/mapa-de-borrado.md` §F con la fila del respaldo y su volumen; `docs/specs/README.md` regenerado.
- Conteos clave: 4.715 conversaciones legibles (4.230 personas; waba 2.636, Instagram 1.680, Facebook 377), 54.187 mensajes (22 % de bots), 3.577 adjuntos (2,10 GB), 4.237 contactos (61 % con teléfono), 4.201 leads; 44 % de las conversaciones con actividad en 12 meses, 81 % en 24. Chatwoot: ≈ 67 MB de base + 2 GB de adjuntos; < 1 h por API en lotes o ≈ 30 min por SQL (estimación).

**VALIDACIÓN.**
- Pruebas del script: PASÓ — `python -I infra/ops/kommo-historial/pruebas/test_respaldar.py`: 24 en el VPS (Python 3.12, con `age`/`zstd`); 22 + 2 saltadas en la PC (0600 y paquete no aplican en Windows).
- sha256 del paquete igual al `.sha256`, recalculado tras la corrida: PASÓ. Manifiesto: 3.578 entradas, 2.106.959.102 bytes = 3.577 adjuntos en disco + paquete: PASÓ.
- Descifrado del paquete real: NO EJECUTADO por diseño (solo Sam tiene la llave); el round-trip con llave efímera PASÓ en el ensayo (spec §4.2).
- Informe sin datos personales: PASÓ (prueba con marcas + revisión a ojo del informe real: 0 teléfonos, correos o enlaces).
- Limpieza: `/dev/shm/kommo-e5` no existe; `/dev/shm/k0582-e5` borrado; unidad `kommo-e5-respaldo` recogida: PASÓ (comprobado por `ls` y `systemctl`).
- `corepack pnpm docs:index` + `docs:check`: PASÓ (567 specs). `corepack pnpm sdd:check`: PASÓ (sin números repetidos). `git diff --check`: PASÓ.
- CI de la PR («Calidad local sin secretos»): PASÓ en 27 min 29 s sobre `1aa89e70a` (lo comprobó el Director a las ~09:35 UTC y `gh pr view 342` lo da como SUCCESS).
- `pnpm verify`: NO EJECUTADO — el diff es un script de operaciones en Python, docs, checklist y handoff; no toca Next/Studio ni la base, y hay cola de verify (una corrida pesada a la vez).
- `pnpm knowledge:status`: INVALID global — grafo de `main` `6d022e94b`, estructural y semántico pendientes para cientos de archivos del repo (los míos entre ellos: handoff, spec, `informe-volumen.md`), Archify sin runtime, Obsidian pendiente. Es el estado normal de un worktree: la publicación de Graphify/Obsidian la hace el Director desde `main`.

**PR / BRANCH.** `codex/0582-e5-historial` → PR [SoftAgentes/DTDCARGO#342](https://github.com/SoftAgentes/DTDCARGO/pull/342) (borrador contra `main`). Commits: `c9bb3b165` (reserva), `469231610`, `c000955fa`, `7b2061e71`, `88b718fbb`, `5131a6a9a`, `c7d470f08` y el commit de cierre (HEAD de la PR). Sin merge ni despliegue (no autorizados).

**PENDIENTES DE ESTA TAREA (gate humano).**
- Ninguno: 5.1 y 5.2 **aceptados** por Sam el 2026-10-31 (~10:15 UTC, «Acepto los 5 (Recomendado)») tras la aceptación técnica del Director (~09:35 UTC). Merge de la PR: lo serializa el Director, no antes del 1 de noviembre según la pregunta de aceptación.
- Retención, asesor y bots: **decididos** por Sam el 2026-10-31 y registrados (spec §6.3/§7, «Autorizaciones registradas»). Se aplican en 5.4–5.7 y 8.6, no aquí.
- Si el Director quiere la PR lista para revisión en vez de borrador: `gh pr ready 342`.

**FUERA DE ALCANCE DETECTADO.**
- 12 conversaciones que la integración no puede leer (403 «Not enough rights»; ids dentro del paquete) y 15 adjuntos cuyo enlace ya no existe (404): si alguna importa, abrirla en Kommo con un usuario con más derechos antes de E8.
- Ids de conversación 1..99 sin sondear (el menor visto en eventos es 100): 99 peticiones, para 5.3, que vuelve a pedir el token.
- Revocar la integración «DTD 0582 historial (solo lectura)» al cerrar E5, después de 5.3 (Director, 2026-10-31); el token generado caduca el 30.11.2026.
- `docs/legal/privacidad/registro-tratamiento.md` sin filas para conversaciones (texto y adjuntos); `inventario-terceros.md:40` sin la anotación de copia propia cifrada; `app/privacidad` promete 30 días de respaldos y borrar consultas sin servicio; con las decisiones de Sam del 2026-10-31 la política no cambia (Director): la fila 1.7 de E1 sigue como está.
- Copia del `.age` a R2/B2: **NO por ahora** (Director, 2026-10-31 ~09:35 UTC); se decide junto con el 2.º respaldo de 8.5 (evaluación de proveedor ya hecha).
- Espacio libre en el disco del VPS para 2 GB más de adjuntos en Chatwoot: no medido; va en 5.5/5.6.
- `/dev/shm/k0582` (55 bytes, 2026-10-29 19:19 CET, de otra sesión): no lo toqué; lo borró el Director con `shred` el 2026-10-31 con el OK de Sam («Sí, bórralo (Recomendado)»). `/dev/shm` del VPS quedó vacío (según el Director).
- El informe compacto (solo conteos) quedó en el journal del VPS por el stdout del script.

**HANDOFF AL DIRECTOR.** SDD-0590, PR #342 (borrador), rama `codex/0582-e5-historial`. 5.1 y 5.2 aceptados (Director ~09:35 UTC y Sam ~10:15 UTC del 2026-10-31) con la evidencia de arriba. Recomendación: cargar todo lo legible en «Archivo Kommo» con regla de retención escrita antes de 5.7 (spec §7). Decisiones que necesita Sam: retención (§6.3), nombre del asesor y bots en el Archivo (§6.2 punto 12, §7). 5.3 en adelante necesita otro OK de Sam y volver a pegar el token.

## Actualización (2026-10-31, «~09:35Z» según el Director): aceptación técnica del Director

Mensaje del Director (sesión «CRM Chatwoot») a esta sesión. Lo comprobó por su cuenta, solo con lecturas:

- `/srv/backups/kommo/kommo-20261030T233814Z`: 3.578 `.age` (3.577 adjuntos y los metadatos), 2,0G según `du` (los 2.106.959.102 bytes del manifiesto), root 0700/0600. `sha256sum -c` de los metadatos: OK.
- `/dev/shm`: ya no está `kommo-e5`; solo queda el `k0582` viejo (55 bytes), que no es de esta tarea.
- CI de la PR #342: «Calidad local sin secretos» PASÓ en 27 min 29 s (sobre `1aa89e70a`).
- **Aceptación técnica del Director: dada.** La de Sam llegó a las ~10:15 UTC («Acepto los 5 (Recomendado)»); las filas 5.1 y 5.2 pasan a `aceptado`.
- Decisiones de §6.3 y §7 (retención del `.age`, leads sin servicio, nombre del asesor y bots): llegaron a las ~09:40 UTC y quedaron registradas en «Autorizaciones registradas» y en la spec §6.3/§7.
- Instrucción del Director: **no arrancar 5.3 ni pedir otro token** hasta su aviso.
- Copia del `.age` a R2/B2: **NO por ahora**; se decide junto con el 2.º respaldo de 8.5.

## Aceptación de Sam (2026-10-31, ~10:15 UTC)

Texto literal, en el chat del Director: **«Acepto los 5 (Recomendado)»**. La pregunta cubría 2.7, 2.8, 3.4, 5.1 y 5.2 y decía que aceptar no fusiona ni despliega nada hasta el 1 de noviembre. Filas 5.1 y 5.2 del checklist en `aceptado` con esa cita. Con el OK de Sam («Sí, bórralo (Recomendado)») el Director borró con `shred` `/dev/shm/k0582` (55 bytes, del 2026-10-29 19:19 CET); `/dev/shm` del VPS quedó vacío. 5.3 sigue en espera del aviso del Director; esta tarea queda cerrada.
