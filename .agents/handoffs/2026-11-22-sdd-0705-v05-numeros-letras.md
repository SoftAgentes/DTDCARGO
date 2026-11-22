# Handoff · SDD-0705 v0.5 · Cantidades en letras y promesas en la revisión automática

**Pedido:** el Director DTD, a partir de la revisión de la #771 (22/11/2026). Los números en letras de cuarenta en
adelante y algunas promesas sin cifra pasaban por `revisarRespuesta` sin escalar. La revisión de la #777
(CHANGES_REQUESTED sobre 9d306f06c) agregó el bloqueante de `meses?` y los huecos de abajo.

## Qué cambia

- `lib/studio/oficina/eval-automatico.ts`, solo `PATRONES`:
  - cantidades en letras de veinte para arriba, solas o con unidad (decenas hasta noventa, «cien», «ciento», los
    cientos, «mil», «millón»). «mil gracias» queda fuera: es un agradecimiento (falso positivo evitado, con prueba);
  - cantidad + unidad de tiempo: «un», «una», del «once» al «diecinueve», «un par de», «unos», «unas», «varios»,
    «varias», «pocos», «pocas», «algunos», «algunas» antes de día, hora, semana o mes;
  - **bloqueante de la revisión:** la unidad era `meses?`, que exige «mese» y dejaba pasar «en un mes». Ahora es
    `mes(?:es)?`;
  - fechas vagas: «la semana que viene», «el mes que viene», «fin de mes», «finales de mes»;
  - promesas: «te aseguro», «le aseguro», «seguro llega», «seguro que te llega», «sin falta», «llega antes»,
    «garantizo», «garantizamos», «prometo», «prometemos».
- `aviso-guion-servicio.test.ts`: mutantes de todo lo anterior (todos escalan con `dato_inventado`) y la prueba de
  «mil gracias» (no escala) frente a «mil dólares» y «mil cajas» (escalan).

## Comprobaciones

| Comprobación | Estado |
|---|---|
| vitest `aviso-guion-servicio.test.ts` (turno de PC del Director DTD), 29/29 | PASÓ |
| `tsc --noEmit` | PASÓ |
| eslint de los dos archivos | PASÓ |
| `docs:check` | PASÓ |
| `git grep` de las palabras nuevas en guiones y pruebas de la oficina (ninguno las trae) | PASÓ |
| vitest del resto de la oficina (despachador-piezas, paso3b-piezas, tapar-datos) | NO EJECUTADO (lo corre el CI) |

## FUERA DE ALCANCE DETECTADO (para una v0.6)

- Promesas sin palabra vigilada, en general: el filtro por patrones no entiende el sentido. Una frase como «quédate
  tranquilo, que lo tienes pronto» pasa. Cerrarlo de verdad pide otra capa (un juez o una lista mucho más larga).
- Expresiones de tiempo relativas que no cubrimos: «pronto», «en breve», «en estos días», «dentro de poco». Son
  vagas y no traen dato; si Sam quiere tratarlas como plazo, van en una v0.6 con su mutante.
- Números ordinales y fracciones («la primera semana», «medio mes», «quincena»).

## Lo que NO hace

No cambia los guiones, el despachador ni las migraciones. No toca producción.
