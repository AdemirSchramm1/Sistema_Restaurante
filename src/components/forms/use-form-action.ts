"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import type { ActionState } from "@/actions/_session";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/**
 * `useActionState` sem o reset automático do React 19: quando o servidor recusa, o que a pessoa
 * digitou continua no formulário. O `action` fica no `<form>` para funcionar sem JavaScript; com
 * JavaScript, o `onSubmit` envia por conta própria. `resetOnSuccess` limpa os campos depois de
 * salvar (formulários de criação).
 */
export function useFormAction(action: Action, { resetOnSuccess = false } = {}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.ok) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => formAction(data));
  };

  return {
    state,
    pending,
    saved: false,
    error: state && !state.ok ? state.error : null,
    formProps: { ref: formRef, action: formAction, onSubmit },
  };
}
