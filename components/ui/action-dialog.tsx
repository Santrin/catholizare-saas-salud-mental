"use client";

import { useRef, type ReactNode } from "react";

type ActionDialogProps = {
  buttonLabel: string;
  title: string;
  children: ReactNode;
};

export function ActionDialog({ buttonLabel, title, children }: ActionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex min-h-10 items-center justify-center rounded-md bg-azulMedio px-4 text-sm font-bold text-blanco transition hover:bg-secundario focus:outline-none focus:ring-2 focus:ring-azulMedio/30"
      >
        {buttonLabel}
      </button>
      <dialog
        ref={dialogRef}
        aria-label={title}
        className="m-auto max-h-[90vh] w-[min(42rem,calc(100%-2rem))] overflow-y-auto rounded-lg border-0 bg-blanco p-0 text-principal shadow-2xl backdrop:bg-principal/45"
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            dialogRef.current?.close();
          }
        }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-principal/10 bg-blanco px-5 py-4">
          <h2 className="text-lg font-bold text-principal">{title}</h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="inline-flex min-h-9 items-center justify-center border border-principal/15 px-3 text-sm font-bold text-principal transition hover:border-azulMedio hover:text-azulMedio"
          >
            Cerrar
          </button>
        </div>
        <div className="p-5">{children}</div>
      </dialog>
    </>
  );
}
