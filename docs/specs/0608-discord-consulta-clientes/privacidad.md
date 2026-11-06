# SDD-0608 — Revisión de datos personales: `/cliente` lleva nombres de clientes a Discord

Corrida completa de [`revisar-datos-ve`](../../../.claude/skills/revisar-datos-ve/SKILL.md) (inventario, doce puntos, verificación y reporte) el 2026-11-06 sobre la rama `claude/discord-consulta-clientes-c50c23` (PR #387), con `main` `5373e6c81` traído. Alcance: lo que cambia esta spec. Qué sale del Studio hacia Discord cuando alguien usa `/cliente`, y el registro nuevo de consultas. No es una auditoría del sistema. La revisión de Discord como tercero para los avisos del Studio es la de la SDD-0606 (PR #380, todavía fuera de `main`).

**No es asesoría legal y no afirma que el proyecto cumple.** Cada punto queda en `ENCONTRADO`, `CORRECTO`, `NO VERIFICABLE` o, si el punto no toca esta spec, «no aplica».

**Marcos.** Venezuela: Constitución arts. 28 y 60; SC 332/2001 (finalidad, calidad, temporalidad, autonomía); SC 759/2025 (habeas data, derecho al olvido); Ley Especial contra los Delitos Informáticos arts. 20 a 22 (obtención y revelación indebida de data personal, responsabilidad penal de personas). Textos en `references/marco-legal-ve.md` de la skill. China (PIPL): sólo si un usuario del Studio que trabaja en China usa el comando. Ver punto 9.

## 1 · Resumen

| Estado | Cantidad |
|---|---|
| `CORRECTO` | 9 |
| `ENCONTRADO` | 4 (dos ya corregidos en esta rama) |
| `NO VERIFICABLE` | 5 |
| No aplica | puntos 3 (parcial), 6, 10 y 11 |

## 2 · Inventario de datos

| Dato | Qué es | Finalidad | Base de licitud | Retención | Quién más lo ve |
|---|---|---|---|---|---|
| `clients.name` → respuesta de `/cliente` | Nombre del cliente | Que el equipo distinga homónimos y llegue a la ficha | no evidente en el código; fuera de alcance (abogado) | la de Discord: **NO VERIFICABLE** | **Discord Inc.** (tercero, EE. UU.) y la persona del equipo que preguntó |
| `clients.markbox` → respuesta | Shipping Mark (`DTD-…`) | Ídem; con el enlace lleva a la ficha | ídem | ídem | ídem |
| Término escrito en Discord | Lo que busca la persona del equipo; casi siempre un nombre | Buscar | ídem | Discord: NO VERIFICABLE · Studio: 180 días | Discord Inc. |
| `discord_consultas_clientes.discord_user_id` | ID de la cuenta de Discord que preguntó, con o sin enlace al Studio | Saber quién consultó; tope por minuto | ídem | 180 días, `supabase/migrations/0516_discord_consulta_clientes.sql:164` | sólo `service_role` |
| `discord_consultas_clientes.user_id` | Usuario del Studio enlazado | Atribuir la consulta a una persona | ídem | 180 días | sólo `service_role` |
| `discord_consultas_clientes.termino` | El término, hasta 100 caracteres | Trazabilidad de qué se consultó | ídem | 180 días | sólo `service_role` |

No es dato sensible. Titulares: **clientes** (nombre y código), **personal del Studio** (quien pregunta) y **personas que no son usuarios del Studio** (punto 12). Lo que **no** sale: teléfono, correo, dirección, documento, facturas, montos, saldo ni estado de envíos.

Sam pidió esta excepción a la regla «sin nombre» de la SDD-0606 con estas palabras: «Puede darle el nombre, pero no le puede dar datos de facturas». La respuesta es efímera, así que no queda en el canal. Además sólo la recibe quien ya vería ese nombre entrando al Studio.

## 3 · Los doce puntos

| # | Punto | Estado | Evidencia |
|---|---|---|---|
| 1 | Inventario | `CORRECTO` | Tabla de arriba. Cada columna con dato personal documenta su finalidad: `0516…sql:97` y vecinas (`comment on column`), vigilado por el contrato (CONTRATO 3) |
| 2 | Minimización | `CORRECTO` | La base devuelve sólo `markbox` y `name`: `0516…sql:184`. El código arma cada fila con esas dos claves: `lib/studio/discord/consulta/consulta.ts:169`. Probado con filas que traen teléfono, correo, dirección, monto y estado (`route.test.ts`, «hay tres Pedro Pérez»). El registro no guarda qué clientes se mostraron |
| 3 | Consentimiento | no aplica / fuera de alcance | La consulta es interna del equipo. Que el tratamiento se apoye en el contrato con el cliente o en otra base lo decide un abogado. El ID de Discord lo pega cada quien en su perfil (SDD-0606) |
| 4 | Derechos | `NO VERIFICABLE` | Ver «No verificable» 4 |
| 5 | Borrado | `ENCONTRADO` → corregido en la rama | Faltaba la tabla en el mapa de borrado. Ahora está en `docs/legal/privacidad/mapa-de-borrado.md` §E y Discord en §F. La supresión a pedido sigue sin decidir |
| 6 | Trazabilidad de solicitudes | no aplica | — |
| 7 | Política pública | `ENCONTRADO` | `app/privacidad/page.tsx:246` no nombra una mensajería interna. Texto propuesto en §5 |
| 8 | Terceros | `ENCONTRADO` | Fila propuesta en el inventario (§4). Además, la frase de entrada de la lista de `/privacidad` promete «obligación de confidencialidad» (`app/privacidad/page.tsx:249`), y con Discord no hay contrato que la dé |
| 9 | Transferencia internacional | `ENCONTRADO` (con el 7) | Nombre y código van a EE. UU. (Discord). La §5 de `/privacidad` no lo dice. En Venezuela la base es lo que la política informe (SC 332/2001) |
| 10 | Decisiones automatizadas | no aplica | Buscar no decide nada sobre una persona |
| 11 | Valor probatorio | no aplica | — |
| 12 | Titulares no usuarios | `ENCONTRADO` → documentado en la rama | El registro guarda el ID de Discord de quien no tiene cuenta del Studio, y el término puede ser el nombre de alguien que no es cliente. Agregados a `docs/legal/privacidad/registro-tratamiento.md` §4.4 y §5, con su retención |

### `CORRECTO` (detalle)

1. **Minimización en la base y en el código.** Ver punto 2. Un mutante que agrega el teléfono a la función hace caer el contrato (`consulta-clientes.migration.test.ts`).
2. **Sólo lo ve quien preguntó.** `flags: 64` y `allowed_mentions: { parse: [] }`: `lib/studio/discord/consulta/respuesta.ts:42`. Probado en cinco caminos (`route.test.ts`).
3. **Sólo pregunta quien ya podría verlo en el Studio.** El ID de Discord tiene que estar en un solo perfil (`consulta.ts:81` y `:87`), con membresía activa en el tenant del servidor (`:96`) y permiso `clients` con los desvíos de ese tenant (`:110`, `:124`). Si los desvíos no se pueden leer, no responde. Es la misma regla de `/studio/clientes` (`lib/studio/rbac.ts:90`).
4. **Sólo desde el servidor de DTD Cargo.** `comando.ts:72`. Por mensaje directo o desde otro servidor no consulta la base.
5. **Un comodín no vacía la base.** `0516…sql:200` exige palabras de 2 o más caracteres. `:215` escapa `\`, `%` y `_`, y `*` queda literal. `:207` deja fuera a los eliminados. Todo con mutantes.
6. **Cada consulta queda registrada, y sin registro no hay búsqueda.** `consulta.ts` (registro antes de buscar). Probado en `route.test.ts`, «si no se puede registrar…».
7. **El registro tiene plazo.** 180 días, borrados en cada registro: `0516…sql:164`, con mutante.
8. **Nada de la aplicación lee el registro.** RLS sin policies y sin privilegios para `anon` ni `authenticated` (`0516…sql:110`, `:114`, `:175`, `:227`). El contrato comprueba el privilegio en sí (`has_function_privilege`, `has_table_privilege`), con tres mutantes.
9. **Los errores no dejan datos en los registros del servidor.** La ruta sólo escribe un texto fijo: `app/api/discord/interacciones/route.ts:98`.

### `ENCONTRADO` (por gravedad)

1. **El nombre del cliente sale a un tercero que `/privacidad` no declara** (puntos 7 y 9). `app/privacidad/page.tsx:246` lista alojamiento, correo, Meta, el proveedor de gestión de clientes, analítica y los equipos propios. No lista una mensajería interna. La SDD-0606 ya lo encontró para los avisos con código; esta spec lo agrava porque sale el **nombre**.
   - Por qué importa: en Venezuela la política es un compromiso. Lo que no dice no está informado (SC 332/2001, autonomía), y la transferencia a EE. UU. queda sin soporte.
   - Arreglo: el texto de §5. **Lo aprueba Sam.** Esta rama no toca la página.
2. **La entrada de la lista de `/privacidad` promete confidencialidad que Discord no da por contrato** (punto 8). `app/privacidad/page.tsx:249` dice «Solo acceden a lo necesario y bajo obligación de confidencialidad». Un servidor gratuito de Discord se rige por sus términos de servicio, sin acuerdo de tratamiento.
   - Arreglo: poner la línea de Discord **fuera** de esa lista, en un párrafo propio (§5). La alternativa es conseguir un acuerdo que la respalde.
3. **La cuenta compartida no deja atribuir una consulta a una persona.** Si alguien pega en su perfil el ID de la cuenta compartida «DTD Cargo», las consultas desde ella quedan a nombre de ese usuario, sin saber quién del equipo escribió.
   - Arreglo: **no enlazar la cuenta compartida** a ningún perfil. Sin enlace recibe «No autorizado». Es una regla de operación para Sam (está en el handoff).
4. **El ID de Discord lo escribe cada quien sin verificación** (SDD-0606, migración 0514). Un usuario con permiso de clientes podría pegar el ID de otra cuenta del servidor y prestarle su acceso a `/cliente`. Queda trazado: el registro guarda el `user_id` y el `discord_user_id`.
   - Arreglo propuesto, no hecho: confirmar el enlace con un código desde Discord, como hacía el `/start` de Telegram. Otra spec.

Los dos `ENCONTRADO` corregidos en la rama, puntos 5 y 12, quedan en la tabla de arriba: la tabla nueva en el mapa de borrado y los titulares no usuarios en el registro de tratamiento.

## 4 · Fila del inventario de terceros

**Sí cambia** `docs/legal/privacidad/inventario-terceros.md`. Esta rama agrega, al final de la §1, la fila «**Discord · consulta `/cliente` — propuesto (SDD-0608), todavía sin datos**»:

- **Qué recibe:** hasta 10 nombres de clientes con su Shipping Mark y el enlace a su ficha, sólo para quien preguntó (respuesta efímera), y el término buscado.
- **País:** EE. UU. (Discord Inc.); la ubicación de los datos es NO VERIFICABLE.
- **Contrato:** términos de una cuenta gratuita, sin acuerdo de tratamiento. NO VERIFICABLE.
- **Evidencia:** `consulta.ts`, `route.ts` y esta revisión.
- **Condiciones:** no enlazar la cuenta compartida, declararlo en `/privacidad` y sumar el registro al mapa de borrado (esta última, hecha).

Cuando la PR de la SDD-0606 entre a `main`, su fila de Discord dirá «sin nombre» para los avisos. Al traer `main` hay que **fundir las dos en una sola fila de Discord**, con este texto en «Qué recibe»: «Avisos internos con lo mínimo (título fijo, código, conteos, enlace; sin nombre ni contacto) y, por `/cliente`, el nombre y el Shipping Mark de hasta 10 clientes sólo para quien preguntó.»

## 5 · `/privacidad`: texto exacto propuesto (lo aprueba Sam)

**Sí cambia** `/privacidad` si se activa `/cliente`. Va en `app/privacidad/page.tsx`, sección «4. Con quién compartimos datos», como **párrafo propio después de la lista** y antes del párrafo «No compartimos la información de tu Portal…». No va como ítem de la lista, por el `ENCONTRADO` 2:

> **Mensajería interna del equipo.** Nuestro equipo usa una herramienta de mensajería con servidores en Estados Unidos. Ahí recibe avisos internos con tu Shipping Mark y un enlace a nuestro sistema, sin tu nombre ni tus datos de contacto. Cuando alguien del equipo con permiso para ver clientes busca un cliente por su nombre, la herramienta le muestra solo a esa persona el nombre y el Shipping Mark de los clientes que coinciden. Tus datos de contacto, tus envíos y tus pagos se consultan solo en nuestro sistema. Esa herramienta se rige por sus propios términos de servicio.

Y en «5. Transferencias internacionales», al final del primer párrafo:

> El nombre y el Shipping Mark que ve nuestro equipo en su herramienta de mensajería interna también pasan por servidores en Estados Unidos.

Notas para Sam:

- No nombra a Discord, igual que la página no nombra a Kommo («proveedor de gestión de clientes»). Si se prefiere nombrarlo, basta cambiar «una herramienta de mensajería» por «Discord».
- Cubre también los avisos de la SDD-0606. Si esa línea ya se aprobó con otro texto, se suma sólo la segunda oración.
- Sólo describe lo que el código hace hoy. Si se activa `/cliente` sin la 0606, se quita la primera oración.

## 6 · No verificable

1. **Qué guarda Discord de una respuesta efímera.** No queda en el historial del canal, pero pasa por sus servidores. Su retención y su uso dependen de sus términos, no leídos en esta revisión.
2. **Contrato con Discord.** Un servidor gratuito se rige por los términos de servicio. No hay acuerdo de tratamiento firmado.
3. **Quién tiene el comando habilitado y quién está en el rol «Equipo».** Se configura en Discord, no en el repositorio. La barrera real es la del Studio (CORRECTO 3).
4. **Supresión.** Si un cliente pide borrar sus datos, el registro puede tener su nombre en `termino` hasta 180 días. Qué hacer con esas filas está sin decidir (mapa de borrado §E). Discord no deja borrar una respuesta efímera ya mostrada.
5. **Comportamiento real.** Firma, PING y formato de respuesta salen de la documentación de Discord. La aplicación todavía no existe. El paso 3 de la skill (dato rastreable, borrado y búsqueda en todas partes) no se ejecutó porque no hay entorno con la 0516 aplicada. Se ejecuta en prueba antes de activar.

**China (PIPL).** La matriz del Studio no ata `clients` al alcance de almacén (`lib/studio/rbac.ts:90`, sin entrada en `WAREHOUSE_SCOPED_MODULES`). Un usuario con rol de operaciones y alcance `cn` vería nombres de clientes en el Studio y también por `/cliente`. Eso no lo crea esta spec: `/cliente` repite la regla del Studio. Pero `/privacidad` promete que el equipo en China «no ve tu nombre», y que se cumpla depende de que nadie en China tenga un rol con `clients`. NO VERIFICABLE desde el repositorio.

## 7 · Fuera de alcance: lo que decide Sam o un abogado

- El texto de `/privacidad` (§5) y si se nombra a Discord.
- La base de licitud de mostrar nombres de clientes al equipo en una herramienta de terceros.
- Si los términos de Discord alcanzan como respaldo para nombres de clientes.
- La regla de no enlazar la cuenta compartida, y si se reemplaza por cuentas personales.
- Qué hacer con las filas del registro ante una supresión.

Segunda opinión sugerida: que otro modelo revise la misma rama con esta skill.

*Esto no es asesoría legal: es un inventario técnico y una lista de preguntas para un abogado.*
