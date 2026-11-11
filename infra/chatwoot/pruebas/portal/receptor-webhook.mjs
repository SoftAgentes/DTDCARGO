// infra/chatwoot/pruebas/portal/receptor-webhook.mjs — receptor de webhooks de la prueba de concepto de la ida
// del portal (SDD-0586, 10.5, PoC-5). Corre en la red `interna` de una instancia EFÍMERA de Chatwoot, donde
// Sidekiq lo alcanza como http://receptor:8080. Guarda cada entrega, tal cual llega, como una línea de SALIDA.
// Solo datos inventados.
import { appendFileSync } from "node:fs";
import { createServer } from "node:http";

const SALIDA = process.env.SALIDA ?? "/estado/webhooks.ndjson";

createServer((pedido, respuesta) => {
  let cuerpo = "";
  pedido.setEncoding("utf8");
  pedido.on("data", (trozo) => {
    cuerpo += trozo;
  });
  pedido.on("end", () => {
    let json = null;
    try {
      json = JSON.parse(cuerpo);
    } catch {
      json = null;
    }
    appendFileSync(SALIDA, `${JSON.stringify({ ruta: pedido.url, metodo: pedido.method, cuerpo: json })}\n`);
    respuesta.writeHead(200, { "Content-Type": "text/plain" });
    respuesta.end("ok");
  });
}).listen(8080, "0.0.0.0");
