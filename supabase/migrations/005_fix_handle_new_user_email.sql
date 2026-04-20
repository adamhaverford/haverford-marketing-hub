-- Ensure email column exists on profiles
alter table public.profiles add column if not exists email text;

-- Fix handle_new_user to store email from auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'marketing'),
    new.email
  )
  on conflict (user_id) do update set
    email = excluded.email;
  return new;
end;
$$;
