create type public.support_conversation_status as enum ('abierto', 'resuelto', 'cerrado');
create type public.support_message_kind as enum ('mensaje', 'recordatorio', 'sistema');
create type public.support_referral_status as enum ('pendiente', 'contactado', 'cerrado');

create table public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.profiles(id) on delete restrict,
  participant_role public.user_role not null,
  assigned_admin_id uuid references public.profiles(id) on delete set null,
  subject text not null default 'Atencion operativa',
  status public.support_conversation_status not null default 'abierto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_conversations_participant_role_check
    check (participant_role in ('paciente', 'profesional')),
  constraint support_conversations_subject_length
    check (char_length(subject) between 3 and 180)
);

create unique index support_conversations_one_open_per_participant_idx
on public.support_conversations(participant_id)
where status <> 'cerrado';

create index support_conversations_admin_status_idx
on public.support_conversations(assigned_admin_id, status, updated_at desc);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete restrict,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  kind public.support_message_kind not null default 'mensaje',
  body text not null,
  created_at timestamptz not null default now(),
  constraint support_messages_body_length check (char_length(body) between 1 and 4000)
);

create index support_messages_conversation_created_idx
on public.support_messages(conversation_id, created_at asc);

create table public.support_referrals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete restrict,
  created_by_admin_id uuid not null references public.profiles(id) on delete restrict,
  target_profile_id uuid references public.profiles(id) on delete restrict,
  target_type text not null,
  operational_note text not null,
  status public.support_referral_status not null default 'pendiente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_referrals_target_type_length check (char_length(target_type) between 3 and 80),
  constraint support_referrals_note_length check (char_length(operational_note) between 5 and 1000)
);

create index support_referrals_patient_created_idx
on public.support_referrals(patient_id, created_at desc);

create table public.consent_reminders (
  id uuid primary key default gen_random_uuid(),
  consentimiento_id uuid not null references public.consentimientos(id) on delete restrict,
  patient_id uuid not null references public.profiles(id) on delete restrict,
  sent_by_user_id uuid references public.profiles(id) on delete set null,
  reminder_stage text not null,
  delivery_status text not null check (delivery_status in ('sent', 'failed')),
  provider_status integer,
  created_at timestamptz not null default now(),
  constraint consent_reminders_stage_length check (char_length(reminder_stage) between 2 and 80)
);

create unique index consent_reminders_automatic_stage_idx
on public.consent_reminders(consentimiento_id, reminder_stage)
where reminder_stage in ('24h', '72h', 'grace_session_used');

create index consent_reminders_patient_created_idx
on public.consent_reminders(patient_id, created_at desc);

create trigger support_conversations_touch_updated_at
before update on public.support_conversations
for each row execute function public.touch_updated_at();

create trigger support_referrals_touch_updated_at
before update on public.support_referrals
for each row execute function public.touch_updated_at();

create or replace function public.touch_support_conversation_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_conversations
  set updated_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger support_messages_touch_conversation
after insert on public.support_messages
for each row execute function public.touch_support_conversation_from_message();

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_referrals enable row level security;
alter table public.consent_reminders enable row level security;

create policy "Participants can read own support conversations"
on public.support_conversations for select to authenticated
using (participant_id = auth.uid() and participant_role = public.current_user_role());

create policy "Participants can create own support conversations"
on public.support_conversations for insert to authenticated
with check (
  participant_id = auth.uid()
  and participant_role = public.current_user_role()
  and participant_role in ('paciente', 'profesional')
  and assigned_admin_id is null
);

create policy "Administrators can manage support conversations"
on public.support_conversations for all to authenticated
using (public.current_user_role() in ('administrador', 'super_administrador'))
with check (public.current_user_role() in ('administrador', 'super_administrador'));

create policy "Participants can read own support messages"
on public.support_messages for select to authenticated
using (
  exists (
    select 1 from public.support_conversations conversation
    where conversation.id = support_messages.conversation_id
      and conversation.participant_id = auth.uid()
      and conversation.participant_role = public.current_user_role()
  )
);

create policy "Participants can send own support messages"
on public.support_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and kind = 'mensaje'
  and exists (
    select 1 from public.support_conversations conversation
    where conversation.id = support_messages.conversation_id
      and conversation.participant_id = auth.uid()
      and conversation.participant_role = public.current_user_role()
      and conversation.status <> 'cerrado'
  )
);

create policy "Administrators can read support messages"
on public.support_messages for select to authenticated
using (public.current_user_role() in ('administrador', 'super_administrador'));

create policy "Administrators can send support messages"
on public.support_messages for insert to authenticated
with check (
  public.current_user_role() in ('administrador', 'super_administrador')
  and sender_id = auth.uid()
);

create policy "Administrators can manage support referrals"
on public.support_referrals for all to authenticated
using (public.current_user_role() in ('administrador', 'super_administrador'))
with check (public.current_user_role() in ('administrador', 'super_administrador'));

create policy "Patients can read own support referrals"
on public.support_referrals for select to authenticated
using (public.current_user_role() = 'paciente' and patient_id = auth.uid());

create policy "Administrators can read consent reminders"
on public.consent_reminders for select to authenticated
using (public.current_user_role() in ('administrador', 'super_administrador'));

revoke update, delete on public.support_messages from authenticated, anon;
revoke delete on public.support_conversations from authenticated, anon;
revoke delete on public.support_referrals from authenticated, anon;
revoke update, delete on public.consent_reminders from authenticated, anon;

grant select, insert, update on public.support_conversations to service_role;
grant select, insert on public.support_messages to service_role;
grant select, insert, update on public.support_referrals to service_role;
grant select, insert on public.consent_reminders to service_role;

create or replace function public.has_valid_informed_consent(target_expediente_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select expediente.consent_status in (
        'firmado_fisico',
        'firmado_digital',
        'excepcion_justificada'
      )
      from public.expedientes expediente
      where expediente.id = target_expediente_id
    ),
    false
  );
$$;

create or replace function public.expediente_grace_session_used(target_expediente_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.notas_clinicas note
    where note.expediente_id = target_expediente_id
      and note.note_type <> 'addendum'
      and note.status <> 'anulada_logicamente'
  );
$$;

create or replace function public.enforce_cita_insert_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  patient_role public.user_role;
  professional_role public.user_role;
  expediente_row public.expedientes%rowtype;
begin
  select role into patient_role from public.profiles where id = new.patient_id;
  select role into professional_role from public.profiles where id = new.professional_id;

  if patient_role <> 'paciente' then
    raise exception 'Appointment patient must have patient role';
  end if;

  if professional_role <> 'profesional' then
    raise exception 'Appointment professional must have professional role';
  end if;

  select * into expediente_row
  from public.expedientes
  where patient_id = new.patient_id
    and professional_id = new.professional_id
    and status = 'activo';

  if expediente_row.id is null then
    raise exception 'Appointment requires an active clinical record';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(expediente_row.id::text, 0));

  if not public.has_valid_informed_consent(expediente_row.id) and (
    public.expediente_grace_session_used(expediente_row.id)
    or exists (
      select 1 from public.citas existing
      where existing.patient_id = new.patient_id
        and existing.professional_id = new.professional_id
        and existing.status <> 'cancelada'
    )
  ) then
    raise exception 'Informed consent required after the grace session';
  end if;

  if new.process_id is not null and not exists (
    select 1 from public.procesos_terapeuticos
    where id = new.process_id
      and patient_id = new.patient_id
      and professional_id = new.professional_id
  ) then
    raise exception 'Appointment process does not match patient and professional';
  end if;

  if new.tcc_process_id is not null and not exists (
    select 1 from public.procesos_terapeuticos
    where id = new.tcc_process_id
      and model_type = 'tcc'
      and patient_id = new.patient_id
      and professional_id = new.professional_id
  ) then
    raise exception 'Appointment TCC process does not match patient and professional';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_nota_clinica_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  expediente_row public.expedientes%rowtype;
  original_note_status public.nota_clinica_status;
begin
  select * into expediente_row from public.expedientes where id = new.expediente_id;

  if expediente_row.id is null then
    raise exception 'Clinical record not found';
  end if;

  if expediente_row.status <> 'activo' then
    raise exception 'Clinical record is not active';
  end if;

  if new.patient_id <> expediente_row.patient_id or new.professional_id <> expediente_row.professional_id then
    raise exception 'Clinical note ownership does not match clinical record';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(expediente_row.id::text, 0));

  if not public.has_valid_informed_consent(expediente_row.id) then
    if new.note_type = 'addendum' or public.expediente_grace_session_used(expediente_row.id) then
      raise exception 'Informed consent required after the grace session';
    end if;
  end if;

  if new.note_type = 'addendum' then
    select status into original_note_status
    from public.notas_clinicas
    where id = new.addendum_to_note_id
      and expediente_id = new.expediente_id
      and professional_id = new.professional_id;

    if original_note_status not in ('confirmada', 'con_addendum', 'exportada') then
      raise exception 'Addendum requires a confirmed original note';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_consent_on_process_advance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.step_data is distinct from old.step_data
    and not public.has_valid_informed_consent(new.expediente_id)
    and public.expediente_grace_session_used(new.expediente_id)
  then
    raise exception 'Informed consent required to advance the therapeutic process';
  end if;
  return new;
end;
$$;

create trigger procesos_terapeuticos_consent_gate
before update on public.procesos_terapeuticos
for each row execute function public.enforce_consent_on_process_advance();

create or replace function public.enforce_consent_on_assessment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_valid_informed_consent(new.expediente_id)
    and public.expediente_grace_session_used(new.expediente_id)
  then
    raise exception 'Informed consent required to create further assessments';
  end if;
  return new;
end;
$$;

create trigger psychological_assessments_consent_gate
before insert on public.psychological_assessments
for each row execute function public.enforce_consent_on_assessment_insert();

revoke execute on function public.has_valid_informed_consent(uuid) from public, anon, authenticated;
revoke execute on function public.expediente_grace_session_used(uuid) from public, anon, authenticated;
grant execute on function public.has_valid_informed_consent(uuid) to service_role;
grant execute on function public.expediente_grace_session_used(uuid) to service_role;
