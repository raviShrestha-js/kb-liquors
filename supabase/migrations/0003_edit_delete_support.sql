-- KB Liquors — supports editing/deleting categories, stock items, cash
-- sessions, and bank transactions from the app.

-- Deleting a category should just uncategorize its stock items, not block
-- the delete or cascade-delete the items themselves.
alter table stock_items drop constraint stock_items_category_id_fkey;
alter table stock_items add constraint stock_items_category_id_fkey
  foreign key (category_id) references categories(id) on delete set null;
