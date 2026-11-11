# Uptime Kuma · avisos a Discord `#salud` (SDD-0609)

Uptime Kuma (`compose.yml` de esta carpeta, panel en `vps.dtdcargo.com`) vigila la
web, Supabase y el latido del vigilante de publicación. Hasta el 2026-11-05 avisaba
por Telegram. Desde la [SDD-0609](../../../docs/specs/0609-avisos-servidor-a-discord/spec.md)
avisa por su **notificación nativa de Discord** al canal `#salud` de la categoría
privada «Servidor» del servidor de Discord «DTD Cargo». Corte directo: sin doble
envío.

Esto no cambia nada del repo ni del contenedor: es un paso **manual de Sam en la
interfaz de Kuma**. Nadie más pega la dirección del webhook: es una llave (quien la
tenga escribe en el canal).

## Datos (no son llaves)

| Qué | ID |
|---|---|
| Servidor de Discord «DTD Cargo» | `1534936818951262390` |
| Canal `#salud` (categoría «Servidor») | `1567955345219780698` |

## Pasos de Sam

1. **En Discord:** `#salud` → Editar canal → Integraciones → Webhooks → Nuevo
   webhook. Nombre: `Uptime Kuma`. «Copiar URL del webhook». No la pegues en un
   chat ni en el repo.
2. **En Kuma** (`https://vps.dtdcargo.com`): Configuración → Notificaciones →
   «Configurar notificación».
   - Tipo de notificación: **Discord**.
   - Nombre: `Discord #salud`.
   - URL del webhook de Discord: la que copiaste.
   - Nombre visible del bot: `Uptime Kuma · DTD Cargo` (opcional).
   - Prefijo / mensaje personalizado: **vacío**. No pongas `@everyone`, `@here` ni
     menciones: el canal avisa sin hacer sonar a nadie.
   - Marca «Activado por defecto» y «Aplicar en todos los monitores existentes».
   - Pulsa **Probar**: en `#salud` aparece el mensaje de prueba de Kuma. Guarda.
3. **Apaga Telegram en Kuma:** en la misma lista de notificaciones, la de Telegram →
   desactívala en cada monitor (o bórrala). Así no hay doble envío.
4. **Comprueba monitor por monitor** (Web · dtdcargo.com, Supabase servidor · auth,
   los de Chatwoot de la SDD-0583,
   Publicación web DTD · vigilante y el Push del respaldo): Editar → sección
   Notificaciones → solo `Discord #salud` marcada.

## Prueba de ida y vuelta

- Botón **Probar** del paso 2: llega a `#salud`.
- Opcional, con la web sana: en un monitor de prueba (por ejemplo un HTTP a
  `https://dtdcargo.com/no-existe-sdd-0609` esperando 200), Kuma lo marca caído
  y avisa en `#salud`; al borrar el monitor no queda nada que limpiar. No pauses ni
  rompas los monitores reales para probar.

## Vuelta atrás

Volver a marcar la notificación de Telegram en los monitores (si no se borró) y
desmarcar la de Discord. Si la dirección del webhook se filtra: en Discord, borrar
ese webhook y crear otro; en Kuma, pegar la nueva en `Discord #salud`.

Los avisos de cada publicación de la web no salen de Kuma: los manda
`infra/ops/web/aviso-discord.sh` a `#publicaciones` (ver
[docs/runbooks/avisos-servidor-discord.md](../../../docs/runbooks/avisos-servidor-discord.md)).
