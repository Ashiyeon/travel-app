-- 2026-10-14  行李清單 + 唯讀分享連結
-- 在 Supabase Dashboard → SQL Editor 貼上整份執行一次即可（可重複執行）。

------------------------------------------------------------
-- 1. 行李清單 packing_items
--    trip_id 的型別自動對齊 trips.id（bigint 或 uuid 皆可）
------------------------------------------------------------
do $$
declare
  trip_id_type text;
begin
  select format_type(atttypid, atttypmod) into trip_id_type
  from pg_attribute
  where attrelid = 'public.trips'::regclass and attname = 'id';

  execute format($f$
    create table if not exists public.packing_items (
      id          bigint generated always as identity primary key,
      trip_id     %s not null references public.trips(id) on delete cascade,
      name        text not null,
      category    text not null default '其他',
      assignee    text,               -- 誰負責帶（旅伴顯示名稱，可空 = 各自帶）
      is_packed   boolean not null default false,
      created_at  timestamptz not null default now()
    )$f$, trip_id_type);
end $$;

create index if not exists packing_items_trip_id_idx on public.packing_items (trip_id);

alter table public.packing_items enable row level security;

-- 權限沿用 trips：看得到該行程的人，就能讀寫它的行李清單。
-- （子查詢會套用呼叫者自己在 trips 上的 RLS）
drop policy if exists "packing_items follow trip access" on public.packing_items;
create policy "packing_items follow trip access" on public.packing_items
  for all
  using (exists (select 1 from public.trips t where t.id = packing_items.trip_id))
  with check (exists (select 1 from public.trips t where t.id = packing_items.trip_id));

------------------------------------------------------------
-- 2. 唯讀分享連結
--    trips.share_token 為空 = 未分享；產生新 token = 舊連結立即失效。
------------------------------------------------------------
alter table public.trips add column if not exists share_token uuid unique;

-- 未登入的人只能透過這個函式、憑 token 讀取；不含記帳與共用 Email。
create or replace function public.get_shared_trip(p_token uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'trip', json_build_object(
      'name', t.name,
      'subtitle', t.subtitle,
      'start_date', t.start_date,
      'end_date', t.end_date,
      'members', t.members
    ),
    -- 明列欄位：日後資料表新增欄位時，不會自動經由匿名連結外流
    'activities', coalesce((
      select json_agg(r order by r.date, r.start_time) from (
        select a.id, a.date, a.start_time, a.title, a.category, a.description, a.map_url
        from public.activities a where a.trip_id = t.id) r), '[]'::json),
    'attractions', coalesce((
      select json_agg(r order by r.id) from (
        select x.id, x.date, x.title, x.subtitle, x.location_tag, x.description, x.highlights,
               x.transport_info, x.must_eat, x.ticket_price, x.opening_hours, x.map_url
        from public.attractions x where x.trip_id = t.id) r), '[]'::json),
    'accommodations', coalesce((
      select json_agg(r order by r.check_in_date) from (
        select c.id, c.name, c.address, c.station, c.check_in_date, c.check_out_date,
               c.check_in_time, c.check_out_time, c.google_map_url, c.transportation, c.transport_note
        from public.accommodations c where c.trip_id = t.id) r), '[]'::json)
  )
  from public.trips t
  where p_token is not null and t.share_token = p_token;
$$;

revoke all on function public.get_shared_trip(uuid) from public;
grant execute on function public.get_shared_trip(uuid) to anon, authenticated;
