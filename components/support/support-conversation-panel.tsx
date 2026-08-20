"use client";

import { useActionState } from "react";

import { sendSupportMessageAction } from "@/app/support/actions";
import { ActionMessage } from "@/components/users/action-message";
import type { SupportConversation } from "@/lib/support/types";

export function SupportConversationPanel({
  conversation,
  audienceLabel
}: {
  conversation: SupportConversation | null;
  audienceLabel: "paciente" | "profesional";
}) {
  const [state, formAction, pending] = useActionState(sendSupportMessageAction, {});

  return (
    <section className="space-y-5 rounded-lg border border-principal/10 bg-blanco p-5">
      <div>
        <p className="text-xs font-bold uppercase text-azulMedio">Canal privado de dos vias</p>
        <h2 className="mt-1 text-lg font-bold text-principal">Atencion para {audienceLabel}</h2>
        <p className="mt-2 text-sm leading-6 text-principal/65">
          Comunicate con administracion para resolver accesos, citas, documentos o uso de la
          plataforma. No escribas contenido clinico, diagnosticos ni notas de sesion.
        </p>
      </div>

      {conversation ? (
        <div className="max-h-96 space-y-3 overflow-y-auto rounded-lg bg-grisMuyClaro p-4">
          {conversation.messages.map((message) => (
            <article
              key={message.id}
              className={`max-w-[88%] rounded-lg border p-3 ${
                message.sender_id === conversation.participant_id
                  ? "ml-auto border-azulMedio/20 bg-blanco"
                  : "border-enfasis/30 bg-enfasis/10"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-grisTextos">
                <span className="font-semibold text-principal">{message.sender_name}</span>
                <span>{new Date(message.created_at).toLocaleString("es-MX")}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-principal/80">{message.body}</p>
            </article>
          ))}
          {conversation.messages.length === 0 ? (
            <p className="text-sm text-grisTextos">Aun no hay mensajes.</p>
          ) : null}
        </div>
      ) : (
        <p className="rounded-lg bg-grisMuyClaro p-4 text-sm text-principal/65">
          Escribe tu primer mensaje para abrir el canal con administracion.
        </p>
      )}

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="conversationId" value={conversation?.id ?? ""} />
        {!conversation ? (
          <label className="block">
            <span className="text-sm font-medium text-principal">Asunto</span>
            <input name="subject" required minLength={3} maxLength={180} className="mt-2 w-full rounded-md border px-3 py-2" />
          </label>
        ) : null}
        <label className="block">
          <span className="text-sm font-medium text-principal">Mensaje</span>
          <textarea name="body" required maxLength={4000} rows={4} className="mt-2 w-full rounded-md border px-3 py-2" />
        </label>
        <ActionMessage message={state.message} ok={state.ok} />
        <button
          type="submit"
          disabled={pending || conversation?.status === "cerrado"}
          className="rounded-md bg-azulMedio px-4 py-2 text-sm font-semibold text-blanco disabled:opacity-50"
        >
          {pending ? "Enviando..." : "Enviar mensaje"}
        </button>
      </form>
    </section>
  );
}

