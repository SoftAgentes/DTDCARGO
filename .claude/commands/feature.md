---
description: Compatibilidad Claude para ejecutar una tarea con el workflow Worker vigente.
---

# /feature

Lee AGENTS.md y [.agents/skills/worker/SKILL.md](../../.agents/skills/worker/SKILL.md).
Ejecuta ese workflow para la tarea recibida. Si esta sesión es Director, prepara
un Worker aislado y conserva el rol. No invocar agentes inexistentes ni usar
bucles, permisos de publicación o cleanup del harness anterior.
