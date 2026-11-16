# SDD-0637 — Revisión de datos personales: lo que guardará Faro (puerta de la fase 2)

Corrida de [`revisar-datos-ve`](../../../.claude/skills/revisar-datos-ve/SKILL.md) el 2026-11-16, sobre `main`
`2794b74a5`, rama `claude/0637-faro-revision-datos`. Alcance: el tratamiento que introducirá Faro según esta spec
(§6.3 alertas, §6.4 registro, §8 Hermes, §10) y lo que ya existe en `lib/studio/asistente/contenido/`. No es una
auditoría del sistema. Todavía no hay tablas ni código de servidor de Faro: casi todo lo de abajo son **condiciones
de diseño** que la migración de la fase 2 debe cumplir, no defectos de código ya escrito.

**No es asesoría legal y no afirma que algo cumple.** Cada punto queda en `ENCONTRADO`, `CORRECTO`,
`NO VERIFICABLE` o «no aplica».

**Marcos.** Venezuela: CRBV arts. 28 y 60; SC 332/2001 (finalidad, temporalidad, autonomía); SC 759/2025 (habeas
data, derecho al olvido); Ley Especial contra los Delitos Informáticos arts. 20 a 22. China (PIPL): aplica, porque
parte del equipo que usará el Studio trabaja en China (punto 9). Textos en `references/` de la skill.

**Decisión de Sam que enmarca esta revisión (2026-11-16).** Ante la pregunta «¿Apruebas la recomendación de Codex
sobre memoria y novedades?», respondió «Sí, apruébala». Queda así:

- Faro recuerda **solo la conversación en curso**, acotada. No hay memoria por persona entre conversaciones.
- El conocimiento compartido (guías y novedades) mejora con lo que se pregunta, siempre con aprobación humana y PR.
- Cada función nueva del Studio trae su guía y su novedad en la misma PR.

## 1 · Resumen

| Estado | Cantidad |
|---|---|
| `CORRECTO` | 3 |
| `ENCONTRADO` | 9 (condiciones para la fase 2 y para el primer envío real) |
| `NO VERIFICABLE` | 5 |
| No aplica | punto 11 |

## 2 · Inventario de datos (diseño de la fase 2)

Separado en tres finalidades, cada una con su plazo. Los nombres de tablas son propuesta; los fija la migración.

| Dato | Qué es | Finalidad | Base de licitud | Retención (D-6, aprobada por Sam el 2026-11-16) | Quién lo ve |
|---|---|---|---|---|---|
| `asistente_conversaciones.usuario_id`, `creada_at` | Quién abrió la conversación y cuándo | Auditoría y continuidad de la conversación activa | Fuera de alcance (abogado); relación laboral, probablemente | **180 días** desde la creación, fijo | Administrador del tenant |
| `asistente_mensajes.texto` (pregunta) | Lo que escribió la persona del equipo, **ya depurado** (§3, hallazgo E-3) | Auditoría; contexto de la conversación activa | ídem | **180 días**, se borra la fila completa | Administrador del tenant; el proveedor de IA lo recibe al preguntar |
| `asistente_mensajes.texto` (respuesta) | La respuesta final que se mostró | Auditoría | ídem | **180 días** | Administrador del tenant |
| `asistente_mensajes.resultado`, `pantalla_id`, versiones | Qué decidió el servidor y con qué versión del contenido | Auditoría; señales para mejorar guías | ídem | **180 días** | Administrador del tenant |
| `asistente_eventos` (alerta) | Alerta de bloqueo serio: quién, desde qué pantalla, resultado y regla. **Sin el texto de la pregunta** | Seguridad: aviso al administrador | ídem | **2 años**, clase `security` de [`retention-schedule-v1.md`](../../legal/retention-schedule-v1.md) §3 | Administrador del tenant |
| `asistente_eventos` (feedback) | «Me sirvió / no me sirvió» y motivo cerrado, por respuesta | Mejorar guías | ídem | **180 días**, con su mensaje | Administrador; Hermes solo agregado |
| `asistente_llamadas` | Por intento a la IA: motor, modelo, tokens, costo, tiempo, código de error. **Sin texto ni usuario** | Tope de gasto y operación | Interés del negocio en controlar costo | **13 meses** (comparar el mismo mes del año anterior) | Servidor; administrador agregado |
| `asistente_cuotas` | Consumo por usuario y hora; consumo del mes | Tope por persona (D-5) y tope de gasto (D-8) | ídem | Ventana por hora: **7 días**. Mes: **13 meses** | Solo servidor |
| `asistente_purgas` | Constancia de cada purga: fecha, corte y conteos. Sin usuarios ni textos | Probar que se borró | ídem | Sin plazo (no tiene datos personales) | Administrador |
| Señales para Hermes (vista o punto de lectura) | Tema, pantalla, tipo de carencia, conteos y ejemplos depurados. **Sin identidad** | Mejorar el minicerebro (§8) | ídem | Se calcula al leer; Hermes no guarda copia (E-8) | Hermes (perfil analista) |
| Lecturas del administrador | Qué conversación ajena abrió el administrador y cuándo | Rendir cuentas de quién vio qué | ídem | **2 años**, clase `security` | Administrador; auditoría |

**Datos sensibles.** Ninguno se pide. El riesgo es el texto libre: una persona puede escribir la cédula, el teléfono
o el nombre de un cliente, un monto, o algo de su propia salud. Ver E-3.

**Titulares que no son usuarios (punto 12).** Los clientes que el equipo nombre en una pregunta. Ver E-3.

## 3 · Los doce puntos

### `CORRECTO`

- **C-1 · El minicerebro no lleva datos personales.** Las guías describen botones, no casos; la prueba
  `lib/studio/asistente/contenido/__tests__/catalogo.test.ts` busca correos, teléfonos y montos en guías y catálogo.
  Es una heurística, y la propia prueba lo dice (líneas 8 a 10).
- **C-2 · El contexto enviado a la IA no se guarda.** La spec lo fija en §6.4: catálogo y guías se rearman en cada
  pregunta. Minimiza lo que queda guardado.
- **C-3 · Se puede filtrar por país.** `user_tenants.region` existe (`supabase/migrations/0052_user_region.sql:5-6`,
  valores `ve` y `cn`). Es lo que hace posible E-6 sin construir nada nuevo.

### `ENCONTRADO` (por gravedad)

**E-1 · La purga que se iba a copiar no borra el texto.** La spec (§6.4) toma como modelo la purga de Noticias, y
esa función solo pone en `null` el identificador y deja la fila (`supabase/migrations/0546_noticias_purga_actor_id.sql:178-202`).
En Faro el dato personal está **en el texto**: quitar el `usuario_id` no basta.
*Arreglo:* la purga **borra las filas completas** de `asistente_mensajes` y `asistente_conversaciones` vencidas. El
trigger de solo inserción admite una excepción estrecha: un `delete` dentro de la función de purga
(`security definer`, solo `service_role`), marcada con un `set local` que el trigger comprueba. Nunca un flag que
pueda poner el cliente, nunca desactivar el trigger. Contrato `.test.sql`: el `delete` directo falla y el de la purga
pasa; la purga deja su fila en `asistente_purgas`.
> SC 332/2001, temporalidad · SC 759/2025, derecho al olvido · PIPL art. 47.

**E-2 · Equipo en China: sin mecanismo para sacar sus preguntas del país.** Las preguntas de quien trabaja en China,
con su identidad, saldrían hacia el proveedor de IA (EE. UU.) y hacia el servidor de Contabo (EE. UU.). El registro
de tratamientos ya marca al «equipo de Yiwu» sin gate regional ni consentimiento separado
(`docs/legal/privacidad/registro-tratamiento.md:156`).
*Arreglo:* **Faro apagado para usuarios con `region = 'cn'`** hasta que exista consentimiento separado
(PIPL art. 39) y un mecanismo del art. 38, o hasta que un abogado diga otra cosa. El servidor lo decide, no el panel.
> PIPL arts. 38 y 39.

**E-3 · El texto libre puede traer datos de clientes.** Faro no lee la base, pero la persona puede escribir «el
cliente V-12345678 pagó…». Ese texto iría a la IA y al registro.
*Arreglo:* antes de enviar a la IA **y** antes de guardar, el servidor reemplaza patrones de cédula, RIF, pasaporte,
teléfono, correo y Shipping Mark por marcadores (`[cédula]`, `[teléfono]`…). Lo que se guarda es el texto depurado.
El panel avisa, junto al campo: «No escribas datos de clientes; Faro no los necesita para ayudarte». Prueba
unitaria con casos de cada patrón. No atrapa nombres propios: por eso el aviso sigue siendo necesario.
> SC 332/2001, finalidad · Ley Especial contra los Delitos Informáticos art. 20.

**E-4 · El equipo no tiene aviso de que sus preguntas se guardan.** No existe todavía; la spec lo pide (§10).
*Arreglo:* la primera vez que alguien abre Faro ve un aviso corto: qué se guarda, quién lo lee (D-4), cuánto dura
(D-6), que la IA es de un proveedor externo en EE. UU. y a quién pedir sus datos. Se registra **qué versión del
aviso se mostró y cuándo**, por persona. Es un aviso, no un consentimiento: la base de licitud la decide un abogado.
> CRBV art. 28 (conocer el uso y la finalidad) · SC 332/2001, autonomía.

**E-5 · No hay camino para que una persona vea o pida borrar sus preguntas.** El panel no relee el historial (§6.4)
y la memoria personal quedó fuera, así que la persona no tiene dónde verlas.
*Arreglo:* el administrador puede **exportar** las conversaciones de una persona y **purgar** las suyas a pedido,
con motivo, por la misma función de E-1 y con registro en `asistente_purgas`. El aviso de E-4 dice cómo pedirlo.
Una pantalla «Mis preguntas» queda como mejora posterior.
> CRBV art. 28 · SC 759/2025.

**E-6 · Las alertas marcan a una persona.** Una alerta dice «esta persona intentó saltarse las reglas». Es una
decisión automatizada sobre alguien del equipo, y puede estar equivocada.
*Arreglo:* cada alerta guarda la **regla y su versión** que la disparó y el resultado del servidor; el administrador
la puede marcar como «revisada, sin mérito». Nada de rankings ni puntajes por empleado. La alerta no lleva el texto
de la pregunta; quien la revisa abre la conversación, y esa lectura queda registrada (E-7).
> CRBV arts. 28 y 60 · PIPL art. 24 (referencia).

**E-7 · Leer conversaciones ajenas no deja rastro.** La spec da lectura al administrador (D-4) pero no dice que esa
lectura quede registrada.
*Arreglo:* abrir una conversación ajena pasa por una función que registra quién, cuál y cuándo (clase `security`,
2 años). Acceso por la función, no por `select` directo.
> SC 332/2001, seguridad y confidencialidad.

**E-8 · Hermes no debe recibir conversaciones.** El ciclo de mejora (§8) necesita saber qué se pregunta, no quién.
*Arreglo:* Hermes lee un punto de solo lectura con **agregados y ejemplos depurados, sin identidad**; nunca las
tablas crudas. El conteo de personas distintas lo calcula el servidor. Hermes no guarda copia: la Oficina intenta
borrar la sesión al terminar (`lib/studio/oficina/despachador.ts:169-170`), pero que se borre de verdad es
NO VERIFICABLE (N-3).

**E-9 · Las alertas a Discord o Telegram sacarían la identidad del equipo.** Si se activa D-7, quién preguntó
llegaría a un tercero.
*Arreglo:* hacia afuera solo va un aviso genérico («Hay una alerta de Faro») y el enlace a la campana. Sin nombre,
sin pantalla, sin texto. D-7 sigue apagado al inicio.
> Ley Especial contra los Delitos Informáticos art. 22.

### `NO VERIFICABLE`

- **N-1 · Retención del proveedor de IA.** Qué guarda Anthropic de cada llamada, cuánto tiempo y si lo usa para
  entrenar depende de los términos y la configuración de **la cuenta** que use Faro. No está en el repo. Sin eso
  por escrito no hay envío real (§10).
- **N-2 · El inventario de terceros todavía no nombra a Faro.** Anthropic figura (`docs/legal/privacidad/inventario-terceros.md:38`),
  pero su fila no menciona Faro ni las preguntas del equipo. Hay que sumarlo antes del primer envío real. Corrige la
  frase de §10 que decía que Anthropic no figuraba.
- **N-3 · Que Hermes borre de verdad.** Ver E-8.
- **N-4 · Respaldos.** Una purga no alcanza las copias de respaldo ya tomadas. Su ciclo es el del proveedor
  (clase `backup_replica`); no se comprobó.
- **N-5 · Que los logs no guarden el texto.** La spec lo exige (§6.4). Se comprueba en la fase 3 con una prueba que
  falle si el texto de la pregunta aparece en un log.

### No aplica

- **Punto 11 · Aceptación electrónica.** Faro no pide firmar ni aceptar nada; el aviso de E-4 se lee, no se firma.

## 4 · Fuera de alcance: lo que decide Sam o un abogado

- La base de licitud para guardar las preguntas del equipo.
- ~~Los plazos de §2 (D-6).~~ Aprobados por Sam el 2026-11-16: «Sí, apruébalos».
- El consentimiento separado y el mecanismo PIPL para el equipo en China (E-2).
- El texto final del aviso al equipo (E-4).
- El contrato y la política de datos con el proveedor de IA (N-1).

---

Esta revisión no es asesoría legal. Es un inventario técnico y una lista de condiciones. Conviene que otro modelo
la revise de nuevo antes de escribir la migración.
