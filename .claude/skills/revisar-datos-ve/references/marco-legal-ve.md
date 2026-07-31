# Marco legal · Venezuela

Fuente para citar. **No cites de memoria: cita desde acá.** Si necesitas un
artículo que no está en este archivo, búscalo antes de afirmar qué dice.

---

## La idea que hay que tener clara antes de empezar

**Venezuela no tiene una ley especial de protección de datos personales.** El
proyecto de Ley Orgánica de Protección de Datos Personales nunca se promulgó.

Eso **no** significa que no haya obligaciones. Significa que el marco es distinto
en tres cosas que cambian todo el análisis:

| | Chile / RGPD | Venezuela |
|---|---|---|
| Fuente | Ley especial + reglamento | **Constitución + jurisprudencia vinculante del TSJ** |
| Autoridad | Agencia / autoridad de control | **No existe.** La vía es **judicial** |
| Sanción típica | Multa administrativa (hasta 20.000 UTM) | **Acción de habeas data** y, en los supuestos de los arts. 20-22 de la ley de delitos informáticos, **prisión de 2 a 6 años** |
| Plazos de respuesta | 30 días corridos, 2 días hábiles para bloqueo | **No hay plazo legal.** El que la organización publique se vuelve exigible |

⚠️ **Error frecuente a evitar:** importar nomenclatura ajena. En Venezuela **no
existen** los "derechos ARCO" (eso es México), ni el "responsable" y el
"encargado del tratamiento" como figuras legales definidas (eso es el RGPD y
Chile), ni el "delegado de protección de datos". Usa los términos de la norma
venezolana.

---

## 1 · Constitución de la República Bolivariana de Venezuela

### Artículo 28 — habeas data

Es el derecho fundamental y la fuente principal. Reconoce a toda persona el
derecho a:

- **acceder** a la información y a los datos sobre sí misma o sobre sus bienes
  que consten en registros **oficiales o privados**, con las excepciones que
  establezca la ley;
- **conocer el uso** que se haga de ellos y **su finalidad**;
- solicitar ante el tribunal competente la **actualización, la rectificación o la
  destrucción** de aquellos, si fuesen erróneos o afectasen ilegítimamente sus
  derechos.

Dos cosas que se pasan por alto:
1. Dice **"o privados"**. No es un derecho solo frente al Estado: alcanza a
   cualquier empresa que lleve un registro.
2. **"conocer el uso y su finalidad"** es un derecho autónomo, distinto del de
   acceso. No basta con enseñar los datos: hay que decir para qué se usan.

### Artículo 60 — vida privada, honor, imagen

Protege el honor, la vida privada, la intimidad, la **propia imagen**, la
confidencialidad y la reputación. Y añade el mandato: *la ley limitará el uso de
la informática para garantizar el honor y la intimidad personal y familiar de los
ciudadanos y el pleno ejercicio de sus derechos.*

La **propia imagen** es la que hace falta para analizar fotografías de personas.

---

## 2 · Jurisprudencia vinculante · Sala Constitucional del TSJ

### Sentencia 332/2001 — los seis principios para registros privados

Es la pieza más útil de todo el marco, porque fija principios **obligatorios**
que aplican a quien lleve un registro **privado**:

| Principio | Qué exige |
|---|---|
| **Autonomía** | Consentimiento **previo, libre, informado, inequívoco y revocable** |
| **Legalidad** | Las restricciones al derecho solo por ley |
| **Finalidad y calidad** | Los datos se limitan a fines predeterminados, explícitos y legítimos; deben ser exactos, completos y actualizados |
| **Temporalidad** | Se conservan solo durante el período necesario para la finalidad |
| **Exactitud y autodeterminación** | Derecho de acceso, y procedimientos de corrección y supresión |
| **Seguridad y confidencialidad** | Medidas técnicas y acceso restringido |

Mapea casi punto por punto con los principios del RGPD. La diferencia es la
fuente: allá es una ley, acá es doctrina constitucional vinculante.

### Sentencia 759 del 21 de mayo de 2025 — derecho al olvido y competencia

La más reciente y la más operativa. Establece:

- El **habeas data** es la vía procesal para exigir la **supresión, rectificación,
  confidencialidad, inclusión, actualización o uso correcto** de datos en
  registros **públicos o privados**.
- Reconoce el **derecho al olvido**: pasado un tiempo razonable, mantener un
  registro activo carece de justificación legal y vulnera derechos
  fundamentales.
- **Competencia:** los **Juzgados de Municipio en lo Contencioso Administrativo**
  de la circunscripción donde el solicitante tenga su **domicilio**.

Ese último punto es el que hay que entender para dimensionar el riesgo: un
titular molesto no presenta una denuncia ante una agencia — demanda en el
tribunal de su propio domicilio.

### Otras referidas

- **Sentencia 1.318/2001** y **Sentencia 4.975/2005** — exigen exactitud y
  veracidad de los datos, prohíben el uso indebido que afecte el honor y la
  confidencialidad, y fijan estándares de seguridad para registros
  informatizados.
- **Sentencia 745/2010** (caso Espacio Público) — desarrolla los requisitos de
  admisibilidad de la acción de habeas data.

> Si vas a apoyar un hallazgo grave en una de estas sentencias, verifica el texto
> vigente. La jurisprudencia se matiza.

---

## 3 · Ley Especial contra los Delitos Informáticos (2001)

Es donde vive el riesgo **penal**, y por eso es el ancla del punto 8 y del punto
12 del checklist.

- **Artículo 20 — obtención indebida** de data o información de carácter
  personal.
- **Artículo 21 — violación de la privacidad de las comunicaciones.** Quien,
  mediante el uso de tecnologías de información, acceda, capture, intercepte,
  interfiera, reproduzca, modifique, desvíe o elimine cualquier mensaje de datos
  o señal de transmisión o comunicación ajena: **prisión de dos a seis años** y
  multa de doscientas a seiscientas unidades tributarias.
- **Artículo 22 — revelación indebida** de data o información de carácter
  personal. Quien revele, difunda o ceda, en todo o en parte, los hechos
  descubiertos, las imágenes, el audio o, en general, la data o información
  obtenidos por alguno de los medios indicados en los artículos 20 y 21:
  **prisión de dos a seis años** y multa de doscientas a seiscientas unidades
  tributarias. **Si hubo fin de lucro o resultó perjuicio para otro, la pena se
  aumenta de un tercio a la mitad.**

Lo que hay que entender: la responsabilidad es **penal y de personas naturales**,
no una multa a la empresa. Por eso el contrato con cada tercero que toca datos
—transportista, contratista, aliado, proveedor— no es papeleo: es lo que delimita
quién responde.

---

## 4 · Ley sobre Mensajes de Datos y Firmas Electrónicas

Decreto con Rango y Fuerza de Ley N° 1.204, Gaceta Oficial N° 37.148 del
28 de febrero de 2001. Es el ancla del **punto 11**.

### Artículo 4 — eficacia probatoria del mensaje de datos

> *"Los Mensajes de Datos tendrán la misma eficacia probatoria que la ley otorga
> a los documentos escritos, sin perjuicio de lo establecido en la primera parte
> del artículo 6 de este Decreto-Ley. Su promoción, control, contradicción y
> evacuación como medio de prueba, se realizará conforme a lo previsto para las
> pruebas libres en el Código de Procedimiento Civil.*
>
> *La información contenida en un Mensaje de Datos, reproducida en formato
> impreso, tendrá la misma eficacia probatoria atribuida en la ley a las copias o
> reproducciones fotostáticas."*

Dos consecuencias prácticas:
1. **Prueba libre** significa que el juez valora conforme a la **sana crítica** —
   pesa el conjunto. Por eso un haz de evidencias convergentes puede ser fuerte
   aunque ninguna pieza aislada lo sea.
2. El **segundo párrafo** es el que casi nadie lee: la foto o el escaneo de un
   documento firmado en papel vale como **copia fotostática**, que es impugnable.
   El **original en papel** es la prueba fuerte. Un proceso que fotografía el
   papel y lo descarta está tirando su mejor prueba.

### Artículo 16 — cuándo la firma electrónica equivale a la autógrafa

> *"La Firma Electrónica que permita vincular al Signatario con el Mensaje de
> Datos y atribuir la autoría de éste, tendrá la misma validez y eficacia
> probatoria que la ley otorga a la firma autógrafa. A tal efecto, salvo que las
> partes dispongan otra cosa, la Firma Electrónica deberá llenar los siguientes
> aspectos:*
>
> *1. Garantizar que los datos utilizados para su generación puedan producirse
> sólo una vez, y asegurar, razonablemente, su confidencialidad.*
> *2. Ofrecer seguridad suficiente de que no pueda ser falsificada con la
> tecnología existente en cada momento.*
> *3. No alterar la integridad del Mensaje de Datos."*

El **requisito 3** es el que hace que la inmutabilidad del documento importe: si
el contenido puede cambiar después de firmado, la firma no cumple.

Y es el filtro que descarta la **firma manuscrita digitalizada** (la que se dibuja
con el dedo en una pantalla): falla el 1 —un trazo se puede reproducir cuantas
veces se quiera— y falla el 2 —se copia trivialmente—.

### Artículo 17 — efectos jurídicos, sana crítica

Epígrafe literal de la ley: *"Efectos jurídicos. Sana critica."*

> *"La Firma Electrónica que no cumpla con los requisitos señalados en el artículo
> anterior no tendrá los efectos jurídicos que se le atribuyen en el presente
> Capítulo, sin embargo, podrá constituir un elemento de convicción valorable
> conforme a las reglas de la sana crítica."*

Traducción operativa: un hash propio, una casilla marcada o una firma dibujada
**no son inútiles** — simplemente **no invierten la carga de la prueba**. Quien
afirma tiene que convencer al juez.

### Artículo 18 — la certificación

> *"La Firma Electrónica, debidamente certificada por un Proveedor de Servicios
> de Certificación conforme a lo establecido en este Decreto-Ley, se considerará
> que cumple con los requisitos señalados en el artículo 16."*

Este es el atajo completo: con certificado de un PSC acreditado, la equivalencia
con la firma autógrafa se **presume**. Quien niegue es quien tiene que probar.

### Artículo 38 — qué garantiza el certificado

El Certificado Electrónico garantiza la **autoría** de la firma electrónica que
certifica y la **integridad** del mensaje de datos.

### Artículo 43 — contenido del certificado

Identificación del PSC (domicilio y dirección electrónica) · el código de
identificación que le asignó SUSCERTE · identificación del titular · fechas de
inicio y vencimiento de vigencia · la firma electrónica del signatario · un serial
único.

### Artículo 44 — certificados extranjeros

> *"Los Certificados Electrónicos emitidos por proveedores de servicios de
> certificación extranjeros tendrán la misma validez y eficacia jurídica
> reconocida en el presente Decreto-Ley, siempre que tales certificados sean
> garantizados por un Proveedor de Servicios de Certificación, debidamente
> acreditado conforme a lo previsto en el presente Decreto-Ley, que garantice, en
> la misma forma que lo hace con sus propios certificados, el cumplimiento de los
> requisitos, seguridad, validez y vigencia del certificado."*

⚠️ **Trampa habitual:** DocuSign, Adobe Sign y similares emiten certificados
extranjeros. Sin la garantía de un PSC venezolano acreditado, **no alcanzan** la
equivalencia del art. 16 en Venezuela.

---

## 5 · Los PSC acreditados por SUSCERTE

La **Superintendencia de Servicios de Certificación Electrónica (SUSCERTE)**
acredita a los Proveedores de Servicios de Certificación y administra la AC RAÍZ
del Estado venezolano. El listado oficial reporta **seis (06)** PSC:

| Marca | Nombre en el listado SUSCERTE | Contacto |
|---|---|---|
| Apacuana | Soluciones Tecnológicas Apacuana C.A. | contacto@apacuana.com |
| FirmeDigital | Documentos Digitales PSC | soporte@firmedigital.com |
| Chinchin | Soluciones Financieras Chinchin | info@pagochinchin.com |
| FIIIDT / CSICE *(público)* | Fundación Instituto de Ingeniería para Investigación y Desarrollo Tecnológico | csice@fii.gob.ve |
| PROCERT | Proveedor de Certificados PROCERT C.A. | contacto@procert.net.ve |
| Authenology | aparece como "Authenticsing" en la página web | contacto@authenology.com.ve |

Normas aplicables: **Norma SUSCERTE N.º 027** (procedimiento de acreditación),
**N.º 040** (estándares técnicos y de seguridad para PSC) y **N.º 032** (tipos de
certificados que pueden emitir).

⚠️ **La acreditación se otorga y se revoca por providencia administrativa.** No
tomes esta tabla como verdad vigente: verifica en <https://www.suscerte.gob.ve/>
antes de contratar o de afirmar que un proveedor está acreditado.

---

## 6 · Lo que este archivo no cubre

- Obligaciones **sectoriales** (banca, seguros, salud, telecomunicaciones,
  educación) que se suman a lo anterior.
- **Plazos de conservación** tributarios, mercantiles, laborales y aduaneros, que
  son los que legitiman conservar datos después de que el titular pide su
  supresión. Los define un contador o un abogado, no esta skill.
- **Ley Orgánica de Protección de Niños, Niñas y Adolescentes (LOPNNA)** cuando
  haya menores.
- **Ley sobre Protección a la Privacidad de las Comunicaciones**.

---

*Este archivo es material de apoyo para una auditoría técnica. No es asesoría
legal. Los artículos citados textualmente provienen del texto publicado por
SUSCERTE; la jurisprudencia, de fuentes secundarias y debe verificarse contra el
texto oficial del TSJ antes de fundar en ella una decisión.*
