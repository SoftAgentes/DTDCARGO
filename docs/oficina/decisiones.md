# Registro de decisiones · La Oficina DTD

De lo nuevo a lo viejo. Una línea por decisión: **fecha · decisión · por qué**.

Reglas del archivo:

- Solo entran decisiones de Sam o su «sí» explícito. Las del Director General (DG) se marcan «(DG)» y quedan para que Sam las ratifique.
- Nada de secretos, llaves, IP ni datos de clientes.
- Lo redacta el Director (Hermes) y lo sube Claude Code en PRs chicos de docs, por el portón del DG.
- Al cierre de cada jornada, si ese día Sam decidió algo, se agrega aquí.

Origen: idea adoptada de Founder OS el 18/11/2026. Hermes redactó el registro desde el 12/11, y Claude Code lo cotejó con la memoria del proyecto (se corrigió la fecha de OpenRouter y se marcaron las decisiones del DG).

## 2026-11

- **18/11** · (DG) La tarjeta del mensaje de prueba del encendido no cuenta entre las 10 conversaciones, porque lleva datos inventados. Sam la rechaza con el motivo «prueba del encendido».
- **18/11** · «Encender la oficina en la etapa 1»: solo la cuenta 2 de Chatwoot y la bandeja de prueba 11, con tope de 1 USD al mes y el agente sin automático. Por qué: practicar las 10 conversaciones en producción sin tocar la cuenta real.
- **18/11** · «Hazlo todo tú»: el webhook, el agente de envío y los secretos del cable los monta Claude Code en el servidor, sin clics de Sam. Por qué: los clics de Sam quedan para juzgar las conversaciones.
- **18/11** · Adoptar de Founder OS el registro de decisiones, el archivo de lecciones y el ritual de cierre. Por qué: que las sesiones acumulen lo aprendido en vez de empezar de cero.
- **17/11** · Etapa 1 con los clics de Sam en persona, en producción y en la bandeja 11. Por qué: «correcta» solo significa algo si la juzgó Sam.
- **17/11** · (DG) Casillas con 3 estados (cumple, falló, no evaluado) y cierre por conversación. El Director había propuesto «marca lo que falló».
- **17/11** · El cable usa su propia cuenta de Chatwoot (`OFICINA_CHATWOOT_ACCOUNT_ID=2`). Por qué: que el cable no pueda tocar la cuenta real aunque alguien se equivoque en una configuración.
- **16/11** · GLM es el modelo principal (por suscripción) y DeepSeek el respaldo, con tope propio. Por qué: lo fijo ya está pagado, y el pago por uso solo entra si GLM falla.
- **16/11** · OpenRouter descartado. Los respaldos se hacen con el `fallback_model` de Hermes y llaves directas.
- **16/11** · Hallazgo 16: opción B ahora, y VACUUM semanal antes de la etapa 2.
- **16/11** · «Sí a todo» de D1 a D6:
  - el agente no tiene llaves de envío;
  - las revisiones van en tabla propia;
  - el borrador se vacía a los 90 días;
  - la página es solo para administradores;
  - cada agente tiene llaves propias;
  - el Paso 3 se parte en 3a y 3b.
- **16/11** · Actualizar Hermes sin cambiar de versión. Por qué: terminar lo del 12/11 y poder mudar el agente a su propio usuario.
- **15/11** · Textos del cable: regla más vaciado a los 90 días (opción A). Por qué: es la red de seguridad si falla el filtro de datos personales.
- **15/11** · Paso 2b por el puente interno (opción 3). Por qué: la ruta pública cortaba el acceso con la VPN.
- **15/11** · Regla para pasar de la etapa 1 a la 2: 10 conversaciones, 9 correctas y los frenos probados.
- **15/11** · Un solo contestador por bandeja. Por qué: dos IA no deben responder al mismo cliente.
- **14/11** · OK para construir el cable. La oficina nace pausada, y el §3 de AUD-01 no aplica al diario porque no guarda datos personales.
- **13/11** · La oficina usa solo GLM y DeepSeek.
- **12/11** · Roster de 35 puestos y gobernanza SGE v8 + SGE-AG-01. Por qué: una agencia con frenos desde el día 1.
