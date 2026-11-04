import { unstable_isUnrecognizedActionError, unstable_rethrow } from "next/navigation";
import { useActionState, useEffect, useRef, type FormEvent } from "react";
import { CLIENT_REQUEST_FIELD } from "./client-request";
import { submitKeepingDraft } from "./submit-keeping-draft";

type Action<S> = (state: Awaited<S>, formData: FormData) => Promise<S>;

/** El servidor ya no reconoce la acción: la página es de una versión anterior y nada se registró. */
export const OUTDATED_PAGE_MESSAGE =
  "Esta página quedó desactualizada y tu envío no se registró. Copia lo que escribiste y recarga la página.";

/**
 * Una acción que, si lanza, responde con un aviso en vez de llegar a la pantalla de error (SDD-0598).
 *
 * Si una acción lanza, como en un corte de red, `useActionState` lleva el error a la barrera más
 * cercana y el formulario se desmonta con todo lo escrito. `redirect()` y `notFound()` también
 * rechazan la promesa en el cliente: esos no son fallos, y `unstable_rethrow` los deja seguir.
 *
 * El aviso no puede afirmar qué pasó: si se perdió la respuesta, la acción pudo haberse registrado.
 * `whenThrown` dice que no se pudo confirmar, qué se conservó y qué revisar antes de reenviar.
 */
export function actionKeepingDraft<S extends { error?: string }>(
  action: Action<S>,
  whenThrown: string,
): Action<S> {
  return async (state, formData) => {
    try {
      return (await action(state, formData)) as S;
    } catch (error) {
      unstable_rethrow(error);
      return { error: unstable_isUnrecognizedActionError(error) ? OUTDATED_PAGE_MESSAGE : whenThrown } as S;
    }
  };
}

/**
 * `useActionState` para un formulario que no pierde lo escrito, ni con una respuesta de error ni
 * cuando la acción lanza.
 *
 * ```tsx
 * const [state, formProps, pending] = useActionKeepingDraft(serverAction, initial, "…");
 * <form {...formProps}>
 * ```
 *
 * Son dos `useActionState` a propósito. Sólo una Server Action sin envolver sirve de `action` en el
 * HTML del servidor: antes de hidratar, o si el JavaScript no cargó, el navegador envía por ahí con
 * POST, y su resultado llega como `serverState`. Una vez hidratado, `onSubmit` toma el envío por el
 * envoltorio que atrapa lo que lanza. Por eso `action` y `onSubmit` se entregan juntos: un `action`
 * solo enviaría sin atrapar nada, y su resultado no llegaría a `state`.
 *
 * Cuando la acción lanzó, el foco va al aviso: el botón deshabilitado ya lo soltó, y en un formulario
 * largo el aviso puede haber quedado fuera de la vista. Ese aviso hay que leerlo antes de reenviar.
 *
 * Con `{ requestId: true }` cada envío lleva el identificador del intento (SDD-0599): se repite en
 * cada reintento y cambia sólo después de `ok`, para que un formulario que queda a la vista no choque
 * consigo mismo. Un POST antes de hidratar no lo trae, y queda sin candado.
 */
export function useActionKeepingDraft<S extends { error?: string; ok?: boolean }>(
  action: Action<S>,
  initial: Awaited<S>,
  whenThrown: string,
  options: { requestId?: boolean } = {},
) {
  const [serverState, formAction] = useActionState<S, FormData>(action, initial);
  const [state, dispatch, pending] = useActionState<S, FormData>(actionKeepingDraft(action, whenThrown), serverState);
  const requestId = useRef<string | null>(null);
  useEffect(() => {
    if (state.ok) requestId.current = null;
  }, [state]);
  const submittedForm = useRef<HTMLFormElement | null>(null);

  const thrown = state.error === whenThrown || state.error === OUTDATED_PAGE_MESSAGE;
  useEffect(() => {
    if (pending || !thrown) return;
    const notice = submittedForm.current?.querySelector<HTMLElement>('[role="alert"]');
    if (!notice) return;
    notice.tabIndex = -1;
    notice.focus();
  }, [state, pending, thrown]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    submittedForm.current = event.currentTarget;
    submitKeepingDraft((formData) => {
      if (options.requestId) {
        requestId.current ??= globalThis.crypto?.randomUUID?.() ?? null;
        if (requestId.current) formData.set(CLIENT_REQUEST_FIELD, requestId.current);
      }
      dispatch(formData);
    }, pending)(event);
  };
  return [state, { action: formAction, onSubmit }, pending] as const;
}
