-- KB Liquors — Phase 1 schema: stores, profiles, categories, stock, cash sessions, sales.
-- Every business table is scoped by store_id and locked down with RLS.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- stores / profiles
-- ---------------------------------------------------------------------------

create table stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'NPR',
  timezone text not null default 'Asia/Kathmandu',
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  store_id uuid not null references stores(id),
  full_name text,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- categories / stock_items
-- ---------------------------------------------------------------------------

create table categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  name text not null,
  client_generated_id uuid not null unique,
  created_at timestamptz not null default now()
);

create table stock_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  category_id uuid references categories(id),
  name text not null,
  brand text,
  size_ml int,
  sku text,
  cost_price numeric(12, 2) not null default 0,
  sale_price numeric(12, 2) not null default 0,
  quantity_on_hand int not null default 0,
  reorder_level int not null default 0,
  photo_path text,
  is_active boolean not null default true,
  client_generated_id uuid not null unique,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id),
  version int not null default 1
);

create index stock_items_store_idx on stock_items(store_id);

-- Server is the single place stock quantity changes on a sale — never trust a
-- client-pushed absolute quantity for a sale-driven change (see sale_items trigger).
-- Manual edits (recounts/restocking) instead use last-write-wins below.
create or replace function stock_items_last_write_wins() returns trigger as $$
begin
  if OLD.updated_at > NEW.updated_at then
    return OLD;
  end if;
  if OLD.updated_at = NEW.updated_at and OLD.version > NEW.version then
    return OLD;
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_stock_items_last_write_wins
before update on stock_items
for each row execute function stock_items_last_write_wins();

-- ---------------------------------------------------------------------------
-- cash_sessions
-- ---------------------------------------------------------------------------

create table cash_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  opened_at timestamptz not null default now(),
  opened_by uuid references profiles(id),
  opening_amount numeric(12, 2) not null,
  closed_at timestamptz,
  closing_counted_amount numeric(12, 2),
  expected_amount numeric(12, 2),
  discrepancy numeric(12, 2),
  status text not null default 'open' check (status in ('open', 'closed')),
  notes text,
  client_generated_id uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Exactly one open cash session per store at a time.
create unique index one_open_session_per_store
  on cash_sessions(store_id) where status = 'open';

-- ---------------------------------------------------------------------------
-- sales / sale_items
-- ---------------------------------------------------------------------------

create table sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  cash_session_id uuid not null references cash_sessions(id),
  sold_at timestamptz not null default now(),
  subtotal numeric(12, 2) not null,
  discount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null,
  cost_total numeric(12, 2) not null default 0,
  -- Phase 2 will widen this check to add 'bank'.
  payment_method text not null default 'cash' check (payment_method in ('cash')),
  status text not null default 'completed' check (status in ('completed', 'voided')),
  created_by uuid references profiles(id),
  client_generated_id uuid not null unique,
  created_at timestamptz not null default now()
);

create index sales_store_idx on sales(store_id);
create index sales_cash_session_idx on sales(cash_session_id);
create index sales_sold_at_idx on sales(sold_at);

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  stock_item_id uuid references stock_items(id),
  item_name_snapshot text not null,
  quantity int not null check (quantity > 0),
  unit_price numeric(12, 2) not null,
  unit_cost numeric(12, 2) not null,
  line_total numeric(12, 2) not null,
  client_generated_id uuid not null unique,
  created_at timestamptz not null default now()
);

create index sale_items_sale_idx on sale_items(sale_id);

-- Insert-only decrement, so idempotent upsert-by-client_generated_id on sale_items
-- means this fires exactly once per real sale line no matter how sync retries.
create or replace function decrement_stock_on_sale_item() returns trigger as $$
begin
  update stock_items
  set quantity_on_hand = quantity_on_hand - NEW.quantity
  where id = NEW.stock_item_id;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_decrement_stock_on_sale_item
after insert on sale_items
for each row execute function decrement_stock_on_sale_item();

-- ---------------------------------------------------------------------------
-- Row Level Security — every table scoped by the caller's store_id
-- ---------------------------------------------------------------------------

alter table stores enable row level security;
alter table profiles enable row level security;
alter table categories enable row level security;
alter table stock_items enable row level security;
alter table cash_sessions enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;

create or replace function current_store_id() returns uuid as $$
  select store_id from profiles where id = auth.uid();
$$ language sql stable security definer;

create policy stores_select on stores
  for select using (id = current_store_id());

create policy profiles_select on profiles
  for select using (store_id = current_store_id());
create policy profiles_update_self on profiles
  for update using (id = auth.uid());

create policy categories_all on categories
  for all using (store_id = current_store_id())
  with check (store_id = current_store_id());

create policy stock_items_all on stock_items
  for all using (store_id = current_store_id())
  with check (store_id = current_store_id());

create policy cash_sessions_all on cash_sessions
  for all using (store_id = current_store_id())
  with check (store_id = current_store_id());

create policy sales_all on sales
  for all using (store_id = current_store_id())
  with check (store_id = current_store_id());

create policy sale_items_all on sale_items
  for all using (
    exists (select 1 from sales s where s.id = sale_id and s.store_id = current_store_id())
  )
  with check (
    exists (select 1 from sales s where s.id = sale_id and s.store_id = current_store_id())
  );

-- ---------------------------------------------------------------------------
-- Storage — stock item photos
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('stock-photos', 'stock-photos', false)
on conflict (id) do nothing;

create policy stock_photos_rw on storage.objects
  for all using (
    bucket_id = 'stock-photos'
    and (storage.foldername(name))[1] = current_store_id()::text
  )
  with check (
    bucket_id = 'stock-photos'
    and (storage.foldername(name))[1] = current_store_id()::text
  );

-- ---------------------------------------------------------------------------
-- New-user bootstrap: first login creates a store + owner profile automatically
-- ---------------------------------------------------------------------------

create or replace function handle_new_user() returns trigger as $$
declare
  new_store_id uuid;
begin
  insert into public.stores (name) values (coalesce(NEW.raw_user_meta_data->>'store_name', 'My Store'))
  returning id into new_store_id;

  insert into public.profiles (id, store_id, full_name, role)
  values (NEW.id, new_store_id, NEW.raw_user_meta_data->>'full_name', 'owner');

  return NEW;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();
