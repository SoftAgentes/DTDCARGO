# Kommo — el segundo webhook que no es nuestro (`qp1-nova.ru`)

> **Qué es:** un hallazgo, no un procedimiento cerrado. Se encontró el
> **2026-08-24** mirando la pantalla de webhooks de Kommo para otra cosa
> (SDD-0288). **Advisory: acá no se declara que haya un incumplimiento** — se
> deja lo medido separado de lo que no se pudo comprobar, y la decisión es del
> founder.

## Lo medido (captura de `Ajustes → Centro de Integraciones → WEB HOOKS`)

La cuenta tiene **2 webhooks**, no 1:

| # | URL | Eventos suscritos |
|---|---|---|
| 1 | `https://xpfuzqombmjmxvprjgmi.supabas…` (**nuestro**, Supabase) | **Todos** |
| 2 | `https://qp1-nova.ru/api/events/ai_calls_…` (**tercero**) | Nota agregada al **lead** · al **contacto** · a la **compañía** |

El botón del encabezado dice `WEB HOOKS (2)`, lo que confirma el conteo.

## Por qué se anota

**Una nota de Kommo es texto libre que escribe el equipo sobre un cliente.**
Ahí caben nombres, teléfonos, montos, direcciones y el detalle de un caso. Ese
webhook manda esas notas a un servidor de un tercero cada vez que se crea una.

Y hay un antecedente que sube la probabilidad de que nadie lo haya autorizado a
conciencia: ya está registrado que **navegar la ficha de un widget en
`es.nova-kommo.com` instaló uno solo, sin pantalla de confirmación** — un clic
puede completar una instalación. En la barra lateral de Ajustes conviven tres
widgets de esa familia: *"Tintado de leads via N…"*, *"Tinción no es un leads
acti…"* (con el error de tipeo ya anotado como pendiente) y *"Análisis de
llamadas AI …"*. El path del webhook (`/api/events/ai_calls_…`) apunta al
tercero de esos.

## 🔴 Lo que NO está medido — y no se debe suponer

Nada de esto se comprobó. Se lista para que no se confunda una sospecha con un
hecho:

- **Si el widget se contrató a propósito** o entró por el clic accidental.
- **Qué hace con las notas**: si las procesa y descarta, o las retiene.
- **Dónde quedan alojadas** ni por cuánto tiempo.
- **Si está activo hoy** o quedó como cáscara sin uso.
- **Si alguna nota real ya viajó** — hay que mirar si el equipo usa notas.

⚠️ **El dominio es `.ru`.** Eso es un dato de la URL, no una conclusión: no
prueba dónde están los servidores ni bajo qué régimen. Se anota porque una
transferencia internacional de datos de clientes es una decisión que se toma a
propósito, no una que se descubre.

## Qué hacer (en este orden)

1. **Decidir si el widget se usa.** Es una pregunta al equipo, de diez segundos,
   y evita medir durante una hora algo que nadie usa. *(Es la misma lección del
   caso del `SalesBot:` de Instagram: antes de cazar al bot, preguntá si fue una
   persona.)*
2. **Si NO se usa** → desinstalar el widget y borrar el webhook (el ícono de
   papelera 🗑 a la derecha de su fila). Sale del problema sin analizarlo.
3. **Si SÍ se usa** → pedirle al proveedor por escrito qué retiene y dónde, y
   registrarlo. Ahí deja de ser un hallazgo y pasa a ser una decisión tomada.
4. **En cualquier caso, revisar si el equipo escribe datos de clientes en las
   notas.** Si la respuesta es sí, el punto 3 no es opcional.

⚠️ **No lo toco yo.** Borrar un webhook o desinstalar un widget es un cambio de
configuración en un sistema externo, en producción, y puede romper algo que
alguien esté usando. Va con el OK del founder, y del founder.

## Relacionado

- [`setup-kommo-webhook.md`](setup-kommo-webhook.md) — el nuestro. Su tabla de
  "6 eventos" quedó desfasada: hoy está en **Todos**.
- [`../specs/0288-alerta-cliente-escribe/spec.md`](../specs/0288-alerta-cliente-escribe/spec.md)
  — el trabajo durante el cual apareció esto.
- El marco de datos personales y cómo se auditan estos casos:
  `.claude/skills/revisar-datos-ve/`.
