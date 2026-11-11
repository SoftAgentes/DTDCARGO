/**
 * Direcciones de webhook FALSAS para las pruebas (SDD-0606), con la forma real:
 * id de 18 dígitos y token de 68 caracteres. No apuntan a ningún canal.
 */
export function fakeWebhook(n: number): string {
  const id = `1${String(n).padStart(17, "0")}`;
  const token = `prueba${n}`.padEnd(68, "x");
  return `https://discord.com/api/webhooks/${id}/${token}`;
}

/** Respuesta de Discord con `wait=true`: el mensaje guardado, con su ID. */
export function mensajeGuardado(n = 1): Response {
  return new Response(JSON.stringify({ id: `13${String(n).padStart(17, "0")}` }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
