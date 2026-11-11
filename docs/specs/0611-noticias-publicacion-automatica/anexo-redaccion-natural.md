# Anexo de SDD-0611 — Redacción natural: herramientas y método

> Para el Redactor de noticias, el Revisor, el Director de contenido y la persona que revisa.
> Pedido de Sam del 2026-11-06: las noticias no dicen que se hicieron con IA y la redacción
> tiene que sonar muy humana. Investigado el 2026-11-06. Al aprobarse la SDD-0611, este anexo
> pasa a la biblioteca de la oficina (`06-noticias.md` y `01-voz-y-atencion.md`).

## 1. En corto

- **Lo que hace que un texto suene humano es cómo se escribe, no una herramienta que lo pase
  en limpio.** La mejor palanca es la instrucción del Redactor, con la voz de DTD Cargo y una
  lista de muletillas prohibidas, más el repaso de una persona en las semanas de prueba.
- **Los «humanizadores» comerciales no entran en el camino automático.** Están hechos para
  engañar a los detectores de IA, que a Google no le importan, y en español empeoran el texto.
  Se pueden probar a mano en la prueba del 2026-11-06 al 2026-11-15 (§5) para decidir con datos.
- **Hay dos herramientas que sí suman y no mandan el texto a terceros:** LanguageTool instalado
  en el servidor propio y un índice de legibilidad en español calculado en el Studio.

## 2. Qué dice Google

Fuentes primarias, leídas el 2026-11-06:

- **No castiga el uso de IA.** Su guía sobre contenido hecho con IA dice que usarla bien no va
  contra sus reglas, y que tampoco da ventaja. Premia el contenido original, útil y con
  experiencia, autoridad y confianza (E-E-A-T), sin importar cómo se hizo.
  [Google Search Central, febrero de 2023](https://developers.google.com/search/blog/2023/02/google-search-and-ai-content).
- **No exige declararlo siempre.** Recomienda declararlo solo cuando el lector lo esperaría, y
  desaconseja poner a la IA como autora. La firma «DTD Cargo» como organización encaja con eso.
  Misma fuente.
- **Sí castiga el contenido en masa sin valor** («abuso de contenido a escala»), lo haga una IA o
  una persona. Entre sus ejemplos está **reescribir con sinónimos, traducir o enmascarar
  contenido ajeno**: justo lo que hacen muchos humanizadores.
  [Políticas de spam de Google](https://developers.google.com/search/docs/essentials/spam-policies).

**Conclusión:** para el buscador, pasar un detector de IA no sirve de nada. Lo que cuenta es que
la noticia resuelva algo, traiga datos propios y se lea bien. Con una o dos por semana, DTD Cargo
está lejos del «contenido a escala», siempre que cada pieza aporte.

## 3. Los humanizadores comerciales

Son servicios web que reescriben un texto de IA para que los detectores no lo reconozcan.

| Herramienta | Qué se encontró | Español |
|---|---|---|
| Undetectable AI | La más citada. Una prueba le da la mejor calidad de las que midió, pero evade poco; otras notan que infla el texto y deja frases torpes | Según una reseña, rinde menos que en inglés |
| StealthGPT | Orientada a estudiantes y a SEO; pocas pruebas con datos | Sin datos |
| WriteHuman, Humbot | Aparecen en listas, sin pruebas independientes | Sin datos |
| Phrasly, Walter Writes, GPTHuman | Encabezan sus propias listas | Sin datos |
| QuillBot (humanizador y parafraseo) | Recomendado para español porque tiene versión en español | Sí |
| Humanizar Texto (humanizar-texto.org) | Hecho para español; la reseña no parece independiente | Sí |

**Cuánto vale esta tabla:** casi todas las clasificaciones las publica alguien que vende un
humanizador o un detector. No encontré una evaluación independiente de calidad en español para
2026. Un estudio académico de 2025 probó 19 humanizadores y encontró que muchos detectores no
los reconocen, pero lo firma una empresa de detección
([Masrour, Emi y Spero, GenAIDetect 2025](https://aclanthology.org/2025.genaidetect-1.9/)).
Las reseñas coinciden en algo: **cuanto más evade, peor escribe.**

Fuentes de la tabla, todas reseñas y no estudios:
[Cybernews](https://cybernews.com/ai-tools/best-ai-humanizer/),
[ProofreaderPro](https://proofreaderpro.ai/blog/best-ai-humanizers-2026),
[Phrasly](https://phrasly.ai/blog/best-ai-humanizer-tools) (vende un humanizador),
[Hackceleration](https://hackceleration.com/es/labs/mejor/humanizador-texto-ia),
[Tesify](https://tesify.es/humanizador-texto-ia-tesis-2026-que-funciona) y
[la reseña de Humanizar Texto en colombia.com](https://www.colombia.com/educacion/noticias/resena-de-humanizar-textoorg-el-mejor-humanizador-de-ia-en-espanol-543491).

### Por qué no van en el camino automático

1. **Persiguen la meta equivocada.** Evitar un detector no le importa a Google (§2) ni al lector.
2. **Cambian el texto sin entenderlo.** Pueden alterar una cifra, quitar la palabra clave,
   romper el prefijo del titular, meter españolismos o voseo y borrar una marca `[VERIFICAR]`
   sin resolverla. Son un filtro de estilo, no una revisión de hechos.
3. **Rompen los filtros.** El veredicto del Revisor vale solo para el texto exacto que revisó
   (F3). Una herramienta que reescribe después lo invalida, y una que reescribe antes deja al
   Revisor mirando un texto que nadie entiende del todo.
4. **Mandan el borrador a un tercero** antes de publicarlo: es un proveedor nuevo que habría que
   sumar a `docs/legal/privacidad/inventario-terceros.md`, con su revisión de privacidad.
5. **Reescribir con sinónimos** está entre los ejemplos de spam de Google (§2).
6. **Cuestan una suscripción** y dependen de una carrera contra los detectores que cambia cada mes.

## 4. Lo que sí hace sonar humano un texto

### 4.1 En la instrucción del Redactor

La voz ya está escrita en `06-noticias.md` y `01-voz-y-atencion.md`. Para que no suene a IA, el
Redactor recibe además estas reglas:

- **Varía el largo de las oraciones.** Una corta. Otra más larga que explica el porqué con un
  ejemplo. La IA tiende a escribir todas del mismo largo.
- **Ejemplos concretos y locales:** el depósito en Valencia, el contenedor que llegó a La Guaira,
  la plata parada en mercancía. Nada de «en el mundo actual» ni «en un mercado globalizado».
- **Una idea propia por sección**, con postura, no un resumen neutro de todo.
- **Datos propios** cuando los haya: lo que preguntan los clientes (`seo-aeo-preguntas-crm.md`,
  agregado y sin datos personales) y lo que buscan en Google (Search Console).
- **Muletillas prohibidas:** a las de `06-noticias.md` («en conclusión», «es importante
  destacar», «no podemos olvidar que») se suman los tics típicos de la IA:

| No | Por qué |
|---|---|
| «En el mundo actual», «en la era digital», «en un mundo cada vez más…» | Arranque vacío |
| «Sumérgete», «descubre», «desbloquea», «potencia», «navegar el panorama» | Calco del inglés de marketing |
| «Cabe destacar», «vale la pena mencionar», «es crucial», «es fundamental» | Relleno |
| «No solo… sino también…» en cada párrafo | Fórmula repetida |
| Listas de tres adjetivos («rápido, seguro y eficiente») | Tic de IA |
| Raya larga (—) para cada aclaración | Tic de IA en español; usar coma o paréntesis |
| Pregunta retórica al empezar cada sección | Fórmula |
| Cerrar cada sección con una frase resumen | Repetición |
| «En resumen», «para concluir», «en definitiva» | Muletilla de cierre |

### 4.2 Controles que el Studio puede medir

Se proponen para el puntaje de §4.3.3 de la spec. Cuestan poco y no mandan el texto afuera:

- **Muletillas:** cero de la tabla de arriba. Es una lista en código, igual que las líneas rojas.
- **Legibilidad en español:** el índice de Fernández Huerta (la adaptación al español del de
  Flesch) o el INFLESZ, calculados en el Studio. Meta inicial: «bastante fácil» o «normal». Es
  aritmética sobre sílabas, palabras y oraciones; no necesita ningún servicio.
- **Variación del largo de las oraciones:** que no sean todas parecidas (desviación estándar
  mínima, a calibrar con las noticias de la prueba).
- **Ortografía y gramática:** [LanguageTool](https://languagetool.org/), que tiene español y se
  puede **instalar en el servidor propio** (es de código abierto). Así el texto no sale de casa.

### 4.3 La persona en la prueba

Del 2026-11-06 al 2026-11-15 las noticias se publican a mano. Quien publica las lee **en voz
alta**: lo que suena a folleto o a traducción se reescribe. Anotar qué se cambió da la lista de
muletillas y los umbrales de §4.2 para la vía automática.

## 5. Prueba propuesta para decidir con datos

En la segunda semana de prueba, con **una sola noticia**:

1. Versión A: el Redactor con las reglas de §4.1.
2. Versión B: la misma, pasada por QuillBot en español.
3. Versión C: la misma, pasada por Undetectable AI.

Sam lee las tres **sin saber cuál es cuál** y elige la que suena más natural. Después se
compara cada una contra la A: cifras cambiadas, palabra clave, prefijo del titular, líneas rojas,
voseo o españolismos. Si B o C ganan sin romper nada, se discute meterlas **antes** del Revisor,
con su alta como proveedor. Si no, se queda la A.

Las versiones B y C se hacen con una noticia que no lleve datos de clientes ni el nombre del
operador de consolidación, porque el texto sale a un tercero.
