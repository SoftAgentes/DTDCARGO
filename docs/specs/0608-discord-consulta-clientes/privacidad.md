# SDD-0608 — Revisión de datos personales: `/cliente` lleva nombres de clientes a Discord

Hecha el 2026-11-05 con [`revisar-datos-ve`](../../../.claude/skills/revisar-datos-ve/SKILL.md), sobre la rama `claude/discord-consulta-clientes-c50c23`. Alcance: sólo lo que cambia esta spec — qué sale del Studio hacia Discord cuando alguien usa `/cliente`, y el registro nuevo de consultas. No es una auditoría del sistema. Complementa la revisión de la SDD-0606 (`docs/specs/0606-avisos-studio-a-discord/privacidad.md`, en su rama), que trata a Discord como tercero nuevo.

**No es asesoría legal y no afirma que el proyecto cumple.** Cada punto queda en `ENCONTRADO`, `CORRECTO` o `NO VERIFICABLE`.

Marco: Venezuela no tiene ley especial de datos personales; rigen la Constitución (arts. 28 y 60) y la Ley Especial contra los Delitos Informáticos (arts. 20 a 22, revelación indebida de data personal, responsabilidad penal de personas). Detalle en la [checklist](../../../.claude/skills/revisar-datos-ve/references/checklist-datos-ve.md), puntos 2, 6, 8 y 12. PIPL (China) no aplica a esta spec: nada se trata en China y el rol «Equipo» no incluye, según lo informado, al equipo de Yiwu.

## 1 · Resumen

| Estado | Cantidad |
|---|---|
| `CORRECTO` | 8 |
| `ENCONTRADO` | 3 |
| `NO VERIFICABLE` | 5 |

## 2 · Inventario

### Qué sale a Discord

| Cuándo | Sale a Discord | Lo que NO sale | Evidencia |
|---|---|---|---|
| Respuesta a `/cliente` | Hasta 10 **nombres de clientes** con su código (Shipping Mark) y el enlace a su ficha; el término que escribió quien preguntó | Teléfono, correo, dirección, documento, facturas, montos, saldo, estado de envíos | `lib/studio/discord/consulta/respuesta.ts` (`mensajeDeResultados`) · `supabase/migrations/0516_discord_consulta_clientes.sql` (`discord_buscar_clientes` devuelve sólo `markbox` y `name`) |
| Rechazos | Un texto fijo («No autorizado…», «Espera un minuto…») | Cualquier dato de cliente | `respuesta.ts` (`MENSAJES`) |

Es una **excepción consciente** a la regla de la SDD-0606 («sin nombre»): Sam la pidió con estas palabras: «Puede darle el nombre, pero no le puede dar datos de facturas». La diferencia con un aviso de canal: la respuesta es efímera (sólo la ve quien preguntó, no queda en el historial del canal) y sólo sale a una persona con enlace y permiso de ver clientes en el Studio, que ya vería ese nombre entrando al Studio.

Discord recibe además, por su cuenta, lo que el usuario escribe en el comando (el término) y la IP del servidor del Studio que responde.

### Dato nuevo que guarda el Studio

```
discord_consultas_clientes | registro de cada consulta /cliente
  discord_user_id   : ID de la cuenta de Discord de quien preguntó (personal o la cuenta compartida)
  user_id, tenant_id: su usuario del Studio y tenant, si hay enlace
  termino           : lo que buscó (hasta 100 caracteres; puede ser el nombre de un cliente)
  resultado         : ok / sin_enlace / enlace_ambiguo / sin_permiso / limite / no_disponible
  finalidad         : trazabilidad (quién consultó a qué cliente y cuándo) y límite por minuto
  retención         : 180 días, borrado en cada registro (migración 0516)
  quién lo ve       : sólo service_role (RLS sin policies; sin privilegios para anon ni authenticated)
```

No guarda qué clientes se mostraron, sólo el término. Titulares: personal del Studio (quien pregunta) y clientes (si el término es un nombre).

## 3 · Hallazgos

### `CORRECTO`

1. **La base sólo entrega código y nombre.** `discord_buscar_clientes` está declarada `returns table (markbox text, name text)`; el contrato lo verifica y un mutante que agrega el teléfono cae (`supabase/tests/0516_discord_consulta_clientes.test.sql`, CONTRATO 3; `consulta-clientes.migration.test.ts`).
2. **El código descarta lo que sobre aunque la base devolviera más.** `consulta.ts` arma cada coincidencia con `markbox` y `name` explícitos; la prueba de la ruta le pasa filas con teléfono, correo, dirección, monto y estado de envío y comprueba que no salen (`route.test.ts`, «hay tres Pedro Pérez»).
3. **Sólo lo ve quien preguntó.** Toda respuesta lleva `flags: 64` (efímera) y `allowed_mentions: { parse: [] }` (`respuesta.ts`, `respuestaEfimera`); probado en cinco caminos distintos (`route.test.ts`).
4. **Sólo pregunta quien ya podría verlo en el Studio**: enlace único, membresía activa en el tenant del servidor y permiso del módulo `clients` con los desvíos del tenant (`consulta.ts`, `autorizar`). Desvíos ilegibles → no responde.
5. **Un comodín no vacía la base.** `%`, `_`, `\` escapados y `*` literal en SQL; una letra o sólo comodines no devuelven nada (contrato, CONTRATO 1/2, con mutantes).
6. **Cada consulta queda registrada** con quién, cuándo, qué buscó y cómo terminó, y sin registro no hay búsqueda (`consulta.ts`; `route.test.ts`, «si no se puede registrar…»).
7. **El registro tiene plazo**: 180 días, y se borra solo (contrato, CONTRATO 5, con mutante).
8. **Nada de la aplicación lee el registro**: RLS sin policies y sin privilegios para `anon` ni `authenticated`; las funciones sólo para `service_role` (contrato, CONTRATO 6, con mutante).

### `ENCONTRADO`

1. **El nombre del cliente sale a un tercero no declarado en la política pública.** `app/privacidad/page.tsx` («Con quién compartimos datos») no nombra una herramienta de mensajería interna. La SDD-0606 ya lo encontró para los avisos (con códigos); esta spec lo agrava porque sale el **nombre**.
   - Arreglo: la línea que proponga la 0606 tiene que decir que el equipo puede ver **el nombre y el código** del cliente en esa herramienta. Texto público: lo aprueba Sam. No se toca en esta spec.
2. **La cuenta compartida no deja atribuir una consulta a una persona.** Si alguien pega el ID de Discord de la cuenta compartida «DTD Cargo» en su perfil del Studio, las consultas desde esa cuenta quedan registradas a nombre de ese usuario del Studio, sin saber quién del equipo escribió.
   - Arreglo propuesto: **no enlazar la cuenta compartida** a ningún perfil del Studio. Sin enlace, esa cuenta recibe «No autorizado» (la barrera ya existe; falta la regla de operación). Se anota en el handoff para Sam.
3. **El ID de Discord lo escribe cada quien sin verificación.** La 0514 no comprueba que el ID sea de quien lo pega. Un usuario con permiso de clientes podría pegar el ID de otra cuenta de Discord del servidor y darle a esa cuenta su acceso a `/cliente`.
   - Por qué importa: es un insider con permiso entregándolo; ya podría copiar datos del Studio, pero esto lo hace sin dejar su sesión del Studio en el medio. El registro sí guarda el `user_id` del Studio y el `discord_user_id`, así que queda trazado.
   - Arreglo propuesto, no hecho: verificar el enlace con un código que la persona confirme desde Discord (como el `/start` de Telegram). Otra spec; no bloquea con dos personas en el rol.

### `NO VERIFICABLE`

1. **Qué guarda Discord de una respuesta efímera.** No queda en el historial del canal, pero pasa por los servidores de Discord; su retención y uso dependen de sus términos, no leídos en esta revisión.
2. **Contrato con Discord.** Un servidor gratuito se rige por los términos de servicio; no hay acuerdo de tratamiento firmado (igual que en la 0606).
3. **Quién tiene el comando habilitado.** Se configura en Discord (Ajustes del servidor › Integraciones); no se puede comprobar desde el repositorio. La barrera del Studio no depende de eso.
4. **Supresión.** Si un cliente pide que se borren sus datos, el registro de consultas puede tener su nombre en `termino` durante 180 días. No hay procedimiento escrito que lo incluya; el mapa de borrado (`docs/legal/privacidad/mapa-de-borrado.md`) no conoce la tabla nueva.
5. **El comportamiento real contra Discord.** Firmas, PING y formato de respuesta salen de la documentación de Discord; no hay aplicación todavía para probarlo.

## 4 · Evaluación del proveedor (sólo lo que cambia)

| Pregunta | Respuesta |
|---|---|
| Qué le mandamos de más | Nombres de clientes con su código, sólo a quien preguntó y tiene permiso |
| ¿Es necesario? | Sí: es lo que pidió Sam («hay tres Pedro Pérez» se resuelve con el nombre) |
| ¿Se puede minimizar más? | Ya va lo mínimo para distinguir homónimos: nombre + código. Lo demás se ve en el Studio |
| Veredicto propuesto | **Adelante con condiciones**: no enlazar la cuenta compartida; declarar en `/privacidad` que el equipo ve nombre y código en su mensajería interna; agregar `discord_consultas_clientes` al mapa de borrado |

## 5 · Alta propuesta en el inventario de terceros

Fila agregada en `docs/legal/privacidad/inventario-terceros.md`, al final de la sección 1, marcada «propuesto». Al integrarse junto a la de la SDD-0606 conviene fundirlas en una sola fila de Discord que diga ambas cosas: avisos con lo mínimo y, por `/cliente`, nombre y código a quien pregunta.

## 6 · Fuera de alcance: lo que decide Sam o un abogado

- El texto de la línea de `/privacidad`.
- Si los términos de Discord alcanzan como respaldo contractual para nombres de clientes.
- La regla de no enlazar la cuenta compartida (y si se reemplaza por cuentas personales).
- Incluir la tabla nueva en el procedimiento de supresión.
