# 0448 aplicada a producción — 2026-09-09

Tarea: aplicar `0448_restore_calculator_settings_0223_history` a prod y dejar el
baseline coherente. Ejecutada por el Director con autorización nominal de Sam.

## Resultado

**APLICADA.** Ledger de prod: 409 → 410 filas, con el basename exacto como `name`,
que es lo que exige la regla hacia adelante de `check-migrations-applied.mjs`.

## El hallazgo que justifica haberla aplicado

La entrada del baseline afirmaba que en prod «su efecto YA ESTÁ». **Era incompleto.**
El sondeo previo confirmó el estado de schema —`peso_max_kg` ausente,
`peso_max_envio_kg` numeric NOT NULL default 9000, CHECK validado con la expresión
correcta, RPC con firma y semántica idénticas— pero **PUBLIC conservaba EXECUTE**
sobre `public_calculator_config()`.

0448 revoca ese privilegio, y su propio postflight aborta si PUBLIC lo conserva:
antes de aplicarla, **producción fallaba una aserción de la propia migración**.

| | antes | después |
|---|---|---|
| EXECUTE sobre la RPC | PUBLIC, anon, authenticated, postgres, service_role | anon, authenticated, postgres, service_role |

El efecto de **schema** ya estaba; el de **privilegios** no. Aplicarla no fue
cosmético: cerró un hueco por el que cualquier rol, incluidos los futuros, podía
ejecutar la RPC.

## Cómo se garantizó la transacción única

La migración borra la RPC al principio y la recrea al final: sin atomicidad, un
fallo intermedio deja la calculadora pública sin API.

- Se comprobó que el endpoint **honra `begin`/`rollback`** entre sentencias de una
  misma llamada.
- Se envolvió el archivo en `begin`/`commit` explícitos — equivalente a
  `psql --single-transaction`, el método que la entrada del baseline exigía.
- **El contenido del archivo no se modificó.**

## Las tres trampas que la entrada advertía

1. **`peso_max_kg` se borra sin migrar valores** → sin consecuencia: la columna ya
   no existía en prod.
2. **DROP/CREATE resetea owner y pierde GRANT personalizados** → verificado después:
   owner `postgres`, igual que las 313 funciones SECURITY DEFINER del esquema, y la
   ACL quedó intacta salvo la revocación deliberada a PUBLIC. **Gap de procedimiento
   declarado: el owner se inventarió DESPUÉS de aplicar, no antes.** No hubo daño,
   pero el orden correcto era el inverso.
3. **El CHECK se reconstruye siempre como `> 0`** → sin consecuencia: la expresión
   previa ya era exactamente esa.

## Verificación posterior

RPC existe; PUBLIC sin EXECUTE; `peso_max_kg` ausente; `peso_max_envio_kg` NOT NULL;
CHECK validado; fila en el ledger; y **llamada real a la RPC devolviendo sus diez
escalares**. Sin residuo de los sondeos.

## Este cambio

Saca `0448_restore_calculator_settings_0223_history` de `pendingBelowCutoff`, que es
lo que la propia entrada mandaba al aplicarla. **El `cutoff` no se toca** — también
lo decía: «no subas cutoff para taparla».

## FUERA DE ALCANCE DETECTADO

- Quedan **9 PR abiertos**, 8 de ellos en conflicto, ninguno revisado en esta tarea.
- `0017_no_olvidar` sigue pendiente, gated por un review criptográfico externo.
