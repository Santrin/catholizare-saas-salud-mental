"use client";

import { useActionState, useState } from "react";

import { createManagedUserAction } from "@/app/users/actions";
import { SearchablePersonSelect } from "@/components/forms/searchable-person-select";
import { ActionMessage } from "@/components/users/action-message";
import { SubmitButton } from "@/components/auth/submit-button";
import type { UserRole } from "@/lib/auth/types";
import type { UserManagementProfile } from "@/lib/users/types";

type CreateUserFormProps = {
  allowedRoles: UserRole[];
  professionals?: UserManagementProfile[];
  fixedRole?: UserRole;
  embedded?: boolean;
};

export function CreateUserForm({
  allowedRoles,
  professionals = [],
  fixedRole,
  embedded = false
}: CreateUserFormProps) {
  const [state, formAction] = useActionState(createManagedUserAction, {});
  const roleOptions = fixedRole ? [fixedRole] : allowedRoles;
  const [selectedRole, setSelectedRole] = useState<UserRole>(roleOptions[0]);
  const showPrimaryProfessional = selectedRole === "paciente" && professionals.length > 0;

  return (
    <form
      action={formAction}
      className={embedded ? "space-y-4" : "space-y-4 rounded-lg border border-ink/10 bg-white p-5"}
    >
      <div>
        <h2 className="text-lg font-semibold text-ink">Crear usuario</h2>
        <p className="mt-1 text-sm text-ink/65">Se enviará una invitación por correo.</p>
      </div>

      <ActionMessage message={state.message} ok={state.ok} />

      <label className="block">
        <span className="text-sm font-medium text-ink">Nombre completo</span>
        <input
          name="fullName"
          required
          className="mt-2 h-10 w-full rounded-md border border-ink/15 px-3 outline-none focus:border-azulMedio focus:ring-2 focus:ring-azulMedio/20"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">Correo electrónico</span>
        <input
          name="email"
          type="email"
          required
          className="mt-2 h-10 w-full rounded-md border border-ink/15 px-3 outline-none focus:border-azulMedio focus:ring-2 focus:ring-azulMedio/20"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">Rol</span>
        <select
          name="role"
          value={selectedRole}
          onChange={(event) => setSelectedRole(event.target.value as UserRole)}
          className="mt-2 h-10 w-full rounded-md border border-ink/15 bg-white px-3 outline-none focus:border-azulMedio focus:ring-2 focus:ring-azulMedio/20"
        >
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </label>

      {showPrimaryProfessional ? (
        <SearchablePersonSelect
          name="primaryProfessionalId"
          label="Profesional principal"
          options={professionals.map((professional) => ({
            id: professional.id,
            label: professional.full_name,
            detail: professional.email
          }))}
          placeholder="Buscar profesional por nombre..."
        />
      ) : null}

      <SubmitButton>Enviar invitación</SubmitButton>
    </form>
  );
}
