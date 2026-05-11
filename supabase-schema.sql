-- Run this in Supabase SQL Editor

create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  photo text default '',
  role text not null default 'tatar' check (role in ('customer','tatar','admin')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  telegram_username text default '',
  created_at timestamptz default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references users(id) on delete set null,
  tatar_id uuid references users(id) on delete set null,
  item text not null,
  quantity int not null default 1,
  location text not null,
  deliver_building text not null,
  deliver_room text not null,
  contact text not null,
  notes text default '',
  tatar_price int,
  fee int,
  total int,
  status text not null default 'pending' check (
    status in ('pending','taken','price_pending','delivering','delivered','cancelled')
  ),
  verify_code text,
  telegram_message_id bigint,
  time text,
  created_at timestamptz default now(),
  taken_at timestamptz,
  delivered_at timestamptz
);

create table ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  customer_id uuid references users(id) on delete set null,
  tatar_id uuid references users(id) on delete set null,
  stars int not null check (stars between 1 and 5),
  created_at timestamptz default now()
);

-- Make yourself admin (run after signing up with Google)
-- Replace with your actual email:
-- update users set role = 'admin', status = 'approved' where email = 'your@email.com';
