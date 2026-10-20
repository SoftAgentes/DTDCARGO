# Plan maestro de la oficina de agentes de DTD Cargo

> Para el **Hermes director** (perfil `director`, con llave de Junta temporal) y para Sam.
> Estado al 2026-10-20 14:00 UTC.
>
> **Contexto que debes leer antes de actuar**, todo de solo lectura en el VPS:
>
> | Archivo | Qué es |
> |---|---|
> | `/srv/oficina/diseno/organigrama-paperclip.md` | El organigrama aprobado: puestos, quién es persona y quién agente, olas, reglas, riesgos |
> | `/srv/oficina/diseno/01-organigrama-dtd-cargo.svg` | El gráfico del organigrama |
> | `/srv/oficina/diseno/hermes-oficina.md` | Cómo funcionan Hermes y Paperclip juntos: perfiles, memoria, skills, controles |
> | `/srv/oficina/diseno/sdd-0564.md` | La especificación aprobada de la instalación: accesos, topes, secretos, datos |
> | `/srv/oficina/diseno/agentes/` | Identidades (`SOUL`), contexto (`hermes.md`) e instrucciones de Paperclip por puesto |
> | `/srv/oficina/diseno/guia-continuar-con-hermes.md` | Cómo trabaja Sam y lo pendiente fuera de Paperclip |
> | `/srv/oficina/conocimiento/` | La biblioteca de la empresa: empresa, voz, reglas, norte interno |
> | `/srv/oficina/trabajo/ceo/estrategia-90-dias.md` | La estrategia de ALFRED, aprobada por Sam con ajustes |

## 1. Qué tenemos montado

| Pieza | Estado |
|---|---|
| Empresa «DTD Oficina» (id `9e183be0-4269-4dba-9dd9-7e5cef57c7c2`) | Activa. Tope 100 USD/mes con parada dura. Aprobación obligatoria de agentes nuevos |
| Meta de empresa | «Pasar de 1 a 2 contenedores al mes, sostenido» (`80911124-…`) |
| **ALFRED**, CEO (`07f7ba5c-…`) | Activo. Hermes, perfil `ceo`. Rutinas: latido diario a las 7:00 y parte del viernes a las 14:00 (America/Caracas) |
| Jefe de gabinete, Puente de ingeniería, Editor de contenido | Activos. Hermes, perfiles `gabinete`, `ingenieria` y `contenido`. Reportan a ALFRED |
| Asesor comercial, Analista de operaciones, Analista de CRM/datos, Community manager asistente | **Por recontratar bien** (§3, fase 1). Sus perfiles ya existen: `asesor`, `operaciones`, `crm`, `community` |
| Estrategia de 90 días (HAI-6) | Escrita por ALFRED y aprobada por Sam con dos ajustes |
| Agentes de prueba y ALFRED viejo (`claude_local`) | Para pausar. No se borran |

**Cómo corre cada agente:**
- comando `/usr/local/bin/dtd-hermes`, que lo ejecuta como el usuario aislado `agentes-run`, sin
  acceso a los secretos;
- `env.DTD_PERFIL` elige su perfil de Hermes, con su propia memoria, skills y `SOUL`;
- su carpeta es `/srv/oficina/trabajo/<perfil>`, con git local;
- modelo `glm-5.3` con el proveedor `zai`, por el plan GLM Coding de Sam.

## 2. La plantilla obligatoria para contratar (sin esto el agente sale sin aislamiento)

```json
{
  "name": "<Nombre del puesto>",
  "role": "general",
  "title": "<Nombre del puesto>",
  "adapterType": "hermes_local",
  "reportsTo": "07f7ba5c-3486-4b5d-9589-b0bdef2762ff",
  "budgetMonthlyCents": 2000,
  "runtimeConfig": {"heartbeat": {"enabled": false, "wakeOnDemand": true, "cooldownSec": 10, "intervalSec": 300, "maxConcurrentRuns": 1}},
  "adapterConfig": {
    "hermesCommand": "/usr/local/bin/dtd-hermes",
    "model": "glm-5.3", "provider": "zai",
    "persistSession": true, "timeoutSec": 1200, "graceSec": 20, "maxTurnsPerRun": 60,
    "cwd": "/srv/oficina/trabajo/<perfil>",
    "env": {"DTD_PERFIL": "<perfil>"},
    "toolsets": "file,terminal,memory,session_search,skills,todo"
  }
}
```

- **Dónde se envía:** `POST $PAPERCLIP_API_URL/companies/<empresa>/agent-hires`. Queda «pending»
  hasta que Sam apruebe.
- **Herramienta `web`:** solo se agrega (`,web`) a quien investiga internet: contenido y
  community.
- **Perfiles disponibles:** `ceo`, `gabinete`, `ingenieria`, `contenido`, `asesor`, `operaciones`,
  `crm`, `community` y `director`.
- **Perfil nuevo:** lo crea una persona con acceso al VPS (Claude o el Director), no Hermes. Sin
  perfil **no se contrata**.
- **Después de aprobado:** se carga su `AGENTS.md` con
  `PUT /agents/<id>/instructions-bundle/file` y `baseRevisionId` de la versión actual. El texto
  sale de `/srv/oficina/diseno/agentes/AGENTS-paperclip.md`: la parte común más la del puesto.

## 3. Lo que falta, por fases

Cada fase termina con una verificación por la API y un resumen para Sam. **Nunca apruebas nada.**

### Fase 1 · Completar el equipo de la ola 1 (8 agentes)

1. Confirmar que Sam rechazó las 4 contrataciones de ALFRED que venían sin `hermesCommand`.
2. Crear las 4 solicitudes con la plantilla de §2:

   | Puesto | Perfil | Extra |
   |---|---|---|
   | Asesor comercial | `asesor` | — |
   | Analista de operaciones | `operaciones` | — |
   | Analista de CRM/datos | `crm` | — |
   | Community manager asistente | `community` | con `,web` |

3. Avisar a Sam. Él aprueba en Approvals.
4. Cargar el `AGENTS.md` de cada uno, con su ajuste:
   - el Asesor **prepara** la lista diaria y los borradores, y **nunca** escribe a clientes;
   - el de CRM **planifica y verifica**, y **nunca** entra a Kommo ni a GoHighLevel;
   - el de Operaciones documenta el piloto y alimenta los SOP;
   - el Community trabaja en borradores pendientes de Marketing.
5. Agregar al `AGENTS.md` de ALFRED la sección «Cómo contratar», con la plantilla de §2 y la
   regla de perfiles. Mostrarla a Sam antes de guardar.
6. Pausar `prueba-opencode` y `prueba-hermes` (`POST /agents/<id>/pause`).

### Fase 2 · Proyectos y trabajo de la estrategia

Crear **un proyecto por meta** de la estrategia, ligado a la meta de la empresa. Cada uno tiene
su espacio de trabajo en la carpeta del responsable (ya tiene git) y su primera tarea asignada:

| Meta | Responsable | Primera tarea (sale de la estrategia) |
|---|---|---|
| 1 · Embarque piloto en el ERP: facturado, cobrado y costeado | Analista de operaciones + Puente de ingeniería | Checklist del piloto: quién carga cada dato |
| 2 · Dueño humano en las 5 direcciones | Jefe de gabinete | Tabla de las 5 direcciones con candidato y vacíos |
| 3 · 6 de 18 SOP | Jefe de gabinete + Analista de operaciones | Priorizar los 6 SOP y su esqueleto |
| 4 · Lista diaria y 0 leads sin atender | Asesor comercial | Formato de la lista diaria y su origen |
| 5 · Ritual del viernes 4 semanas | ALFRED | Ya está en la rutina del viernes |
| 6 · Migración Kommo → GoHighLevel | Analista de CRM + Puente de ingeniería | Plan de migración con inventario y verificación (Sam aprueba antes de ejecutar) |

Las tareas siguientes las crea **ALFRED**, no tú. Tú solo dejas montada la estructura.

### Fase 3 · Política de revisión

- En las tareas que producen algo para personas (SOP, borradores, pedidos) se configura una etapa
  de **revisión por ALFRED** (`executionPolicy`, revisor agente) antes de cerrar. Nadie se revisa
  a sí mismo.
- Lo que va hacia afuera (textos a clientes, publicaciones) lleva además **aprobación humana**:
  la de Sam o la del dueño humano del puesto.

### Fase 4 · Primer ciclo completo

- Pedirle a ALFRED (con una tarea) que **adelante el primer parte del viernes**.
- Confirmar que el parte trae los cuatro bloques:
  1. avance por meta;
  2. atrasos;
  3. memorias y skills nuevas de cada agente;
  4. un solo lote de decisiones con ⭐.
- Entregarle a Sam el resumen y la lista de decisiones.

### Fase 5 · Cierre de la configuración

- Dejar a Sam un informe final:
  - agentes activos con su perfil, tope y jefe;
  - proyectos y rutinas;
  - pendientes que no son de Paperclip (§5).
- Revocar la llave sobrante «paperclipai cli (board)» `e619f8d0-57d8-4a03-ab5f-4b02d60b56fb`
  (`DELETE $PAPERCLIP_API_URL/board-api-keys/<id>`). La otra ya se revocó. Tu propia llave
  `hermes-director` la revoca Sam cuando termine la configuración.
- **Duplicados pausados**: 2c4e223f, 88f167e4, 6035783c y 1a6b7d65 son contrataciones de ALFRED
  sin aislamiento. No se usan, no se reactivan y no se les asignan tareas. Los buenos son
  3ad1b6a9, 7714d984, 7e1b14c0 y d07161e2.

## 4. Lo que viene después (no es parte de esta configuración)

| Ola | Agentes | Condición para empezar (organigrama §4.4) |
|---|---|---|
| **2** | Vigía de tránsito, Analista de embudo, Controller de cobro y cuadres, Analista de crecimiento, Oficial de cumplimiento, Analista de datos | Un tablero de indicadores **agregados** del ERP, de solo lectura y sin datos personales: una SDD nueva con `revisar-datos-ve`. Además, 4 semanas de la ola 1 dentro del presupuesto. El Analista de embudo espera el corte a GoHighLevel |
| **3** | Postventa, documental de aduana, conciliación de calidad | Se construyen **dentro del ERP** (agentes del Studio), no en Paperclip |

Con 8 agentes la ola 1 queda llena: no se contrata a nadie más sin decisión de Sam.

## 5. Pendientes fuera de Paperclip (Hermes no puede)

| Pendiente | Quién |
|---|---|
| Guardar en Git todo el diseño de hoy, en una PR nueva | Director |
| Actualizar la SDD-0564: Hermes con GLM como motor, OpenCode de respaldo, perfiles, `dtd-hermes`, llave del director | Director |
| Respaldo diario de `/home/agentes-run/.hermes/profiles` | Claude o el Director |
| Perfiles nuevos y fijar o revertir skills (`hermes curator`) | Claude o el Director |
| Copia filtrada del código para el Puente de ingeniería (`/srv/oficina/repo`) | Claude o el Director |
| Corregir la sección 29 de Kommo v7: el seguro es «próximamente» | Sam |
| Revocar la llave de Anthropic que no se usa | Sam |
| Revocar las llaves de Junta al terminar | Sam |

## 6. Reglas que no se rompen

- **Tú no apruebas nada**: contrataciones, estrategia ni topes. Solo Sam, con su mano.
- No apagas la aprobación de agentes nuevos ni subes topes sin la orden explícita de Sam, escrita
  en el chat.
- No borras agentes, tareas ni proyectos sin un OK de Sam para ese elemento.
- No tocas el ERP, la base de datos, el servidor de DTD Cargo, Kommo ni GoHighLevel.
- No imprimes llaves ni secretos.
- Antes de cada cambio dices qué vas a hacer; después lo verificas por la API.
