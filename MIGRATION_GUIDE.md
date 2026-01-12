# Scratchpal Migration Guide

## Overview
**Scratchpal** is a scratch-off lottery ticket tracking community web application with the following core features:
- State-specific lottery game database with ranking system
- Community discussion forum (Hot Topics)
- Win reporting system
- Favorites system (games, stores, conversations)
- Ticket scanner using AI (OnSpace AI)
- User points & rewards system with referrals
- Admin panel for content management
- Google OAuth authentication

**Tech Stack:**
- Frontend: React + TypeScript + Vite + Tailwind CSS
- Backend: Supabase (PostgreSQL + Storage + Edge Functions)
- Authentication: Supabase Auth (Email/Password + Google OAuth)
- AI: OnSpace AI (for ticket scanning)

---

## Step 1: Create New OnSpace Project

1. Go to OnSpace homepage
2. Click **"WEBSITE"** tab
3. Create new project named "Scratchpal"
4. **✅ Select "Supabase" as backend** (NOT OnSpace Cloud)
5. Wait for project initialization

---

## Step 2: Database Schema Setup

### 2.1 Core Tables

Run this SQL in your Supabase SQL Editor:

```sql
-- ============================================================================
-- USER PROFILES TABLE
-- ============================================================================
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  email text not null,
  role text not null default 'user',
  profile_color text default '#14b8a6'
);

-- Enable RLS
alter table public.user_profiles enable row level security;

-- RLS Policies
create policy "Users can view own profile"
  on public.user_profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.user_profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "Users can delete own profile"
  on public.user_profiles for delete
  to authenticated
  using (auth.uid() = id);

-- ============================================================================
-- GAMES TABLE
-- ============================================================================
create table public.games (
  id uuid primary key default gen_random_uuid(),
  game_number text not null,
  game_name text not null,
  state text not null,
  price numeric not null,
  top_prize numeric not null,
  top_prizes_remaining integer not null,
  total_top_prizes integer not null,
  overall_odds text,
  start_date date,
  end_date date,
  image_url text,
  rank integer default 0,
  upvotes integer default 0,
  downvotes integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  image_converted boolean default false,
  original_image_url text,
  slug text,
  source text,
  source_url text,
  constraint unique_game_state_prize unique (game_number, state, top_prize)
);

-- Enable RLS
alter table public.games enable row level security;

-- RLS Policies
create policy "anon_select_games"
  on public.games for select
  to anon
  using (true);

create policy "authenticated_select_games"
  on public.games for select
  to authenticated
  using (true);

create policy "admin_insert_games"
  on public.games for insert
  to authenticated
  with check (exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  ));

create policy "admin_update_any_games"
  on public.games for update
  to authenticated
  using (exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  ));

create policy "admin_delete_any_games"
  on public.games for delete
  to authenticated
  using (exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  ));

-- ============================================================================
-- USER PREFERENCES TABLE
-- ============================================================================
create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  selected_state text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint unique_user_preferences unique (user_id)
);

alter table public.user_preferences enable row level security;

create policy "authenticated_select_own_preferences"
  on public.user_preferences for select
  to authenticated
  using (user_id = auth.uid());

create policy "authenticated_insert_own_preferences"
  on public.user_preferences for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "authenticated_update_own_preferences"
  on public.user_preferences for update
  to authenticated
  using (user_id = auth.uid());

create policy "authenticated_delete_own_preferences"
  on public.user_preferences for delete
  to authenticated
  using (user_id = auth.uid());

-- ============================================================================
-- FAVORITES TABLE
-- ============================================================================
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  favorite_type text not null,
  reference_id uuid not null,
  created_at timestamptz default now(),
  constraint unique_favorite unique (user_id, favorite_type, reference_id)
);

alter table public.favorites enable row level security;

create policy "authenticated_select_own_favorites"
  on public.favorites for select
  to authenticated
  using (user_id = auth.uid());

create policy "authenticated_insert_own_favorites"
  on public.favorites for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "authenticated_delete_own_favorites"
  on public.favorites for delete
  to authenticated
  using (user_id = auth.uid());

-- ============================================================================
-- FORUM TOPICS TABLE
-- ============================================================================
create table public.forum_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  game_id uuid references public.games(id) on delete set null,
  category text not null,
  title text not null,
  content text not null,
  image_urls text[],
  upvotes integer default 0,
  is_pinned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  slug text
);

alter table public.forum_topics enable row level security;

create policy "anon_select_forum_topics"
  on public.forum_topics for select
  to anon
  using (true);

create policy "authenticated_select_forum_topics"
  on public.forum_topics for select
  to authenticated
  using (true);

create policy "authenticated_insert_forum_topics"
  on public.forum_topics for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "authenticated_update_own_forum_topics"
  on public.forum_topics for update
  to authenticated
  using (user_id = auth.uid());

create policy "authenticated_delete_own_forum_topics"
  on public.forum_topics for delete
  to authenticated
  using (user_id = auth.uid());

create policy "admin_delete_any_forum_topics"
  on public.forum_topics for delete
  to authenticated
  using (exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  ));

-- ============================================================================
-- FORUM POSTS TABLE
-- ============================================================================
create table public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.forum_topics(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  content text not null,
  image_urls text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.forum_posts enable row level security;

create policy "anon_select_forum_posts"
  on public.forum_posts for select
  to anon
  using (true);

create policy "authenticated_select_forum_posts"
  on public.forum_posts for select
  to authenticated
  using (true);

create policy "authenticated_insert_forum_posts"
  on public.forum_posts for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "authenticated_update_own_forum_posts"
  on public.forum_posts for update
  to authenticated
  using (user_id = auth.uid());

create policy "authenticated_delete_own_forum_posts"
  on public.forum_posts for delete
  to authenticated
  using (user_id = auth.uid());

create policy "admin_update_any_forum_posts"
  on public.forum_posts for update
  to authenticated
  using (exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  ));

create policy "admin_delete_any_forum_posts"
  on public.forum_posts for delete
  to authenticated
  using (exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  ));

-- ============================================================================
-- WINS TABLE
-- ============================================================================
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  city text not null,
  state text not null,
  zip text not null,
  latitude numeric,
  longitude numeric,
  store_type text,
  created_at timestamptz default now()
);

alter table public.stores enable row level security;

create policy "anon_select_stores"
  on public.stores for select
  to anon
  using (true);

create policy "authenticated_select_stores"
  on public.stores for select
  to authenticated
  using (true);

create table public.wins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  win_amount numeric not null,
  image_url text,
  created_at timestamptz default now()
);

alter table public.wins enable row level security;

create policy "anon_select_wins"
  on public.wins for select
  to anon
  using (true);

create policy "authenticated_select_wins"
  on public.wins for select
  to authenticated
  using (true);

create policy "authenticated_insert_own_wins"
  on public.wins for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "authenticated_update_own_wins"
  on public.wins for update
  to authenticated
  using (user_id = auth.uid());

create policy "authenticated_delete_own_wins"
  on public.wins for delete
  to authenticated
  using (user_id = auth.uid());

-- ============================================================================
-- SLIDER MESSAGES TABLE
-- ============================================================================
create table public.slider_messages (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  transition_type text default 'fade',
  duration integer default 5000,
  is_active boolean default true,
  display_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.slider_messages enable row level security;

create policy "anon_select_slider_messages"
  on public.slider_messages for select
  to anon
  using (is_active = true);

create policy "authenticated_select_slider_messages"
  on public.slider_messages for select
  to authenticated
  using (is_active = true);

create policy "admin_insert_slider_messages"
  on public.slider_messages for insert
  to authenticated
  with check (exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  ));

create policy "admin_update_slider_messages"
  on public.slider_messages for update
  to authenticated
  using (exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  ));

create policy "admin_delete_slider_messages"
  on public.slider_messages for delete
  to authenticated
  using (exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  ));

-- ============================================================================
-- STATE CONFIG TABLE
-- ============================================================================
create table public.state_config (
  state_code text primary key,
  state_name text not null,
  emoji text not null,
  display_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  country text default 'US'
);

alter table public.state_config enable row level security;

create policy "anon_select_state_config"
  on public.state_config for select
  to anon
  using (true);

create policy "admin_insert_state_config"
  on public.state_config for insert
  to authenticated
  with check (exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  ));

create policy "admin_update_state_config"
  on public.state_config for update
  to authenticated
  using (exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  ));

create policy "admin_delete_state_config"
  on public.state_config for delete
  to authenticated
  using (exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  ));

-- ============================================================================
-- IMPORT LOGS TABLE
-- ============================================================================
create table public.import_logs (
  id uuid primary key default gen_random_uuid(),
  import_date timestamptz default now(),
  source_url text not null,
  status text not null,
  records_processed integer default 0,
  records_inserted integer default 0,
  records_updated integer default 0,
  records_failed integer default 0,
  error_message text,
  details jsonb,
  created_at timestamptz default now()
);

create index idx_import_logs_date on public.import_logs(import_date);

alter table public.import_logs enable row level security;

create policy "admin_select_import_logs"
  on public.import_logs for select
  to authenticated
  using (exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  ));

create policy "admin_insert_import_logs"
  on public.import_logs for insert
  to authenticated
  with check (exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  ));
```

### 2.2 Points & Rewards System

```sql
-- ============================================================================
-- POINTS CONFIG TABLE
-- ============================================================================
create table public.points_config (
  activity_name text primary key,
  points_awarded integer not null default 0,
  instant_fanfare boolean not null default false,
  display_name text not null,
  is_active boolean not null default true,
  daily_limit integer,
  weekly_limit integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.points_config enable row level security;

create policy "anon_select_points_config"
  on public.points_config for select
  to anon
  using (is_active = true);

create policy "authenticated_select_points_config"
  on public.points_config for select
  to authenticated
  using (is_active = true);

-- ============================================================================
-- USER POINTS TABLE
-- ============================================================================
create table public.user_points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  total_points integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint unique_user_points unique (user_id)
);

create index idx_user_points_user_id on public.user_points(user_id);
create index idx_user_points_total on public.user_points(total_points);

alter table public.user_points enable row level security;

create policy "authenticated_select_own_points"
  on public.user_points for select
  to authenticated
  using (user_id = auth.uid());

create policy "authenticated_select_all_points_for_leaderboard"
  on public.user_points for select
  to authenticated
  using (true);

-- ============================================================================
-- POINTS HISTORY TABLE
-- ============================================================================
create table public.points_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  activity_name text not null,
  points_earned integer not null,
  description text,
  created_at timestamptz default now()
);

create index idx_points_history_user_id on public.points_history(user_id);
create index idx_points_history_created_at on public.points_history(created_at);

alter table public.points_history enable row level security;

create policy "authenticated_select_own_history"
  on public.points_history for select
  to authenticated
  using (user_id = auth.uid());

-- ============================================================================
-- PENDING FANFARE TABLE
-- ============================================================================
create table public.pending_fanfare (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  activity_name text not null,
  points_earned integer not null,
  shown boolean not null default false,
  created_at timestamptz default now()
);

create index idx_pending_fanfare_user_shown on public.pending_fanfare(user_id, shown);

alter table public.pending_fanfare enable row level security;

create policy "authenticated_select_own_fanfare"
  on public.pending_fanfare for select
  to authenticated
  using (user_id = auth.uid());

-- ============================================================================
-- TOPIC UPVOTES TABLE
-- ============================================================================
create table public.topic_upvotes (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.forum_topics(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz default now(),
  constraint unique_topic_upvote unique (topic_id, user_id)
);

create index idx_topic_upvotes_topic on public.topic_upvotes(topic_id);
create index idx_topic_upvotes_user on public.topic_upvotes(user_id);

alter table public.topic_upvotes enable row level security;

create policy "authenticated_select_upvotes"
  on public.topic_upvotes for select
  to authenticated
  using (true);

create policy "authenticated_insert_own_upvotes"
  on public.topic_upvotes for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "authenticated_delete_own_upvotes"
  on public.topic_upvotes for delete
  to authenticated
  using (user_id = auth.uid());
```

### 2.3 Referral System

```sql
-- ============================================================================
-- REFERRAL CODES TABLE
-- ============================================================================
create table public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  referral_code text not null,
  created_at timestamptz default now(),
  constraint unique_referral_code unique (referral_code),
  constraint unique_user_referral unique (user_id)
);

create index idx_referral_codes_code on public.referral_codes(referral_code);

alter table public.referral_codes enable row level security;

create policy "anon_select_referral_codes"
  on public.referral_codes for select
  to anon
  using (true);

create policy "authenticated_select_own_referral_code"
  on public.referral_codes for select
  to authenticated
  using (user_id = auth.uid());

-- ============================================================================
-- REFERRALS TABLE
-- ============================================================================
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.user_profiles(id) on delete cascade,
  referred_user_id uuid not null references public.user_profiles(id) on delete cascade,
  referral_code text not null,
  is_signup boolean not null default false,
  created_at timestamptz default now(),
  constraint unique_referral unique (referrer_id, referred_user_id)
);

create index idx_referrals_referrer on public.referrals(referrer_id);

alter table public.referrals enable row level security;

create policy "authenticated_select_own_referrals"
  on public.referrals for select
  to authenticated
  using (referrer_id = auth.uid());
```

### 2.4 Notifications System

```sql
-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz default now()
);

create index idx_notifications_user_id on public.notifications(user_id);
create index idx_notifications_read on public.notifications(read);

alter table public.notifications enable row level security;

create policy "authenticated_select_own_notifications"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "authenticated_update_own_notifications"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid());

create policy "authenticated_delete_own_notifications"
  on public.notifications for delete
  to authenticated
  using (user_id = auth.uid());

-- ============================================================================
-- NOTIFICATION PREFERENCES TABLE
-- ============================================================================
create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  announcements_enabled boolean not null default true,
  topic_replies_enabled boolean not null default true,
  favorite_replies_enabled boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint unique_user_notification_prefs unique (user_id)
);

create index idx_notification_preferences_user_id on public.notification_preferences(user_id);

alter table public.notification_preferences enable row level security;

create policy "authenticated_select_own_preferences"
  on public.notification_preferences for select
  to authenticated
  using (user_id = auth.uid());

create policy "authenticated_insert_own_preferences"
  on public.notification_preferences for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "authenticated_update_own_preferences"
  on public.notification_preferences for update
  to authenticated
  using (user_id = auth.uid());
```

### 2.5 Ticket Scanner Tables

```sql
-- ============================================================================
-- SCANNED IMAGES TABLE
-- ============================================================================
create table public.scanned_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete cascade,
  image_url text not null,
  state text not null,
  scan_name text,
  ticket_matches jsonb not null,
  created_at timestamptz default now(),
  is_sample boolean default false
);

create index idx_scanned_images_user_id on public.scanned_images(user_id);
create index idx_scanned_images_created_at on public.scanned_images(created_at);

alter table public.scanned_images enable row level security;

create policy "authenticated_select_own_scans"
  on public.scanned_images for select
  to authenticated
  using (user_id = auth.uid());

create policy "authenticated_insert_own_scans"
  on public.scanned_images for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "authenticated_update_own_scans"
  on public.scanned_images for update
  to authenticated
  using (user_id = auth.uid());

create policy "authenticated_delete_own_scans"
  on public.scanned_images for delete
  to authenticated
  using (user_id = auth.uid());

create policy "public_select_sample_scans"
  on public.scanned_images for select
  to anon
  using (is_sample = true);

-- ============================================================================
-- SCAN USAGE TABLE
-- ============================================================================
create table public.scan_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  scanned_at timestamptz default now()
);

create index idx_scan_usage_user_time on public.scan_usage(user_id, scanned_at);

alter table public.scan_usage enable row level security;

create policy "authenticated_select_own_scans"
  on public.scan_usage for select
  to authenticated
  using (user_id = auth.uid());

create policy "authenticated_insert_own_scans"
  on public.scan_usage for insert
  to authenticated
  with check (user_id = auth.uid());

-- ============================================================================
-- SCANNER CONFIG TABLE
-- ============================================================================
create table public.scanner_config (
  id uuid primary key default gen_random_uuid(),
  config_key text not null,
  config_value text not null,
  description text,
  updated_at timestamptz default now(),
  constraint unique_config_key unique (config_key)
);

alter table public.scanner_config enable row level security;

create policy "authenticated_select_scanner_config"
  on public.scanner_config for select
  to authenticated
  using (true);

create policy "service_role_select_scanner_config"
  on public.scanner_config for select
  to service_role
  using (true);

create policy "admin_insert_scanner_config"
  on public.scanner_config for insert
  to authenticated
  with check (exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  ));

create policy "admin_update_scanner_config"
  on public.scanner_config for update
  to authenticated
  using (exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  ));

create policy "admin_delete_scanner_config"
  on public.scanner_config for delete
  to authenticated
  using (exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  ));
```

---

## Step 3: Database Functions & Triggers

### 3.1 Helper Functions

```sql
-- ============================================================================
-- GENERATE REFERRAL CODE
-- ============================================================================
create or replace function generate_referral_code()
returns text
language plpgsql
as $$
declare
  code text;
  exists boolean;
begin
  loop
    code := upper(substring(md5(random()::text) from 1 for 8));
    exists := (select 1 from referral_codes where referral_code = code);
    exit when not exists;
  end loop;
  return code;
end;
$$;

-- ============================================================================
-- PARSE ODDS (helper for ranking)
-- ============================================================================
create or replace function parse_odds(odds_text text)
returns numeric
language plpgsql
as $$
begin
  if odds_text is null or odds_text = '' then
    return 1.0;
  end if;
  
  return coalesce(
    (regexp_match(odds_text, '1\s*in\s*([\d.]+)', 'i'))[1]::numeric,
    1.0
  );
end;
$$;

-- ============================================================================
-- GET PRICE GROUP (helper for ranking)
-- ============================================================================
create or replace function get_price_group(price numeric)
returns text
language plpgsql
as $$
begin
  if price >= 1 and price <= 5 then
    return '$1-$5';
  elsif price >= 6 and price <= 10 then
    return '$6-$10';
  elsif price >= 11 and price <= 20 then
    return '$11-$20';
  elsif price >= 21 and price <= 50 then
    return '$21-$50';
  else
    return 'Other';
  end if;
end;
$$;

-- ============================================================================
-- DAYS UNTIL (helper for ranking)
-- ============================================================================
create or replace function days_until(target_date date)
returns integer
language plpgsql
as $$
begin
  if target_date is null then
    return 180;
  end if;
  return greatest(0, target_date - current_date);
end;
$$;

-- ============================================================================
-- CALCULATE RECOMMENDATION SCORE (ranking algorithm)
-- ============================================================================
create or replace function calculate_recommendation_score(
  p_prizes_remaining integer,
  p_total_prizes integer,
  p_overall_odds text,
  p_price numeric,
  p_top_prize numeric,
  p_end_date date
)
returns integer
language plpgsql
as $$
declare
  prize_availability_score numeric := 0;
  odds_score numeric := 0;
  value_score numeric := 0;
  time_score numeric := 0;
  total_score numeric := 0;
begin
  -- Prize availability (50% weight)
  if p_total_prizes > 0 then
    prize_availability_score := (p_prizes_remaining::numeric / p_total_prizes::numeric) * 50;
  end if;

  -- Odds (25% weight)
  declare
    odds_value numeric := parse_odds(p_overall_odds);
  begin
    if odds_value > 0 then
      odds_score := (1.0 / odds_value) * 100 * 25;
    end if;
  end;

  -- Value (15% weight)
  if p_price > 0 then
    value_score := (p_top_prize / p_price) / 1000 * 15;
  end if;

  -- Time remaining (10% weight)
  declare
    days_left integer := days_until(p_end_date);
  begin
    if days_left <= 0 then
      time_score := 0;
    elsif days_left >= 180 then
      time_score := 10;
    else
      time_score := (days_left::numeric / 180) * 10;
    end if;
  end;

  total_score := prize_availability_score + odds_score + value_score + time_score;
  return least(greatest(round(total_score), 0), 100);
end;
$$;
```

### 3.2 Ranking System

```sql
-- ============================================================================
-- UPDATE GAME RANKS
-- ============================================================================
create or replace function update_game_ranks()
returns void
language plpgsql
as $$
declare
  game_rec record;
  state_price_combo record;
  max_score_per_state record;
  rank_100_count integer;
begin
  -- Step 1: Calculate scores for all games
  update games
  set rank = calculate_recommendation_score(
    top_prizes_remaining,
    total_top_prizes,
    overall_odds,
    price,
    top_prize,
    end_date
  );

  -- Step 2: Assign rank 100 to the SINGLE highest-scoring game per state
  for max_score_per_state in
    select state, max(rank) as max_rank
    from games
    group by state
  loop
    update games
    set rank = 100
    where state = max_score_per_state.state
      and rank = max_score_per_state.max_rank
      and id = (
        select id from games
        where state = max_score_per_state.state
          and rank = max_score_per_state.max_rank
        limit 1
      );
  end loop;

  -- Step 3: Within each state+price group, rank the rest
  for state_price_combo in
    select distinct state, get_price_group(price) as price_group
    from games
  loop
    with ranked_games as (
      select
        id,
        rank,
        row_number() over (order by rank desc, top_prizes_remaining desc) as rn,
        count(*) over () as total_games
      from games
      where state = state_price_combo.state
        and get_price_group(price) = state_price_combo.price_group
        and rank < 100
    )
    update games g
    set rank = case
      when rg.rn = 1 and rg.total_games >= 3 then 99
      when rg.rn = 2 and rg.total_games >= 5 then 98
      else least(greatest(g.rank, 0), 97)
    end
    from ranked_games rg
    where g.id = rg.id;
  end loop;
end;
$$;

-- ============================================================================
-- GET RANKING SUMMARY
-- ============================================================================
create or replace function get_ranking_summary()
returns table (
  state text,
  price_group text,
  rank_100_count bigint,
  rank_99_count bigint,
  rank_98_count bigint,
  total_games bigint,
  avg_rank numeric
)
language plpgsql
as $$
begin
  return query
  select
    g.state,
    get_price_group(g.price) as price_group,
    count(*) filter (where g.rank = 100) as rank_100_count,
    count(*) filter (where g.rank = 99) as rank_99_count,
    count(*) filter (where g.rank = 98) as rank_98_count,
    count(*) as total_games,
    round(avg(g.rank), 1) as avg_rank
  from games g
  group by g.state, get_price_group(g.price)
  order by g.state, price_group;
end;
$$;

-- ============================================================================
-- DELETE GAMES BY STATE
-- ============================================================================
create or replace function delete_games_by_state(p_state text)
returns json
language plpgsql
as $$
declare
  deleted_count integer;
begin
  delete from games where state = p_state;
  get diagnostics deleted_count = row_count;
  
  return json_build_object('deleted_count', deleted_count);
end;
$$;
```

### 3.3 Points & Rewards Functions

```sql
-- ============================================================================
-- CHECK ACTIVITY LIMIT
-- ============================================================================
create or replace function check_activity_limit(
  p_user_id uuid,
  p_activity_name text,
  p_daily_limit integer,
  p_weekly_limit integer
)
returns boolean
language plpgsql
as $$
declare
  daily_count integer;
  weekly_count integer;
begin
  if p_daily_limit is not null then
    select count(*) into daily_count
    from points_history
    where user_id = p_user_id
      and activity_name = p_activity_name
      and created_at >= current_date;
    
    if daily_count >= p_daily_limit then
      return false;
    end if;
  end if;

  if p_weekly_limit is not null then
    select count(*) into weekly_count
    from points_history
    where user_id = p_user_id
      and activity_name = p_activity_name
      and created_at >= date_trunc('week', current_date);
    
    if weekly_count >= p_weekly_limit then
      return false;
    end if;
  end if;

  return true;
end;
$$;

-- ============================================================================
-- AWARD POINTS (core function)
-- ============================================================================
create or replace function award_points(
  p_user_id uuid,
  p_activity_name text,
  p_description text default null
)
returns void
language plpgsql
security definer
as $$
declare
  config_rec record;
  can_award boolean;
begin
  select * into config_rec
  from points_config
  where activity_name = p_activity_name and is_active = true;

  if not found then
    return;
  end if;

  can_award := check_activity_limit(
    p_user_id,
    p_activity_name,
    config_rec.daily_limit,
    config_rec.weekly_limit
  );

  if not can_award then
    return;
  end if;

  insert into user_points (user_id, total_points)
  values (p_user_id, config_rec.points_awarded)
  on conflict (user_id)
  do update set
    total_points = user_points.total_points + config_rec.points_awarded,
    updated_at = now();

  insert into points_history (user_id, activity_name, points_earned, description)
  values (p_user_id, p_activity_name, config_rec.points_awarded, coalesce(p_description, config_rec.display_name));

  if config_rec.instant_fanfare then
    insert into pending_fanfare (user_id, activity_name, points_earned)
    values (p_user_id, p_activity_name, config_rec.points_awarded);
  end if;
end;
$$;

-- ============================================================================
-- SPECIFIC AWARD FUNCTIONS
-- ============================================================================
create or replace function award_points_topic()
returns trigger
language plpgsql
security definer
as $$
begin
  perform award_points(new.user_id, 'forum_topic_create', 'Created topic: ' || new.title);
  return new;
end;
$$;

create or replace function award_points_reply()
returns trigger
language plpgsql
security definer
as $$
declare
  topic_title text;
begin
  select title into topic_title
  from forum_topics
  where id = new.topic_id;

  perform award_points(new.user_id, 'forum_post_create', 'Replied to: ' || topic_title);
  return new;
end;
$$;

create or replace function award_points_win()
returns trigger
language plpgsql
security definer
as $$
declare
  game_name text;
begin
  select g.game_name into game_name
  from games g
  where g.id = new.game_id;

  perform award_points(new.user_id, 'report_win', 'Reported win on: ' || game_name);
  return new;
end;
$$;

create or replace function award_points_upvote()
returns trigger
language plpgsql
security definer
as $$
declare
  topic_owner_id uuid;
begin
  select user_id into topic_owner_id
  from forum_topics
  where id = new.topic_id;

  if topic_owner_id != new.user_id then
    perform award_points(topic_owner_id, 'topic_upvoted', 'Your topic received an upvote');
  end if;

  return new;
end;
$$;

-- ============================================================================
-- GET LEADERBOARD
-- ============================================================================
create or replace function get_leaderboard(p_limit integer default 10)
returns table (
  user_id uuid,
  username text,
  profile_color text,
  total_points integer,
  rank integer
)
language plpgsql
as $$
begin
  return query
  select
    up.user_id,
    u.username,
    u.profile_color,
    up.total_points,
    row_number() over (order by up.total_points desc)::integer as rank
  from user_points up
  join user_profiles u on up.user_id = u.id
  order by up.total_points desc
  limit p_limit;
end;
$$;

-- ============================================================================
-- GET PENDING FANFARE
-- ============================================================================
create or replace function get_pending_fanfare(p_user_id uuid)
returns table (
  activity_name text,
  points_earned integer,
  display_name text
)
language plpgsql
security definer
as $$
begin
  return query
  select
    pf.activity_name,
    pf.points_earned,
    pc.display_name
  from pending_fanfare pf
  join points_config pc on pf.activity_name = pc.activity_name
  where pf.user_id = p_user_id
    and pf.shown = false
  order by pf.created_at;

  update pending_fanfare
  set shown = true
  where user_id = p_user_id
    and shown = false;
end;
$$;
```

### 3.4 Referral Functions

```sql
-- ============================================================================
-- TRACK REFERRAL VISIT
-- ============================================================================
create or replace function track_referral_visit(
  p_referral_code text,
  p_visitor_user_id uuid default null
)
returns json
language plpgsql
as $$
declare
  referrer_id uuid;
begin
  select user_id into referrer_id
  from referral_codes
  where referral_code = p_referral_code;

  if not found then
    return json_build_object('success', false, 'message', 'Invalid referral code');
  end if;

  if p_visitor_user_id is null then
    return json_build_object('success', true, 'message', 'Visit tracked (anonymous)');
  end if;

  if p_visitor_user_id = referrer_id then
    return json_build_object('success', false, 'message', 'Cannot refer yourself');
  end if;

  insert into referrals (referrer_id, referred_user_id, referral_code, is_signup)
  values (referrer_id, p_visitor_user_id, p_referral_code, false)
  on conflict (referrer_id, referred_user_id) do nothing;

  return json_build_object('success', true, 'message', 'Visit tracked');
end;
$$;

-- ============================================================================
-- TRACK REFERRAL SIGNUP
-- ============================================================================
create or replace function track_referral_signup()
returns trigger
language plpgsql
security definer
as $$
declare
  referral_code_param text;
  referrer_id uuid;
begin
  referral_code_param := new.raw_user_meta_data->>'referral_code';
  
  if referral_code_param is null then
    return new;
  end if;

  select user_id into referrer_id
  from referral_codes
  where referral_code = referral_code_param;

  if not found then
    return new;
  end if;

  insert into referrals (referrer_id, referred_user_id, referral_code, is_signup)
  values (referrer_id, new.id, referral_code_param, true)
  on conflict (referrer_id, referred_user_id)
  do update set is_signup = true;

  perform award_points(referrer_id, 'referral_signup', 'Referred a new user');

  return new;
end;
$$;
```

### 3.5 Notification Functions

```sql
-- ============================================================================
-- NOTIFY TOPIC REPLY
-- ============================================================================
create or replace function notify_topic_reply()
returns trigger
language plpgsql
security definer
as $$
declare
  topic_rec record;
  topic_owner_prefs record;
begin
  select t.*, u.username as owner_username
  into topic_rec
  from forum_topics t
  join user_profiles u on t.user_id = u.id
  where t.id = new.topic_id;

  if topic_rec.user_id = new.user_id then
    return new;
  end if;

  select * into topic_owner_prefs
  from notification_preferences
  where user_id = topic_rec.user_id;

  if found and topic_owner_prefs.topic_replies_enabled then
    insert into notifications (user_id, type, title, message, link)
    values (
      topic_rec.user_id,
      'topic_reply',
      'New reply to your topic',
      'Someone replied to "' || topic_rec.title || '"',
      '/hot-topics/' || topic_rec.id
    );
  end if;

  return new;
end;
$$;

-- ============================================================================
-- SEND ANNOUNCEMENT
-- ============================================================================
create or replace function send_announcement(
  p_title text,
  p_message text
)
returns json
language plpgsql
security definer
as $$
declare
  sent_count integer := 0;
  user_rec record;
begin
  for user_rec in
    select up.id
    from user_profiles up
    left join notification_preferences np on up.id = np.user_id
    where coalesce(np.announcements_enabled, true) = true
  loop
    insert into notifications (user_id, type, title, message)
    values (user_rec.id, 'announcement', p_title, p_message);
    sent_count := sent_count + 1;
  end loop;

  return json_build_object('sent_count', sent_count);
end;
$$;
```

### 3.6 User Management Functions

```sql
-- ============================================================================
-- HANDLE NEW USER (trigger on auth.users insert)
-- ============================================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  user_email text;
  user_username text;
begin
  user_email := coalesce(new.email, '');
  user_username := coalesce(
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'full_name',
    split_part(user_email, '@', 1)
  );

  insert into public.user_profiles (id, username, email, role)
  values (
    new.id,
    user_username,
    user_email,
    'user'
  );

  insert into public.referral_codes (user_id, referral_code)
  values (new.id, generate_referral_code());

  insert into public.notification_preferences (user_id)
  values (new.id);

  perform award_points(new.id, 'account_signup', 'Welcome to Scratchpal!');

  return new;
end;
$$;

-- ============================================================================
-- SYNC USER METADATA (trigger on auth.users update)
-- ============================================================================
create or replace function sync_user_metadata()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.user_profiles
  set
    username = coalesce(
      new.raw_user_meta_data->>'username',
      new.raw_user_meta_data->>'full_name',
      username
    ),
    email = coalesce(new.email, email)
  where id = new.id;

  return new;
end;
$$;
```

### 3.7 Topic Upvote Handler

```sql
-- ============================================================================
-- HANDLE TOPIC UPVOTE
-- ============================================================================
create or replace function handle_topic_upvote()
returns trigger
language plpgsql
security definer
as $$
begin
  update forum_topics
  set upvotes = upvotes + 1
  where id = new.topic_id;

  return new;
end;
$$;
```

---

## Step 4: Create Triggers

```sql
-- ============================================================================
-- AUTH TRIGGERS
-- ============================================================================
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function sync_user_metadata();

-- ============================================================================
-- GAME RANKING TRIGGERS
-- ============================================================================
create trigger auto_update_ranks_on_insert
  after insert on public.games
  for each statement execute function trigger_update_game_ranks();

create trigger auto_update_ranks_on_update
  after update on public.games
  for each statement execute function trigger_update_game_ranks();

create trigger auto_update_ranks_on_delete
  after delete on public.games
  for each statement execute function trigger_update_game_ranks();

-- Helper function for triggers
create or replace function trigger_update_game_ranks()
returns trigger
language plpgsql
as $$
begin
  perform update_game_ranks();
  return null;
end;
$$;

-- ============================================================================
-- POINTS TRIGGERS
-- ============================================================================
create trigger trigger_award_points_topic
  after insert on public.forum_topics
  for each row execute function award_points_topic();

create trigger trigger_award_points_reply
  after insert on public.forum_posts
  for each row execute function award_points_reply();

create trigger trigger_award_points_win
  after insert on public.wins
  for each row execute function award_points_win();

-- ============================================================================
-- NOTIFICATION TRIGGERS
-- ============================================================================
create trigger trigger_notify_topic_reply
  after insert on public.forum_posts
  for each row execute function notify_topic_reply();
```

---

## Step 5: Initial Data Setup

### 5.1 State Configuration

```sql
-- Insert US state configurations
insert into public.state_config (state_code, state_name, emoji, display_order, country) values
('AR', 'Arkansas', '🌪️', 1, 'US'),
('AZ', 'Arizona', '🌵', 2, 'US'),
('CA', 'California', '☀️', 3, 'US'),
('FL', 'Florida', '🌴', 4, 'US'),
('GA', 'Georgia', '🍑', 5, 'US'),
('TX', 'Texas', '🤠', 6, 'US');
```

### 5.2 Points Configuration

```sql
-- Insert default points config
insert into public.points_config (activity_name, points_awarded, instant_fanfare, display_name, is_active, daily_limit, weekly_limit) values
('account_signup', 100, true, 'Account Signup', true, null, null),
('forum_topic_create', 10, false, 'Create Forum Topic', true, 5, 20),
('forum_post_create', 5, false, 'Reply to Topic', true, 10, 50),
('topic_upvoted', 2, false, 'Topic Upvoted', true, null, null),
('report_win', 15, true, 'Report a Win', true, 5, 20),
('referral_signup', 50, true, 'Referral Signup', true, null, null),
('daily_login', 5, false, 'Daily Login', true, 1, null);
```

### 5.3 Scanner Configuration

```sql
-- Insert default scanner config
insert into public.scanner_config (config_key, config_value, description) values
('min_confidence_threshold', '0.6', 'Minimum confidence score (0-1) required for ticket matches. Higher = stricter matching.'),
('max_tickets_detected', '20', 'Maximum number of tickets to detect in a single scan. Prevents excessive processing.'),
('fuzzy_match_enabled', 'true', 'Enable fuzzy matching for game numbers (handles leading zeros, spaces, dashes)'),
('ai_model', 'google/gemini-3-flash-preview', 'AI model used for ticket analysis. Options: google/gemini-3-flash-preview, google/gemini-2.5-pro');
```

### 5.4 Default Slider Messages

```sql
-- Insert default slider messages
insert into public.slider_messages (message, transition_type, duration, is_active, display_order) values
('Now available in 6 States📌 including Georgia, Arkansas, Texas and Arizona', 'fade', 5000, true, 1),
('Stop buying tickets with no Top Prizes🏆 remaining!', 'slide', 5000, true, 2),
('Help the Algorithm🎰 keep Algorithming! Tell us about your win!', 'zoom', 5000, true, 3),
('You Win, We All Win. Report Your Win Here!🎯', 'fade', 5000, true, 4),
('Use our ranking system 🟢🟡🟠🔴 to choose your next lucky ticket!', 'slide', 5000, true, 5);
```

---

## Step 6: Supabase Storage Setup

### 6.1 Create Storage Buckets

```sql
-- Create game-images bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'game-images',
  'game-images',
  true,
  10485760, -- 10MB
  array['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'text/csv', 'application/csv']
);

-- Create forum-images bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'forum-images',
  'forum-images',
  true,
  10485760, -- 10MB
  array['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
);
```

### 6.2 Storage RLS Policies

```sql
-- game-images bucket policies
create policy "public_read_game_images"
  on storage.objects for select
  to public
  using (bucket_id = 'game-images');

create policy "authenticated_upload_game_images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'game-images');

create policy "service_role_all_operations_game_images"
  on storage.objects for all
  to service_role
  using (bucket_id = 'game-images')
  with check (bucket_id = 'game-images');

-- forum-images bucket policies
create policy "public_read_forum_images"
  on storage.objects for select
  to public
  using (bucket_id = 'forum-images');

create policy "authenticated_upload_forum_images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'forum-images');

create policy "service_role_all_operations"
  on storage.objects for all
  to service_role
  using (bucket_id = 'forum-images')
  with check (bucket_id = 'forum-images');
```

---

## Step 7: Edge Functions Setup

You'll need to create 4 Edge Functions. Here's the structure:

### 7.1 Shared CORS Helper

Create `supabase/functions/_shared/cors.ts`:

```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

### 7.2 import-csv-data Function

**Purpose:** Import game data from CSV URLs  
**Location:** `supabase/functions/import-csv-data/index.ts`  
**Key Features:**
- Downloads CSV from URL (supports external URLs and Supabase Storage)
- Parses CSV with multiple column name formats
- Batch processing (50 rows at a time)
- Upserts based on (game_number, state, top_prize)
- Logs import results to `import_logs` table
- Automatically triggers ranking update

**See current file for complete implementation**

### 7.3 analyze-tickets Function

**Purpose:** AI-powered ticket scanner  
**Location:** `supabase/functions/analyze-tickets/index.ts`  
**Key Features:**
- Accepts base64 image + state filter
- Uses OnSpace AI (via `ONSPACE_AI_API_KEY` and `ONSPACE_AI_BASE_URL`)
- Fetches scanner config from database
- Matches detected tickets against games database
- Returns JSON with matched games
- Tracks scan usage

**Environment Variables Required:**
- `ONSPACE_AI_API_KEY` (auto-injected by request_self_built_ai tool)
- `ONSPACE_AI_BASE_URL` (auto-injected by request_self_built_ai tool)

### 7.4 convert-game-images Function

**Purpose:** Convert external image URLs to Supabase Storage  
**Location:** `supabase/functions/convert-game-images/index.ts`  
**Key Features:**
- Downloads image from external URL
- Uploads to `game-images` bucket
- Updates game record with new URL
- Sets `image_converted` flag

### 7.5 batch-convert-images Function

**Purpose:** Batch convert multiple game images  
**Location:** `supabase/functions/batch-convert-images/index.ts`  
**Key Features:**
- Finds all games with unconverted images
- Optional state filter
- Processes in parallel (with error handling)
- Returns conversion statistics

---

## Step 8: Authentication Setup

### 8.1 Supabase Auth Configuration

In Supabase Dashboard → Authentication → Settings:

1. **Enable Email/Password Auth**
   - Enable email provider
   - Enable email confirmations (optional)
   - Set minimum password length: 6

2. **Enable Google OAuth** (if needed)
   - Go to Authentication → Providers
   - Enable Google
   - Add OAuth credentials from Google Cloud Console
   - Set redirect URL: `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`

### 8.2 Frontend Auth Configuration

Create `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!,
  {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  }
);
```

Create `.env`:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

---

## Step 9: Frontend Structure

### 9.1 Core Files to Create

**File Structure:**
```
src/
├── components/
│   ├── layout/
│   │   ├── Header.tsx        # Teal gradient header with logo, state selector
│   │   ├── BottomNav.tsx     # 4-button animated navigation
│   │   └── Layout.tsx        # Wraps Header + children + BottomNav
│   ├── GameCard.tsx          # Game thumbnail with badges
│   ├── MessageSlider.tsx     # Auto-rotating announcements
│   ├── Loading.tsx           # Loading spinner
│   ├── Confetti.tsx          # Points celebration animation
│   ├── PointsBadge.tsx       # User points display
│   └── SavedScanCard.tsx     # Scanned ticket history card
├── pages/
│   ├── StateSelection.tsx    # First-time state picker
│   ├── Games.tsx             # Main game listing with filters
│   ├── GameDetail.tsx        # Game details + forum convos
│   ├── HotTopics.tsx         # Discussion forum
│   ├── TopicDetail.tsx       # Single topic + replies
│   ├── Favorites.tsx         # 3-tab favorites page
│   ├── ReportWins.tsx        # Win reporting form
│   ├── ScanTickets.tsx       # AI ticket scanner
│   ├── Profile.tsx           # User profile + settings
│   ├── Admin.tsx             # Admin panel (8 tabs)
│   ├── AdminRewards.tsx      # Points config management
│   ├── AdminStates.tsx       # State config management
│   └── OAuthCallback.tsx     # OAuth redirect handler
├── hooks/
│   ├── useAuth.tsx           # Auth context provider
│   ├── usePoints.tsx         # Points management
│   ├── useUserColor.tsx      # User profile color
│   └── useStateFromUrl.tsx   # URL state parameter
├── stores/
│   └── authStore.ts          # Zustand auth state
├── lib/
│   ├── supabase.ts           # Supabase client
│   ├── auth.ts               # Auth helper functions
│   ├── utils.ts              # Utility functions
│   └── haptics.ts            # Haptic feedback (mobile)
└── types/
    └── index.ts              # TypeScript type definitions
```

### 9.2 Key Component Features

**Header.tsx:**
- Sticky top position, 85px height
- Teal gradient (#00BCD4 to #0097A7)
- Left: Coin icon (46px) → Admin Panel
- Center: Logo → Games page
- Right: State circle (46px, #4DD0E1) → Profile

**BottomNav.tsx:**
- 4 buttons: Games (⚡), Hot Topics (🔥), Favs (❤️), Wins (🏆)
- Animated bounce effect on tap
- Active state: grows 5px + label appears

**GameCard.tsx:**
- Background: Game image
- Top-right diagonal banner: "X / Y 🏆 left"
- Badges (right side, middle-to-bottom):
  - Rank badge (ribbon icon)
  - Favorite badge (heart icon, toggleable)
  - Top prize badge
  - "Share a Win" badge (trophy icon, purple)
  - "Talk About It" badge (bullhorn icon, orange)

---

## Step 10: OnSpace AI Integration

### 10.1 Required Steps

1. **Call `request_self_built_ai` tool** before implementing scanner
2. This auto-injects environment variables in Edge Functions:
   - `ONSPACE_AI_API_KEY`
   - `ONSPACE_AI_BASE_URL`

### 10.2 Scanner Implementation

**Frontend (`ScanTickets.tsx`):**
- File upload or camera capture
- Convert image to base64
- Send to `analyze-tickets` Edge Function
- Display matched tickets

**Edge Function (`analyze-tickets`):**
```typescript
// Get scanner config from database
const { data: config } = await supabase
  .from('scanner_config')
  .select('*');

// Call OnSpace AI
const response = await fetch(`${ONSPACE_AI_BASE_URL}/chat/completions`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ONSPACE_AI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: config.ai_model, // e.g., 'google/gemini-3-flash-preview'
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: TICKET_ANALYSIS_PROMPT },
        { type: 'image_url', image_url: { url: base64Image } }
      ]
    }],
    response_format: { type: 'json_object' }
  })
});

// Match detected tickets against games database
// Apply fuzzy matching if enabled
// Return results
```

---

## Step 11: Environment Variables

### 11.1 Frontend (.env)

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

### 11.2 Edge Functions (auto-configured by Supabase)

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`

### 11.3 OnSpace AI (injected via tool)

- `ONSPACE_AI_API_KEY`
- `ONSPACE_AI_BASE_URL`

---

## Step 12: Admin User Setup

After first user signup, manually promote to admin:

```sql
update public.user_profiles
set role = 'admin'
where email = 'your-email@example.com';
```

---

## Step 13: Testing Checklist

- [ ] User signup (email/password)
- [ ] User signup (Google OAuth)
- [ ] State selection persists
- [ ] Games list loads
- [ ] Game ranking shows correctly
- [ ] Favorites work (games, topics, stores)
- [ ] Forum topic creation
- [ ] Forum replies
- [ ] Topic upvoting
- [ ] Win reporting
- [ ] Ticket scanner (AI)
- [ ] Points system (awards, history, leaderboard)
- [ ] Referral system
- [ ] Notifications
- [ ] Admin panel (all 8 tabs)
- [ ] CSV import
- [ ] Image conversion
- [ ] Slider messages

---

## Step 14: Key Differences from OnSpace Cloud

### What Works Better on Supabase:
✅ **Direct database access** - No 502 gateway errors  
✅ **Full SQL capabilities** - Complex queries, debugging  
✅ **Better logging** - Full Edge Function logs  
✅ **Standard Supabase Storage** - Reliable file uploads  
✅ **Realtime support** - Native Supabase Realtime (if needed)  
✅ **Supabase Dashboard** - Full control over data, auth, storage

### What to Watch Out For:
⚠️ **Edge Function timeouts** - Still limited to 150s (batch imports accordingly)  
⚠️ **Storage limits** - Free tier has 1GB limit  
⚠️ **Database size** - Free tier has 500MB limit

---

## Migration Completion

After completing all steps:

1. **Test all features** against checklist
2. **Import game data** via CSV
3. **Create initial slider messages**
4. **Configure points system** values
5. **Set up Google OAuth** (if needed)
6. **Deploy to production** (Publish in OnSpace)

---

## Support Resources

- **Supabase Docs:** https://supabase.com/docs
- **OnSpace AI Docs:** Available in OnSpace platform
- **React Query Docs:** https://tanstack.com/query/latest
- **Tailwind CSS Docs:** https://tailwindcss.com/docs

---

## Notes for AI Agent

This guide provides complete schema and logic to recreate Scratchpal from scratch. Key implementation details:

1. **Database schema is CRITICAL** - All tables, constraints, RLS policies must match exactly
2. **Ranking algorithm** is complex - Use provided `calculate_recommendation_score` function
3. **Points system** has limits and fanfare logic - Follow trigger/function pattern
4. **Image conversion** has two methods - Server (fast, may fail) and Browser (slow, reliable)
5. **CSV import** uses batch processing - 50 rows at a time to avoid timeouts
6. **Ticket scanner** requires OnSpace AI setup - Call `request_self_built_ai` tool first

**Most Common Gotchas:**
- Forgetting to create RLS policies
- Not setting up triggers (points won't award)
- Missing CORS headers in Edge Functions
- Not handling FunctionsHttpError properly
- Forgetting to call `update_game_ranks()` after data changes
