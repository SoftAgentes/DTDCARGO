/**
 * SDD-0585 · paso 2.6 · `/privacidad` dice lo que el sistema guarda de los
 * mensajes por WhatsApp y chat, con los plazos que decidió Sam (2026-10-30):
 *  - lead sin servicio: anonimizado a los 12 meses sin actividad (SDD-0587, D6);
 *  - BSUID: borrado al año sin actividad (SDD-0586, H-2, `interval '365 days'`);
 *  - registro de respuestas automáticas: 30 días (SDD-0586, H-3, `interval '30 days'`).
 * Si alguien cambia un plazo en la base, esta prueba obliga a mirar el texto, y
 * al revés. Lee el archivo: es contenido estático.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const texto = readFileSync(path.join(process.cwd(), "app/privacidad/page.tsx"), "utf8").replace(/\s+/g, " ");

describe("/privacidad · mensajes por WhatsApp y chat (SDD-0585, 2.6)", () => {
  it("dice qué se recoge del chat, incluido el BSUID", () => {
    expect(texto).toContain("Mensajes por WhatsApp y chat");
    expect(texto).toContain("código anónimo de tu cuenta (BSUID)");
    expect(texto).toContain("los últimos 10 dígitos de tu teléfono");
  });

  it("nombra a Meta y ya no dice que todas las conversaciones se atienden en el sistema propio", () => {
    expect(texto).toContain("Meta (WhatsApp e Instagram)");
    expect(texto).not.toContain("Las conversaciones las atendemos en nuestro propio sistema");
  });

  // Sam aprobó estas palabras el 2026-11-05, por el Director General: si esta
  // prueba falla porque cambió el texto, se le vuelve a preguntar.
  it("el párrafo de mensajes dice exactamente lo que Sam aprobó, con Instagram", () => {
    expect(texto).toContain(
      '"Mensajes por WhatsApp y chat", "Si nos escribes por WhatsApp, Instagram u otro canal de chat: tu nombre y tu usuario o teléfono tal como aparecen en ese canal, los datos de tu perfil que ese canal nos entrega (en Instagram, por ejemplo: un código de tu cuenta, tu foto, tu número de seguidores y si sigues nuestra cuenta) y el contenido de la conversación. Si no muestras tu teléfono, WhatsApp nos da en su lugar un código anónimo de tu cuenta (BSUID). Si todavía no eres cliente, guardamos tu nombre visible y, si lo tenemos, los últimos 10 dígitos de tu teléfono para dar seguimiento a tu consulta.", ',
    );
  });

  // Sam aprobó estos tres textos el 2026-11-05, por el Director General, con lo que
  // dio la lectura L3 de SDD-0587. Si esta prueba falla porque cambió el texto, se le
  // vuelve a preguntar. Fijan también el cierre de cada bloque: una frase de más sale roja.
  it("la fila de Meta dice exactamente lo que Sam aprobó, y nada más", () => {
    expect(texto).toContain(
      "<li> <strong>Meta (WhatsApp e Instagram)</strong>, que transporta los mensajes que nos envías y te enviamos por esos canales. </li>",
    );
  });

  it("el punto del proveedor de gestión de clientes dice exactamente lo que Sam aprobó", () => {
    expect(texto).toContain(
      "<li> <strong>Proveedor de gestión de clientes</strong>, que todavía usamos para llevar el seguimiento de clientes y atender parte de las conversaciones por WhatsApp e Instagram. Recibe tu nombre, tu correo, tu teléfono o usuario y esos mensajes. Si te atendemos como cliente o te preparamos un estimado, también puede recibir tu Shipping Mark, el valor del estimado y las notas de seguimiento. Estamos pasando esa atención a nuestro propio sistema, alojado en nuestro servidor. </li>",
    );
  });

  // El 2026-11-06 Sam aprobó cerrar ese mismo párrafo con la frase de la mensajería
  // interna (SDD-0606, SDD-0608): va después de la del proveedor y es la última.
  it("§5 agrega al primer párrafo lo que Sam aprobó, y va al final de ese párrafo", () => {
    expect(texto).toContain(
      "solo nosotros tenemos la clave para abrirlas. Mientras terminamos ese cambio, lo que pasa por ese proveedor también se guarda en sus servidores y en los de quienes le prestan servicio, que pueden estar en Estados Unidos o en otros países. El nombre y el Shipping Mark que ve nuestro equipo en su herramienta de mensajería interna también pasan por servidores en Estados Unidos. </p>",
    );
  });

  it("los tres plazos coinciden con los de la base", () => {
    expect(texto).toMatch(/12 meses sin actividad/);
    expect(texto).toMatch(/BSUID\)<\/strong> se borra al <strong>año sin actividad/);
    expect(texto).toMatch(/respuestas automáticas, a los <strong>30 días/);
  });

  it("«Registro de cliente» dice que guardamos la campaña (SDD-0587, 6.4)", () => {
    expect(texto).toMatch(
      /"Registro de cliente", "[^"]*También guardamos la campaña por la que llegaste, si el enlace la trae\.[^"]*"/,
    );
  });

  it("la fecha de la política se movió con el cambio", () => {
    expect(texto).toContain('const UPDATED = "6 de noviembre de 2026";');
  });
});
