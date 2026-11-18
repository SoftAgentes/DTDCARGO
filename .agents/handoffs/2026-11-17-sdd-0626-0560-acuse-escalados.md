# Handoff · SDD-0626 · 0560: «Acuse» en los escalados

**Pedido:** el Director General, 17/11/2026, por delegación de Sam en los criterios: la salida 2 del choque entre el
kit de la etapa 1 y el conteo de la 0558. Hermes pedía marcar «Acuse» en «No evaluado» en las conversaciones que se
escalan (la 3, la 4, la 6 y la 8). Con la 0558, un «No evaluado» en cualquier criterio vuelve incorrecta la
conversación, y con cuatro incorrectas la etapa 1 no podía pasar nunca. El DG descartó la salida 1 (que Sam marque
«cumple» en algo que no ocurrió) porque ensucia el dato que decide el paso de etapa.

Rama nueva desde `origin/main` 725e2ef81 (con la #652 ya adentro). La 0558 no se toca: va en la migración **0560**,
con el número que asignó el DG.

## Qué se hizo

- **`supabase/migrations/0560_oficina_acuse_en_escalados.sql`** (NO APLICADA A PRODUCCIÓN):
  - Solo **reemplaza `office_conteo_revisiones`**, con la misma firma y las mismas columnas. El cuerpo es el de la 0558
    con una regla más. En una revisión de criterio 2 de un **escalado**, «Acuse» puede estar en `true` o en `null`
    («Falló» = `false` sigue contando como fallo), y las otras tres casillas tienen que estar en `true`. En una
    **respuesta** las cuatro siguen en `true`.
  - El tipo lo decide la base con `office_revisiones.tipo_borrador`, que existe desde la 0549 y que
    `office_revisar_borrador_v2` copia del borrador, nunca del cliente.
  - **Preflight:**
    - exige la 0558 (y la 0549);
    - si el cuerpo vivo del conteo es exactamente el de la 0560 (md5 de `prosrc`), no vuelve a mirar las filas: así es
      idempotente aunque la etapa 1 ya haya empezado, y un cuerpo que solo trae la regla en un comentario no lo burla;
    - si no la tiene y hay revisiones de criterio 2 de escalados con `c_acuse` en null (las únicas cuyo resultado
      cambiaría), **aborta** con «0560: hay N revisiones…». El mensaje lleva solo el número, ningún dato.
  - **Postflight:** search_path vacío, SECURITY DEFINER, EXECUTE solo para authenticated, y la regla presente en el
    cuerpo vivo.
  - No toca filas, tablas ni checks. Aprobar un escalado no depende de «Acuse»: lo que se exige para aprobar vale
    solo para las respuestas (el check `criterio2_aprobar_exige` y `office_revisar_borrador_v2`), y ninguno mira
    `c_acuse`.
- **`supabase/desarmes/0560_desarme.sql`:** vuelve el conteo al cuerpo de la 0558, copiado tal cual.
- **La pantalla** (`TarjetaBorrador.tsx`), con las frases aprobadas por el DG:
  - En un escalado, «Acuse» nace en «No evaluado» y debajo va la línea «En un escalado no hay respuesta al cliente:
    deja «Acuse» en «No evaluado»; no cuenta en contra.»
  - El aviso junto a los botones dice ahora: «Guardar sin marcas significa «revisé y cumple». Con algo en «No
    evaluado», la conversación no cuenta como correcta, salvo «Acuse» en un escalado. Rechazar exige marcar al menos un
    «Falló».» El aviso anterior decía que «No evaluado» no contaba ni bien ni mal, y eso no era cierto en el conteo de
    la 0558.
  - En una respuesta nada nace marcado.
- **Pruebas:**
  - `supabase/tests/0560_oficina_acuse_en_escalados.test.sql`:
    - los cuatro casos que pidió el DG: escalado con «Acuse» en false → incorrecta; respuesta con «Acuse» en null →
      incorrecta; escalado con otra casilla en null → incorrecta; escalado con «Acuse» en null y el resto en cumple →
      correcta;
    - los controles: escalado y respuesta con todo en cumple → correctas;
    - un cierre que falló sigue restando;
    - el tipo de la revisión es el del borrador;
    - aplicarla otra vez, con esas filas ya guardadas, no cambia el conteo;
    - anon, service_role y un authenticated sin admin no llaman al conteo.
  - `lib/studio/__tests__/oficina-acuse-escalado.migration.test.ts`:
    - el contrato en PGlite y el control rojo (sin la 0560 cae en CONTRATO 2);
    - 6 mutantes;
    - el **preflight**: con una fila así antes de la 0560, la migración no se aplica y el mensaje no trae datos. Su
      control (un null en una respuesta) sí se aplica, y una prueba confirma que lo que frena es la comprobación de
      filas;
    - el desarme, dos veces, y la 0560 se vuelve a aplicar.
  - `lib/studio/oficina/__tests__/acuse-escalado-pantalla.test.ts`: la tarjeta de escalado nace con «Acuse» en «No
    evaluado» y su línea; la de respuesta, sin nada marcado; el aviso nuevo en las dos.
- **La espera:** `migrations-baseline.json` › pendingBelowCutoff (la 0560). No hace falta una declaración de símbolos
  nueva: la 0560 no crea símbolos, y `office_conteo_revisiones` ya está declarado (en la declaración de la 0549). La
  espera de la 0558 no se revive.
- **Docs:**
  - Spec v0.7: §3.5 de la 0560 y su allowlist, más la corrección «0558 aplicada en producción el 2026-11-17 a las
    22:21Z» en las líneas que decían «sin aplicar».
  - Runbook §11: el conteo con la 0560.

## Comprobaciones

| Comprobación | Resultado |
|---|---|
| Contrato de la 0560 en PGlite (con la conversación mezclada, el escalado rechazado y la regla 1 ignorada), control rojo, 6 mutantes, preflight (con su control y el md5 que no se burla con un comentario) y desarme con su comentario (13 pruebas) | PASÓ |
| Revisión con Opus sobre 2440d8ef2 | CHANGES_REQUESTED, sin problemas de lógica ni de seguridad. Corregidos: 1 (orden), 2 (cabecera), 3 (aviso de símbolos quitado: el chequeo descarta lo que ya crea una migración aplicada), 4 (contrato), 5 (comentario del desarme) y 6 (md5 de `prosrc`) |
| Pantalla: escalado con «Acuse» en «No evaluado», respuesta sin marcas, el aviso nuevo; más `paso3b-piezas`, `oficina-contraste` y `casillas-0558` (54 pruebas) | PASÓ |
| pending-migration-symbols (0 rojos, 4 amarillos declarados) | PASÓ |
| Contrato en Postgres 17 («Contratos SQL» del CI) | lo corre el CI |
| Suite amplia y typecheck completo | NO EJECUTADO en local (sin turno de PC): los corre el CI |
| Aplicar la 0560 en staging o producción | NO EJECUTADO: fuera de esta PR. La aplica el DG con el OK nominal de Sam |

## Fuera de alcance detectado

- **REQUISITO DURO DE ORDEN (revisión con Opus, hallazgo 1):** la 0560 se aplica en producción **antes de fusionar
  esta PR y de publicar el web**. Si el web sale antes, la pantalla deja «Acuse» en «No evaluado» en los escalados y
  fabrica justo las filas que hacen abortar el preflight. El DG lo hace en ese orden y el portón de publicación lo
  exige. El aviso nuevo («salvo «Acuse» en un escalado») también es cierto solo con la 0560 aplicada.
- **El postflight busca la regla como texto en el cuerpo vivo**, así que un comentario la burlaría (como el B4 de la
  #655). Los mutantes lo tienen en cuenta.
- **El kit de Hermes:** en las conversaciones que se escalan, Sam deja «Acuse» como viene («No evaluado»). «Cierre en
  3» se registra en «Conversaciones por cerrar».

## Lo que falta (no es de esta PR)

1. La revisión con Opus (la pide el DG) y la fusión por su portón.
2. Aplicar la 0560 en producción **antes de fusionar esta PR y de publicar el web** (requisito duro), con el OK
   nominal de Sam para este archivo y el runbook aplicar-migraciones-prod, con el DG.
3. Fusionar y publicar el web con esta pantalla.
