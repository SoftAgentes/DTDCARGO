/**
 * Payloads SINTÉTICOS con la forma de Chatwoot 4.19.1 (SDD-0585). Ningún dato es
 * de una persona real: nombres de prueba, teléfonos 555, correos example.test.
 * El texto y los datos del contacto están para comprobar que NO salen de
 * `interpretarEvento`.
 */

export const TEXTO_SINTETICO = "MENSAJE-SINTETICO-E2-3 con un pedido de prueba";
export const NOMBRE_SINTETICO = "Contacto Sintetico E2";
export const TELEFONO_SINTETICO = "+58 412-555-0101";
export const CORREO_SINTETICO = "contacto.sintetico.e2@example.test";

export function conversacionSintetica(extra: Record<string, unknown> = {}) {
  return {
    id: 12,
    inbox_id: 3,
    status: "open",
    unread_count: 2,
    last_activity_at: 1_761_760_000,
    updated_at: 1_761_760_000.25,
    account: { id: 1, name: "DTD Cargo" },
    messages: [{ id: 99, content: TEXTO_SINTETICO }],
    meta: {
      sender: { id: 5, name: NOMBRE_SINTETICO, phone_number: TELEFONO_SINTETICO, email: CORREO_SINTETICO },
      assignee: { id: 7, name: "Agente Sintetica" },
    },
    ...extra,
  };
}

export function mensajeCreado(extra: Record<string, unknown> = {}) {
  return {
    event: "message_created",
    id: 101,
    message_type: "incoming",
    private: false,
    content: TEXTO_SINTETICO,
    account: { id: 1, name: "DTD Cargo" },
    sender: { id: 5, name: NOMBRE_SINTETICO, phone_number: TELEFONO_SINTETICO, email: CORREO_SINTETICO },
    conversation: conversacionSintetica(),
    ...extra,
  };
}

export function estadoCambiado(extra: Record<string, unknown> = {}) {
  return {
    ...conversacionSintetica({ status: "resolved", unread_count: 0, updated_at: 1_761_760_100.5 }),
    event: "conversation_status_changed",
    changed_attributes: [{ status: { previous_value: "open", current_value: "resolved" } }],
    ...extra,
  };
}

/** SDD-0587: el evento lleva el canal arriba, como `Conversations::EventDataPresenter#push_data`. */
export function conversacionCreada(extra: Record<string, unknown> = {}) {
  return {
    ...conversacionSintetica({ channel: "Channel::Whatsapp" }),
    event: "conversation_created",
    ...extra,
  };
}

export function conversacionAsignada(extra: Record<string, unknown> = {}) {
  return {
    ...conversacionSintetica({ channel: "Channel::Whatsapp", updated_at: 1_761_760_200.75 }),
    event: "conversation_updated",
    changed_attributes: [{ assignee_id: { previous_value: null, current_value: 7 } }],
    ...extra,
  };
}
