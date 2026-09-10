# 0017_no_olvidar aplicada a producción — 2026-09-10

Autorización nominal de Sam, nombrándola: «referente a la 017 … quiero que lo migres; no
importa la criptografía, aplícalo. Después vemos el tema de la criptografía, no vamos a meter
datos.» Conforme a `docs/runbooks/aplicar-migraciones-prod.md`.

## Resultado

**APLICADA.** Ledger de prod: 425 → **426**. Con esto `pendingBelowCutoff` queda **VACÍO**
por primera vez. El `cutoff` sigue en 238.

## La barrera que se levantó, y la que no

Estaba bloqueada desde julio por un **review criptográfico externo** (envelope encryption).
Sam decidió aplicarla igual y tratar la criptografía después. **Eso es coherente con el
estado real**, y se comprobó tras aplicar:

- `no_olvidar_get_active_kek_version()` devuelve **NULL** → el módulo **no está inicializado**.
- La KEK **no se siembra** en esta migración; su creación es manual y post-deploy vía
  `vault.create_secret` (spec §7.1).
- La policy `no_olvidar_items_owner_insert` exige `setup_completed = true`, y **nadie lo tiene**:
  no se puede crear ni un item.

Es decir: **el esquema quedó instalado y es imposible meter secretos hasta que exista la KEK.**
La barrera criptográfica sigue de pie donde importa.

## El hallazgo que el registro NO tenía

La entrada del baseline afirmaba que el código es inerte —«el page.tsx es un EmptyState y
nadie importa no-olvidar-queries.ts»— y de ahí concluía que aplicarla era inocuo.
**Eso describe el código de la app, no la base.**

Esta migración instala **`no_olvidar_on_auth_user_created`, un trigger `AFTER INSERT` sobre
`auth.users`**: dispara en **cada alta de usuario**, use o no alguien el No-Olvidar. Hasta hoy
`auth.users` **no tenía ningún trigger propio**; éste es el primero.

Se analizó antes de aplicar si podía romper el registro de usuarios. **No puede:**

- aporta las dos únicas columnas `not null` sin default (`totp_secret_ciphertext` y
  `totp_secret_nonce`) con `''::bytea`;
- todas las demás columnas obligatorias tienen default;
- lleva `on conflict (user_id) do nothing`;
- sólo actúa si `raw_user_meta_data->>'tenant' = 'dtd-cargo'`.

**Efecto real:** cada alta futura con ese tenant crea una fila esqueleto en
`no_olvidar_user_keys`, sin secretos. Los **193 usuarios `dtd-cargo` existentes no reciben
fila**: el trigger es sólo para altas nuevas.

## Verificación posterior

| comprobación | resultado |
|---|---|
| md5 de los cuatro cuerpos de función | **4 de 4 coinciden** con el archivo |
| tipos, tablas | 6 enums · **6 tablas** |
| RLS | **6 de 6 tablas** con RLS activa |
| policies | **22** |
| trigger en `auth.users` | `no_olvidar_on_auth_user_created` · **HABILITADO** |
| KEK activa | **NULL** — módulo sin inicializar |
| datos | `user_keys` 0 · `items` 0 · `config` 1 (sólo el seed) |
| ledger | 425 → **426**, basename exacto |

Sin preflight propio: la migración no trae bloque de aborto. Se comprobó a mano que **ninguno**
de sus objetos existía (0 tipos, 0 tablas, 0 funciones, 0 triggers) antes de escribir.
`vault` sólo aparece en comentarios: **no es prerequisito para aplicar**.

## PENDIENTES DE ESTA TAREA

Ninguno de aplicación.

## FUERA DE ALCANCE DETECTADO

- **La criptografía sigue pendiente y ahora es lo único que separa al módulo de poder usarse.**
  Para habilitarlo hacen falta, en este orden: crear la KEK en Vault, insertar su fila en
  `no_olvidar_kek_versions`, y **respaldarla offline**. Sin eso el módulo no arranca — que es
  exactamente el estado deseado hoy.
- El trigger sobre `auth.users` es el primero del proyecto en esa tabla. Conviene tenerlo
  presente al depurar cualquier problema futuro de registro de usuarios.
