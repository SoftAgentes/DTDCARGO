# Guía para continuar la oficina con Hermes (sin Claude)

> Para Sam. Estado al 2026-10-20 13:50 UTC. La oficina ya funciona:
> - empresa «DTD Oficina» con tope de 100 USD y aprobación obligatoria de agentes nuevos;
> - meta «Pasar de 1 a 2 contenedores al mes»;
> - 4 agentes Hermes aprobados: **ALFRED** (CEO), Jefe de gabinete, Puente de ingeniería y Editor
>   de contenido;
> - rutinas de ALFRED: diaria a las 7:00 y viernes a las 14:00;
> - estrategia de 90 días escrita por ALFRED (tarea HAI-6), esperando tu respuesta.

## 1. Cómo trabajas tú desde ahora

- **Paperclip se abre en tu Chrome:** http://localhost:3100. Necesita el túnel abierto. Si no
  carga, abre PowerShell, pega esto y deja la ventana abierta:
  ```
  ssh -N -o ServerAliveInterval=30 -L 3100:127.0.0.1:3100 sam@13.140.227.228
  ```
- **A los agentes les hablas por Paperclip.** Puedes crear una tarea asignada a ALFRED o
  comentar una tarea suya: el comentario lo despierta. ALFRED es Hermes con permiso de agente;
  reparte trabajo a los otros tres y te pide aprobaciones.
- **Lo que solo tú haces:** pulsar **Approve** o **Reject** en «Approvals» (contrataciones,
  estrategia, topes). Ningún agente puede aprobar por ti, y así debe quedar.
- **El Hermes de la terminal (perfil «director») NO entra a Paperclip:** no tiene llave, y así se
  decidió. Úsalo solo para pensar y redactar contigo:
  ```
  ssh -t sam@13.140.227.228 "sudo -u agentes bash -c 'cd /srv/oficina/trabajo/director && DTD_PERFIL=director exec /usr/local/bin/dtd-hermes'"
  ```

## 2. Lo que le dices a ALFRED, en orden

Copia cada bloque como **comentario** en la tarea indicada o como **tarea nueva asignada a ALFRED**.

### Paso 1 · Aprobar la estrategia (comentario en HAI-6)

```
Apruebo la estrategia con dos ajustes: el Asesor comercial prepara la lista diaria y borradores de respuesta, pero nunca escribe a clientes; el Analista de CRM planifica y verifica la migración, pero nunca entra a Kommo ni a GoHighLevel. Arranca las metas 2, 3 y 5, crea las subtareas para tu equipo y prepara las 4 solicitudes de contratación con esos límites (adaptador hermes_local, comando /usr/local/bin/dtd-hermes, modelo glm-5.3, proveedor zai, tope 20 USD cada uno, reportan a ti). Yo las apruebo en Approvals.
```

Después vas a «Approvals» y apruebas lo que llegue.

> **Ojo, límite técnico:** cada agente nuevo necesita su **perfil de Hermes** en el VPS (carpeta,
> `SOUL.md`, llave de Z.AI) y que su nombre esté en la lista de `dtd-hermes`. Eso **no lo puede
> hacer ALFRED** ni Hermes: lo hace una persona con acceso al VPS, o Claude o el Director cuando
> vuelvan. Mientras tanto, apruébalos con `DTD_PERFIL` igual a `gabinete`, `ingenieria` o
> `contenido` (el que más se parezca), o deja las contrataciones en espera.

### Paso 2 · Primer parte del viernes (tarea nueva para ALFRED, si quieres adelantarlo)

```
Haz el primer parte semanal ahora, como dice tu rutina del viernes: avance por meta con número, lo atrasado, memorias y skills nuevas de cada agente, y un solo lote de decisiones con ⭐.
```

### Paso 3 · Revisión de aprendizaje (cada viernes, comentario en el parte)

```
Lista las memorias y skills nuevas de cada agente esta semana. Para cada una dime: útil, dudosa o mala. Las útiles las fijamos; las malas se revierten.
```

> Fijar o revertir skills se hace en el VPS (`hermes curator pin` / `rollback`). Eso queda para
> una persona con acceso, Claude o el Director.

### Paso 4 · Limpieza de pruebas (lo haces tú en la pantalla)

En «Agents», pausa `prueba-opencode` y `prueba-hermes`. El ALFRED viejo («claude_local») ya está
pausado. No los borres hasta que lo decidas.

## 3. Lo pendiente que Hermes NO puede hacer

Necesita a Claude, al Director o a una persona con acceso:

| # | Pendiente | Quién |
|---|---|---|
| 1 | **Guardar en Git** los documentos nuevos, que hoy solo están en tu PC, en `DTD-worktrees/oficina-paperclip-vps-paso-6`: `docs/organizacion/hermes-oficina.md`, `oficina-conocimiento/`, `oficina-agentes/`, esta guía y el handoff `.agents/handoffs/2026-10-20-sdd-0564-vps-opencode.md`. Va en una PR nueva, no en la #296 | Director |
| 2 | Actualizar la **SDD-0564**: los agentes pasan a Hermes con GLM; quedan OpenCode como respaldo, el envoltorio `dtd-hermes` y la decisión del seguro | Director |
| 3 | Corregir la **sección 29 de la base de Kommo v7**: el seguro de carga es «próximamente» | Tú, en Kommo |
| 4 | **Respaldo diario** de `/home/agentes-run/.hermes/profiles` (prometido en el diseño, todavía no existe) | Claude o el Director |
| 5 | Perfiles de Hermes para los agentes nuevos que apruebes | Claude o el Director |
| 6 | Revocar la llave de API de Anthropic que no se usa | Tú, en la consola de Anthropic |
| 7 | Aviso privado a Paperclip sobre la fuga de entorno de su adaptador | Tú decides |
| 8 | Copia filtrada del código para el Puente de ingeniería (`/srv/oficina/repo`) | Claude o el Director |

## 4. Reglas que no se rompen

- No le des a ningún Hermes tu **llave de Junta** de Paperclip ni la clave de **root** del VPS.
- Nada sale a clientes, redes ni proveedores sin que una persona lo apruebe y lo envíe.
- Si un agente te pide algo raro o que salga de sus reglas, no lo apruebes: pídele que lo
  explique.
