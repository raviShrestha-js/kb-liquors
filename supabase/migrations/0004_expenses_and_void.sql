-- KB Liquors — cash expenses, sale voiding, and correct pull-sync watermarks
-- for rows that can now be edited after creation (sales, bank_transactions).

-- ---------------------------------------------------------------------------
-- sales: track updated_at so edits (voiding) are actually pull-syncable —
-- previously sales were treated as append-only and pulled by created_at,
-- which never re-fetches a row whose only change is a later status flip.
-- ---------------------------------------------------------------------------

alter table sales add column updated_at timestamptz not null default now();

-- Voiding a sale (status: completed -> voided) restores the stock it had
-- decremented. Sale_items are the historical record and are never touched.
create or replace function restore_stock_on_sale_void() returns trigger as $$
begin
  if OLD.status = 'completed' and NEW.status = 'voided' then
    update stock_items si
    set quantity_on_hand = si.quantity_on_hand + sub.qty
    from (
      select stock_item_id, sum(quantity) as qty
      from sale_items
      where sale_id = NEW.id and stock_item_id is not null
      group by stock_item_id
    ) sub
    where si.id = sub.stock_item_id;
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_restore_stock_on_sale_void
after update on sales
for each row execute function restore_stock_on_sale_void();

-- ---------------------------------------------------------------------------
-- bank_transactions: same watermark fix, now that entries are editable.
-- ---------------------------------------------------------------------------

alter table bank_transactions add column updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- cash_expenses: expenses paid out of the physical cash drawer, tied to the
-- session they were paid from (mirrors sales' relationship to cash_sessions).
-- ---------------------------------------------------------------------------

create table cash_expenses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  cash_session_id uuid not null references cash_sessions(id),
  occurred_at timestamptz not null default now(),
  amount numeric(12, 2) not null check (amount > 0),
  category text not null default 'other',
  notes text,
  created_by uuid references profiles(id),
  client_generated_id uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cash_expenses_store_idx on cash_expenses(store_id);
create index cash_expenses_session_idx on cash_expenses(cash_session_id);

alter table cash_expenses enable row level security;

create policy cash_expenses_all on cash_expenses
  for all using (store_id = current_store_id())
  with check (store_id = current_store_id());
