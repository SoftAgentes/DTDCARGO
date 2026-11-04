import { startTransition, type FormEvent } from "react";

/**
 * Manejador de `onSubmit` que no borra lo escrito (SDD-0596).
 *
 * React 19 vacía los campos sin estado de un `<form action={...}>` al terminar la
 * acción, aunque esta devuelva un error (`startHostTransition` en `react-dom`). Con
 * `preventDefault` en `onSubmit`, React omite la acción y ese reinicio. La validación
 * nativa de `required` sigue corriendo antes, y un envío en curso bloquea el siguiente.
 *
 * En una pantalla renderizada en el servidor hay que conservar también `action`: antes
 * de hidratar, un `<form>` sin `action` enviaría sus campos por GET, en la URL.
 *
 * ```tsx
 * <form action={formAction} onSubmit={submitKeepingDraft(formAction, isPending)}>
 * ```
 *
 * Sin reinicio, un formulario que queda a la vista tras guardar debe limpiarse por su cuenta.
 */
export function submitKeepingDraft(action: (formData: FormData) => void, pending: boolean) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  };
}
