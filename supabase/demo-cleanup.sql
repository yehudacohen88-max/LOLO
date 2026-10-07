-- Deletes ONLY the LOLO demo event from supabase/demo-seed.sql.
-- Run manually in the Supabase SQL Editor. Safe to run when the demo is absent.
-- Does not change RLS, grants, or schema. Does not touch rows outside this demo.
--
-- Vouchers, redemptions, and settlements normally refuse DELETE. This script
-- turns those delete guards off only for this transaction, removes the demo
-- rows, and turns the guards back on. A settlement that also contains a
-- non-demo redemption is left in place and reported with a notice.

do $$
declare
  event_slug constant text := 'demo-bat-mitzvah-noa';
  demo_event uuid;
begin
  select id into demo_event from public.events where slug = event_slug;

  if demo_event is not null and exists (
    select 1
    from public.settlement_lines line
    join public.redemptions redemption on redemption.id = line.redemption_id
    join public.vouchers voucher on voucher.id = redemption.voucher_id
    where voucher.event_id = demo_event
      and exists (
        select 1
        from public.settlement_lines other
        join public.redemptions other_redemption on other_redemption.id = other.redemption_id
        join public.vouchers other_voucher on other_voucher.id = other_redemption.voucher_id
        where other.settlement_id = line.settlement_id
          and other_voucher.event_id is distinct from demo_event
      )
  ) then
    raise exception
      'A settlement mixes this demo with other redemptions. Leave it, or remove that settlement before cleanup. Nothing was deleted.';
  end if;

  alter table public.vouchers disable trigger vouchers_block_delete;
  alter table public.redemptions disable trigger redemptions_block_delete;
  alter table public.settlements disable trigger settlements_block_delete;
  alter table public.settlement_lines disable trigger settlement_lines_block_delete;

  begin
    if demo_event is not null then
      create temp table demo_cleanup_settlements on commit drop as
      select distinct line.settlement_id
      from public.settlement_lines line
      join public.redemptions redemption on redemption.id = line.redemption_id
      join public.vouchers voucher on voucher.id = redemption.voucher_id
      where voucher.event_id = demo_event;

      delete from public.settlement_lines
      where settlement_id in (select settlement_id from demo_cleanup_settlements);

      delete from public.settlements
      where id in (select settlement_id from demo_cleanup_settlements);

      delete from public.redemptions redemption
      using public.vouchers voucher
      where redemption.voucher_id = voucher.id
        and voucher.event_id = demo_event;

      delete from public.vouchers where event_id = demo_event;
      delete from public.order_items
      where order_id in (select id from public.orders where event_id = demo_event);
      delete from public.orders where event_id = demo_event;
      delete from public.event_guests where event_id = demo_event;
      delete from public.event_host_access where event_id = demo_event;
      delete from public.event_gifts where event_id = demo_event;
      delete from public.events where id = demo_event;
    else
      raise notice 'Demo event % was not found.', event_slug;
    end if;

    delete from public.store_redemption_access access
    using public.stores store
    where access.store_id = store.id
      and store.slug in ('demo-ofanaim', 'demo-sefer')
      and not exists (select 1 from public.vouchers voucher where voucher.store_id = store.id)
      and not exists (select 1 from public.event_gifts gift where gift.store_id = store.id)
      and not exists (select 1 from public.redemptions redemption where redemption.store_id = store.id)
      and not exists (select 1 from public.settlements settlement where settlement.store_id = store.id);

    delete from public.stores store
    where store.slug in ('demo-ofanaim', 'demo-sefer')
      and not exists (select 1 from public.vouchers voucher where voucher.store_id = store.id)
      and not exists (select 1 from public.event_gifts gift where gift.store_id = store.id)
      and not exists (select 1 from public.redemptions redemption where redemption.store_id = store.id)
      and not exists (select 1 from public.settlements settlement where settlement.store_id = store.id);
  exception
    when others then
      alter table public.vouchers enable trigger vouchers_block_delete;
      alter table public.redemptions enable trigger redemptions_block_delete;
      alter table public.settlements enable trigger settlements_block_delete;
      alter table public.settlement_lines enable trigger settlement_lines_block_delete;
      raise;
  end;

  alter table public.vouchers enable trigger vouchers_block_delete;
  alter table public.redemptions enable trigger redemptions_block_delete;
  alter table public.settlements enable trigger settlements_block_delete;
  alter table public.settlement_lines enable trigger settlement_lines_block_delete;

  raise notice 'Demo cleanup finished for %.', event_slug;
end;
$$;
