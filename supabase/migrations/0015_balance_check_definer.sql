-- =====================================================================
-- Fix: the journal balance check is a deferred trigger, so it runs at
-- COMMIT as the signed-in user, after the security-definer posting
-- function has returned. Row-level security then hid most lines from
-- restricted roles (e.g. a salesman sees only customer lines), so every
-- invoice they posted looked unbalanced and was rolled back.
-- The check must see every line of the entry regardless of who posts it.
-- =====================================================================

create or replace function app.check_entry_balanced() returns trigger
language plpgsql security definer set search_path = public, app as $$
declare
  v_diff numeric;
begin
  select coalesce(sum(debit), 0) - coalesce(sum(credit), 0) into v_diff
  from public.journal_lines where entry_id = new.entry_id;
  if v_diff <> 0 then
    raise exception 'Journal entry % is not balanced (difference %)', new.entry_id, v_diff;
  end if;
  return null;
end $$;

revoke execute on function app.check_entry_balanced() from public, anon;
