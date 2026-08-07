# Prompt para otra sesión · cerrar permisos del Studio

> Copia todo lo que está dentro del bloque y pégalo como primer mensaje de la
> sesión nueva. Está escrito para arrancar en frío, sin este contexto.

---

```
Vamos a cerrar los pendientes del modelo de roles y permisos del Studio (el ERP
de DTD Cargo). Empieza leyendo AGENTS.md y abre tu propio git worktree desde
origin/main — hay muchos worktrees activos, así que no trabajes en el árbol
principal ni en el de otra ventana.

Ya existe uno para este carril: DTD-worktrees/roles-permisos-equipo, rama
feat/roles-permisos-equipo. Si sigue ahí, úsalo (queda atrás de main: haz
`git merge origin/main` primero). Si no, créalo con
`node scripts/harness-worktree.mjs start <slug>` — NO con `git worktree add`
pelado, porque ese no copia .env.local y el gate te va a fallar con 12 pruebas
de auth rojas que parecen un bug tuyo y no lo son.

## Contexto: lo que se cerró el 2026-08-07 (verifícalo, no lo des por cierto)

- SDD-0250 · enlace de acceso. Studio › Usuarios trae «Enviar acceso» por fila.
  Migraciones 0354 (tabla studio_access_tokens) y 0350 APLICADAS.
- Ficha de la persona: clic en el nombre de una fila abre un overlay con sus
  datos, su acceso y las acciones de admin. El cargo (position_label) se edita
  ahí — antes no había forma de cargárselo a nadie.
- SDD-0250 · superadmin. Migración 0355 APLICADA. Dos llaves salieron de manos
  de cualquier admin: los feature flags, y tocar a otro admin (suspenderlo o
  cambiarle el rol, en los dos sentidos).
- platform_admins tiene 2 filas: hailuway.com@gmail.com y
  hailuway.com@hotmail.com (esta última con rol admin y perfil creado).

## Lo primero, y es una deuda: NADIE HA VISTO LA FICHA RENDERIZADA

La ficha de usuario se entregó con su comportamiento probado (15 pruebas
unitarias, gate verde) pero SIN verificación visual — la sesión anterior no
tenía credenciales del Studio. Es lo único que se publicó sin mirar.

Antes de construir nada más:
1. Pídele al founder que abra Studio › Usuarios y haga clic en un nombre.
2. Corre /ui-check sobre app/studio/(app)/usuarios/_components/UserDetailDrawer.tsx
   (regla del founder: todo cambio visual pasa por ahí antes del commit; este se
   saltó el paso por falta de acceso, no por decisión).
3. Si algo se ve torcido, arréglalo antes de seguir.

La pantalla /acceso/[token] SÍ se verificó visualmente en producción — esa no
hace falta revisarla.

## Las decisiones que el founder no ha tomado

Ninguna bloquea nada. Todas necesitan que él arbitre. NO las tomes por él, pero
tampoco se las presentes en crudo: llévale el dato medido y una recomendación.

1. LAS OTRAS LLAVES DEL SUPERADMIN. Hoy siguen abiertas a cualquier admin:
   capa legal, No-Olvidar, Financiero China, Dirección, Mailing y Rendiciones.
   La 0355 subió sólo dos llaves a propósito. Mide qué expone cada una antes de
   recomendar.

2. LA MATRIZ EDITABLE. Es la pieza grande y la más riesgosa.
   - El Norte diseña una pantalla «Permisos por rol» con códigos V/C/E/D
     (docs/design/studio/_norte/erp/modules/admin.jsx:650-660).
   - ⚠️ Esa matriz VIOLA 3 candados de gobernanza en 5 celdas: da Facturación y
     Reportes a Comercial (son MONEY_MODULES, sólo accounting) y Mailing a
     Comercial, Operaciones y Soporte (es ADMIN_ONLY). Cargarla tal cual pone el
     gate rojo en cada corrida.
   - Además lista 17 módulos de 57, 6 roles de 7 (falta Marketing entero), su
     columna "Admin. Tenant" sale vacía por un bug de llave, y sus celdas NO son
     editables: el botón "Aplicar cambios" es decorativo.
   - ⚠️ Contradice una decisión del propio founder del 2026-07-02, escrita en
     lib/studio/rbac.ts: "la matriz NO se vuelve editable en DB, NO hay V/C/E/D
     ni overrides por usuario".
   - PERO SDD-0139 dejó cláusula de reapertura y nombra el gatillo: "matriz
     editable en DB (revisar recién con el 'empleado 4-5' o el primer pedido
     real del founder, como spec propia)". El pedido del founder del 2026-08-07
     ES ese gatillo — para la MATRIZ. Los overrides por usuario siguen
     descartados y exigen una spec que supersede a 0139.
   - Si se avanza: los 7 roles están fijados en CINCO lugares de la base (migr
     0189), así que un rol nuevo es migración, no TypeScript.

3. ¿FIORELLA (marketing) DEBE VER DOCUMENTOS? Es el único rol excluido del hub
   de documentos en la matriz de lib/studio/rbac.ts. Puede ser deliberado o un
   olvido — nadie lo confirmó.

4. ¿YOLIMAR (contabilidad) DEBE VER NÓMINA? Hoy sí: nomina está en
   MONEY_MODULES con accounting. Son los sueldos de sus compañeros.

5. ¿EL ROL `support` SE USA O SE RETIRA? Existe en código, es read-only puro, y
   nadie lo tiene asignado.

6. ¿EL "OLVIDÉ MI CONTRASEÑA" DEL LOGIN? Hoy el acceso lo repone un admin desde
   Usuarios; la persona no puede pedirlo sola. El login todavía dice "Escríbele
   a Sam" con un mailto. Abrirlo exige respuesta idéntica exista o no el correo
   (para no filtrar quién tiene cuenta) y tope por IP — el patrón ya está en
   app/api/contact/route.ts, que reusa portal_registro_throttle con un prefijo.

## Limpieza que el founder puede hacer solo (recuérdasela, no la hagas tú)

- Mandarle el acceso a Yolimar, Fiorella, Alejandro y Alberto: 4 clics.
- Cargar el cargo de las 8 personas desde la ficha nueva.
- Borrar prueba4@dtdcargo.com (desactivado y baneado desde el 20-jul).
- Revocar 3 invitaciones expiradas del 26-may (prueba@, prueba2@, prueba3@).

⛔ NO borres usuarios ni mandes correos a personas reales por iniciativa propia.
Borrar es irreversible y los correos salen a gente de verdad.

## Cómo trabajar acá

- Specs SDD en docs/specs/NNNN-slug/spec.md. Pide el número con `pnpm sdd:next`
  (NO lo adivines mirando el disco) y vuelve a correr `git fetch` justo antes de
  pushear.
- Cierra con `node scripts/verify.mjs` en verde. Ojo: si lo corres con `| tail`,
  el exit code que ves es el del tail, no el de verify. Redirige a archivo.
- ⛔ NO apliques migraciones a producción sin OK del founder NOMBRÁNDOLA. Un
  "dale" no alcanza — es su propia regla, y está en
  docs/runbooks/aplicar-migraciones-prod.md.
- Tests contractuales SQL validados CON MUTACIÓN. Y la mutación tiene que pasar
  las postcondiciones de la migración: si la caza la postcondición en vez de la
  aserción del test, no probaste el test.
- Un cambio de permisos se prueba por el lado negativo Y comprobando que no
  rompiste la operación diaria. Una regla de seguridad que estorba se termina
  revirtiendo.

## Cinco trampas que costaron caro el 2026-08-07 — no las re-descubras

1. UN TOKEN DE UN SOLO USO NUNCA SE CONSUME EN UN GET. El escáner de correo de
   Gmail abre los enlaces del mensaje apenas llega y consumía el token antes de
   que la persona hiciera clic. Ningún enlace llegó vivo a su destinatario. Los
   GET los dispara cualquiera y deben ser idempotentes; el consumo va en el POST.

2. UN STUB MÁS PERMISIVO QUE LA TABLA REAL NO PRUEBA NADA. El contrato de la
   0355 pasó en verde y la migración reventó contra prod con 23503: el stub de
   user_tenants no reprodujo su FK a user_profiles. Antes de estubear una tabla,
   trae sus constraints reales con
   `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid
   = 'public.<tabla>'::regclass`.

3. NO CORRAS DOS GATES A LA VEZ EN EL MISMO WORKTREE. Se pisan el caché de tipos
   generados de Next y typecheck sale rojo con TS6053 sobre archivos que no
   existen. Cura: borrar .next y correr uno solo.

4. EL PASO `test` YA TIENE RED (testTimeout 20 s desde el 2026-08-07), pero si
   igual falla: conjunto DISTINTO entre corridas + mensaje de timeout = carga,
   no regresión. Una regresión falla el MISMO test las dos veces y con una
   aserción, no con un reloj. El paso e2e tiene la misma firma: "worker-N did
   not exit within 300000ms" es teardown, y la corrida tarda 6 min contra 2.

5. EL ÚLTIMO COMMIT DEL PUSH DECIDE SI HAY DEPLOY. El ignoreCommand de
   vercel.json cancela el build si el último commit sólo toca docs/** o *.md.
   Comprobación:
   git diff --quiet HEAD^ HEAD -- . ':(exclude)docs/**' ':(exclude,glob)*.md' \
     && git diff --quiet HEAD^ HEAD -- docs/marketing && echo "NO despliega"

## Lo que quiero de ti, en orden

1. Cierra la deuda visual de la ficha (arriba). Es lo único publicado sin mirar.
2. Llévale al founder las 6 decisiones con dato medido y una recomendación por
   cada una, cortas. Él decide dónde va cada frontera.
3. Recién ahí: spec, migración (sin aplicar) y código.
```

---

## Notas para ti (Sam) · no van en el prompt

**El equipo, medido el 2026-08-07:**

| Rol | Persona | Correo | Superadmin | Entró |
|---|---|---|---|---|
| admin | *(sin nombre)* | hailuway.com@gmail.com | ✅ | sí |
| admin | *(sin nombre)* | hailuway.com@hotmail.com | ✅ | — |
| admin | Jose Mendez | sistemaqb@gmail.com | ❌ | sí, hoy |
| admin | VZLA Pérez | vzla@dtdcargo.com | ❌ | 26-may |
| accounting | Yolimar Moreno | pagodtd@gmail.com | ❌ | **nunca** |
| marketing | Fiorella de Vita | creativedtd@gmail.com | ❌ | **nunca** |
| operations | Alejandro Parra | pasantedtd@gmail.com | ❌ | **nunca** |
| warehouse (VE) | Alberto Lameda | logisticavzladtd@gmail.com | ❌ | **nunca** |

Más `prueba4@dtdcargo.com`, desactivado y baneado desde el 20-jul.

**Ojo con los nombres:** no existe ninguna "Fiorella Pérez". Fiorella es
**de Vita** (Marketing) y Pérez es **VZLA** (Admin). Si en tu cabeza son la misma
persona, uno de los dos nombres está mal cargado — y ahora se corrige desde la
ficha.

**Cargos:** los 8 tienen `position_label` vacío. Por eso "gerente" no figura en
ningún lado del sistema. Se carga en la ficha, y aparece bajo el nombre en la
tabla.
