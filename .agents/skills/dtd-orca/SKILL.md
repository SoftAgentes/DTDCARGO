---
name: dtd-orca
description: Prepara o coordina el Director de DTD Cargo dentro de Orca, con sus reglas de proyecto y el protocolo oficial de orquestación. El piloto inicial es local y no ejecuta producto ni inicia Workers.
---

# Director DTD Cargo en Orca

Lee [AGENTS.md](../../../AGENTS.md), [el Director del proyecto](../director/SKILL.md) y [el procedimiento de ingeniería](../../../docs/runbooks/codex-engineering.md). Mantén sus responsabilidades y límites.

Carga el skill común instalado para este usuario en `~/.agents/skills/director-orca/SKILL.md` y su referencia `references/dtd-cargo.md`. Expande `~` al home real; no supongas una ruta Windows en otro host. Si falta esa instalación, informa lo pendiente y no sustituyas el protocolo oficial por comandos inventados.

El Director es el agente que Sam elija. Conserva su modelo/cuenta configurados salvo decisión explícita. Usa las guías de `orchestration` de la versión que ejecuta los comandos; el skill oficial permanece intacto.

Para este inicio autorizado: verifica identidad, instrucciones y modo Manual y presenta una confirmación breve del rol. No lances Workers ni Run/Task/Dispatch, no programes producto, no publiques, no integres, no apruebes entregas ni accedas a VPS o bases de datos. No instales dependencias o modifiques configuraciones para completar esa primera respuesta.

Ante un encargo posterior, conserva el alcance de sus permisos y usa el contrato de asignación del Director común. La adaptación de transporte no autoriza a modificar otra sesión o su árbol.
