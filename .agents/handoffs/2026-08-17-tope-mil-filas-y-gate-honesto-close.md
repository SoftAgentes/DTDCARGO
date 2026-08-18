# Handoff · El tope de 1.000 filas y el gate que decía verde de más — cierre 2026-08-17

> Todo lo de abajo está **medido**: contra el código con `grep`, corriendo el
> gate, o rompiendo a propósito cada mecanismo para ver si se pone rojo.
> Verifica antes de cambiar, pero no vuelvas a descubrirlo desde cero.

**Objetivo 2 del plan del CRM** (bloques C y D). El objetivo 1 —Fases 4 y 5 del
CRM— lo cerró otra ventana; su handoff es `2026-08-14-crm-fases-4-5-cierre.md`.

## Lo que quedó EN `main` (no rehacer)

| Commit | Qué |
|---|---|
| `3842f20b` | **`lib/db/paginate.ts`** — `fetchAllPaged` / `fetchAllByIds`, leer una tabla completa sin que PostgREST la recorte |
| `7973d9ec` → `be8818af` | 10 commits por módulo: contabilidad, fiscal, rendiciones, reportes, naviera, clientes, prealertas, legal, pagos/despacho/costing, partner-finance |
| `1ac68813` | Cierre del barrido: **105 de 105 sitios**, más la regla de ESLint que impide la recaída |
| `45ca2e5b` | **Los dobles de prueba cortan en 1.000 filas** como PostgREST (18 archivos) |
| `24996e56` | Bloque D: el `[SKIP]` deja de verse como `[OK]`, y tres mecanismos más |

## 1. El bug: `.limit(N)` con N > 1.000 no es un límite, es un deseo

PostgREST corta en `db-max-rows = 1000`. `.limit(5000)` **devuelve 1.000 filas,
sin error y sin aviso**. Ese número no era un contrato: era una intención que el
servidor ignoraba en silencio.

**105 sitios.** No eran KPIs de adorno: eran los balances de contabilidad, los
libros de IVA, las retenciones, la rendición de plata de terceros, los 12
reportes, el CBM de los contenedores, la cobranza y el margen.

### Tres cosas que aprendí midiendo y que se van a olvidar si no quedan escritas

**(a) El corte seguro es la página VACÍA, no la página corta.** La regla
intuitiva —"pedí 1.000, vinieron 800, ya terminé"— reintroduce el mismo bug en
cuanto el servidor decida devolver menos por su cuenta. `fetchAllPaged` avanza
**por las filas que recibió**, no por las que pidió, y sólo para cuando llega
una página vacía.

**(b) `.in(ids)` tiene DOS topes distintos y arreglar uno deja el bug vivo.**
El largo de la URL (se resuelve por lotes: `IDS_POR_LOTE = 500`) y las filas que
vuelven (se resuelve paginando). Son independientes.

**(c) 🔴 Cuando lo truncado es una lista de EXCLUSIÓN, el bug se invierte:
muestra de MÁS, no de menos.** Cuatro casos encontrados así — doble
conciliación, doble consolidación, un enlace revocado que seguía vivo y un panel
de salud que se declaraba sano porque no llegó a ver los problemas. En esos, el
truncamiento deja de ser un error de contabilidad y pasa a ser operativo.

### El mecanismo que impide la recaída

Regla en `eslint.config.mjs` (`no-restricted-syntax`) sobre `lib/**` y `app/**`:
un `.limit(N)` literal con N > 1.000 es **error**, no aviso. Validada por
mutación: escribí un `.limit(5000)` nuevo y el lint se puso rojo.

Barrido hoy: `grep -rn "\.limit([0-9]\{4,\})" lib app` sólo devuelve
**comentarios** que explican el bug viejo. Cero código.

## 2. 🔴 El bug vivía en las PRUEBAS tanto como en el código

Esto es lo que más vale de todo el trabajo. **Diecisiete dobles de prueba eran
más generosos que el servidor real**: devolvían todas las filas sin importar el
`.range()` que les pidieran. Por eso 105 sitios equivocados sobrevivieron meses
en verde.

Ahora cada doble corta en `SERVER_CAP = 1000` por request, igual que PostgREST.
Un doble que miente no es un doble: es un permiso.

**Al escribir un doble nuevo de Supabase, la pregunta no es "¿devuelve lo que
necesito?" sino "¿se comporta como el servidor cuando le pido de más?".**

## 3. Bloque D — cuatro mecanismos, cada uno validado rompiéndolo

| # | Qué | Cómo lo rompí para probarlo |
|---|---|---|
| D1 | El `[SKIP]` **deja de imprimirse como `[OK]`**. Cierra con *"13 de 13 pasos corrieron de verdad"*; si alguno se omitió, avisa y dice explícitamente que **no es un cierre verde completo** | forcé 3 omisiones → el resumen las contó y bajó el número |
| D2 | El gate dice **qué dev server reusó** (PID, puerto, hora de arranque) y avisa si está desfasado del commit | levanté un server viejo → salió el aviso |
| D3 | **Detector de ramas sin publicar** (`scripts/check-unpublished.mjs`), enganchado al cierre antes del corto-circuito de "no hay cambios" | creé una rama fantasma → la nombró |
| D4 | Contrato SQL de la migración 0362 (8 casos) · `paginateTwoPass` avisa cuando trunca | rompí la guarda de orden → el contrato se puso rojo |

**`EXIT_SKIPPED = 3`** es la pieza central de D1: un código de salida distinto
para que el padre pueda distinguir *"pasó"* de *"no corrió"*. Antes los dos eran
`0` y el gate no tenía cómo saberlo. Ojo: los pasos con `retry` **no se
reintentan** ante un skip — reintentar algo que no corrió imprime el mismo
`[SKIP]` dos veces y no mide nada nuevo.

### D3 encontró algo real en su primera corrida

`feat/sdd-0258-kommo-resuelve-jubilados` tenía **1 commit sin publicar**. No es
de esta ventana y no lo toqué, pero es exactamente el modo de fallo que perdió
el código de SDD-0091: una rama con el gate verde que nunca se pusheó.

## 4. Lo que NO cubre, dicho en vez de prometido

- **La regla de ESLint sólo ve literales.** `.limit(n)` con `n` variable pasa
  sin que nadie chille. No encontré ninguno hoy, pero el mecanismo no lo cubre.
- **`fetchAllPaged` tiene tope de páginas** y devuelve `complete: false` cuando
  lo alcanza. Quien lo llame **tiene que mirar ese campo**; si lo ignora, vuelve
  a truncar en silencio, sólo que más arriba.
- **43 archivos ya lo consumen.** El que agregue el 44 y no pase por acá va a
  reinventar el bug.

## 5. Estado del gate al cerrar

```
13 de 13 pasos corrieron de verdad
[OK] verify: TODO VERDE ✓ (13/13 pasos medidos)
```

Con un `[AVISO]` conocido en `e2e`: 93 tests pasaron, ninguno falló, y el
proceso salió ≠0 por el worker de WebKit. Es el caso que el absolvedor ya
contempla — no es un fallo de aserción.

## 6. Lo que queda del plan original del CRM

⭐ **Bloque E** — los 5 campos comerciales y el reparto de cartera en Kommo. Es
configuración en el navegador de Kommo, no código: el documento está listo y
espera al founder.
