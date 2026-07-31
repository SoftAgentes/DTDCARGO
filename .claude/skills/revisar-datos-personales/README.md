# revisar-datos-personales · fork Venezuela + China

Auditoría de datos personales sobre un repositorio real, con evidencia
`archivo:línea`. **No es asesoría legal**: produce un inventario técnico y una
lista de preguntas para llevarle a un abogado.

## Cómo se usa

```
Revisa este proyecto con la skill de datos personales
```

También responde a *auditar privacidad*, *protección de datos*, *habeas data*,
*derecho al olvido*, *minimización*, *consentimiento*, *derecho de supresión*,
*firma electrónica*, *valor probatorio*, *SUSCERTE*, *PSC* o *PIPL*.

Sale un reporte en cinco secciones: resumen · inventario · hallazgos por gravedad
· **no verificable** · fuera de alcance. Las dos últimas son las que más se usan.

## La regla que manda

Tres estados y solo tres: `ENCONTRADO` · `CORRECTO` · `NO VERIFICABLE`. **Una
afirmación sin `archivo:línea` no entra al reporte.** La skill no puede responder
que cumples — esa pregunta es de sí o no, y los modelos son complacientes.

`NO VERIFICABLE` no es un fracaso: es la lista de lo que hay que ir a mirar con
los propios ojos (el panel de un proveedor, un contrato firmado, la configuración
de un servicio).

## Origen y qué se cambió

Fork de **[`revisar-datos-personales`](https://github.com/Carlos-Dominguez-faber/revisar-datos-personales)**
de **Carlos Domínguez** (MIT), escrito para la **Ley 21.719 de Chile**. La lectura
legal original la aportó **Víctor Hugo Morales Pérez**, licenciado en Derecho por
la UNAM.

**El método se conserva íntegro** — los tres estados, los cuatro pasos, la regla
de evidencia, "cómo no fallar". Eso es lo que hace que funcione y no se toca.

Lo que cambió:

| | Upstream (Chile) | Este fork |
|---|---|---|
| Marco principal | Ley 19.628 modificada por la 21.719 | CRBV arts. 28 y 60 · jurisprudencia vinculante de la Sala Constitucional del TSJ (332/2001, 759/2025) · Ley Especial contra los Delitos Informáticos · Ley sobre Mensajes de Datos y Firmas Electrónicas |
| Segundo marco | — | **PIPL de China**, cuando hay tratamiento en territorio chino |
| RGPD / Chile | Marco aplicable | **Estándar de referencia**, se dice explícitamente que no obliga |
| Autoridad | Agencia de Protección de Datos | **No existe.** La vía es judicial: habeas data ante el Juzgado de Municipio en lo Contencioso Administrativo del domicilio del solicitante |
| Sanción | Multa administrativa (hasta 20.000 UTM) | **Habeas data** y **prisión de 2 a 6 años** en los supuestos de los arts. 20-22 de delitos informáticos |
| Plazos | 30 días corridos · 2 días hábiles para bloqueo | **No hay plazo legal.** El que la organización publique se vuelve exigible por haberlo publicado |
| Puntos | 10 | **12** — se agregan el 11 y el 12 |
| Archivo del checklist | `checklist-21719.md` | `checklist-datos-ve.md` |
| `practica/` y `assets/` | Incluidos | **No vendorizados** (ver abajo) |

### Los dos puntos nuevos

- **Punto 11 · Valor probatorio de la aceptación electrónica.** No existe en el
  upstream porque Chile tiene su propia ley de firma. Cubre los tres escalones del
  derecho venezolano —mensaje de datos (art. 4), firma no certificada (art. 17),
  firma certificada por un PSC (arts. 16 y 18)—, el problema de sellar la
  *referencia* en vez del *contenido*, los certificados extranjeros (art. 44) y el
  valor del papel original frente a su fotografía.
- **Punto 12 · Titulares que no son tus usuarios.** Quien recibe una entrega y
  firma, el contacto de un proveedor, el contacto de emergencia de un empleado, el
  referido. Gente cuyos datos se tratan sin que haya pasado nunca por el registro
  ni por la política, y que por eso queda fuera de todos los inventarios.

### Otros ajustes menores

- El paso 1 suma **buckets de almacenamiento de archivos** a las fuentes del
  inventario: no aparecen en ningún `CREATE TABLE` y suelen ser lo más sensible.
- **Geolocalización** añadida a la lista de datos sensibles.
- Regla explícita: ningún dato sensible está prohibido — lo exigible es poder
  **justificar** por qué ese dato y no uno menos invasivo.
- Regla del **campo obligatorio**: si la finalidad es comercial, el campo no puede
  ser `required`.
- El punto 7 incorpora la **arquitectura documental** de tres niveles (contrato
  que se acepta · aviso que se lee · consentimientos que se encienden y apagan) y
  el test para decidir en cuál va cada cosa.
- Advertencia contra importar nomenclatura ajena ("derechos ARCO" es México; el
  binomio responsable/encargado es RGPD y Chile).
- El paso 3 recuerda que **no se ejecuta contra producción** sin autorización
  nombrada.

## Qué no se trajo, y por qué

- **`practica/`** — la app Node de una barbería con nueve errores sembrados. Trae
  su propio `package.json` y ensuciaría `pnpm lint` y `typecheck` del repo. Sigue
  siendo la mejor forma de calibrar: clónala **fuera** del repo y corre este fork
  contra ella comparando con los nueve errores documentados en su README. Si este
  fork detecta menos que el original, el re-anclaje rompió algo.
- **`assets/`** — solo el banner del README original.

## Archivos

```
SKILL.md                              el método (lo que lee el agente)
references/
  checklist-datos-ve.md               los doce puntos
  marco-legal-ve.md                   Venezuela: artículos, jurisprudencia, los 6 PSC
  marco-legal-cn-pipl.md              China: PIPL
  plantillas/
    registro-tratamiento.md           el inventario, para llenar
    runbook-brecha.md                 qué hacer las primeras horas
    evaluacion-proveedores.md         antes de conectar un tercero
```

Las plantillas se usan **sin** la skill: son documentos para llenar a mano.

## Limitaciones

**No te deja cumpliendo.** Te deja sabiendo qué revisar y qué preguntar, que es
una posición mucho mejor, pero no es lo mismo.

**No sustituye a un abogado: lo hace más barato.** Llegas con el inventario hecho
en vez de con "no sé qué datos tengo".

**No ejecuta código ni mira la base de datos.** Lee el repositorio. Todo lo que
esté fuera del código sale como `NO VERIFICABLE`, y así debe ser.

**No decide la base de licitud** ni redacta las políticas. Puede construir un
borrador desde el inventario real, pero el texto legal lo revisa un abogado.
Publicar una política que promete lo que el sistema no hace es peor que no
tenerla.

**No encuentra sus propios puntos ciegos.** Al terminar, que otro modelo audite el
mismo repositorio.

## Licencia

MIT. Copyright (c) 2026 Carlos Domínguez. Ver `LICENSE`, que conserva el aviso
original y documenta esta obra derivada.
