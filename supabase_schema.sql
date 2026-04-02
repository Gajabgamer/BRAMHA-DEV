-- 1. Users Table (Linked to Supabase Auth)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Connected Accounts Table
CREATE TABLE public.connected_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    provider TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expiry TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'connected' NOT NULL,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, provider)
);

ALTER TABLE public.connected_accounts
DROP CONSTRAINT IF EXISTS connected_accounts_provider_check;

ALTER TABLE public.connected_accounts
ADD COLUMN IF NOT EXISTS expiry TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.connected_accounts
ADD CONSTRAINT connected_accounts_provider_check
CHECK (provider IN ('gmail', 'google_calendar', 'outlook', 'github', 'instagram', 'app-reviews', 'google-play', 'imap'));

-- 3. Automatic User Sync Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $body
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$body LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;

-- 5. Real Issues Table
CREATE TABLE IF NOT EXISTS public.issues (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    sources TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
    report_count INTEGER DEFAULT 0 NOT NULL,
    priority TEXT DEFAULT 'LOW' NOT NULL,
    trend TEXT DEFAULT 'stable' NOT NULL,
    trend_percent INTEGER DEFAULT 0 NOT NULL,
    summary TEXT,
    source_breakdown JSONB DEFAULT '{}'::jsonb NOT NULL,
    location_breakdown JSONB DEFAULT '{}'::jsonb NOT NULL,
    suggested_actions TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.issue_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    issue_id UUID REFERENCES public.issues(id) ON DELETE CASCADE NOT NULL,
    text TEXT NOT NULL,
    source TEXT NOT NULL,
    author TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    sentiment TEXT DEFAULT 'neutral' NOT NULL
);

CREATE TABLE IF NOT EXISTS public.issue_timeline (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    issue_id UUID REFERENCES public.issues(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    count INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS public.feedback_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    source TEXT NOT NULL,
    external_id TEXT NOT NULL,
    content_hash TEXT,
    unique_key TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    author TEXT,
    author_email TEXT,
    url TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    sentiment TEXT DEFAULT 'neutral' NOT NULL,
    replied BOOLEAN DEFAULT false NOT NULL,
    location JSONB DEFAULT '{"country":null,"state":null,"confidence":"low"}'::jsonb NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, unique_key)
);

ALTER TABLE public.feedback_events
ADD COLUMN IF NOT EXISTS location JSONB DEFAULT '{"country":null,"state":null,"confidence":"low"}'::jsonb NOT NULL;

ALTER TABLE public.feedback_events
ADD COLUMN IF NOT EXISTS content_hash TEXT;

ALTER TABLE public.feedback_events
ADD COLUMN IF NOT EXISTS unique_key TEXT;

ALTER TABLE public.feedback_events
ADD COLUMN IF NOT EXISTS replied BOOLEAN DEFAULT false NOT NULL;

ALTER TABLE public.feedback_events
ADD COLUMN IF NOT EXISTS author_email TEXT;

CREATE INDEX IF NOT EXISTS idx_feedback_events_content_hash ON public.feedback_events(user_id, content_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_events_unique_key ON public.feedback_events(user_id, unique_key);

ALTER TABLE public.issues
ADD COLUMN IF NOT EXISTS location_breakdown JSONB DEFAULT '{}'::jsonb NOT NULL;

ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'open' NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved')),
    priority TEXT DEFAULT 'medium' NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    linked_issue_id UUID REFERENCES public.issues(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.reminders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'done')),
    linked_issue_id UUID REFERENCES public.issues(id) ON DELETE SET NULL,
    linked_ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON public.reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON public.reminders(remind_at);
CREATE INDEX IF NOT EXISTS idx_reminders_linked_issue_id ON public.reminders(linked_issue_id);
CREATE INDEX IF NOT EXISTS idx_reminders_linked_ticket_id ON public.reminders(linked_ticket_id);

CREATE TABLE IF NOT EXISTS public.agent_settings (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    autonomous_actions_enabled BOOLEAN DEFAULT true NOT NULL,
    last_state TEXT DEFAULT 'idle' NOT NULL,
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_summary TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.agent_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    agent_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    reason TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_user_created_at ON public.agent_actions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' NOT NULL,
    read BOOLEAN DEFAULT false NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);

CREATE TABLE IF NOT EXISTS public.learning_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    issue_type TEXT NOT NULL,
    total_cases INTEGER DEFAULT 0 NOT NULL,
    accepted_count INTEGER DEFAULT 0 NOT NULL,
    rejected_count INTEGER DEFAULT 0 NOT NULL,
    edited_count INTEGER DEFAULT 0 NOT NULL,
    last_confidence DOUBLE PRECISION,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, issue_type)
);

CREATE TABLE IF NOT EXISTS public.issue_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    issue_id UUID REFERENCES public.issues(id) ON DELETE CASCADE NOT NULL,
    frequency_count INTEGER DEFAULT 0 NOT NULL,
    source_count INTEGER DEFAULT 0 NOT NULL,
    similarity_score DOUBLE PRECISION DEFAULT 0.5 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(issue_id)
);

CREATE TABLE IF NOT EXISTS public.agent_memory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('issue', 'action', 'decision', 'chat')),
    content JSONB DEFAULT '{}'::jsonb NOT NULL,
    importance_score DOUBLE PRECISION DEFAULT 0.5 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.github_settings (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    code_insights_enabled BOOLEAN DEFAULT true NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.repo_mappings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    issue_type TEXT NOT NULL,
    repo_owner TEXT NOT NULL,
    repo_name TEXT NOT NULL,
    repo_default_branch TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, issue_type)
);

CREATE INDEX IF NOT EXISTS idx_learning_stats_user_issue_type ON public.learning_stats(user_id, issue_type);
CREATE INDEX IF NOT EXISTS idx_issue_metrics_user_issue ON public.issue_metrics(user_id, issue_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_user_created ON public.agent_memory(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memory_user_importance ON public.agent_memory(user_id, importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_repo_mappings_user_issue_type ON public.repo_mappings(user_id, issue_type);

ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repo_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminders_select_own" ON public.reminders;
CREATE POLICY "reminders_select_own"
ON public.reminders
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reminders_insert_own" ON public.reminders;
CREATE POLICY "reminders_insert_own"
ON public.reminders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reminders_update_own" ON public.reminders;
CREATE POLICY "reminders_update_own"
ON public.reminders
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reminders_delete_own" ON public.reminders;
CREATE POLICY "reminders_delete_own"
ON public.reminders
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "agent_settings_select_own" ON public.agent_settings;
CREATE POLICY "agent_settings_select_own"
ON public.agent_settings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "agent_settings_insert_own" ON public.agent_settings;
CREATE POLICY "agent_settings_insert_own"
ON public.agent_settings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "agent_settings_update_own" ON public.agent_settings;
CREATE POLICY "agent_settings_update_own"
ON public.agent_settings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "agent_actions_select_own" ON public.agent_actions;
CREATE POLICY "agent_actions_select_own"
ON public.agent_actions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "agent_actions_insert_own" ON public.agent_actions;
CREATE POLICY "agent_actions_insert_own"
ON public.agent_actions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
ON public.notifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert_own" ON public.notifications;
CREATE POLICY "notifications_insert_own"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
ON public.notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "learning_stats_select_own" ON public.learning_stats;
CREATE POLICY "learning_stats_select_own"
ON public.learning_stats
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "learning_stats_insert_own" ON public.learning_stats;
CREATE POLICY "learning_stats_insert_own"
ON public.learning_stats
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "learning_stats_update_own" ON public.learning_stats;
CREATE POLICY "learning_stats_update_own"
ON public.learning_stats
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "issue_metrics_select_own" ON public.issue_metrics;
CREATE POLICY "issue_metrics_select_own"
ON public.issue_metrics
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "issue_metrics_insert_own" ON public.issue_metrics;
CREATE POLICY "issue_metrics_insert_own"
ON public.issue_metrics
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "issue_metrics_update_own" ON public.issue_metrics;
CREATE POLICY "issue_metrics_update_own"
ON public.issue_metrics
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "agent_memory_select_own" ON public.agent_memory;
CREATE POLICY "agent_memory_select_own"
ON public.agent_memory
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "agent_memory_insert_own" ON public.agent_memory;
CREATE POLICY "agent_memory_insert_own"
ON public.agent_memory
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "agent_memory_update_own" ON public.agent_memory;
CREATE POLICY "agent_memory_update_own"
ON public.agent_memory
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "agent_memory_delete_own" ON public.agent_memory;
CREATE POLICY "agent_memory_delete_own"
ON public.agent_memory
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "github_settings_select_own" ON public.github_settings;
CREATE POLICY "github_settings_select_own"
ON public.github_settings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "github_settings_insert_own" ON public.github_settings;
CREATE POLICY "github_settings_insert_own"
ON public.github_settings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "github_settings_update_own" ON public.github_settings;
CREATE POLICY "github_settings_update_own"
ON public.github_settings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "repo_mappings_select_own" ON public.repo_mappings;
CREATE POLICY "repo_mappings_select_own"
ON public.repo_mappings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "repo_mappings_insert_own" ON public.repo_mappings;
CREATE POLICY "repo_mappings_insert_own"
ON public.repo_mappings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "repo_mappings_update_own" ON public.repo_mappings;
CREATE POLICY "repo_mappings_update_own"
ON public.repo_mappings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "repo_mappings_delete_own" ON public.repo_mappings;
CREATE POLICY "repo_mappings_delete_own"
ON public.repo_mappings
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.agent_outcomes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    issue_id uuid REFERENCES public.issues(id) ON DELETE SET NULL,
    issue_type text NOT NULL,
    action_type text NOT NULL,
    confidence double precision,
    outcome text NOT NULL,
    repo_owner text,
    repo_name text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_outcomes_user_issue_action
ON public.agent_outcomes(user_id, issue_type, action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_outcomes_user_repo
ON public.agent_outcomes(user_id, repo_owner, repo_name, created_at DESC);

ALTER TABLE public.agent_outcomes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.repo_stats (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    issue_type text NOT NULL,
    repo_owner text NOT NULL,
    repo_name text NOT NULL,
    success_count integer DEFAULT 0 NOT NULL,
    failure_count integer DEFAULT 0 NOT NULL,
    last_used_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, issue_type, repo_owner, repo_name)
);

CREATE INDEX IF NOT EXISTS idx_repo_stats_user_issue_type
ON public.repo_stats(user_id, issue_type, last_used_at DESC);

ALTER TABLE public.repo_stats ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.product_setup (
    user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    product_name text NOT NULL,
    repo_owner text NOT NULL,
    repo_name text NOT NULL,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.product_setup ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.repo_structure (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    repo_owner text NOT NULL,
    repo_name text NOT NULL,
    default_branch text,
    modules jsonb DEFAULT '[]'::jsonb NOT NULL,
    tech_stack jsonb DEFAULT '[]'::jsonb NOT NULL,
    key_files jsonb DEFAULT '[]'::jsonb NOT NULL,
    file_count integer DEFAULT 0 NOT NULL,
    analyzed_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, repo_owner, repo_name)
);

CREATE INDEX IF NOT EXISTS idx_repo_structure_user_repo
ON public.repo_structure(user_id, repo_owner, repo_name);

ALTER TABLE public.repo_structure ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.workspaces (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    slug text UNIQUE NOT NULL,
    invite_code text UNIQUE NOT NULL,
    owner_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    role text DEFAULT 'viewer' NOT NULL,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.issue_assignments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    issue_id uuid REFERENCES public.issues(id) ON DELETE CASCADE NOT NULL,
    assignee_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    assigned_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    status text DEFAULT 'active' NOT NULL,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(workspace_id, issue_id)
);

CREATE TABLE IF NOT EXISTS public.issue_comments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    issue_id uuid REFERENCES public.issues(id) ON DELETE CASCADE NOT NULL,
    author_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    body text NOT NULL,
    is_ai boolean DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.workspace_activity (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    actor_type text DEFAULT 'user' NOT NULL,
    action_type text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    summary text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.approval_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    issue_id uuid REFERENCES public.issues(id) ON DELETE CASCADE,
    requested_by_type text DEFAULT 'agent' NOT NULL,
    requested_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    action_type text NOT NULL,
    status text DEFAULT 'pending' NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    reasoning text,
    resolved_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    resolved_at timestamptz,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user
ON public.workspace_members(user_id, workspace_id);

CREATE INDEX IF NOT EXISTS idx_issue_comments_workspace_issue
ON public.issue_comments(workspace_id, issue_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_activity_workspace_created
ON public.workspace_activity(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_requests_workspace_issue
ON public.approval_requests(workspace_id, issue_id, created_at DESC);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_outcomes_select_own" ON public.agent_outcomes;
CREATE POLICY "agent_outcomes_select_own"
ON public.agent_outcomes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "agent_outcomes_insert_own" ON public.agent_outcomes;
CREATE POLICY "agent_outcomes_insert_own"
ON public.agent_outcomes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "repo_stats_select_own" ON public.repo_stats;
CREATE POLICY "repo_stats_select_own"
ON public.repo_stats
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "repo_stats_insert_own" ON public.repo_stats;
CREATE POLICY "repo_stats_insert_own"
ON public.repo_stats
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "repo_stats_update_own" ON public.repo_stats;
CREATE POLICY "repo_stats_update_own"
ON public.repo_stats
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "product_setup_select_own" ON public.product_setup;
CREATE POLICY "product_setup_select_own"
ON public.product_setup
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "product_setup_insert_own" ON public.product_setup;
CREATE POLICY "product_setup_insert_own"
ON public.product_setup
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "product_setup_update_own" ON public.product_setup;
CREATE POLICY "product_setup_update_own"
ON public.product_setup
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "repo_structure_select_own" ON public.repo_structure;
CREATE POLICY "repo_structure_select_own"
ON public.repo_structure
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "repo_structure_insert_own" ON public.repo_structure;
CREATE POLICY "repo_structure_insert_own"
ON public.repo_structure
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "repo_structure_update_own" ON public.repo_structure;
CREATE POLICY "repo_structure_update_own"
ON public.repo_structure
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "workspaces_select_member" ON public.workspaces;
CREATE POLICY "workspaces_select_member"
ON public.workspaces
FOR SELECT
TO authenticated
USING (
  owner_user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = workspaces.id
      AND wm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "workspaces_insert_owner" ON public.workspaces;
CREATE POLICY "workspaces_insert_owner"
ON public.workspaces
FOR INSERT
TO authenticated
WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "workspace_members_select_member" ON public.workspace_members;
CREATE POLICY "workspace_members_select_member"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "workspace_members_insert_self_or_owner" ON public.workspace_members;
CREATE POLICY "workspace_members_insert_self_or_owner"
ON public.workspace_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.workspaces w
    WHERE w.id = workspace_id
      AND w.owner_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "workspace_members_update_owner_admin" ON public.workspace_members;
CREATE POLICY "workspace_members_update_owner_admin"
ON public.workspace_members
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "issue_assignments_member_access" ON public.issue_assignments;
CREATE POLICY "issue_assignments_member_access"
ON public.issue_assignments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = issue_assignments.workspace_id
      AND wm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = issue_assignments.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin', 'developer')
  )
);

DROP POLICY IF EXISTS "issue_comments_member_access" ON public.issue_comments;
CREATE POLICY "issue_comments_member_access"
ON public.issue_comments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = issue_comments.workspace_id
      AND wm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = issue_comments.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin', 'developer')
  )
);

DROP POLICY IF EXISTS "workspace_activity_member_select" ON public.workspace_activity;
CREATE POLICY "workspace_activity_member_select"
ON public.workspace_activity
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_activity.workspace_id
      AND wm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "workspace_activity_member_insert" ON public.workspace_activity;
CREATE POLICY "workspace_activity_member_insert"
ON public.workspace_activity
FOR INSERT
TO authenticated
WITH CHECK (
  actor_user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_activity.workspace_id
      AND wm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "approval_requests_member_access" ON public.approval_requests;
CREATE POLICY "approval_requests_member_access"
ON public.approval_requests
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = approval_requests.workspace_id
      AND wm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = approval_requests.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin', 'developer')
  )
);

CREATE TABLE IF NOT EXISTS public.job_queue (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    job_type text NOT NULL,
    queue_name text DEFAULT 'maintenance' NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending' NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    dedupe_key text,
    worker_name text,
    scheduled_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    available_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    started_at timestamptz,
    finished_at timestamptz,
    last_error text,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.scheduled_jobs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    job_type text NOT NULL,
    interval_minutes integer NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    last_run_at timestamptz,
    next_run_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, name)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_queue_dedupe_key_active
ON public.job_queue(dedupe_key)
WHERE dedupe_key IS NOT NULL AND status IN ('pending', 'running');

CREATE INDEX IF NOT EXISTS idx_job_queue_status_available
ON public.job_queue(queue_name, status, available_at, priority, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_job_queue_user_created
ON public.job_queue(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_next_run
ON public.scheduled_jobs(enabled, next_run_at);

CREATE TABLE IF NOT EXISTS public.system_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    event_type text NOT NULL,
    queue_name text,
    priority text DEFAULT 'normal' NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_system_events_user_created
ON public.system_events(user_id, created_at DESC);

ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_queue_select_own" ON public.job_queue;
CREATE POLICY "job_queue_select_own"
ON public.job_queue
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "job_queue_insert_own" ON public.job_queue;
CREATE POLICY "job_queue_insert_own"
ON public.job_queue
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "job_queue_update_own" ON public.job_queue;
CREATE POLICY "job_queue_update_own"
ON public.job_queue
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "scheduled_jobs_select_own" ON public.scheduled_jobs;
CREATE POLICY "scheduled_jobs_select_own"
ON public.scheduled_jobs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "scheduled_jobs_insert_own" ON public.scheduled_jobs;
CREATE POLICY "scheduled_jobs_insert_own"
ON public.scheduled_jobs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "scheduled_jobs_update_own" ON public.scheduled_jobs;
CREATE POLICY "scheduled_jobs_update_own"
ON public.scheduled_jobs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "system_events_select_own" ON public.system_events;
CREATE POLICY "system_events_select_own"
ON public.system_events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "system_events_insert_own" ON public.system_events;
CREATE POLICY "system_events_insert_own"
ON public.system_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
