const crypto = require('crypto');
const supabase = require('../lib/supabaseClient');

const VALID_ROLES = new Set(['owner', 'admin', 'developer', 'viewer']);
const VALID_APPROVAL_STATUSES = new Set(['pending', 'approved', 'rejected']);

function isMissingRelationError(error) {
  return error?.code === '42P01' || error?.code === '42703';
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function sanitizeRole(role) {
  const normalized = String(role || 'viewer').trim().toLowerCase();
  return VALID_ROLES.has(normalized) ? normalized : 'viewer';
}

function summarizeActivity(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    actorUserId: row.actor_user_id,
    actorType: row.actor_type,
    actionType: row.action_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    summary: row.summary,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

function normalizeWorkspace(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    inviteCode: row.invite_code,
    ownerUserId: row.owner_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeMember(row) {
  const profile =
    row.users ||
    row.profiles || {
      email: null,
      full_name: null,
      avatar_url: null,
    };

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role,
    email: profile.email || null,
    name: profile.full_name || profile.name || profile.email || null,
    avatarUrl: profile.avatar_url || null,
    joinedAt: row.created_at,
  };
}

function normalizeComment(row) {
  const author = row.users || row.profiles || {};
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    issueId: row.issue_id,
    authorUserId: row.author_user_id,
    body: row.body,
    isAi: row.is_ai === true,
    createdAt: row.created_at,
    author: {
      id: row.author_user_id,
      email: author.email || null,
      name: author.full_name || author.name || author.email || (row.is_ai ? 'Product Pulse AI' : 'Teammate'),
      avatarUrl: author.avatar_url || null,
    },
  };
}

function normalizeAssignment(row) {
  const assignee = row.assignee || row.users || row.profiles || {};
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    issueId: row.issue_id,
    assigneeUserId: row.assignee_user_id,
    assignedByUserId: row.assigned_by_user_id,
    status: row.status || 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assignee: row.assignee_user_id
      ? {
          id: row.assignee_user_id,
          email: assignee.email || null,
          name: assignee.full_name || assignee.name || assignee.email || null,
          avatarUrl: assignee.avatar_url || null,
        }
      : null,
  };
}

function normalizeApproval(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    issueId: row.issue_id,
    requestedByType: row.requested_by_type,
    requestedByUserId: row.requested_by_user_id,
    actionType: row.action_type,
    status: row.status,
    payload: row.payload || {},
    reasoning: row.reasoning || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    resolvedByUserId: row.resolved_by_user_id,
  };
}

async function logWorkspaceActivity(workspaceId, input) {
  const payload = {
    workspace_id: workspaceId,
    actor_user_id: input.actorUserId || null,
    actor_type: input.actorType || 'user',
    action_type: input.actionType,
    entity_type: input.entityType,
    entity_id: input.entityId || null,
    summary: input.summary,
    metadata: input.metadata || {},
  };

  const { data, error } = await supabase
    .from('workspace_activity')
    .insert(payload)
    .select('*')
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) {
      return {
        id: `temp-${Date.now()}`,
        workspaceId,
        actorUserId: payload.actor_user_id,
        actorType: payload.actor_type,
        actionType: payload.action_type,
        entityType: payload.entity_type,
        entityId: payload.entity_id,
        summary: payload.summary,
        metadata: payload.metadata,
        createdAt: new Date().toISOString(),
      };
    }
    throw error;
  }

  return summarizeActivity(data);
}

async function getWorkspaceById(workspaceId) {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) return null;
    throw error;
  }

  return data ? normalizeWorkspace(data) : null;
}

async function listUserWorkspaceRows(userId) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('id, workspace_id, user_id, role, created_at, workspaces(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }

  return data || [];
}

async function ensureWorkspaceForUser(user) {
  const memberships = await listUserWorkspaceRows(user.id);
  if (memberships.length > 0) {
    const first = memberships[0];
    return {
      workspace: normalizeWorkspace(first.workspaces),
      role: first.role,
    };
  }

  const timestamp = Date.now().toString(36);
  const baseName =
    user.email?.split('@')[0]?.replace(/[._-]+/g, ' ') || 'Product Pulse Team';
  const workspaceName = `${baseName} workspace`;
  const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();

  const { data: workspaceRow, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({
      name: workspaceName,
      slug: `${slugify(baseName)}-${timestamp}`,
      invite_code: inviteCode,
      owner_user_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (workspaceError) {
    throw workspaceError;
  }

  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspaceRow.id,
      user_id: user.id,
      role: 'owner',
    });

  if (memberError && !isMissingRelationError(memberError)) {
    throw memberError;
  }

  return {
    workspace: normalizeWorkspace(workspaceRow),
    role: 'owner',
  };
}

async function listUserWorkspaces(user) {
  const ensured = await ensureWorkspaceForUser(user);
  const memberships = await listUserWorkspaceRows(user.id);

  const workspaces = memberships.length
    ? memberships.map((row) => ({
        workspace: normalizeWorkspace(row.workspaces),
        role: row.role,
      }))
    : [ensured];

  return workspaces;
}

async function resolveWorkspaceContext(user, workspaceId = null) {
  const workspaces = await listUserWorkspaces(user);
  const selected =
    (workspaceId &&
      workspaces.find((entry) => entry.workspace.id === workspaceId)) ||
    workspaces[0] ||
    null;

  if (!selected) {
    throw new Error('Workspace not found.');
  }

  return selected;
}

async function listWorkspaceMembers(workspaceId) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('id, workspace_id, user_id, role, created_at, users(email)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }

  const members = [];
  for (const row of data || []) {
    members.push(
      normalizeMember({
        ...row,
        users: row.users || {},
      })
    );
  }

  return members;
}

async function createWorkspace(user, name) {
  const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  const { data: workspaceRow, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({
      name,
      slug: `${slugify(name)}-${Date.now().toString(36)}`,
      invite_code: inviteCode,
      owner_user_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (workspaceError) throw workspaceError;

  const { error: memberError } = await supabase.from('workspace_members').insert({
    workspace_id: workspaceRow.id,
    user_id: user.id,
    role: 'owner',
  });
  if (memberError) throw memberError;

  return normalizeWorkspace(workspaceRow);
}

async function joinWorkspace(user, inviteCode) {
  const { data: workspaceRow, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('invite_code', inviteCode)
    .maybeSingle();

  if (error) throw error;
  if (!workspaceRow) {
    throw new Error('Invite code is invalid.');
  }

  const { error: memberError } = await supabase
    .from('workspace_members')
    .upsert(
      {
        workspace_id: workspaceRow.id,
        user_id: user.id,
        role: 'developer',
      },
      { onConflict: 'workspace_id,user_id' }
    );

  if (memberError) throw memberError;

  await logWorkspaceActivity(workspaceRow.id, {
    actorUserId: user.id,
    actorType: 'user',
    actionType: 'member_joined',
    entityType: 'workspace',
    entityId: workspaceRow.id,
    summary: `${user.email || 'A teammate'} joined the workspace.`,
  });

  return normalizeWorkspace(workspaceRow);
}

async function updateWorkspaceMemberRole(workspaceId, targetUserId, role) {
  const nextRole = sanitizeRole(role);
  const { data, error } = await supabase
    .from('workspace_members')
    .update({
      role: nextRole,
    })
    .eq('workspace_id', workspaceId)
    .eq('user_id', targetUserId)
    .select('id, workspace_id, user_id, role, created_at, users(email)')
    .single();

  if (error) throw error;
  return normalizeMember(data);
}

async function getAccessibleUserIds(user, workspaceId = null) {
  try {
    const context = await resolveWorkspaceContext(user, workspaceId);
    const members = await listWorkspaceMembers(context.workspace.id);
    return {
      workspace: context.workspace,
      role: context.role,
      members,
      userIds: members.map((member) => member.userId),
    };
  } catch (error) {
    if (isMissingRelationError(error)) {
      return {
        workspace: null,
        role: 'owner',
        members: [],
        userIds: [user.id],
      };
    }
    throw error;
  }
}

async function listWorkspaceIssues(user, workspaceId = null) {
  const access = await getAccessibleUserIds(user, workspaceId);
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .in('user_id', access.userIds)
    .order('created_at', { ascending: false })
    .limit(40);

  if (error) {
    if (isMissingRelationError(error)) return { ...access, issues: [] };
    throw error;
  }

  return { ...access, issues: data || [] };
}

async function listIssueAssignments(workspaceId, issueId) {
  const { data, error } = await supabase
    .from('issue_assignments')
    .select('id, workspace_id, issue_id, assignee_user_id, assigned_by_user_id, status, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .eq('issue_id', issueId)
    .order('updated_at', { ascending: false });

  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }

  const members = await listWorkspaceMembers(workspaceId);
  const memberMap = new Map(members.map((member) => [member.userId, member]));

  return (data || []).map((row) =>
    normalizeAssignment({
      ...row,
      assignee: row.assignee_user_id ? memberMap.get(row.assignee_user_id) : null,
    })
  );
}

async function assignIssue(workspaceId, issueId, assigneeUserId, assignedByUserId) {
  const { data, error } = await supabase
    .from('issue_assignments')
    .upsert(
      {
        workspace_id: workspaceId,
        issue_id: issueId,
        assignee_user_id: assigneeUserId,
        assigned_by_user_id: assignedByUserId,
        status: 'active',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,issue_id' }
    )
    .select('*')
    .single();

  if (error) throw error;

  return normalizeAssignment(data);
}

async function listIssueComments(workspaceId, issueId) {
  const { data, error } = await supabase
    .from('issue_comments')
    .select('id, workspace_id, issue_id, author_user_id, body, is_ai, created_at, users(email)')
    .eq('workspace_id', workspaceId)
    .eq('issue_id', issueId)
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }

  return (data || []).map(normalizeComment);
}

async function addIssueComment(workspaceId, issueId, authorUserId, body, options = {}) {
  const { data, error } = await supabase
    .from('issue_comments')
    .insert({
      workspace_id: workspaceId,
      issue_id: issueId,
      author_user_id: authorUserId,
      body,
      is_ai: options.isAi === true,
    })
    .select('id, workspace_id, issue_id, author_user_id, body, is_ai, created_at, users(email)')
    .single();

  if (error) throw error;

  return normalizeComment(data);
}

async function listApprovalRequests(workspaceId, issueId = null) {
  let query = supabase
    .from('approval_requests')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (issueId) {
    query = query.eq('issue_id', issueId);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }

  return (data || []).map(normalizeApproval);
}

async function createApprovalRequest(workspaceId, input) {
  const { data, error } = await supabase
    .from('approval_requests')
    .insert({
      workspace_id: workspaceId,
      issue_id: input.issueId || null,
      requested_by_type: input.requestedByType || 'agent',
      requested_by_user_id: input.requestedByUserId || null,
      action_type: input.actionType,
      status: 'pending',
      payload: input.payload || {},
      reasoning: input.reasoning || null,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) throw error;
  return normalizeApproval(data);
}

async function resolveApprovalRequest(approvalId, userId, status) {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  if (!VALID_APPROVAL_STATUSES.has(normalizedStatus) || normalizedStatus === 'pending') {
    throw new Error('Approval status must be approved or rejected.');
  }

  const { data, error } = await supabase
    .from('approval_requests')
    .update({
      status: normalizedStatus,
      resolved_by_user_id: userId,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', approvalId)
    .select('*')
    .single();

  if (error) throw error;
  return normalizeApproval(data);
}

async function listWorkspaceActivity(workspaceId) {
  const { data, error } = await supabase
    .from('workspace_activity')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(40);

  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }

  return (data || []).map(summarizeActivity);
}

module.exports = {
  addIssueComment,
  assignIssue,
  createApprovalRequest,
  createWorkspace,
  ensureWorkspaceForUser,
  getAccessibleUserIds,
  listApprovalRequests,
  listIssueAssignments,
  listIssueComments,
  listUserWorkspaces,
  listWorkspaceActivity,
  listWorkspaceIssues,
  listWorkspaceMembers,
  joinWorkspace,
  logWorkspaceActivity,
  resolveApprovalRequest,
  resolveWorkspaceContext,
  updateWorkspaceMemberRole,
};
