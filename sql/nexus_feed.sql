-- Citizen UX Nexus — Leader Feed (Founder Broadcast) backend schema for Supabase.
--
-- STATUS: DESIGN FILE, NOT YET APPLIED OR TESTED. nexus.html currently uses a
-- local browser-only FeedStore (see LocalFeedStore). This is the schema a
-- networked FeedStore adapter would talk to; run it in a scratch Supabase
-- project and test the policies before pointing anything at production.
--
-- Model: ONE author (the Founder/CEO) may create posts; any signed-in team
-- member may read, comment and react. The "founder" role is stored in
-- nexus_members and can only be granted with the service role (no client
-- policy allows writing it), so it cannot be self-assigned from the browser.
--
-- Requires Supabase Auth: every policy keys off auth.uid(). Without sign-in
-- there is nothing to enforce "single author" with, which is why /nexus must
-- not be treated as access-controlled until Auth is wired in.

create table if not exists public.nexus_members (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  title        text check (char_length(title) <= 80),
  department   text,
  role         text not null default 'member' check (role in ('founder','member')),
  created_at   timestamptz not null default now()
);

create table if not exists public.nexus_posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.nexus_members(user_id),
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.nexus_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.nexus_posts(id) on delete cascade,
  author_id  uuid not null references public.nexus_members(user_id),
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists nexus_comments_post_idx on public.nexus_comments(post_id, created_at);

create table if not exists public.nexus_reactions (
  post_id    uuid not null references public.nexus_posts(id) on delete cascade,
  user_id    uuid not null references public.nexus_members(user_id) on delete cascade,
  emoji      text not null check (emoji in ('👍','✅','🚀','👀','❤️')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);

alter table public.nexus_members   enable row level security;
alter table public.nexus_posts     enable row level security;
alter table public.nexus_comments  enable row level security;
alter table public.nexus_reactions enable row level security;

-- Helper: is the caller a registered team member / the founder?
create or replace function public.nexus_is_member() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from nexus_members where user_id = auth.uid()) $$;

create or replace function public.nexus_is_founder() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from nexus_members where user_id = auth.uid() and role = 'founder') $$;

-- Members: members can read the roster and edit their own display fields.
-- No client policy can insert rows or change `role` (service role only).
create policy members_read on public.nexus_members for select to authenticated using (public.nexus_is_member());
create policy members_update_self on public.nexus_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and role = (select role from public.nexus_members where user_id = auth.uid()));

-- Posts: everyone on the team reads; ONLY the founder inserts, as themselves.
create policy posts_read   on public.nexus_posts for select to authenticated using (public.nexus_is_member());
create policy posts_insert on public.nexus_posts for insert to authenticated
  with check (public.nexus_is_founder() and author_id = auth.uid());
create policy posts_delete on public.nexus_posts for delete to authenticated
  using (public.nexus_is_founder() and author_id = auth.uid());

-- Comments: team reads and writes as themselves; authors can delete their own.
create policy comments_read   on public.nexus_comments for select to authenticated using (public.nexus_is_member());
create policy comments_insert on public.nexus_comments for insert to authenticated
  with check (public.nexus_is_member() and author_id = auth.uid());
create policy comments_delete on public.nexus_comments for delete to authenticated using (author_id = auth.uid());

-- Reactions: team reads; each member adds/removes only their own.
create policy reactions_read   on public.nexus_reactions for select to authenticated using (public.nexus_is_member());
create policy reactions_insert on public.nexus_reactions for insert to authenticated
  with check (public.nexus_is_member() and user_id = auth.uid());
create policy reactions_delete on public.nexus_reactions for delete to authenticated using (user_id = auth.uid());

-- Realtime: lets a FeedStore.subscribe() adapter receive live changes.
alter publication supabase_realtime add table public.nexus_posts, public.nexus_comments, public.nexus_reactions;
