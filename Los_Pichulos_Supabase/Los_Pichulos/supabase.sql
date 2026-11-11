-- LOS PICHULOS - esquema para Supabase (PostgreSQL)
-- Ejecutar completo desde Supabase > SQL Editor > New query.

create table if not exists public.productos (
  id text primary key,
  nombre varchar(80) not null,
  marca varchar(60) not null default '',
  talle varchar(30) not null,
  precio numeric(12,2) not null default 0 check (precio >= 0),
  stock integer not null default 0 check (stock >= 0),
  categoria varchar(60) not null default 'General',
  created_at timestamptz not null default now()
);

create table if not exists public.ventas (
  id text primary key,
  producto_id text,
  producto_nombre varchar(80) not null,
  talle varchar(30) not null default '',
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  medio_pago varchar(40) not null default 'Efectivo',
  cliente varchar(120) not null default '',
  fecha date not null default current_date,
  creado_en timestamptz not null default now()
);

create table if not exists public.configuracion (
  clave varchar(60) primary key,
  valor text not null default ''
);

create index if not exists idx_productos_nombre on public.productos(nombre);
create index if not exists idx_productos_stock on public.productos(stock);
create index if not exists idx_ventas_fecha on public.ventas(fecha);

-- Activar RLS y permitir operaciones solo a usuarios autenticados.
alter table public.productos enable row level security;
alter table public.ventas enable row level security;
alter table public.configuracion enable row level security;

drop policy if exists "Acceso autenticado a productos" on public.productos;
create policy "Acceso autenticado a productos" on public.productos for all to authenticated using (true) with check (true);
drop policy if exists "Acceso autenticado a ventas" on public.ventas;
create policy "Acceso autenticado a ventas" on public.ventas for all to authenticated using (true) with check (true);
drop policy if exists "Acceso autenticado a configuracion" on public.configuracion;
create policy "Acceso autenticado a configuracion" on public.configuracion for all to authenticated using (true) with check (true);
