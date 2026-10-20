# Plan maestro de la oficina de agentes de DTD Cargo

> Para el **Hermes director** (perfil `director`, con llave de Junta temporal) y para Sam.
> Revisión documental del 2026-10-20. Fuente de estado: el
> [handoff de instalación](../../.agents/handoffs/2026-10-20-sdd-0564-vps-opencode.md),
> incluido su cierre hasta las 14:48 UTC, y
> [SDD-0564 D11](../specs/0564-instalacion-piloto-paperclip-hermes/spec.md).
> No se consultó el VPS ni Paperclip en esta revisión: el estado vivo es **NO VERIFICADO**.
> Este documento no autoriza repetir operaciones ya registradas ni ejecutar las pendientes.
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

## 1. Qué quedó documentado

| Pieza | Estado |
|---|---|
| Empresa «DTD Oficina» (id `9e183be0-4269-4dba-9dd9-7e5cef57c7c2`) | El handoff registra tope 100 USD/mes y aprobación obligatoria de agentes nuevos. Su estado y la parada efectiva no se volvieron a verificar |
| Meta de empresa | «Pasar de 1 a 2 contenedores al mes, sostenido» (`80911124-…`) |
| **ALFRED**, CEO (`07f7ba5c-…`) | Registrado activo, Hermes, perfil `ceo`. Rutinas documentadas: latido diario a las 7:00 y parte del viernes a las 14:00 (America/Caracas) |
| Jefe de gabinete, Puente de ingeniería, Editor de contenido | Registrados activos. Hermes, perfiles `gabinete`, `ingenieria` y `contenido`; reportan a ALFRED |
| Asesor comercial, Analista de operaciones, Analista de CRM/datos, Community manager asistente | El cierre registra las cuatro contrataciones correctas y sus perfiles `asesor`, `operaciones`, `crm`, `community`. No volver a solicitarlas por seguir este plan |
| Estrategia de 90 días (HAI-6) | Escrita por ALFRED y aprobada por Sam con dos ajustes |
| Agentes de prueba y ALFRED viejo (`claude_local`) | El handoff registra al ALFRED viejo pausado y deja la limpieza pendiente por elemento. Comprobar el estado antes de cualquier acción; no borrar ni reactivar por esta lista |

**Cómo corre cada agente:**
- comando `/usr/local/bin/dtd-hermes`, que lo ejecuta como `agentes-run`; la prueba histórica
  negó acceso a secretos del usuario `agentes`. No demuestra aislamiento de secretos entre
  perfiles del mismo `agentes-run`;
- `env.DTD_PERFIL` elige su perfil de Hermes, con su propia memoria, skills y `SOUL`;
- su carpeta es `/srv/oficina/trabajo/<perfil>`, con git local;
- modelo `glm-5.3` con el proveedor `zai`, por el plan GLM Coding de Sam.

## 2. Plantilla de solicitud de contratación ordinaria

Sirve para preparar la solicitud dentro del alcance aprobado por la Junta; la contratación
sigue pendiente hasta que Sam la apruebe. Primero se comprueba que el puesto no tenga ya un
agente correcto. El envoltorio evita el fallo histórico de ejecución como `agentes`;
no convierte los perfiles de `agentes-run` en usuarios aislados entre sí.

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
- **Perfiles ordinarios registrados:** `ceo`, `gabinete`, `ingenieria`, `contenido`, `asesor`,
  `operaciones`, `crm` y `community`. Cada uno corresponde a su agente; no son perfiles libres
  para reutilizar en otra contratación.
- **Fuera de la contratación ordinaria:** `director`, perfil de configuración con la llave
  temporal de Junta descrita en D11, y `telegram`, cuya continuación es separada. Ninguno puede
  usarse como sustituto de un perfil ordinario.
- **Perfil nuevo:** lo crea una persona con acceso al VPS (Claude o el Director), no Hermes. Sin
  perfil **no se contrata**.
- **Después de aprobado:** se carga su `AGENTS.md` con
  `PUT /agents/<id>/instructions-bundle/file` y `baseRevisionId` de la versión actual. El texto
  sale de `/srv/oficina/diseno/agentes/AGENTS-paperclip.md`: la parte común más la del puesto.

## 3. Comprobaciones de continuación

Primero se contrasta el registro con la API, dentro de un encargo de lectura. Solo después se
proponen cambios concretos que sigan pendientes. Las autorizaciones históricas no son órdenes
de repetición. **Nunca apruebas nada por Sam.**

### Comprobación 1 · Equipo de la ola 1 (8 agentes documentados)

1. Contrastar los agentes correctos y los duplicados con los identificadores del cierre (§3,
   comprobación 5). El handoff dice que Sam aprobó los duplicados y después se pausaron; no que
   las solicitudes fueran rechazadas.
2. Comprobar las cuatro correspondencias registradas, sin crear nuevas solicitudes:

   | Puesto | Perfil | Extra |
   |---|---|---|
   | Asesor comercial | `asesor` | — |
   | Analista de operaciones | `operaciones` | — |
   | Analista de CRM/datos | `crm` | — |
   | Community manager asistente | `community` | con `,web` |

3. Si falta un agente o su estado difiere, informar a Sam; no recrearlo automáticamente.
4. Revisar que las instrucciones conservan sus límites:
   - el Asesor **prepara** la lista diaria y los borradores, y **nunca** escribe a clientes;
   - el de CRM **planifica y verifica**, y **nunca** entra a Kommo ni a GoHighLevel;
   - el de Operaciones documenta el piloto y alimenta los SOP;
   - el Community trabaja en borradores pendientes de Marketing.
5. Comprobar que las instrucciones de ALFRED contienen el comando, el perfil propio y las
   exclusiones de §2. La corrección de esta fuente en Git no actualiza Paperclip.
6. Registrar el estado de `prueba-opencode` y `prueba-hermes`; una limpieza necesita su propio
   alcance autorizado.

### Comprobación 2 · Proyectos y trabajo de la estrategia

El plan original propuso **un proyecto por meta**, ligado a la meta de la empresa, con espacio
de trabajo propio. No hay evidencia aquí que certifique su configuración actual. Esta tabla
conserva las metas y primeras tareas propuestas; no ordena crearlas de nuevo:

| Meta | Responsable | Primera tarea (sale de la estrategia) |
|---|---|---|
| 1 · Embarque piloto en el ERP: facturado, cobrado y costeado | Analista de operaciones + Puente de ingeniería | Checklist del piloto: quién carga cada dato |
| 2 · Dueño humano en las 5 direcciones | Jefe de gabinete | Tabla de las 5 direcciones con candidato y vacíos |
| 3 · 6 de 18 SOP | Jefe de gabinete + Analista de operaciones | Priorizar los 6 SOP y su esqueleto |
| 4 · Lista diaria y 0 leads sin atender | Asesor comercial | Formato de la lista diaria y su origen |
| 5 · Ritual del viernes 4 semanas | ALFRED | Ya está en la rutina del viernes |
| 6 · Migración Kommo → GoHighLevel | Analista de CRM + Puente de ingeniería | Plan de migración con inventario y verificación (Sam aprueba antes de ejecutar) |

Antes de proponer estructura o tareas nuevas, comparar con lo existente y la decisión vigente
de Sam. El reparto posterior corresponde a ALFRED dentro de esa decisión.

### Comprobación 3 · Revisión de entregables

- El diseño prevé **revisión por ALFRED** (`executionPolicy`, revisor agente) antes de cerrar
  tareas que producen SOP, borradores o pedidos. Su configuración actual es **NO VERIFICADA**.
  Nadie se revisa a sí mismo.
- Lo que va hacia afuera (textos a clientes, publicaciones) lleva además **aprobación humana**:
  la de Sam o la del dueño humano del puesto.

### Comprobación 4 · Ciclo completo

- Revisar el parte existente; esta lista no pide adelantar otro ni crea una tarea.
- Confirmar que el parte trae los cuatro bloques:
  1. avance por meta;
  2. atrasos;
  3. memorias y skills nuevas de cada agente;
  4. un solo lote de decisiones con ⭐.
- Entregarle a Sam el resumen y la lista de decisiones.

### Comprobación 5 · Cierre de la configuración

- Dejar a Sam un informe final:
  - agentes activos con su perfil, tope y jefe;
  - proyectos y rutinas;
  - pendientes que no son de Paperclip (§5).
- El handoff ya registra revocadas las dos llaves sobrantes «paperclipai cli (board)»:
  `de189091` y `e619f8d0`. No repetir las revocaciones por seguir una versión antigua del plan.
  La vigencia y revocación de `hermes-director` al terminar siguen pendientes de comprobación
  por Sam; el vencimiento registrado es 2026-10-27 13:37 UTC.
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
| Revisar e integrar la documentación de #306; D11 ya está incorporada | Director |
| Decidir la actualización del diseño e instrucciones del VPS después de integrar; esta corrección no los publica | Director / Sam |
| Verificar vigencia y recuperación del respaldo diario registrado en el handoff | Persona con encargo y acceso al VPS |
| Perfiles nuevos y fijar o revertir skills (`hermes curator`) | Claude o el Director |
| Manifiesto de la copia filtrada: cumplimiento de todas las exclusiones **NO VERIFICADO** | Director |
| Corregir la sección 29 de Kommo v7: el seguro es «próximamente» | Sam |
| Revocar la llave de Anthropic que no se usa | Sam |
| Revocar las llaves de Junta al terminar | Sam |
| Comprobar el aislamiento de la llave de Junta frente a otros perfiles; continuación de Telegram en una PR separada después de #306 | Director / Sam |

## 6. Reglas que no se rompen

- **Tú no apruebas nada**: contrataciones, estrategia ni topes. Solo Sam, con su mano.
- No apagas la aprobación de agentes nuevos ni subes topes sin la orden explícita de Sam, escrita
  en el chat.
- No borras agentes, tareas ni proyectos sin un OK de Sam para ese elemento.
- No tocas el ERP, la base de datos, el servidor de DTD Cargo, Kommo ni GoHighLevel.
- No imprimes llaves ni secretos.
- Antes de cada cambio dices qué vas a hacer; después lo verificas por la API.

**Límite de seguridad documentado:** la llave temporal de Junta figura en
`profiles/director/paperclip.env`, modo `600`, dueño `agentes-run`. Todos los perfiles ordinarios
comparten ese usuario; elegir `HERMES_HOME` o no cargar la llave en su entorno no demuestra que
no puedan leerla. No se probó ese acceso en esta revisión documental. Falta una comprobación
específica de aislamiento, sin leer ni mostrar el valor de la llave; este texto no elige una
arquitectura nueva ni amplía la aceptación histórica del riesgo del Director a otros agentes.
