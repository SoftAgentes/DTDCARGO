# Aviso a los clientes · cambio de alojamiento de la plataforma (borrador)

- **Fecha del borrador:** 2026-10-13 (Worker SDD-0505).
- **Estado:** borrador para que Sam lo apruebe y lo envíe. **No se ha enviado.**
- **Para qué:** el guion del corte (`docs/runbooks/servidor-contabo.md` §3.6,
  checklist, punto 3) exige avisar a los clientes antes del corte, y la revisión
  [`revision-traslado-contabo-2026-10-09.md`](revision-traslado-contabo-2026-10-09.md)
  (H4) lo deja como lo único pendiente de ese hallazgo.
- **Hechos en los que se apoya** (los mismos que la política publicada en
  `/privacidad`, aprobada por Sam el 2026-10-13): los datos se alojan hoy y después
  del cambio en servidores en Estados Unidos; los respaldos se cifran antes de
  salir del servidor y se guardan 30 días en otro proveedor; el equipo que trata
  los datos está en Venezuela; no se nombran proveedores (decisión de Sam, julio
  de 2026). No promete nada que el sistema no haga: la sesión abierta debería
  seguir válida después del corte (claves de sesión compartidas, `jwks-set.sh`),
  pero como eso se comprueba recién en el smoke del corte, el texto solo garantiza
  que usuario y contraseña no cambian.
- **Antes de enviar hay que completar:** la fecha y la hora (**decidida por Sam el
  2026-10-13: hoy martes 13, de 10:00 a 11:00 p. m., hora de Venezuela**) y el canal
  (correo a los clientes con cuenta en el Portal, mensaje en el Portal, WhatsApp a
  quienes lo usan). El paso 2 del corte (la web, domingo 25) no interrumpe el
  servicio y no necesita aviso.
- **Tono:** tuteo venezolano, sin voseo, como el resto de la comunicación de la
  marca (`BRAND.md`).

## Versión larga (correo)

**Asunto:** Mejora en la plataforma de DTD Cargo · hoy martes 13 de octubre, 10:00 p. m.

Hola, [nombre]:

Te escribimos para contarte un cambio que estamos haciendo en la plataforma de
DTD Cargo. No te pide nada a ti, pero queremos que lo sepas con tiempo.

**Qué cambia.** Estamos mudando la base de datos y los archivos de la plataforma
a un servidor administrado por nosotros, que sigue estando en Estados Unidos.
Con esto ganamos control sobre la información y sobre las copias de seguridad,
que se cifran antes de salir del servidor y se guardan en un proveedor distinto.

**Cuándo.** Hoy martes 13 de octubre, entre las 10:00 y las 11:00 de la noche
(hora de Venezuela). Durante ese rato la plataforma mostrará el mensaje «Estamos
haciendo una mejora» y no se podrán guardar cambios: ni registrar prealertas, ni
subir documentos, ni editar tu perfil. Las páginas informativas siguen abiertas.

**Qué tienes que hacer.** Nada. Tu usuario y tu contraseña siguen siendo los
mismos y no hace falta registrarse otra vez. Si la plataforma te pide iniciar
sesión de nuevo, entra como siempre. Si a esa hora estabas guardando algo,
espera a que vuelva y repítelo.

**Tus datos.** No cambia qué datos tratamos ni para qué. Actualizamos la
política de privacidad para describir dónde se alojan y cómo se respaldan:
puedes leerla en https://dtdcargo.com/privacidad.

Si tienes cualquier duda, respóndenos a este correo o escríbenos por el canal de
siempre.

Gracias por confiar en DTD Cargo.

El equipo de DTD Cargo

## Versión corta (WhatsApp o aviso en el Portal)

Hola, [nombre]. Hoy martes 13 de octubre, de 10:00 a 11:00 p. m. (hora de
Venezuela), la plataforma de DTD Cargo estará en mantenimiento por una mejora en
nuestros servidores. En ese rato no se podrán guardar cambios. No tienes que
hacer nada: tu usuario y tu contraseña siguen igual. Actualizamos la política de
privacidad en dtdcargo.com/privacidad. ¡Gracias!

## Versión para el equipo interno (Studio y Back)

Hoy martes 13, 10:00 p. m.: el sistema queda en modo mantenimiento alrededor de
una hora mientras se copia la base al servidor propio. No guarden nada en ese
rato (lo que se guarde en el sistema viejo después de la copia se pierde). A las
11:00 p. m. vuelve con los mismos datos; si algo no se ve igual, avisen de inmediato por el
grupo. El sitio público y las tarifas siguen abiertos todo el tiempo.

## Registro

| Fecha | Qué | Quién |
|---|---|---|
| 2026-10-13 | Borrador escrito con los hechos del inventario y la política aprobada | Worker SDD-0505 |
| 2026-10-13 | Fecha decidida por Sam: hoy 22:00-23:00 de Caracas; los tres textos pasados a esa hora | Sam (fecha) · Worker (texto) |
| — | Aprobación del texto | Sam |
| — | Envío (canal, cuántos clientes) | Sam |
