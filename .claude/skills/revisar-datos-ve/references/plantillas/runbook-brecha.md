# Runbook: se filtraron datos

Esto se escribe **antes** de que pase. El día que pasa nadie está en condiciones
de improvisar un procedimiento.

**Quién decide:** _(nombre y suplente)_
**Quién habla con los afectados:**
**Quién habla con la autoridad,** si aplica PIPL:
**Asesoría legal (nombre y teléfono fuera de horario):**
**Contactos fuera de horario del equipo técnico:**

---

## Lo primero que hay que entender: acá no hay agencia

En Venezuela **no existe una autoridad administrativa de protección de datos** a
la que reportar, ni un plazo legal de notificación. Eso tienta a pensar que una
brecha no tiene consecuencias. Es al revés: **la consecuencia es judicial y penal,
no administrativa**, y llega más tarde y peor.

Lo que sí te van a exigir, en un juicio de habeas data o en una denuncia por los
artículos 20 a 22 de la Ley Especial contra los Delitos Informáticos, es que
demuestres **qué hiciste y cuándo**. Sin plazo legal, lo que te defiende es tu
propia **trazabilidad**: tener un mapa de tiempos escrito de antemano y poder
probar que se cumplió al pie de la letra.

**Por eso este runbook fija tiempos propios.** Ajústalos a la realidad del equipo
—pero fíjalos, publícalos internamente y cúmplelos.

| Paso | Tiempo objetivo | Responsable |
|---|---|---|
| Confirmar que la alerta es real | 30 min | |
| Contener el vector | 1 h | |
| Informe interno de alcance | 4 h | |
| Decisión de notificar | 8 h | |
| Notificación a los afectados | 72 h | |

> Si aplica **PIPL** (hay tratamiento en China), el art. 57 sí obliga: medidas de
> inmediato y notificación a la autoridad y a las personas afectadas.

---

## Hora 0 — Contener y anotar

Antes que nada, **empieza una bitácora con hora de cada paso**. Esa bitácora es
después tu prueba de que actuaste con diligencia.

1. Cortar el acceso: rotar credenciales, revocar tokens, cerrar el vector.
2. **No borres evidencia.** Preserva logs antes de limpiar. El impulso de "dejar
   todo limpio" destruye lo que necesitas para responder qué pasó — y en un
   proceso penal, borrar registros después de conocer el hecho se lee muy mal.
3. Congelar despliegues.
4. Anotar la hora exacta en que la organización tomó conocimiento. Ese es el reloj
   que corre.

## Hora 1 a 4 — Entender el alcance

Responder por escrito, aunque sea con incertidumbre:

- ¿Qué ocurrió: destrucción, filtración, pérdida, alteración o acceso no
  autorizado?
- ¿Qué categorías de datos? ¿Hay **sensibles** —biométricos, geolocalización,
  salud, cuentas financieras—? ¿De **menores**? ¿Documentos de identidad?
- ¿Cuántos titulares, aproximadamente? ¿Hay entre ellos **personas que no son
  usuarios** (receptores de entregas, contactos de proveedores)? A esas es más
  difícil avisarles y suele olvidarse que también son afectadas.
- ¿Los datos salieron a otro país?
- ¿Sigue abierto el vector?
- ¿Hay riesgo razonable para los derechos de esas personas?

## Avisar a las personas afectadas

En Venezuela no es una obligación legal expresa, pero **sí es lo que reduce el
daño y lo que un tribunal va a valorar**. Y si la política de privacidad publicada
prometió avisar, entonces sí es exigible: lo prometiste.

En lenguaje claro y sencillo:

- Qué datos suyos se vieron afectados, concretamente.
- Qué consecuencias puede tener para esa persona.
- Qué medidas se tomaron.
- Qué puede hacer ella —cambiar contraseña, vigilar movimientos.
- A quién escribir para saber más.

Se notifica a cada titular. Si no es posible identificarlos a todos, se publica un
aviso visible.

## Si aplica PIPL

**Art. 57.** Adoptar medidas de inmediato y notificar a la autoridad
correspondiente y a las personas afectadas, informando: categorías de información
y causa · daño potencial · medidas adoptadas y medidas de mitigación disponibles
para la persona · datos de contacto. Si las medidas evitan eficazmente el daño, la
autoridad puede eximir de notificar a las personas, pero puede exigirlo igual.

## Después

- [ ] Registrar la vulneración en el registro interno (hazlo exista o no
      obligación de reportar: es tu prueba).
- [ ] Análisis de causa raíz, sin buscar culpables.
- [ ] Cerrar el hueco y verificar que quedó cerrado.
- [ ] Revisar si otros sistemas tienen el mismo hueco.
- [ ] Actualizar el registro de tratamiento si cambió algo.
- [ ] Actualizar este runbook con lo que se aprendió, y **anotar si los tiempos
      objetivo se cumplieron o no**. Si no se cumplieron, o se corrige el proceso
      o se corrige el tiempo — pero no se deja un número que nadie cumple.

---

## Lo que no hay que hacer

- **No minimizar por escrito.** "Fue un incidente menor" en un chat interno es un
  documento en tu contra si después resulta que no lo era.
- **No borrar registros.** Además de destruir tu defensa, en el marco de la Ley
  Especial contra los Delitos Informáticos la eliminación de data puede ser el
  delito, no solo la prueba de él.
- **No prometer lo que no sabes.** "Ningún dato fue comprometido" antes de
  haberlo verificado es la frase que más caro sale.
- **No inventar un plazo después del hecho.** Si el mapa de tiempos no existía
  antes, no lo escribas con fecha retroactiva. Reconoce que no lo tenías y
  créalo ahora.

---

*Plantilla de apoyo, no un documento legal. Que un abogado la revise antes de que
la necesites.*
