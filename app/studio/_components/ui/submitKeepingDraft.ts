import { startTransition, type FormEvent } from "react";

/**
 * Manejador de `onSubmit` que no borra lo escrito.
 *
 * React 19 vacía los campos sin estado de un `<form action={...}>` al terminar la
 * acción, aunque esta devuelva un error (`startHostTransition` en `react-dom`). Con
 * `onSubmit` no hay reinicio, y la validación nativa de `required` sigue corriendo antes.
 *
 * Sin reinicio, un panel que queda abierto tras guardar debe limpiarse por su cuenta.
 * Sirve para formularios montados en el cliente: antes de hidratar, un `<form>` sin
 * `action` enviaría sus campos por GET.
 *
 * ```tsx
 * <form id={FORM_ID} onSubmit={submitKeepingDraft(formAction, isPending)}>
 * ```
 */
export function submitKeepingDraft(action: (formData: FormData) => void, pending: boolean) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  };
}
