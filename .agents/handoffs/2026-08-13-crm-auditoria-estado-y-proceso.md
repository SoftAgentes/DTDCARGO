# Auditoría CRM — estado real y patrón de proceso · 2026-08-13

Medido contra el repo (worktree `DTD-worktrees/crm`, rama `feat/crm-columna-contacto`
@ `a216799d`, sincronizada con `origin/main`). 42 agentes en paralelo; cada hallazgo
accionable pasó por un refutador adversarial antes de entrar acá.

**33 hallazgos confirmados · 3 refutados.** Los refutados están al final: importan
tanto como los confirmados, porque son cosas que parecían ciertas y no lo eran.

---

## 1. El patrón: el trabajo se detiene una capa antes de volverse real

No son siete problemas distintos. Es **uno solo, siete veces**: la parte difícil se
termina con calidad y se salta la última milla —la barata— que la vuelve usable,
verificable o duradera.

| Instancia | La parte difícil (hecha) | La última milla (faltó) |
|---|---|---|
| Verbos Fase 4 | 3 acciones con RBAC, validación, payload puro y test | **1 de 3** tiene botón |
| Teléfonos | 1.666 espejados, tabla puente, columna generada | La UI no los mostraba (se cerró después) |
| Tablero | El verbo de mover, con cola, claim y nudge | Vivía en **una** de las dos vistas |
| SDD-0256 | 3 commits en `main`, migración con `SKIP LOCKED` | La spec sigue siendo un stub `RESERVADO` |
| `.limit(5000)` | `fetchAllRows` correcto y probado | **102 sitios** más, sin regla que los cace |
| Deuda en handoffs | Descrita con `archivo:línea` quirúrgico | Nunca se convierte en mecanismo |
| checklist-kommo.md | — | Congelado el 19-jul, hoy **miente** |

La ingeniería de fondo es buena: la cola con `FOR UPDATE SKIP LOCKED`, la fusión de
payload por `field_id`, la poda con dos guardas, la paginación real. Lo que falta es
sistemáticamente lo más barato del trabajo.

## 2. Verificar un proxy en vez de la cosa

**La categoría más repetida del repo y la única sin ningún mecanismo.** Cinco casos
documentados:

| Caso | El proxy que se midió | Lo que pasaba de verdad |
|---|---|---|
| `--dry-run` del subidor de marca | Archivos locales resueltos | 14 de 35 documentos rotos por la CSP |
| `pnpm typecheck \| tail` | El exit code de `tail` | Typecheck rojo → rompió `main` |
| `chromiumInstalled()` | ¿Existe una carpeta `chromium*`? | Ciego a los otros motores y a la versión |
| Estado de React del panel | La variable decía "cerrado" | El panel se veía abierto |
| PATCH fallido = "código nuevo" | La traza del camino de error | Viejo y nuevo dejan la MISMA traza |

El antídoto existe y está probado: **validación por mutación**. En SDD-0184 se
rompieron 24 invariantes a propósito; 4 sobrevivieron y cada una destapó un bug real.
Pero es voluntaria: ningún paso de `verify.mjs`, ningún test contractual y ninguna
plantilla de handoff exige demostrar que la prueba discrimina.

## 3. El gate se apaga justo donde trabajamos

**5 de 13 pasos degradan a SKIP, y el SKIP no se distingue de un verde** — el hijo sale
con código 0 y `verify.mjs:316` imprime `[OK]`.

| Paso | Se apaga cuando | Frecuencia real |
|---|---|---|
| `migrations-applied` | falta `.env.local` (`check-migrations-applied.mjs:302-304`) | **el modo por defecto es worktree** |
| `sql-tests` | no hay Docker (`run-sql-tests.mjs:67`) | — |
| `schema-rebuild` | no hay Docker (`check-schema-rebuild.mjs:156`) | — |
| `edge-functions` | no se consiguió Deno (`check-edge-functions.mjs:71-73`) | — |
| `e2e` | faltan navegadores (`verify.mjs:184-189`) | ⚠️ sin `.env.local` no se apaga: da **rojo falso** |

Cinco cierres publicaron declarando "verify verde" con `migrations-applied` apagado.
No existe paso que convierta "publiqué con SKIP" en rojo, ni un resumen que diga cuántos
pasos corrieron de verdad.

## 4. Las colisiones de numeración: el check ratifica, no previene

Con `check-numbering.mjs` ya vivo (01-ago) hubo **cuatro colisiones más** de migraciones
—0336, 0342, 0362, 0363— que terminaron declaradas exentas. La tabla de excepciones
creció de 6 a 10 entradas entre el 01 y el 13 de agosto.

El escape está en la regla misma: **una migración ya aplicada no se renumera**, así que
cuando el check salta ya es tarde. La causa raíz —aplicar a prod antes de pushear el
archivo— no la toca el check. (Sí la toca `findOrphans` en `check-migrations-applied.mjs:237`,
que caza la aplicada-sin-archivo a las 24 h.)

Matiz: la exención **no** es el único desenlace — tres colisiones post-check se
resolvieron renumerando (`0df927b2`, `17ab8085`, `52744025`).

## 5. Código commiteado que nunca se publica

`SDD-0091` (motor de flujo): **3 slices con el gate verde, nunca pusheados**; la rama,
los commits y el worktree ya no existen. Sólo quedó la spec.

Medición hoy sobre las 11 ramas locales de los 5 worktrees vivos: **0 ahead en todas**.
O sea, hoy no hay nada colgando. Pero no hay detector: el hook de `Stop` sólo mira
cambios *sin commitear*, y ningún script lista ramas adelantadas del remoto. El comando
que lo mide existe y es de una línea:

```bash
git for-each-ref --format='%(refname:short)' refs/heads | while read b; do n=$(git rev-list --count origin/main..$b 2>/dev/null); [ "${n:-0}" -gt 0 ] && echo "$b: $n commits sin publicar"; done
```

---

# CHECKLIST

## A. Cerrar la Fase 4 (lo que falta para que esté completa)

- [ ] **1. Arreglar la fusión de arrays en la cola ANTES de cablear etiquetas.**
      `0364_kommo_outbox_fusiona_payload.sql:104-114` fusiona profundo **sólo**
      `custom_fields_values`; para el resto hace `payload = viejo || nuevo`, superficial.
      La `0365:57` ya admitió `patch_tags`, cuyo payload es un **array**
      (`tags_to_add`/`tags_to_delete`). La propia 0364 lo dejó avisado por escrito en sus
      líneas 25-28 — la condición que lo activaba ya se cumplió y nadie volvió.
      **Orden importa:** construir la UI de etiquetas primero mete un bug de pérdida
      silenciosa de datos. Migración nueva.
- [ ] **2. La UI de los dos verbos que quedaron sin superficie.**
      `reassignLeadOwnerAction` (`actions.ts:415-446`) y `setLeadTagsAction` (`:449`)
      tienen cadena completa —RBAC, validación, payload probado, encolado, nudge— y
      **cero** consumidores. Van en el drawer del lead.
      ⚠️ **Decisión tuya antes de construir:** `docs/specs/0087-kommo-users-mirror/spec.md:47`
      declara "Reasignar leads / round-robin" **fuera de alcance** ("eso vive en Kommo,
      no en el ERP"). El commit de SDD-0256 lo construyó igual. Hay que resolver cuál
      norte manda.
- [ ] **3. Gate de RBAC en la UI.** `page.tsx:58` sólo llama `requireModuleView`.
      `StageControl` se monta sin condición de permiso en las dos vistas
      (`KommoClient.tsx:674-680`, `KommoBoardView.tsx:417-424`); el gate real vive sólo
      en la acción. Un usuario con vista-sin-edición ve el control, lo usa y recibe un
      error — y aprende que la pantalla no sirve. Hoy es latente (la matriz no tiene ese
      rol); se vuelve real el día que se use la UI de overrides.
- [ ] **4. Llenar la spec SDD-0256.** `docs/specs/0256-crm-outbox-operable/spec.md`
      sigue diciendo `RESERVADO` / `status: draft` con **tres commits en `main`**
      (`ef3fa655`, `7551fb01`, `a48d6989`) y una migración de claim aplicada. Se cambió
      comportamiento del ERP sin una línea normativa. Es requisito ISO 9001 §7.5.
      Bonus: SDD-0256 tampoco está en el índice generado y `pnpm docs:check` sale verde
      igual — el gate no compara el índice contra el disco.
- [ ] **5. Reescribir `docs/marketing/checklist-kommo.md`.** Congelado el 19-jul. Su
      fila 5 declara "el bloqueo técnico real" a un cron que existe desde el 11-ago, y su
      fila 6 dice que el write-back está en dry-run cuando lleva días escribiendo a
      producción. `docs/marketing/README.md:37` lo ofrece como "los pasos que faltan".
      **Está desinformando activamente.**
- [ ] **6. Validación desigual del `leadId`.** De los tres verbos, sólo
      `moveLeadStageAction` verifica que el lead exista. Los otros dos encolan contra un
      id que puede no existir.

## B. Fase 5 (lo que hoy es imposible, no sólo pendiente)

- [ ] **7. Método HTTP por op.** `kommo-writeback/index.ts:166` tiene `"PATCH"`
      **hardcodeado**; `resolveTarget()` (`:48-55`) sólo decide la ruta. Una op POST
      encolada hoy saldría como PATCH contra `/leads/{id}`: 400/405, o peor, Kommo
      interpreta el cuerpo de la nota como un patch del lead.
- [ ] **8. Notas y tareas.** No existe la op, ni el payload, ni el tipo. La tarea es la
      que pone la tarjeta roja en Kommo — el semáforo real del equipo.
- [ ] **9. La clave de idempotencia, antes de la primera nota.** Hoy es
      `<leadId>:<op>` (`0364:94`) y el índice único sólo cubre `status='pending'`
      (`0136:48-50`) — con la fila en `processing` la dedup desaparece del todo.
      Correcto para PATCH ("gana el último"), **roto para POST**. No es un bug vivo
      (`add_note` no existe), es un **prerrequisito**.
- [ ] **10. Saldo y carga en tránsito al CONTACTO de Kommo.** Nada lo empuja hoy; el
      único `patch_contact` que existe escribe el Shipping Mark. Es lo de más valor
      comercial: el agente de IA lee campos del contacto.
      ⚠️ Decisión pendiente tuya: sí/no vs. el monto exacto.

## C. Transversal (merece spec propia, no este hilo)

- [ ] **11. `.limit(N>1000)` — quedan 102 llamadas reales en 41 archivos.** Ninguna
      pagina. Las peligrosas no son las del CRM:
      | Dónde | Qué se calcula truncado |
      |---|---|
      | Contabilidad | **balances** sobre máx. 1.000 asientos y 1.000 líneas |
      | Rendiciones | dinero de terceros, sobre recibos truncados |
      | Libros fiscales / retenciones | riesgo legal, no de tablero |
      | Reportes | 12 sitios agregando en JS sobre lecturas capadas |
      Hoy casi ninguna tabla pasa de 1.000 filas. El día que pasen, **102 lugares
      empiezan a mentir el mismo día y ninguno tira error**.
      El arreglo ya existe pero está **privado** (sin `export`) en
      `kommo-analytics.ts:366`. Faltan: exportarlo + una regla `no-restricted-syntax` en
      `eslint.config.mjs` (que hoy sólo tiene `no-restricted-imports`).
- [ ] **12. `sync.ts` y `kommo-client.ts` no tienen ni un test.** La guarda 2 de la poda,
      el tope del espejo, el drenaje de la bandeja y toda la paginación están sin cubrir.
- [ ] **13. La migración 0362 no tiene test de contrato SQL** — incluidas las dos RPC con
      guarda de orden (gemelas del 0107).
- [ ] **14. `paginateTwoPass` trunca en silencio a 20 páginas**; su hermana
      `paginateUnsorted` sí avisa.
- [ ] **15. `custom_fields` y `users` se piden con un solo fetch de `limit=250`** sin
      paginar ni detectar truncamiento.
- [ ] **16. Nadie lee los `sync_logs` de los pasos janitorial** — una poda que falle
      todos los días es invisible.
- [ ] **17. El gate `edge-functions` sale verde aunque los tests de `_shared` no compilen
      bajo Deno.** Medido directo: `check-edge-functions.mjs:90-95` arma las entradas
      filtrando `!d.name.startsWith("_")`, así que `_shared/__tests__` nunca es entrada.
      Los 5 archivos de test no tienen chequeo de tipos por ningún lado (tsconfig los
      excluye, Vitest los transpila sin chequear).

## D. Proceso (lo que evita repetir todo lo de arriba)

- [ ] **18. Que el SKIP se vea.** Un resumen final en `verify.mjs` que diga cuántos de
      los 13 pasos corrieron de verdad, y que un cierre con SKIP no pueda decir "verde".
- [ ] **19. Mutación obligatoria en el handoff.** Un campo que exija: "esta prueba la
      corrí contra la versión sin el arreglo y salió roja". Es la única categoría de
      error repetida 5 veces con cero mecanismo.
- [ ] **20. Detector de ramas sin publicar** (el comando de arriba, en el hook de cierre).

---

## Los 3 refutados — cosas que parecían ciertas y no lo eran

1. **"Dos notas distintas colapsan en una fila y la primera se pierde en silencio."**
   Las citas eran exactas, el impacto falso: `add_note` no existe todavía. Es
   prerrequisito de Fase 5, no un bug vivo. (Sigue en el checklist como #9.)
2. **"Anular una rendición con >1000 recibos deja recibos trabados en `rendido`."**
   El escenario es inalcanzable: el puente tiene un solo escritor y no hay otro insert
   en todo el repo.
3. **"Tres documentos dan tres números distintos de clientes sin llave a Kommo."**
   Las tres citas existen, pero la premisa es falsa — no son el mismo universo.

Sin la fase de refutación, esos tres habrían entrado al checklist como trabajo real.
