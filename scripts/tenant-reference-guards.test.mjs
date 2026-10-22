import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

// Reutiliza uma instalação PGlite de homologação, sem adicionar dependência ao app.
// PGLITE_MODULE_URL=file:///.../@electric-sql/pglite/dist/index.js node --test scripts/tenant-reference-guards.test.mjs
const { PGlite } = await import(process.env.PGLITE_MODULE_URL || '@electric-sql/pglite')
const id = (n) => `'00000000-0000-4000-8000-${String(n).padStart(12, '0')}'`
const A = id(1), B = id(2), userA = id(3), productA = id(11), productB = id(12), productA2 = id(13)
const orderA = id(21), orderB = id(22), tokenA = id(31), tokenB = id(32)
const availabilityA = id(41), availabilityB = id(42), availabilityA2 = id(43), bookingA = id(51)

test('tenant reference guards reject cross-business links under RLS and preserve valid operations', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema private;
      create function auth.uid() returns uuid language sql stable as $$
        select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
      $$;
      create table public.workspaces (id uuid primary key, niche text);
      create table public.workspace_members (workspace_id uuid references public.workspaces, user_id uuid);
      create function private.is_workspace_member(target uuid) returns boolean
      language sql stable security definer set search_path = '' as $$
        select exists (select 1 from public.workspace_members where workspace_id = target and user_id = auth.uid());
      $$;
      create table public.products (id uuid primary key, workspace_id uuid references public.workspaces, published boolean default true);
      create table public.orders (id uuid primary key, workspace_id uuid references public.workspaces);
      create table public.order_items (id bigint primary key, order_id uuid references public.orders, product_id uuid references public.products);
      create table public.product_access_tokens (id uuid primary key, order_id uuid references public.orders, product_id uuid references public.products);
      create table public.client_notifications (id int generated always as identity primary key, workspace_id uuid references public.workspaces, product_id uuid references public.products, target_token_id uuid references public.product_access_tokens, created_by uuid, title text);
      create table public.evaluation_availability (id uuid primary key, workspace_id uuid references public.workspaces, product_id uuid references public.products, active boolean default true);
      create table public.evaluation_bookings (id uuid primary key, workspace_id uuid references public.workspaces, product_id uuid references public.products, order_id uuid references public.orders, availability_id uuid references public.evaluation_availability, order_item_id bigint references public.order_items, status text default 'payment_pending');
      insert into public.workspaces values (${A}, 'fitness'), (${B}, 'creator');
      insert into public.workspace_members values (${A}, ${userA});
      insert into public.products(id,workspace_id) values (${productA},${A}), (${productB},${B}), (${productA2},${A});
      insert into public.orders values (${orderA},${A}), (${orderB},${B});
      insert into public.order_items values (1,${orderA},${productA}), (2,${orderB},${productB}), (3,${orderA},${productA2});
      insert into public.product_access_tokens values (${tokenA},${orderA},${productA}), (${tokenB},${orderB},${productB});
      insert into public.evaluation_availability(id,workspace_id,product_id) values (${availabilityA},${A},${productA}), (${availabilityB},${B},${productB}), (${availabilityA2},${A},${productA2});
      insert into public.evaluation_bookings(id,workspace_id,product_id,order_id,availability_id,order_item_id) values (${bookingA},${A},${productA},${orderA},${availabilityA},1);
      grant usage on schema public,auth,private to authenticated;
      grant select on public.products,public.orders,public.order_items,public.evaluation_bookings to authenticated;
      grant select,insert on public.client_notifications to authenticated;
      grant usage on sequence public.client_notifications_id_seq to authenticated;
      grant select,insert,update on public.evaluation_availability to authenticated;
      grant update on public.evaluation_bookings to authenticated;
      alter table public.client_notifications enable row level security;
      alter table public.evaluation_availability enable row level security;
      alter table public.evaluation_bookings enable row level security;
      alter table public.product_access_tokens enable row level security;
      create policy notification_select on public.client_notifications for select to authenticated using(private.is_workspace_member(workspace_id));
      create policy notification_insert on public.client_notifications for insert to authenticated with check(private.is_workspace_member(workspace_id) and created_by = auth.uid());
      create policy availability_access on public.evaluation_availability for all to authenticated using(private.is_workspace_member(workspace_id)) with check(private.is_workspace_member(workspace_id));
      create policy booking_access on public.evaluation_bookings for all to authenticated using(private.is_workspace_member(workspace_id)) with check(private.is_workspace_member(workspace_id));
      select set_config('request.jwt.claims', '{"sub":${userA.replaceAll("'", '"')},"role":"authenticated"}', false);
      set role authenticated;
    `)
    // Prova a lacuna anterior: RLS do tenant A aceita referências a IDs de B.
    await db.exec(`insert into public.client_notifications(workspace_id,product_id,created_by,title) values (${A},${productB},${userA},'Antes do guard');`)
    await db.exec(`insert into public.evaluation_availability(id,workspace_id,product_id) values (${id(99)},${A},${productB});`)
    await db.exec(`update public.evaluation_bookings set product_id = ${productB} where id = ${bookingA};`)
    await db.exec(`reset role; delete from public.client_notifications; delete from public.evaluation_availability where id = ${id(99)}; update public.evaluation_bookings set product_id = ${productA} where id = ${bookingA};`)
    await db.exec(await readFile(new URL('../supabase/drafts/tenant_reference_guards.sql', import.meta.url), 'utf8'))
    await db.exec('set role authenticated')
    const rejected = async (query, code = '23514') => assert.rejects(db.exec(query), (error) => error.code === code)

    await rejected(`insert into public.client_notifications(workspace_id,product_id,created_by) values (${A},${productB},${userA})`)
    await rejected(`insert into public.client_notifications(workspace_id,target_token_id,created_by) values (${A},${tokenB},${userA})`)
    await rejected(`insert into public.client_notifications(workspace_id,product_id,target_token_id,created_by) values (${A},${productA2},${tokenA},${userA})`)
    await rejected(`insert into public.client_notifications(workspace_id,product_id,created_by) values (${B},${productB},${userA})`, '42501')
    await rejected(`select * from public.product_access_tokens`, '42501')
    await db.exec(`insert into public.client_notifications(workspace_id,product_id,target_token_id,created_by) values (${A},${productA},${tokenA},${userA})`)
    await db.exec(`insert into public.client_notifications(workspace_id,created_by,title) values (${A},${userA},'Aviso geral')`)

    await rejected(`insert into public.evaluation_availability(id,workspace_id,product_id) values (${id(99)},${A},${productB})`)
    await rejected(`update public.evaluation_availability set product_id = ${productB} where id = ${availabilityA}`)
    await db.exec(`update public.evaluation_availability set active = false where id = ${availabilityA}`)
    for (const assignment of [`product_id = ${productB}`, `order_id = ${orderB}`, `availability_id = ${availabilityB}`, `availability_id = ${availabilityA2}`, 'order_item_id = 2', 'order_item_id = 3']) {
      await rejected(`update public.evaluation_bookings set ${assignment} where id = ${bookingA}`)
    }
    // Não bloqueia operação histórica quando um produto foi despublicado.
    await db.exec(`reset role; update public.products set published = false where id = ${productA}; set role authenticated;`)
    await db.exec(`update public.evaluation_bookings set status = 'awaiting_approval' where id = ${bookingA}`)
    const result = await db.query(`select status,product_id from public.evaluation_bookings where id = ${bookingA}`)
    assert.equal(result.rows[0].status, 'awaiting_approval')
    assert.equal(result.rows[0].product_id, productA.slice(1, -1))
    const notifications = await db.query('select count(*)::int as count from public.client_notifications')
    assert.equal(notifications.rows[0].count, 2)
  } finally {
    await db.close()
  }
})
