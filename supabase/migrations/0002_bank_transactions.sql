-- KB Liquors — Phase 2 (partial): bank transactions.
-- Widens sales.payment_method to allow 'bank', and adds a bank ledger for
-- transfers/expenses that aren't tied to a POS sale (supplier payments, rent, etc).

alter table sales drop constraint sales_payment_method_check;
alter table sales add constraint sales_payment_method_check
  check (payment_method in ('cash', 'bank'));

create table bank_transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  occurred_at timestamptz not null default now(),
  direction text not null check (direction in ('in', 'out')),
  amount numeric(12, 2) not null check (amount > 0),
  category text not null default 'other',
  notes text,
  related_sale_id uuid references sales(id),
  created_by uuid references profiles(id),
  client_generated_id uuid not null unique,
  created_at timestamptz not null default now()
);

create index bank_transactions_store_idx on bank_transactions(store_id);
create index bank_transactions_occurred_idx on bank_transactions(occurred_at);

alter table bank_transactions enable row level security;

create policy bank_transactions_all on bank_transactions
  for all using (store_id = current_store_id())
  with check (store_id = current_store_id());
