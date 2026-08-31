alter table public.plantillas_nota_clinica
  drop constraint if exists plantillas_nota_clinica_model_type_check;

alter table public.plantillas_nota_clinica
  add constraint plantillas_nota_clinica_model_type_check
  check (model_type in (
    'tcc', 'gestalt', 'third_wave', 'psychodynamic', 'humanistic', 'systemic',
    'brief_systemic', 'neuropsychological', 'gestalt_humanistic', 'rebt', 'emdr',
    'psychological_consulting', 'schema_therapy', 'dbt', 'act', 'sfbt', 'mbct',
    'logotherapy', 'narrative', 'gottman', 'general'
  ));

alter table public.plantillas_nota_clinica
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by_user_id uuid references public.profiles(id) on delete set null;

create index if not exists plantillas_nota_clinica_active_model_idx
on public.plantillas_nota_clinica(professional_id, model_type, version desc)
where archived_at is null;

create or replace function public.enforce_active_note_template_limit()
returns trigger
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended(new.professional_id::text || ':' || new.model_type, 0)
  );

  if (
    select count(*)
    from public.plantillas_nota_clinica
    where professional_id = new.professional_id
      and model_type = new.model_type
      and archived_at is null
  ) >= 3 then
    raise exception 'A maximum of three active note template versions is allowed per model';
  end if;

  return new;
end;
$$;

drop trigger if exists plantillas_nota_clinica_limit_active_versions
on public.plantillas_nota_clinica;

create trigger plantillas_nota_clinica_limit_active_versions
before insert on public.plantillas_nota_clinica
for each row execute function public.enforce_active_note_template_limit();

grant update on public.plantillas_nota_clinica to service_role;

alter table public.procesos_terapeuticos
  add column if not exists reconceptualization_interval integer default 8,
  add column if not exists last_reconceptualized_session_count integer not null default 0,
  add column if not exists ai_conceptualization_enabled boolean not null default false,
  add column if not exists ai_next_block_plan_enabled boolean not null default false;

alter table public.procesos_terapeuticos
  drop constraint if exists procesos_terapeuticos_reconceptualization_interval_check;

alter table public.procesos_terapeuticos
  add constraint procesos_terapeuticos_reconceptualization_interval_check
  check (reconceptualization_interval is null or reconceptualization_interval in (4, 8, 10, 12));

alter table public.procesos_terapeuticos
  drop constraint if exists procesos_terapeuticos_reconceptualized_count_check;

alter table public.procesos_terapeuticos
  add constraint procesos_terapeuticos_reconceptualized_count_check
  check (last_reconceptualized_session_count >= 0);

create table if not exists public.professional_resource_seen_items (
  professional_id uuid not null references public.profiles(id) on delete cascade,
  content_key text not null,
  seen_at timestamptz not null default now(),
  primary key (professional_id, content_key),
  constraint professional_resource_seen_items_key_length
    check (char_length(content_key) between 3 and 1000)
);

create index if not exists professional_resource_seen_items_seen_idx
on public.professional_resource_seen_items(professional_id, seen_at desc);

alter table public.professional_resource_seen_items enable row level security;

create policy "Professionals can read own seen resources"
on public.professional_resource_seen_items for select to authenticated
using (
  public.current_user_role() = 'profesional'
  and professional_id = auth.uid()
);

create policy "Professionals can mark own resources as seen"
on public.professional_resource_seen_items for insert to authenticated
with check (
  public.current_user_role() = 'profesional'
  and professional_id = auth.uid()
);

revoke all on public.professional_resource_seen_items from anon;
revoke update, delete on public.professional_resource_seen_items from authenticated;
grant select, insert on public.professional_resource_seen_items to authenticated;
grant select, insert on public.professional_resource_seen_items to service_role;
