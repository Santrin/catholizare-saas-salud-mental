create table if not exists public.professional_dashboard_settings (
  professional_id uuid primary key references public.profiles(id) on delete restrict,
  session_price_cents integer not null default 0,
  currency text not null default 'MXN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_dashboard_settings_price_check
    check (session_price_cents between 0 and 100000000),
  constraint professional_dashboard_settings_currency_check
    check (currency = 'MXN')
);

drop trigger if exists professional_dashboard_settings_touch_updated_at
on public.professional_dashboard_settings;

create trigger professional_dashboard_settings_touch_updated_at
before update on public.professional_dashboard_settings
for each row execute function public.touch_updated_at();

alter table public.professional_dashboard_settings enable row level security;

drop policy if exists "Professionals can read own dashboard settings"
on public.professional_dashboard_settings;

create policy "Professionals can read own dashboard settings"
on public.professional_dashboard_settings for select to authenticated
using (
  public.current_user_role() = 'profesional'
  and professional_id = auth.uid()
);

drop policy if exists "Professionals can insert own dashboard settings"
on public.professional_dashboard_settings;

create policy "Professionals can insert own dashboard settings"
on public.professional_dashboard_settings for insert to authenticated
with check (
  public.current_user_role() = 'profesional'
  and professional_id = auth.uid()
);

drop policy if exists "Professionals can update own dashboard settings"
on public.professional_dashboard_settings;

create policy "Professionals can update own dashboard settings"
on public.professional_dashboard_settings for update to authenticated
using (
  public.current_user_role() = 'profesional'
  and professional_id = auth.uid()
)
with check (
  public.current_user_role() = 'profesional'
  and professional_id = auth.uid()
);

revoke all on public.professional_dashboard_settings from anon;
revoke delete on public.professional_dashboard_settings from authenticated;
grant select, insert, update on public.professional_dashboard_settings to authenticated;
grant select, insert, update on public.professional_dashboard_settings to service_role;
