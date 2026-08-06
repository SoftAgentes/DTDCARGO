# Inventario de los Salesbots de Kommo — antes de retirarlos

> **Para qué existe:** capturar qué hacía cada Salesbot **antes de borrarlos**, porque Kommo no tiene
> una vía segura de exportarlos (el botón "ver fuente" avisa que *"una vez que modifiques el código de
> la fuente, no podrás volver al editor visual"* — camino de ida).
>
> Extraído el **2026-08-06** del endpoint interno `GET /ajax/v4/bots/{id}?with=text` de
> `dtdcargo.kommo.com`. No hay API pública de Salesbots en la v4.

## ✅ EJECUTADO — 2026-08-06

**Los 11 bots quedaron APAGADOS** (`settings.active: false`, verificado por API) y se cerraron sus
sesiones colgadas: **de 3.082 a 4**.

⚠️ **Kommo NO ofrece borrar un Salesbot desde la lista.** La barra de acciones masivas sólo tiene
`apagar` · `turn on` · `detener sesión` · `reiniciar las estadísticas`. Apagar es lo que hay, y es
reversible — que para este caso es mejor que borrar.

Las dos acciones usadas, para repetirlas si hace falta:
- **`apagar`** → deja `settings.active: false`. El bot no puede dispararse.
- **`detener sesión`** → cierra las sesiones colgadas. Hubo que correrlo **dos veces**: procesa por
  lotes (3.082 → 467 → 4).

Se cerraron las sesiones porque una sesión de Salesbot abierta **puede impedir que el agente de IA
tome esa conversación**. Con los bots apagados no podían continuar de todas formas.

## ⭐ El hallazgo: ya están muertos

**Ningún bot tiene disparador.** El panel `Disparadores` está vacío en los 11 (sólo `NPS Bot` declara
"Conversación cerrada"), y el tablero de automatizaciones del pipeline `Ventas DTD` tiene **una sola
regla**: *"En un mensaje recibido desde canales seleccionados → Activar agente de IA"*. Ningún
Salesbot se lanza desde ahí.

**Prueba empírica:** los contadores de lanzamientos y sesiones quedaron **idénticos** entre el
2026-08-05 y el 2026-08-06, y en ese lapso entraron leads nuevos y el agente de IA estuvo activo.
Cero lanzamientos en 24 h.

⚠️ **Por lo tanto, las "sesiones activas" no son gente conversando: son escombro histórico** —
conversaciones que nunca se cerraron formalmente cuando los bots eran la puerta de entrada, antes de
la consolidación del embudo. **No hay choque con el agente de IA** y apagarlos no cambia nada, porque
nada los prende.

**Consecuencia operativa:** `Asignar asesor` **no está repartiendo leads**. El traspaso a un humano no
existe hoy — hay que construirlo, no preservarlo. Encaja con que haya 372 leads sin dueño en
`Contacto inicial`.

## Los 11 bots

| id | Nombre | Lanz. | Sesiones "activas" | Qué hacía |
|---|---|---|---|---|
| 38249 | **Bienvenida horario oficina** | 2.734 | 1.208 | Saludo + **menú de letras A–H** → ruteaba a los bots de servicio |
| 38711 | **Asignar asesor** | 3.886 | 1.124 | Ruteo por palabra clave → `Cambiar responsable` + **Round Robin** |
| 38713 | **Solicitud de datos** | 887 | 368 | Pedía nombre, cédula, correo y dirección; los guardaba en campos |
| 38251 | Carga marítima | 505 | 260 | Condiciones del servicio marítimo |
| 38777 | Atencion al cliente | 347 | 0 | Imagen + `Cambiar etapa` |
| 38773 | cursos | 105 | 62 | Info de cursos |
| 38775 | asesorías personalizadas | 96 | 33 | Info del servicio de asesoría |
| 38715 | validacion de proveedores | 35 | 17 | Presencial vs. digital |
| 38771 | Validación de mercancía | 21 | 10 | En almacén vs. en fábrica |
| 47639 | NPS Bot | 0 | 0 | Encuesta 1-10 (**nunca corrió**) |
| 54707 | Bot de chat en el sitio web | 0 | 0 | Vacío (**nunca corrió**) |

## El menú que era la puerta de entrada

`Bienvenida horario oficina` mandaba esto y de ahí salía todo lo demás:

```
¡Hola! es un placer saludarte somos Doortudoor, una empresa de importación de China a
Venezuela, con mas 13 años de experiencia.🚚
Puedes indicarme sobre cual servicio te gustaría información escribiendo la letra de la opción.😁
A- Carga marítima ⚓          E- Investigación de productos 👁️
B- Compra asistida 📦         F- Cursos 📖
C- Validación de proveedor 🛸  G- Asesoría personalizada 😀
D- Verificación de mercancía 🔎 H- Atención al cliente 📱
```

Fallback: *"No he logrado entender tu mensaje, puedes intentar de nuevo o esperar a ser atendido por
un asesor."*

**Ese menú es el mapa de los 11 embudos por servicio que se consolidaron.** Es lo que ahora tiene que
hacer el Clasificador entendiendo, en vez de pidiendo una letra.

## 🔴 Por qué actualizarlos no servía: el contenido está mal

### Marca

- **"Doortudoor"** en el saludo y en Carga marítima. La marca pública es **DTD Cargo**.
- **"mas 13 años de experiencia"** — número congelado y además equivocado: desde 2008 van 18. La regla
  es calcularlo, nunca escribir un total fijo.

### Datos operativos falsos — `Carga marítima`

```
- Cancelas el porcentaje que ocupa tu mercancía, nuestro mínimo marítimo es de 0.20 CBM.
- Tarifas especiales a partir de 5CBM.
- Los envíos tardan entre 65 y 90 días aproximadamente más 10 días de nacionalización.
- El peso permitido por CBM es de 500KG, si tu mercancía excede de ese peso, se cobra por peso adicional.
```

- 🔴 **500 KG por CBM es FALSO.** Producción cobra **1.000 kg/m³** desde el 2026-07-06.
- 🔴 **"Tarifas especiales a partir de 5CBM"** — umbral de volumen prometido por escrito. Es
  exactamente lo que las reglas prohíben ofrecer.
- 🟡 **"65 y 90 días"** — el dato canónico es **60 a 90**.

### Compromisos comerciales sin dueño

`Bienvenida` cerraba con un precio concreto:

> *"Este servicio tiene un costo de **$60**, que será reembolsado al cerrar la negociación con el
> proveedor seleccionado."*

Un precio y una condición de reembolso comprometidos por un bot que nadie estaba revisando.

### Ruteo a gente que ya no está

`Asignar asesor` condiciona por nombre: `jose`, `arilys`, `urso`, `sam`, más `asesor`, `visa` y
`china a venezuela`. **Ninguno corresponde a un usuario activo de Kommo** — hoy sólo hay dos cuentas
activas y una es de un consultor externo. El **71,4%** de sus lanzamientos caía en la rama
`Ninguna de las condiciones` → **Round Robin**, que reparte entre nadie.

## Lo único que vale la pena rescatar

1. **El mapa de servicios del menú A–H** — es el catálogo real y alimenta la tabla de ruteo del
   Clasificador en [`../marketing/agentes-ia-por-etapa.md`](../marketing/agentes-ia-por-etapa.md).
2. **La secuencia de `Solicitud de datos`** — nombre → cédula → correo → dirección, con confirmación
   de cada dato ya conocido antes de volver a pedirlo. Ese patrón de *"¿su cédula es X?"* en vez de
   *"deme su cédula"* es bueno y es lo que Codex propone como `SB-02`.
3. **`NPS Bot`** — la idea (encuesta 1-10, avisar al gerente si es baja) es válida. Nunca corrió.
   Reconstruirlo **después de un servicio cumplido** es un pendiente razonable, no urgente.

## Orden de retiro

Se prueba primero con los que no tienen sesiones, como red de seguridad:

1. **Borrar** `Bot de chat en el sitio web` (54707) y `NPS Bot` (47639) — cero lanzamientos en toda su
   vida, nada que perder.
2. **Borrar** `Atencion al cliente` (38777) — 0 sesiones activas.
3. Verificar que no pasó nada raro, y recién ahí el resto.
4. **Borrar** los seis de servicio + `Solicitud de datos` + `Asignar asesor`.

⚠️ **`Bienvenida horario oficina` se borra al final**, cuando el agente de Entrada esté activo y
probado: es el único que, si algo se reactivara, todavía diría algo a un cliente.
