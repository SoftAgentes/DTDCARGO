# Prompt para otra sesión · Superadmin, Admin y Contabilidad

> Copiá todo lo que está dentro del bloque y pegalo como primer mensaje de la
> sesión nueva. Está escrito para que arranque en frío, sin este contexto.

---

```
Vamos a diseñar y construir el modelo de roles y permisos del Studio (el ERP de
DTD Cargo). Arrancá leyendo AGENTS.md y abrí tu propio git worktree desde
origin/main — hay ~38 worktrees activos, así que no trabajes en el árbol
principal ni en el de otra ventana.

## Qué quiero lograr

Hoy todos los roles del equipo son planos: o sos "admin" y podés todo, o tenés un
rol de área. Quiero tres niveles bien definidos:

1. SUPERADMIN (yo, el founder) — todo lo del admin MÁS las llaves del sistema:
   activar y desactivar módulos/features, y lo que decidamos que no debe poder
   tocar nadie más.
2. ADMIN (José Mendez, director) — acceso total a la operación y al equipo, pero
   SIN las llaves del sistema.
3. CONTABILIDAD (Yolimar Moreno) — hay que definir exactamente qué ve y qué toca.

Te voy a ir pasando los correos de cada persona durante la sesión.

## Lo que YA existe — verificalo antes de construir nada

Esto lo midió otra sesión contra producción el 2026-08-06. Confirmalo vos mismo,
no lo des por cierto:

- Los roles en uso son 6: admin, commercial, accounting, operations, marketing,
  warehouse. Definidos en lib/studio/user-types.ts.
- El permiso por módulo ya existe (SDD-0085): lib/studio/rbac-guard.ts, con
  `moduleEditDenial(supabase, "<módulo>")` y `canEditModule(role, moduleId)`.
  Ese es el punto donde hay que enchufar el nivel nuevo.
- ⚠️ La tabla `platform_admins` YA EXISTE en la base (migración 0058) y tiene 1
  fila — PERO ningún código de app/ ni lib/ la lee. Es infraestructura dormida.
  Decidí si el superadmin se construye sobre ella o se descarta; lo que no vale
  es dejar dos conceptos de superadmin conviviendo.
- Los feature flags YA EXISTEN (SDD-0240): tabla `feature_flags`, 22 filas, 17
  encendidos y 5 apagados, administrados en Studio › Administración. Hoy los
  toca cualquier "admin". Ese es justamente el permiso que hay que subir a
  superadmin.
- ⚠️ Hay al menos una inconsistencia para revisar: el flag `vault` (No-Olvidar)
  está en enabled=true, pero su migración 0017 NO está aplicada a propósito. Un
  flag encendido para algo que no existe en la base.

## Dos huecos que ya se resolvieron (2026-08-07)

⚠️ Este bloque decía que no había recuperación de contraseña Y que no existía
pantalla para cambiarla estando adentro. **La segunda afirmación era FALSA** —
salió de grepear un solo archivo (`usuarios/actions.ts`) y concluir que la
función no existía. La pantalla existía desde el 31-jul en el menú del avatar.
Se deja escrito porque es la clase de error que se propaga: de ahí pasó a las
instrucciones del gerente, que estuvieron a punto de mandarse.

1. RECUPERACIÓN DE CONTRASEÑA — **resuelto** (SDD-0250 · migr 0354). Studio ›
   Usuarios trae «Enviar acceso» por fila; la persona crea su propia clave en
   `/acceso/<token>`. Y estando adentro cualquiera se la cambia desde el menú de
   su avatar. Lo que sigue SIN existir es el "olvidé mi contraseña" del propio
   login: hoy la repone un admin, no la pide la persona.
2. 5 DE 7 USUARIOS NUNCA HABÍAN ENTRADO — **parcialmente resuelto**. El director
   ya entró. Faltan cuatro, y ahora es un clic por persona. El problema de fondo
   era de adopción y de un enlace que se rompía, no de permisos.

## Cómo trabajar acá

- Specs SDD en docs/specs/NNNN-slug/spec.md. Pedí el número con `pnpm sdd:next`
  (NO lo adivines mirando el disco) y volvé a correr `git fetch` justo antes de
  pushear: hubo colisiones por numerar y publicar con horas de diferencia.
- Cerrá con `node scripts/verify.mjs` en verde. Ojo: si lo corrés con `| tail`,
  el exit code que ves es el del tail, no el de verify. Redirigí a archivo.
- Tests contractuales SQL validados CON MUTACIÓN: rompé la regla a propósito y
  comprobá que el test se ponga rojo. Si pasa a la primera sin mutar, no probaste
  nada.
- ⛔ NO apliques migraciones a producción. Escribilas como archivo, validalas
  local, y declaralas en `pendingBelowCutoff` de supabase/migrations-baseline.json
  para no dejar el gate rojo a las demás ventanas. Yo las aplico nombrándolas
  una por una.
- Un cambio de permisos es un cambio de seguridad: cada permiso nuevo se prueba
  por el lado negativo también (que el rol que NO debe, efectivamente no pueda).

## Lo que quiero de vos en esta sesión, en orden

1. Leé el código real y decime qué hay hoy, sin suposiciones: qué puede hacer
   cada rol módulo por módulo.
2. Proponeme la matriz de los tres niveles y discutila conmigo antes de escribir
   código. Quiero decidir yo dónde va cada frontera.
3. Recién ahí: spec, migración (sin aplicar) y código.

Contexto adicional útil: docs/audits/estado-operacional-2026-08-05.md y
docs/audits/pendientes-2026-08-06.md tienen el estado medido del sistema.
```

---

## Notas para vos (Sam) · no van en el prompt

**El equipo, como está guardado hoy.** Nadie tiene cargo cargado
(`position_label` vacío en los 7), así que "gerente" no figura en ningún lado:

| Rol | Nombre | Correo | Último acceso |
|---|---|---|---|
| **admin** | *(sin nombre)* | hailuway.com@gmail.com | hoy · **este eres tú** |
| **admin** | VZLA Pérez | vzla@dtdcargo.com | 27-may |
| accounting | Yolimar Moreno | pagodtd@gmail.com | **nunca** |
| commercial | **Jose Mendez** | sistemaqb@gmail.com | **nunca** |
| marketing | Fiorella de Vita | creativedtd@gmail.com | **nunca** |
| operations | Alejandro Parra | pasantedtd@gmail.com | **nunca** |
| warehouse | Alberto Lameda | logisticavzladtd@gmail.com | **nunca** |

⚠️ **El único que puede cambiarle el rol a José es `vzla@dtdcargo.com`**, porque
cambiar roles exige ser Admin y no hay otro. Si "el gerente" es alguna de las
otras personas, **no va a poder hacerlo** — tendrías que hacerlo tú, o subirlo a
Admin primero.

**Los enlaces:**

- Equipo (Studio / ERP) → **https://dtdcargo.com/studio/login**
- Clientes (Portal) → **https://dtdcargo.com/portal/login**
