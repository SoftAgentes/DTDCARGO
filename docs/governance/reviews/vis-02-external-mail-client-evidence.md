# VIS-02 · evidencia controlada en clientes de correo

| Control | Valor |
|---|---|
| Revisión | REV-VIS-010 |
| SDD | [SDD-0175](../../specs/0175-vis-02-tipografia-voz-idioma/spec.md) |
| Fecha | 2026-07-30 |
| Alcance | Gmail y Outlook · entrega y estructura |
| Resultado | evidencia parcial; gate visual abierto |

## Muestra controlada

Se envió una única muestra sintética desde `hailuway.com@gmail.com` a estos dos
destinatarios confirmados por el founder:

- `hailuway.com@gmail.com`;
- `hailuway.com@hotmail.com`.

La muestra no contiene datos de clientes, información operativa, adjuntos, CC
ni BCC. Usa el asunto `VIS-02 controlado · firma formal zh-CN` y los valores
sintéticos `王华`, `义乌办公室` y `office@example.com`.

El HTML de la firma fue producido por el renderer canónico
`renderSignatureHtml()` con `layout: "corporate"` y `lang: "zh"`. No se creó
un template alterno para la prueba.

## Evidencia obtenida

| Cliente | Evidencia | Clasificación |
|---|---|---|
| Gmail | Mensaje `19fb649872624409` presente en enviados y recibido en el destinatario Gmail; sin adjuntos | cumplimiento de entrega |
| Gmail · MIME | `multipart/alternative`, UTF-8, partes `text/plain` y `text/html`; el HTML conserva `lang="zh-CN"` y la pila `Noto Serif SC`, `Noto Sans SC`, `sans-serif` | cumplimiento estructural |
| Outlook | Mensaje recibido el `2026-07-31T03:48:23Z` desde `hailuway.com@gmail.com`; caracteres chinos y cuerpo HTML preservados; sin adjuntos | cumplimiento de entrega y contenido |
| Gmail visual | Falta captura controlada del mensaje abierto en el cliente real | no conformidad de evidencia |
| Outlook visual | Falta captura controlada del mensaje abierto en el cliente real | no conformidad de evidencia |
| Apple Mail visual | Falta abrir la misma muestra en un cliente Apple Mail real y capturarla | no conformidad de evidencia |

El identificador RFC 5322 de la muestra es
`<CADxWAOieLdwrKQa86m9TuLKUgJDp5XgkQSjrjGzYGsaOqVUsig@mail.gmail.com>`.

## Límites de la conclusión

La entrega, el contenido y la estructura MIME quedaron verificados en Gmail y
Outlook. Esta evidencia no demuestra qué fuente terminó usando cada motor de
render ni autoriza declarar compatibilidad visual en Gmail, Outlook o Apple
Mail.

El gate externo permanece abierto hasta incorporar capturas controladas y
redactadas de los tres clientes. La UI china sigue fuera de este alcance y
debe conservar Noto Sans SC; BD-036 continúa limitada a documentos formales
`lang="zh-CN"`.
