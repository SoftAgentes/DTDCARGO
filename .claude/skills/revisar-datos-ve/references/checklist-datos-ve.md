# Los doce puntos

Cada punto trae qué buscar, qué delata el problema y la norma que lo respalda.

**Venezuela** no tiene ley especial de protección de datos. Las anclas son la
Constitución (arts. 28 y 60), la jurisprudencia **vinculante** de la Sala
Constitucional del TSJ (sentencias 332/2001 y 759 del 21-05-2025, entre otras), la
**Ley Especial contra los Delitos Informáticos** y la **Ley sobre Mensajes de
Datos y Firmas Electrónicas**. **China (PIPL)** se cita cuando hay tratamiento en
territorio chino. El texto de cada norma está en `marco-legal-ve.md` y
`marco-legal-cn-pipl.md`.

Los puntos 1 a 10 vienen del checklist original de Chile, re-anclados. Los puntos
**11 y 12** son propios de este fork.

---

## 1 · Inventario de datos personales

**Qué buscar:** todo campo que identifique o haga identificable a una persona
natural, en esquemas, formularios, tipos, payloads **y buckets de archivos**.

**Delata el problema:**
- Campos de texto libre (`notas`, `observaciones`, `comentarios`) sin restricción,
  donde termina cayendo información de salud o económica.
- Objetos JSON sin tipar que se guardan enteros (`metadata`, `extra`, `payload`).
- Tablas de importación o staging que nadie limpia.
- Buckets de almacenamiento que no figuran en ningún `CREATE TABLE` y guardan
  cédulas, pasaportes, recibos o fotos.

**Salida esperada:** la tabla del paso 1 de la skill, completa.

> **VE:** CRBV art. 28 — derecho a acceder a los datos propios y **a conocer el
> uso que se haga de ellos y su finalidad**. No puedes informar la finalidad de un
> dato que no sabes que tienes.
> **CN:** PIPL arts. 5-7 (licitud, buena fe, finalidad clara y transparencia).

---

## 2 · Minimización y proporcionalidad

**Qué buscar:** campos que el sistema pide pero no usa. Búscalos por su nombre en
todo el código: si un campo solo aparece en el `INSERT` y en el formulario, y
nunca se lee, no tiene finalidad.

**Delata el problema:**
- Fecha de nacimiento completa cuando bastaría un booleano de mayoría de edad.
- Dirección exacta o coordenadas para un servicio que no va a domicilio.
- Documento de identidad cuando no hay obligación legal de identificar.
- Datos de terceros que nunca dieron su consentimiento (el "contacto de
  emergencia", los contactos del teléfono).
- Ingresos, ocupación o estado civil en servicios que no evalúan crédito.
- **Fotografía del rostro** cuando la firma y el número de documento ya
  identifican suficiente.

**El arreglo:** por cada campo sin finalidad, dos opciones — se elimina, o se
documenta su finalidad. No hay tercera. Si el proyecto usa Postgres, documenta la
finalidad como `comment on column`: viaja con la migración y se revisa en el code
review, en vez de morir en una hoja de cálculo.

**La regla del campo obligatorio.** Un campo cuya finalidad es **comercial** —
fidelización, segmentación, cumpleaños, preferencias— puede pedirse, pero **no
puede ser obligatorio**: la persona tiene que poder no darlo y recibir el servicio
igual. Si el formulario lo marca `required` y la única justificación es comercial,
eso es un hallazgo. Solo lo que la prestación del servicio realmente necesita
puede ser obligatorio.

**Y el mismo test vale para los datos sensibles.** Ninguno está prohibido; lo que
se exige es la **justificación documentada** de por qué ese dato y no uno menos
invasivo. Un control biométrico en una planta donde entrar sin capacitación puede
matar se justifica solo; una fotografía del rostro cuando la firma y el número de
documento ya identifican, no. La carga de sostener esa justificación es de quien
captura.

> **VE:** SC 332/2001 — principios de **finalidad y calidad** (los datos se
> limitan a fines predeterminados, explícitos y legítimos) y de **temporalidad**
> (se conservan solo durante el período necesario).
> **CN:** PIPL art. 6 — mínimo alcance necesario para la finalidad.

---

## 3 · Consentimiento con evidencia

**Qué buscar:** cómo se captura, se guarda y se retira el consentimiento.

**Delata el problema:**
- Una sola columna booleana (`accepted_terms`, `acepto_todo`) para todas las
  finalidades juntas.
- Checkbox premarcado (`checked` por defecto).
- No se guarda **cuándo** se aceptó ni **qué versión** del texto.
- No existe forma de retirarlo, o retirarlo es mucho más difícil que darlo.
- Se asume el consentimiento por el solo uso del servicio.
- El consentimiento vive **solo en el navegador del usuario** (una cookie, el
  `localStorage`): si lo borra o cambia de equipo, no queda evidencia de nada.

**El arreglo:** una tabla de consentimientos con una fila por finalidad —
`titular_id`, `finalidad`, `version_texto`, `otorgado_en`, `revocado_en`, `canal`
y evidencia (IP, user-agent, texto mostrado). Sin `UPDATE`: el histórico completo
es la prueba.

> **VE:** SC 332/2001 — principio de **autonomía**: el consentimiento debe ser
> **previo, libre, informado, inequívoco y revocable**. La carga de probarlo es de
> quien trata los datos, no del titular.
> **CN:** PIPL arts. 13-14 — el consentimiento debe ser voluntario, explícito e
> informado, y hay que poder retirarlo con la misma facilidad con que se dio.

---

## 4 · Los derechos, como caminos reales

**Qué buscar:** que existan los caminos, no solo un correo de contacto.

| Derecho | ¿Existe en Venezuela? | Qué debe existir |
|---|---|---|
| Acceso | ✅ CRBV 28 | Ver qué datos hay |
| Conocer el uso y la finalidad | ✅ CRBV 28 (es un derecho autónomo) | Saber para qué se usan y a quién se pasan |
| Actualización | ✅ CRBV 28 | Poner al día un dato viejo |
| Rectificación | ✅ CRBV 28 | Corregir un dato inexacto |
| Destrucción / supresión | ✅ CRBV 28 · SC 759/2025 | Borrado real, no una bandera |
| Confidencialidad e inclusión | ✅ SC 759/2025 | Restringir o completar el registro |
| Oposición | ❌ no reconocido como tal | Se ofrece por estándar, no por obligación |
| Portabilidad | ❌ no reconocido | Se ofrece por estándar, no por obligación |

**Delata el problema:** que la única vía sea "escríbenos a contacto@". Que el
export sea un PDF (no es un formato operable por otro sistema). Que la política
prometa un derecho que la ley venezolana no da, o que use nomenclatura importada
("derechos ARCO" es México, no Venezuela).

**Ojo con el sentido de la asimetría:** que la portabilidad no sea obligatoria en
Venezuela no la vuelve mala idea. Ofrecerla es diferenciación; prometerla y no
tenerla es el problema.

> **VE:** CRBV art. 28 · SC 759 del 21-05-2025, que fija el **habeas data** como
> la vía para exigir supresión, rectificación, confidencialidad, inclusión,
> actualización o uso correcto, y reconoce el **derecho al olvido**.
> **CN:** PIPL arts. 44-50, que **sí** incluyen portabilidad (art. 45).

---

## 5 · El borrado que borra de verdad

**Qué buscar:** todos los lugares donde el dato se replica. Esta es la
verificación del paso 3 de la skill.

**Los ocho escondites habituales:**
1. Soft delete: `deleted_at`, `activo = 0`, `is_deleted`. La fila sigue completa.
2. Tablas de auditoría o historial con copia íntegra del registro.
3. Logs de aplicación con datos personales en texto plano.
4. Colas de trabajos y webhooks con el payload guardado.
5. Caché y sesiones.
6. Exports y respaldos.
7. **Buckets de almacenamiento** — el borrado de la fila casi nunca borra el
   archivo.
8. Sistemas de terceros que ya recibieron el dato.

**Ojo:** el soft delete puede ser legítimo si hay una obligación legal de
conservación —tributaria, por ejemplo—. Lo que no es legítimo es decirle a la
persona que sus datos fueron eliminados cuando no lo fueron. Si conservas, dilo, y
conserva solo lo que la obligación exige.

**El arreglo:** un mapa de borrado documentado — todos los destinos del dato y qué
pasa con cada uno.

> **VE:** CRBV art. 28 — derecho a solicitar la **destrucción** de los datos ·
> SC 759/2025, **derecho al olvido**: pasado un tiempo razonable, mantener un
> registro activo carece de justificación · SC 332/2001, **temporalidad**.
> **CN:** PIPL art. 47 — deber de eliminar cuando se cumplió la finalidad, expiró
> el plazo de conservación o se retiró el consentimiento.

---

## 6 · Trazabilidad de las solicitudes

**Qué buscar:** que exista un registro de solicitudes con reloj, no una bandeja de
correo.

**Los plazos: acá cambia el razonamiento.** Venezuela **no fija un plazo legal**
para responder a un titular, ni existe una autoridad administrativa que multe.
Eso significa dos cosas:

1. El riesgo no es una multa: es una **acción de habeas data**, que se interpone
   ante los **Juzgados de Municipio en lo Contencioso Administrativo del domicilio
   del solicitante** (SC 759/2025). Es un juicio, no un expediente sancionatorio.
2. Si la organización **publica** un plazo propio, se vuelve exigible por haberlo
   publicado. Eso es una ventaja: convierte un vacío en un compromiso controlado.
   Pero entonces hay que cumplirlo, y hay que poder probar que se cumplió.

**Delata el problema:** no hay tabla de solicitudes, no hay estado, no hay fecha de
recepción, no hay forma de demostrar cuándo se respondió. O la política dice "en un
plazo razonable" —que no significa nada y no se puede auditar.

> **VE:** CRBV art. 28 · SC 759/2025 (vía y competencia).
> **CN:** PIPL art. 50 — mecanismo para recibir y atender solicitudes, y respuesta
> **oportuna**; si se rechaza, hay que explicar por qué.

---

## 7 · La política pública de tratamiento

**Qué buscar:** una página pública y permanente, **con fecha y versión**, que
describa el sistema que realmente está corriendo.

Venezuela no tiene una lista legal de contenidos obligatorios. Eso **no** vuelve
la política opcional: la vuelve un **compromiso contractual**. Lo que publicas te
obliga por haberlo publicado, y su incumplimiento es responsabilidad civil frente
a quien confió en ella.

**Contenidos mínimos razonables** (tomados del estándar internacional, como
referencia, no como obligación venezolana): identificación de quien trata los
datos y cómo contactarlo · categorías de datos y de titulares · finalidades y su
base · destinatarios · transferencias internacionales · período de conservación ·
los derechos del titular y cómo ejercerlos · origen de los datos · existencia de
decisiones automatizadas · fecha y versión.

**Delata el problema:** política genérica copiada de una plantilla, que describe un
sistema que no es el que está corriendo. Ese es el peor caso: promete cosas que el
código no hace. También: enumerar los momentos de captura y que falte uno real
(el trabajo de campo, la entrega, el almacén).

**Y revisa la arquitectura documental**, no solo el texto. Son tres niveles
distintos y mezclarlos es un error caro:
- **Contrato** (términos de servicio): se **acepta**, con versión y evidencia.
- **Aviso** (política de privacidad, de cookies): se **lee**, va enlazado desde el
  acto de aceptación e incorporado por referencia. **No se firma.**
- **Consentimientos granulares** (marketing, analítica, transferencia
  internacional, uso de imagen): se **encienden y apagan** por separado, y
  retirarlos no rompe el servicio.

El test que decide dónde va cada cosa: *"si el titular dice que no a esto, ¿se le
puede seguir prestando el servicio?"*. Si no → contrato. Si sí → consentimiento
separado. Hacer firmar la política de privacidad es un error clásico: sugiere que
todo el tratamiento se apoya en consentimiento, y el día que lo retiren se queda
sin base lo que se necesitaba para operar.

> **VE:** SC 332/2001 (autonomía: el consentimiento debe ser **informado**, y solo
> se informa con una política que diga la verdad) · responsabilidad civil por la
> declaración pública.
> **CN:** PIPL art. 17 — aviso **previo** a la recolección, en lenguaje claro.

---

## 8 · Inventario de terceros

**Qué buscar:** cada servicio externo que toca datos personales — proveedores de
IA, analítica, correo, mensajería, CRM, hosting, monitoreo de errores,
geocodificación, pasarelas de pago.

**Por cada uno:** qué datos recibe · para qué · dónde está alojado · qué dice su
política sobre uso y compartición · qué contrato existe · qué pasa al terminar.

**Delata el problema:**
- Trazas de error que suben el objeto de usuario completo al servicio de
  monitoreo.
- Analítica que recibe correo o identificador en la URL.
- Servicios gratuitos o "de utilidad" a los que se les manda un dato personal sin
  que nadie los cuente como proveedor (geocodificar una dirección, validar un
  teléfono, acortar un enlace).
- Proveedores cuya política permite usar tus datos para entrenar o compartirlos
  con terceros.
- **Personas externas con credenciales del sistema** — un transportista, un
  contratista, un aliado — que capturan o consultan datos sin contrato que lo
  regule.

**Acá está el riesgo más filoso de Venezuela.** No existe la figura legal del
"encargado del tratamiento", así que no hay un régimen administrativo que reparta
responsabilidades: lo que hay es la **Ley Especial contra los Delitos
Informáticos**, y sus artículos 20 a 22 tipifican como **delito** la obtención y
la revelación indebida de data personal, con **prisión de dos a seis años**,
aumentada de un tercio a la mitad si hubo fin de lucro o perjuicio. Es
responsabilidad **penal de personas**, no una multa a la empresa. Por eso el
contrato con cada tercero que toca datos no es burocracia: es lo que delimita
quién responde.

> **VE:** Ley Especial contra los Delitos Informáticos, arts. 20, 21 y 22 ·
> responsabilidad civil por hecho ilícito.
> **CN:** PIPL art. 21 (contrato con el encargado, supervisión, devolución o
> eliminación al terminar) y art. 23 (**consentimiento separado** para compartir
> con un tercero, informando su identidad y finalidad).

---

## 9 · Transferencia internacional

**Qué buscar:** si el dato sale del país, con qué mecanismo se justifica.

**Venezuela no tiene régimen de transferencia internacional.** No hay lista de
países adecuados ni cláusulas tipo. La base es el consentimiento informado de
SC 332/2001 y lo que se haya prometido en la política y en el contrato. En la
práctica: si la política dice a dónde van los datos y por qué, y el titular lo
aceptó, la transferencia está soportada; si no lo dice, no lo está.

**La obligación dura viene del otro lado.** Si hay tratamiento en **China** —una
oficina, un equipo, un almacén propios— la **PIPL** exige, para sacar información
personal del territorio chino:
- **Consentimiento separado** del titular, no incluido en la aceptación general.
- Informarle el **nombre y contacto del destinatario extranjero**, la finalidad,
  el método y las categorías de datos.
- Un **mecanismo habilitante**: evaluación de seguridad de la CAC, certificación
  de protección de información personal, o el contrato estándar de la CAC.

**Delata el problema:** nadie se lo ha planteado. Es lo normal: casi todo proyecto
manda datos a Estados Unidos sin haberlo pensado —el modelo de lenguaje, el
hosting, la base de datos gestionada, el proveedor de correo—. Y una casilla única
que dice "acepto la transferencia internacional" **no** satisface el consentimiento
separado que pide la PIPL.

> **VE:** SC 332/2001 (consentimiento informado) · lo prometido en la política.
> **CN:** PIPL arts. 38, 39 y 40.

---

## 10 · Decisiones automatizadas trazables

**Qué buscar:** cualquier punto donde el sistema decide algo sobre una persona —
scoring, calificación de leads, aprobación o rechazo, priorización, moderación,
detección de fraude, verificación de identidad, evaluación de desempeño.

**Delata el problema:**
- Se guarda el resultado pero no los factores que lo produjeron.
- No se registra la versión del algoritmo, del modelo ni del prompt que decidió.
- No hay forma de pedir intervención humana.
- La persona nunca supo que la decisión fue automática.
- El resultado se presenta como "advisory" pero en la práctica nadie lo
  contradice: entonces es una decisión, no una sugerencia.

**El arreglo:** una tabla de decisiones con `titular_id`, `entrada`,
`version_modelo`, `salida`, `factores`, `decidido_en`, `revisado_por`,
`revisado_en`. Y un camino real para pedir la revisión.

> **VE:** CRBV art. 28 — derecho a **conocer el uso** que se hace de los datos y
> su finalidad; un veredicto automático sobre una persona es un uso. CRBV art. 60
> — protección del honor y la reputación, que es exactamente lo que un veredicto
> erróneo daña.
> **CN:** PIPL art. 24 — transparencia y equidad en las decisiones automatizadas,
> derecho a una explicación y a **rechazar** decisiones tomadas solo por medios
> automatizados que afecten significativamente a la persona.

---

## 11 · Valor probatorio de la aceptación electrónica

*Punto propio de este fork. No existe en el checklist chileno porque Chile tiene
su propia ley de firma electrónica.*

**Qué buscar:** cómo se registra que alguien aceptó algo, y cuánto vale eso ante un
tribunal venezolano.

- ¿Qué se hashea: el **texto exacto** que la persona vio, o solo un identificador
  de versión?
- ¿El documento publicado es inmutable **en la base de datos**, o solo por una
  norma escrita que nadie hace cumplir? Busca policies de `UPDATE` y `DELETE`
  sobre la tabla de documentos.
- ¿La tabla de aceptaciones es realmente append-only? Un trigger que lanza
  excepción vale; un comentario que dice "append-only" no.
- ¿Quién sella la evidencia: el servidor o el cliente? Si el navegador manda la
  IP, la hora o el user-agent, no son evidencia.
- ¿Hay certificado de un **Proveedor de Servicios de Certificación acreditado por
  SUSCERTE**?
- ¿Entran certificados **extranjeros** (DocuSign, Adobe Sign)?

**Los tres escalones, y en cuál estás:**

| Escalón | Qué es | Valor |
|---|---|---|
| Mensaje de datos | El documento electrónico en sí | **Art. 4** — misma eficacia probatoria que un documento escrito |
| Firma electrónica **no certificada** | Hash propio, casilla, firma dibujada en pantalla | **Art. 17** — no equivale a firma autógrafa; es *elemento de convicción valorable conforme a las reglas de la sana crítica* |
| Firma electrónica **certificada por un PSC** | Certificado de un proveedor acreditado por SUSCERTE | **Arts. 16 y 18** — misma validez y eficacia que la **firma autógrafa** |

**Delata el problema:**
- Copy de interfaz que dice *"firmado"* o *"firma digital"* cuando el respaldo es
  del art. 17. Es una afirmación falsa sobre el propio sistema.
- Un hash de la **referencia** al documento presentado como huella de integridad
  del **contenido**.
- Documentos "publicados e inmutables" que un administrador puede editar.
- Un certificado extranjero al que se le atribuye la eficacia del art. 16 sin que
  un PSC venezolano lo garantice (**art. 44**).
- Una firma manuscrita **digitalizada** (dibujada con el dedo en una pantalla)
  presentada como equivalente a la firma autógrafa. No lo es: falla los
  requisitos 1 y 2 del art. 16 —un trazo se puede reproducir y se puede copiar—.

**El arreglo, en orden de retorno:**
1. **Sellar el contenido**, no la referencia: hash del texto exacto, calculado en
   el servidor, e inmutabilidad del documento publicado forzada por la base.
2. **Corregir el copy** para que no prometa una eficacia que no tiene.
3. Solo entonces evaluar el **certificado de PSC**, y por umbral de valor del
   acto: no todo acto justifica el costo y la fricción.

**Y cuando hay papel de por medio:** una firma manuscrita sobre papel **sí** es
autógrafa, y vale más que cualquier firma en pantalla. Pero el art. 4 §2 dice que
lo reproducido en formato impreso tiene la eficacia de las *copias o
reproducciones fotostáticas*: la **foto** del papel firmado es una copia simple e
impugnable; el **original archivado** es la prueba fuerte. Si el proceso fotografía
el papel y lo descarta, se está tirando la mejor prueba que tenía.

> **VE:** Ley sobre Mensajes de Datos y Firmas Electrónicas — arts. 4, 16, 17, 18
> y 44. Los PSC acreditados, en `marco-legal-ve.md`.

---

## 12 · Titulares que no son tus usuarios

*Punto propio de este fork.*

**Qué buscar:** personas cuyos datos trata el sistema **sin que hayan pasado nunca
por el registro ni por la política**. Casi siempre están fuera del inventario
porque no tienen `user_id`.

Los habituales:
- Quien **recibe** una entrega y firma por ella — muchas veces no es el cliente,
  sino un empleado, un familiar o un conserje.
- El **contacto del proveedor** en el extranjero.
- El **contacto de emergencia** de un empleado.
- El **referido** al que alguien invitó dando su teléfono.
- El **pagador tercero** de una factura ajena.

**Delata el problema:**
- La política enumera los momentos de captura y **falta el trabajo de campo**: la
  entrega, el retiro en almacén, la inspección.
- Una cláusula del tipo *"si nos das datos de otra persona, declaras que cuentas
  con su permiso"* usada para cubrir datos que la empresa **recolecta
  directamente** de esa persona. Esa cláusula solo cubre lo que un usuario te
  entrega; no cubre lo que tú capturas de alguien que tienes enfrente.
- Fotografía de rostro, documento de identidad o **ubicación GPS** capturados en
  campo sin ningún aviso en el momento de la captura. Ojo: el rostro es
  **biométrico** y la ubicación es **geolocalización** — los dos son datos
  sensibles, y de una persona que no es tu usuario. Es la combinación más
  delicada que puede tener un sistema.
- Esa persona no tiene ninguna vía para ejercer sus derechos: normalmente ni sabe
  el nombre de la empresa que la fotografió.
- Retención indefinida: la foto del rostro de quien recibió una caja hace tres
  años sigue ahí.
- Un **tercero con credenciales** del sistema (transportista, contratista) es
  quien hace la captura, sin contrato que lo regule.

**El arreglo:**
1. Meter a estos titulares en el inventario del paso 1, aunque no tengan cuenta.
2. Un **aviso en el momento de la captura** — corto, en la pantalla del operario,
   antes de pedir la firma: quién es la empresa, para qué se toma el dato y cómo
   ejercer derechos. Y registrar que se mostró (versión y hora), no solo
   mostrarlo.
3. Una **política de retención** específica, con borrado automático. Es lo que
   hace defendible la captura.
4. Aplicar minimización con dureza: cada elemento capturado tiene que ganarse su
   lugar. Fotografiar a una persona es la captura más invasiva de todas.

**La tensión que hay que nombrar en el reporte:** reforzar la prueba y proteger
los datos empujan en direcciones opuestas. Más fotos y más documentos = mejor
defensa ante un reclamo, y mayor exposición. No se resuelve eligiendo un lado: se
resuelve capturando lo justo, **sellándolo** para que valga, avisando a quien se
le captura, y borrándolo a tiempo.

> **VE:** CRBV arts. 28 y 60 · SC 332/2001 (autonomía: consentimiento **previo** e
> informado; temporalidad) · **Ley Especial contra los Delitos Informáticos, art.
> 20** — obtención indebida de data o información de carácter personal.
> **CN:** PIPL art. 28 — la **información biométrica** y las imágenes de rostro son
> **información personal sensible**: exigen finalidad específica, necesidad
> acreditada y consentimiento separado.

---

## Lo que esta auditoría no cubre

Fuera de alcance, siempre a un abogado:

- La redacción legal de las políticas y los términos.
- Qué base de licitud aplica a cada tratamiento concreto.
- Los contratos con proveedores, encargados, aliados y transportistas.
- La decisión sobre firma electrónica certificada y con qué PSC.
- Qué se conserva por obligación legal —tributaria, mercantil, laboral, aduanera—
  y por cuánto tiempo.
- Cualquier obligación sectorial —salud, banca, seguros, educación— que se sume.
