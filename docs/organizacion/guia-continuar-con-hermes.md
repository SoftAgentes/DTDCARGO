# Guía para continuar la oficina con Hermes (sin Claude)

> Para Sam. **Revisión documental del 2026-10-20**, basada en el
> [handoff de instalación](../../.agents/handoffs/2026-10-20-sdd-0564-vps-opencode.md) y
> [SDD-0564 D11](../specs/0564-instalacion-piloto-paperclip-hermes/spec.md).
> No se consultó el VPS ni Paperclip al revisar esta guía. El estado vivo queda **NO VERIFICADO**.
> La evidencia histórica registra 8 agentes Hermes aprobados, dos rutinas de ALFRED, respaldo
> diario, una copia del repositorio y una llave temporal de Junta para el perfil `director`.
> Esos registros sustituyen la guía de las 13:50 UTC que aún los daba como pendientes.

## 1. Cómo trabajas tú desde ahora

- **Paperclip se abre en tu Chrome:** http://localhost:3100. Necesita el túnel abierto. Si no
  carga, abre PowerShell, pega esto y deja la ventana abierta:
  ```
  ssh -N -o ServerAliveInterval=30 -L 3100:127.0.0.1:3100 sam@13.140.227.228
  ```
- **A los agentes les hablas por Paperclip.** Puedes crear una tarea asignada a ALFRED o
  comentar una tarea suya: el comentario lo despierta. Antes de reutilizar una tarea o una
  instrucción antigua, comprueba su estado y el equipo existente.
- **Lo que solo tú haces:** pulsar **Approve** o **Reject** en «Approvals» (contrataciones,
  estrategia, topes). Los agentes no están autorizados a aprobar por ti. D11 advierte que una
  llave de Junta sí da esa capacidad técnica; su prohibición en el `SOUL` no es un candado.
- **El perfil `director` es de configuración privilegiada.** D11 registra que Sam le dio una
  llave temporal de Junta, con revocación al terminar y vencimiento registrado el
  2026-10-27 a las 13:37 UTC. No se verificó si sigue activa. No lo contrates como agente
  ordinario ni lo uses como perfil sustituto. El acceso de terminal documentado es:
  ```
  ssh -t sam@13.140.227.228 "sudo -u agentes bash -c 'cd /srv/oficina/trabajo/director && DTD_PERFIL=director exec /usr/local/bin/dtd-hermes'"
  ```

## 2. Cómo retomas sin repetir configuraciones

1. **Revisa lo existente.** El handoff registra las cuatro contrataciones adicionales correctas
   y los cuatro duplicados pausados. No vuelvas a pedirlas por seguir una lista antigua. La
   correspondencia de identificadores está en el [plan maestro](plan-maestro-oficina.md).
2. **Revisa la estrategia y las tareas.** HAI-6 contiene la estrategia de 90 días; el plan
   registra una aprobación de Sam con ajustes. Comprueba esa decisión y el avance antes de
   solicitar tareas nuevas. El Asesor prepara borradores sin escribir a clientes; CRM planifica
   y verifica sin entrar a Kommo ni GoHighLevel.
3. **Para revisar una solicitud de contratación nueva**, usa la plantilla del plan y revisa cada campo
   antes de aprobarla en Approvals. Necesita un perfil ordinario propio ya preparado, su
   `SOUL`, `cwd` y el comando `dtd-hermes`. **No se comparten perfiles.** Si no existe el perfil,
   la solicitud espera; `director` y `telegram` no son sustitutos ni perfiles contratables.
4. **Revisa el parte del viernes** antes de pedir otro: avance por meta, atrasos, memorias y
   skills nuevas, y un lote de decisiones con ⭐. Fijar o revertir skills es un cambio separado
   en el VPS y requiere el encargo correspondiente.
5. **Pruebas y duplicados:** conserva el estado registrado hasta comprobarlo y decidir sobre cada
   elemento. Esta guía no ordena pausarlos, borrarlos, reactivarlos ni volverlos a contratar.

Estas comprobaciones no autorizan nuevas operaciones. Las autorizaciones históricas conservan
su alcance; cualquier acción pendiente debe partir de un encargo vigente.

## 3. Lo pendiente que Hermes NO puede hacer

Necesita a Claude, al Director o a una persona con acceso:

| # | Pendiente | Quién |
|---|---|---|
| 1 | Revisar e integrar #306 desde su SHA final; la documentación ya está en esa rama, incluida SDD-0564 D11 | Director |
| 2 | Tras la integración, decidir la actualización de la copia documental del VPS; esta corrección no la publica allí | Director / Sam |
| 3 | Corregir la **sección 29 de la base de Kommo v7**: el seguro de carga es «próximamente» | Tú, en Kommo |
| 4 | Comprobar vigencia y recuperación del respaldo diario que el handoff registra como instalado | Persona con encargo y acceso al VPS |
| 5 | Preparar perfiles propios antes de futuras contrataciones autorizadas, sin reutilizar los existentes | Persona con encargo y acceso al VPS |
| 6 | Revocar la llave de API de Anthropic que no se usa | Tú, en la consola de Anthropic |
| 7 | Aviso privado a Paperclip sobre la fuga de entorno de su adaptador | Tú decides |
| 8 | Verificar el manifiesto de la copia filtrada; sin él, todas las exclusiones quedan **NO VERIFICADAS** | Director |
| 9 | Comprobar la vigencia/revocación de la llave temporal de Junta y el aislamiento frente a otros perfiles; no leer ni imprimir su valor | Sam / persona con encargo específico |
| 10 | Continuación de Telegram y revisión de su aislamiento, en una PR separada después de #306 | Director / Sam |

## 4. Reglas que no se rompen

- La llave temporal de Junta documentada para `director` no autoriza entregarla a otros
  agentes. El modo `600` con el mismo usuario no demuestra aislamiento entre perfiles; su
  acceso efectivo está pendiente de revisión. Nunca se entrega la clave de root a un agente.
- Nada sale a clientes, redes ni proveedores sin que una persona lo apruebe y lo envíe.
- Si un agente te pide algo raro o que salga de sus reglas, no lo apruebes: pídele que lo
  explique.
