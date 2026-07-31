---
name: revisar-datos-personales
description: Audita un proyecto de software frente al marco de proteccion de datos personales de Venezuela (CRBV art. 28 y 60, jurisprudencia vinculante de la Sala Constitucional del TSJ, Ley Especial contra los Delitos Informaticos y Ley sobre Mensajes de Datos y Firmas Electronicas) y de China (PIPL) cuando hay tratamiento en territorio chino. Levanta el inventario de datos personales que trata el sistema, revisa doce puntos de cumplimiento con evidencia de archivo y linea, y entrega un reporte que separa lo verificado de lo que no se pudo comprobar. Usar cuando alguien pida revisar cumplimiento, privacidad, proteccion de datos, datos personales, habeas data, derecho al olvido, minimizacion, consentimiento, derecho de supresion, portabilidad, firma electronica, valor probatorio, SUSCERTE, PSC, PIPL, RGPD o 21.719 en un repositorio.
---

# Revisar datos personales (Venezuela + China)

Auditoría de cumplimiento sobre un repositorio real. No es asesoría legal: es un
inventario técnico con evidencia, para que una persona sepa qué preguntarle a su
abogado.

> **Fork.** El método es de `revisar-datos-personales` de Carlos Domínguez (MIT),
> escrito para la Ley 21.719 de Chile. Acá se conserva íntegro y se re-anclan las
> citas legales a Venezuela y China. Ver `README.md`.

## La regla que manda sobre todas las demás

**Nunca afirmes que algo cumple.** Este trabajo se entrega en tres estados y
solo tres:

| Estado | Cuándo usarlo |
|---|---|
| `ENCONTRADO` | Viste el problema en el código. Va con ruta y línea. |
| `CORRECTO` | Viste la implementación que lo resuelve. Va con ruta y línea. |
| `NO VERIFICABLE` | No pudiste comprobarlo leyendo el repo. Di por qué. |

Una afirmación sin `archivo:línea` no entra al reporte. Si la evidencia está
fuera del código —en un panel de Supabase, en un contrato con un proveedor, en
la configuración de un servicio— eso es `NO VERIFICABLE`, y se dice así.

`NO VERIFICABLE` no es un fracaso: es el resultado honesto y es la parte más útil
del reporte, porque es la lista de lo que la persona tiene que ir a mirar con sus
propios ojos.

## Procedimiento

### Paso 1 — Inventario antes que juicio

Antes de evaluar nada, levanta qué datos personales trata el sistema. Busca en
este orden:

1. Migraciones y definiciones de esquema (`*.sql`, `schema.prisma`, `models.py`,
   `migrations/`, `CREATE TABLE`).
2. Formularios y validadores del frontend.
3. Tipos e interfaces que crucen la frontera de la red.
4. Payloads que se envían a terceros.
5. **Buckets de almacenamiento de archivos.** Un bucket de documentos de
   identidad no aparece en ningún `CREATE TABLE` y suele ser lo más sensible que
   guarda el sistema.

Para **cada campo** que identifique o haga identificable a una persona natural,
llena una fila:

```
tabla.campo | qué es | finalidad declarada | base de licitud | retención | quién más lo ve
```

Si no puedes deducir la finalidad de un campo leyendo el código, escribe
`finalidad no evidente en el código`. Esa frase es el hallazgo más valioso de
todo el paso: un campo cuya razón de existir nadie puede explicar es exactamente
lo que el principio de proporcionalidad prohíbe.

Marca aparte los **datos sensibles**: salud, origen racial, afiliación política,
convicciones religiosas, vida sexual, identidad de género, biométricos, perfil
biológico y **geolocalización**. Ojo con los que se disfrazan: un campo `notas` u
`observaciones` de texto libre suele contener datos de salud. Revisa los datos
reales si tienes acceso, no solo el nombre de la columna.

> La **geolocalización** es la que más se olvida, porque no se ve como un dato
> personal: entra como una columna `lat`/`lng`, una tabla de posiciones de
> vehículo o un campo de precisión del GPS. Saber dónde estuvo una persona a una
> hora determinada es tan identificador como su documento.

**Ningún dato sensible está prohibido — lo que se exige es poder justificarlo.**
Si el sistema captura un biométrico o una geolocalización, la pregunta que hay
que poder responder por escrito es *por qué ese dato y no uno menos invasivo*. Si
la justificación no existe o no se sostiene, ese es el hallazgo.

**Y marca aparte los titulares que no son usuarios del sistema** — quien recibe
un paquete y firma, el contacto de un proveedor, el contacto de emergencia de un
empleado, el referido. Nunca pasaron por el registro y suelen no estar en ninguna
política. Es el punto 12.

### Paso 2 — Los doce puntos

Recorre `references/checklist-datos-ve.md`. Cada punto trae qué buscar, los
patrones que delatan el problema y la norma que lo respalda.

El marco legal completo, con el texto de los artículos, está en
`references/marco-legal-ve.md` y `references/marco-legal-cn-pipl.md`. Cítalos
por artículo; no cites de memoria.

### Paso 3 — Verificación contra datos, no contra código

Leer el código no prueba que el sistema se comporte como el código sugiere.
Cuando tengas acceso a un entorno de desarrollo, propón —y ejecuta si te
autorizan— al menos esta comprobación:

1. Crea un registro de prueba con un valor único y rastreable.
2. Ejerce el borrado por el camino que usa una persona real.
3. Busca ese valor único en **todas** partes: tablas, tablas de auditoría, logs,
   colas de trabajos, caché, exports, buckets de archivos, sistemas de terceros.

Si el valor sobrevive en algún lado, el borrado no borra. Repórtalo como
`ENCONTRADO` aunque el código diga `DELETE`.

Cuando no tengas ese acceso, dilo: *"la lógica de borrado se ve correcta en
`ruta:línea`, pero no se verificó contra una base real"*. No lo des por bueno.

> **Nunca ejecutes esto contra producción por tu cuenta.** Escribir y borrar en
> la base real necesita autorización explícita y nombrada de quien manda. Si no
> la tienes, propón el script y deja el punto en `NO VERIFICABLE`.

### Paso 4 — El reporte

Entrega en este orden:

1. **Resumen** — cuántos puntos en cada estado. Sin adjetivos.
2. **Inventario de datos** — la tabla del paso 1.
3. **Hallazgos** — ordenados por gravedad, cada uno con: qué encontraste,
   `archivo:línea`, por qué importa, la norma, y el arreglo concreto.
4. **No verificable** — qué falta mirar y dónde.
5. **Fuera de alcance** — lo que necesita un abogado: redacción de las políticas,
   contratos con proveedores y encargados, y la decisión sobre la base de licitud
   aplicable.

Cierra siempre con el recordatorio de que esto no es asesoría legal.

## Cómo no fallar

**No inventes la política de privacidad.** Si te piden generar el texto,
constrúyelo desde el inventario real del paso 1. Redactar una política que
promete algo que el sistema no hace es publicar una afirmación falsa sobre el
propio sistema, y eso es peor que no tenerla.

**No confundas ausencia de evidencia con cumplimiento.** No encontrar un endpoint
de exportación significa que no lo encontraste, no que la portabilidad esté
resuelta en otro lado.

**No importes derecho ajeno.** En Venezuela no existen los "derechos ARCO" (eso
es México), ni el "responsable del tratamiento" y el "encargado" como figuras
legales definidas (eso es el RGPD y Chile), ni una autoridad administrativa de
protección de datos. Si usas un término, que sea el que usa la norma venezolana.
Cuando cites un estándar extranjero, di explícitamente que es referencia y no
obligación.

**No prometas plazos que la ley no fija.** Venezuela no tiene plazo legal para
responder a un titular. Si la organización publica uno, se vuelve exigible por
haberlo publicado — eso es una ventaja, no un riesgo, pero hay que decirlo así.

**Pide la segunda opinión.** Al terminar, sugiere que otro modelo audite el mismo
repo. Un modelo no encuentra sus propios puntos ciegos.

**Sé específico con el arreglo.** "Mejorar el manejo del consentimiento" no sirve.
"Reemplazar la columna `acepto_todo` por una tabla `consentimientos` con
`finalidad`, `version_texto`, `otorgado_en` y `revocado_en`" sí.

## Alcance territorial

Antes de empezar, determina qué marcos aplican. Son acumulativos, no excluyentes.

**Venezuela** — aplica a quien trate datos de personas en Venezuela desde un
registro público o privado. No hay ley especial de protección de datos: el marco
es la **Constitución** (arts. 28 y 60), la **jurisprudencia vinculante de la Sala
Constitucional del TSJ**, la **Ley Especial contra los Delitos Informáticos** y
la **Ley sobre Mensajes de Datos y Firmas Electrónicas**. La ausencia de ley
especial **no** significa ausencia de obligaciones: significa que la sanción no
es una multa administrativa sino una **acción de habeas data** y, en los
supuestos de los arts. 20 a 22 de la ley de delitos informáticos,
**responsabilidad penal**.

**China (PIPL)** — aplica si hay tratamiento de información personal **dentro del
territorio chino** (una oficina, un equipo, un almacén propios), o si se ofrecen
productos o servicios a personas que están en China, o se analiza su
comportamiento. Un equipo propio en China que ve nombres, direcciones y teléfonos
de clientes está tratando información personal en China. Aquí las obligaciones
son **más duras** que en Venezuela, no más laxas: consentimiento separado para la
transferencia transfronteriza, deber de informar al destinatario, y multas de
hasta el 5% de la facturación anual.

**RGPD europeo y Ley 21.719 de Chile** — solo si hay titulares en la UE o en
Chile. Si no los hay, se usan como **estándar de referencia** y se dice así en el
reporte: son el marco al que se parecen los patrones técnicos habituales (Consent
Mode, doble opt-in, DSR endpoints), y sirven de guía aunque no obliguen.

Si el proyecto no toca ninguno de estos, la auditoría igual sirve: casi todo esto
es común a las leyes de la región. Dilo así en el reporte.

## Archivos de apoyo

- `references/checklist-datos-ve.md` — los doce puntos en detalle.
- `references/marco-legal-ve.md` — el marco venezolano con el texto de los
  artículos, la jurisprudencia y los PSC acreditados.
- `references/marco-legal-cn-pipl.md` — PIPL, para el tratamiento en China.
- `references/plantillas/registro-tratamiento.md` — inventario para llenar.
- `references/plantillas/runbook-brecha.md` — qué hacer las primeras horas.
- `references/plantillas/evaluacion-proveedores.md` — antes de conectar un tercero.

---

Esta skill no da asesoría legal. Produce un inventario técnico y una lista de
preguntas. La revisión legal la hace un abogado.
