---
sdd: "0476"
title: "La tarifa pública se lee de la base, vencida o no"
status: in-progress
author: "founder + Claude Opus 5"
created: 2026-09-17
updated: 2026-09-17
supersedes: null
superseded_by: null
related: ["0101", "0164", "0255", "0474", "0475"]
confidencialidad: interno
---

# DTD-0476 — La tarifa pública se lee de la base, vencida o no

> El día que la tarifa del calculador vence, el sitio deja de leer la base y
> empieza a cotizar con una constante compilada en el código. Hoy nadie lo nota
> porque los dos números coinciden por casualidad. Esto corta esa dependencia.

## Contexto

`public.public_cbm_rate(p_modo text)` —la RPC anon que alimenta `/tarifas`,
`/tarifas/embed` y `/api/public/cbm-rate`— filtra por vigencia:

```sql
and (r.valid_until is null or r.valid_until >= current_date)
...
order by r.valid_from desc nulls last
limit 1
```

Al vencer la tarifa devuelve **cero filas**. `lib/public/rates-queries.ts` hace
`if (!row || row.per_cbm == null) return null`, y los tres consumidores caen a
`CONFIG.tarifaBaseCBM` de `lib/calculadora.ts`: **una constante del código, no
la base**. Sin error, sin log, sin aviso al cliente.

Que hoy el precio no se mueva es **coincidencia numérica**: la constante y la
tarifa del ERP valen lo mismo. La propia constante lo dice en su comentario
(«si algún día suben la tarifa en el Studio, HAY QUE SUBIR TAMBIÉN ESTE
NÚMERO»), y la cabecera de `0336_rate_ddp_850_septiembre_2026.sql` lo avisa dos
veces. Es un acuerdo entre humanos, no un mecanismo: se rompe sola la próxima
vez que cambie el precio.

**Criterio del founder, 2026-09-17 (textual):**

> «Aunque la tarifa se venza o esté vencida, se mantiene el precio anterior. Lo
> que vamos a leer aquí es la base de datos. Ya el tema de si se actualiza o no
> se actualiza es un tema del back-end, no tuyo. Lo importante es que tú
> muestres en la base de datos la última actualización o el precio actual de la
> tarifa.»

### Lo que hay en producción (leído 2026-09-17, sólo catálogo y esa tabla)

| Dato | Valor |
| --- | --- |
| Fila DDP pública con precio | `per_cbm 850.00` · `min_charge 50.00` · `valid_from 2026-09-04` · `valid_until 2026-11-29` · `status published` |
| Otras filas DDP públicas | **dos**, con `per_cbm` en **NULL**, `valid_from 2026-05-24`, `valid_until 2026-12-31` |
| Modalidad `consolidado` | `per_cbm 580.00` · `valid_from` y `valid_until` en **NULL** (nunca vence) |
| Índice | `rates_one_public_cbm_per_tenant_modo` = `unique (tenant_id, public_calc_modo) where is_public and deleted_at is null and per_cbm is not null` |

Las dos filas sin precio existen porque el índice único las ignora (su predicado
exige `per_cbm is not null`). La RPC las descarta por el mismo motivo. **Es el
filtro más importante del WHERE**: sin él, el sitio serviría una tarifa vacía.

## Alcance

**Entra:** el cuerpo de `public.public_cbm_rate(text)`, en una migración nueva
(`0458_tarifa_lectura_sin_vigencia.sql`), más los comentarios del código
consumidor que quedaban mintiendo.

**No entra:** el índice único, ninguna fila de datos, la firma de la RPC,
`lib/calculadora.ts`, `CONFIG.tarifaBaseCBM` ni sus tests de anclaje, **ni el
bloque de comentarios de `app/api/public/cbm-rate/route.ts`**. Todo eso lo está
reescribiendo la SDD-0475 (rama `claude/respaldo-tarifa-850`, viva y sin
fusionar), que entra primero. Tocar el mismo bloque desde acá produciría un
conflicto **semántico**, no mecánico: 0475 escribe ahí que al vencer la vigencia
la RPC devuelve null, y esta spec dice lo contrario.

El código de `route.ts` **no necesita cambiar**: la 0458 no altera la firma de la
RPC ni la forma de la respuesta. Lo único que quedará desactualizado es la prosa
de su cabecera, y se corrige **después** de integrar 0475 (ver Seguimiento).

**No se aplica a producción.** La migración se escribe y se deja en el repo,
declarada como espera en `supabase/migrations-baseline.json`. Aplicarla la
decide el founder con `docs/runbooks/aplicar-migraciones-prod.md`.

## Diseño

### Alternativas evaluadas

**(a) Quitar el filtro de `valid_until` y ordenar de modo que gane la más
reciente.** — **ELEGIDA.**

**(b) Preferir la vigente y, sólo si no hay ninguna vigente, devolver la última
vencida.** — **DESCARTADA.**

### Por qué (b) no se puede ejercitar

(b) presupone un **conjunto** de filas candidatas entre las que elegir. El
esquema no lo permite:

1. `rates_one_public_cbm_per_tenant_modo` admite **a lo sumo UNA** fila con
   `is_public and deleted_at is null and per_cbm is not null` por
   `(tenant_id, public_calc_modo)`. El `status` no entra en su predicado, así
   que ni siquiera puede haber una publicada y una borrador a la vez.
2. El relevo programado de `0336` **despublica la anterior**
   (`is_public = false`) antes de insertar la nueva. La histórica no es
   candidata: no hay a qué «caer».

O sea que el ramal «si no hay vigente, agarrá la última vencida» sería **código
muerto**: ninguna disposición de datos alcanzable lo ejecuta. Y si algún día
alguien dropeara el índice, ese ramal elegiría una fila **distinta** de la que
`/studio/tarifas` muestra como «la pública» y de la que vigila el cron de
vencimiento — el sitio y el ERP dirían precios distintos sin un solo error.

(a) no puede divergir: sirve la única fila pública, la misma que el founder
edita y la misma que el ERP marca. Y es un diff de una línea.

### Lo que la RPC sigue filtrando, y por qué

| Filtro | Por qué se queda |
| --- | --- |
| `is_public = true` | Es la marca del founder. Sin ella la fila no es del sitio |
| `status = 'published'` | Un borrador **nunca** se sirve (regla de 0255) |
| `deleted_at is null` | Soft delete |
| `per_cbm is not null` | Descarta las dos filas DDP públicas sin precio que hay en producción. Sin esto el sitio serviría una tarifa vacía |
| `valid_from is null or valid_from <= current_date` | Una tarifa **programada** a futuro no se adelanta |
| `public_calc_modo = coalesce(nullif(trim(p_modo),''),'ddp')` | La modalidad |

El `order by` pasa de `valid_from desc nulls last` a
`valid_from desc nulls last, updated_at desc, id`: con el índice vivo nunca se
ejercita, pero deja el desempate **total** y alineado con el objetivo (gana la
más reciente) por si el índice desapareciera.

### Las tres preguntas del encargo

**1. ¿El consumidor puede distinguir «vigente» de «vencida»? ¿Hace falta una
señal explícita?**

Puede, y **no hace falta**. La RPC ya devuelve `valid_until`, y
`vencida ⟺ valid_until != null && valid_until < hoy`. La firma **no se toca**:
`app/api/public/cbm-rate/route.ts` y `lib/public/rates-queries.ts` siguen
recibiendo exactamente `(per_cbm, min_charge, valid_until)`, y sus tests siguen
valiendo. Cuatro razones para no agregar un booleano:

- **El sitio público no tiene qué hacer con esa señal.** El criterio del founder
  es mostrar el precio. Decirle al cliente «esta tarifa está vencida» no es un
  requisito: es ruido comercial.
- **Quien necesita la señal es el founder, y ya la tiene.** `rateExpiryBadge()`
  (`lib/studio/rate-types.ts`) pinta «Vencida» / «Por vencer» en
  `/studio/tarifas`, y el cron diario `app/api/cron/rate-expiry-alert/route.ts`
  le avisa por Telegram y correo. Esa es la mitad «back-end» del criterio.
- **Un booleano se congelaría en las cachés.** `/tarifas` tiene ISR
  `revalidate = 300` y `/api/public/cbm-rate` sale con
  `s-maxage=300, stale-while-revalidate=600`. Un `esta_vencida` calculado al
  construir la respuesta viaja congelado hasta 15 minutos; una **fecha** no
  caduca — el consumidor la vuelve a comparar contra su propio hoy.
- **Romper la firma cuesta y no compra nada.** Un campo más obligaría a tocar la
  respuesta del handler y su test de allowlist de claves.

**2. ¿Qué pasa con `valid_from` en el futuro?**

No cambia: el filtro se queda **verbatim** y hay un caso de prueba que lo
comprueba en los tres estados (programada con corte, programada con vigencia
abierta, y el día que arranca). Vencer y todavía-no-empezar son cosas distintas:
lo primero es un precio real que quedó viejo, lo segundo es un precio que nunca
rigió.

**Hueco residual, NO introducido por este cambio:** por el índice único, dejar
una tarifa programada exige **despublicar** la vigente primero. Entre la
despublicación y el arranque el sitio se queda sin fila pública y cae al
respaldo del código. Por eso `0336` usa `pg_cron` para hacer el relevo en el
instante del cambio en vez de precargar la fila. Cerrarlo de verdad exigiría
tocar el índice o el flujo de relevo — fuera de alcance, anotado abajo.

**3. ¿`CONFIG.tarifaBaseCBM` sigue teniendo sentido?**

Sí, pero su significado se **estrecha**. Deja de ser «la red que atrapa el
vencimiento» y pasa a ser sólo el respaldo de una caída real: Supabase
inalcanzable, env ausente, RPC ausente, fila en borrador, `is_public` sin marcar
o `valid_from` a futuro. **No se borra ni se toca acá** — es de la rama
`claude/respaldo-tarifa-850`. Lo que sí queda pendiente es que el comentario de
esa constante, que hoy explica la grieta del vencimiento, quedará **obsoleto en
esa parte** una vez aplicada la 0458. Anotado como pendiente documental para esa
rama / el Director, no ejecutado acá.

## Aceptación

1. Con la tarifa DDP vencida, la RPC devuelve la fila con su `per_cbm`.
2. Con la tarifa vigente devuelve lo mismo que antes (cero regresión).
3. Una tarifa con `valid_from` a futuro **no** se sirve.
4. Las dos filas públicas con `per_cbm` NULL se siguen descartando; sin fila con
   precio la RPC devuelve cero filas, nunca una tarifa vacía.
5. Un borrador nunca se sirve, vencido o vigente.
6. `consolidado` (sin fechas) no cambia.
7. La firma, el `security definer`, el `stable` y los grants
   (`anon`, `authenticated`; PUBLIC sin EXECUTE) quedan idénticos.
8. El índice único sigue prohibiendo dos públicas con precio por modalidad.

## Verificación

`lib/public/public-cbm-rate.migration.test.ts` corre el **archivo `.sql` real**
sobre PostgreSQL embebido (PGlite, dependencia del repo desde SDD-0473) con 11
casos, fechas relativas a `current_date` y un **control rojo** que instala el
cuerpo de 0255 y comprueba que ahí la tarifa vencida devuelve cero filas.
Mutación comprobada: reponer el predicado de `valid_until` en el `.sql` mata 4
de los 11 casos.

No se escribió `supabase/tests/0458_*.test.sql`: esa suite exige Docker, que no
hay en esta máquina, **y el CI (`.github/workflows/quality.yml`) tampoco la
corre**. El test de PGlite sí corre en `pnpm test` y por lo tanto en cada push.
Es el mismo criterio que siguió la 0457 (SDD-0473), que tampoco tiene `.test.sql`.

## Seguimiento (después de integrar, no en esta rama)

1. **`app/api/public/cbm-rate/route.ts`** — su cabecera dice «o `{ per_cbm: null }`
   si no hay tarifa pública **vigente**», y la SDD-0475 le agrega ahí el aviso de
   que al vencer la vigencia el sitio cae a `CONFIG.tarifaBaseCBM`. Con la 0458
   **aplicada** las dos frases dejan de ser ciertas. Se corrige en una tarea
   posterior, **una vez integrada 0475**, para no pelear por el mismo bloque.
2. **`lib/calculadora.ts`** — el comentario de `CONFIG.tarifaBaseCBM` explica hoy
   la grieta del vencimiento como si fuera permanente. Mismo caso: es archivo de
   0475, se actualiza después y sólo cuando la 0458 esté aplicada en producción.
3. **`docs/specs/README.md`** — el índice se regenera con
   `node scripts/build-docs-index.mjs` sobre un árbol que ya tenga **las dos**
   specs (0475 y 0476). Regenerado desde una rama sola, declara hueca la spec de
   la otra.

## Adjuntos

Ninguno.
