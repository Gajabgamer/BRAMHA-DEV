const supabase = require('../lib/supabaseClient');
const {
  addIssueComment,
  assignIssue,
  createApprovalRequest,
  createWorkspace,
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
} = require('../services/collaborationService');

function normalizeIssue(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    summary: row.summary || '',
    priority: row.priority || 'LOW',
    reportCount: Number(row.report_count || 0),
    trendPercent: Number(row.trend_percent || 0),
    createdAt: row.created_at,
  };
}

async function listWorkspaces(req, res) {
  try {
    const workspaces = await listUserWorkspaces(req.user);
    res.json({
      workspaces,
      activeWorkspace: workspaces[0] || null,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to load workspaces.',
    });
  }
}

async function createWorkspaceHandler(req, res) {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'Workspace name is required.' });
    }

    const workspace = await createWorkspace(req.user, name);
    res.status(201).json({ workspace });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create workspace.',
    });
  }
}

async function joinWorkspaceHandler(req, res) {
  try {
    const inviteCode = String(req.body?.inviteCode || '').trim().toUpperCase();
    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code is required.' });
    }

    const workspace = await joinWorkspace(req.user, inviteCode);
    res.json({ workspace });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to join workspace.',
    });
  }
}

async function updateMemberRole(req, res) {
  try {
    const workspaceId = String(req.body?.workspaceId || '').trim();
    const userId = String(req.body?.userId || '').trim();
    const role = String(req.body?.role || '').trim();

    if (!workspaceId || !userId || !role) {
      return res.status(400).json({
        error: 'workspaceId, userId, and role are required.',
      });
    }

    const context = await resolveWorkspaceContext(req.user, workspaceId);
    if (!['owner', 'admin'].includes(context.role)) {
      return res.status(403).json({ error: 'Only owners and admins can change roles.' });
    }

    const member = await updateWorkspaceMemberRole(workspaceId, userId, role);
    await logWorkspaceActivity(workspaceId, {
      actorUserId: req.user.id,
      actorType: 'user',
      actionType: 'member_role_updated',
      entityType: 'workspace_member',
      entityId: member.id,
      summary: `Updated a teammate role to ${member.role}.`,
      metadata: {
        userId,
        role: member.role,
      },
    });

    res.json({ member });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to update member role.',
    });
  }
}

async function getWorkspaceDashboard(req, res) {
  try {
    const workspaceId = String(req.query.workspaceId || '').trim() || null;
    const context = await resolveWorkspaceContext(req.user, workspaceId);
    const [members, activity, issues, approvals] = await Promise.all([
      listWorkspaceMembers(context.workspace.id),
      listWorkspaceActivity(context.workspace.id),
      listWorkspaceIssues(req.user, context.workspace.id),
      listApprovalRequests(context.workspace.id),
    ]);

    res.json({
      workspace: context.workspace,
      role: context.role,
      members,
      activity,
      approvals,
      issues: issues.issues.map(normalizeIssue),
    });
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Failed to load workspace dashboard.',
    });
  }
}

async function getIssueCollaboration(req, res) {
  try {
    const workspaceId = String(req.query.workspaceId || '').trim() || null;
    const issueId = String(req.params.issueId || '').trim();
    const access = await getAccessibleUserIds(req.user, workspaceId);

    const { data: issue, error } = await supabase
      .from('issues')
      .select('id, user_id, title, summary, priority, report_count, trend_percent, created_at')
      .eq('id', issueId)
      .in('user_id', access.userIds)
      .maybeSingle();

    if (error) throw error;
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found in this workspace.' });
    }

    const [assignments, comments, approvals, activity] = await Promise.all([
      listIssueAssignments(access.workspace.id, issueId),
      listIssueComments(access.workspace.id, issueId),
      listApprovalRequests(access.workspace.id, issueId),
      listWorkspaceActivity(access.workspace.id),
    ]);

    res.json({
      workspace: access.workspace,
      role: access.role,
      issue: normalizeIssue(issue),
      members: access.members,
      assignments,
      comments,
      approvals,
      activity: activity.filter(
        (entry) =>
          entry.entityId === issueId ||
          entry.metadata?.issueId === issueId ||
          entry.metadata?.linkedIssueId === issueId
      ),
    });
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Failed to load issue collaboration.',
    });
  }
}

async function assignIssueHandler(req, res) {
  try {
    const workspaceId = String(req.body?.workspaceId || '').trim();
    const issueId = String(req.body?.issueId || '').trim();
    const assigneeUserId = String(req.body?.assigneeUserId || '').trim();

    if (!workspaceId || !issueId || !assigneeUserId) {
      return res.status(400).json({
        error: 'workspaceId, issueId, and assigneeUserId are required.',
      });
    }

    const context = await resolveWorkspaceContext(req.user, workspaceId);
    if (context.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot assign issues.' });
    }

    const assignment = await assignIssue(
      workspaceId,
      issueId,
      assigneeUserId,
      req.user.id
    );
    await logWorkspaceActivity(workspaceId, {
      actorUserId: req.user.id,
      actorType: 'user',
      actionType: 'issue_assigned',
      entityType: 'issue',
      entityId: issueId,
      summary: 'Assigned an issue to a teammate.',
      metadata: {
        issueId,
        assigneeUserId,
      },
    });

    res.json({ assignment });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to assign issue.',
    });
  }
}

async function addCommentHandler(req, res) {
  try {
    const workspaceId = String(req.body?.workspaceId || '').trim();
    const issueId = String(req.body?.issueId || '').trim();
    const body = String(req.body?.body || '').trim();

    if (!workspaceId || !issueId || !body) {
      return res.status(400).json({
        error: 'workspaceId, issueId, and body are required.',
      });
    }

    const context = await resolveWorkspaceContext(req.user, workspaceId);
    if (context.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot add comments.' });
    }

    const comment = await addIssueComment(workspaceId, issueId, req.user.id, body);
    await logWorkspaceActivity(workspaceId, {
      actorUserId: req.user.id,
      actorType: 'user',
      actionType: 'comment_added',
      entityType: 'issue_comment',
      entityId: comment.id,
      summary: 'Added a comment to an issue discussion.',
      metadata: {
        issueId,
      },
    });

    res.status(201).json({ comment });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to add comment.',
    });
  }
}

async function createApprovalHandler(req, res) {
  try {
    const workspaceId = String(req.body?.workspaceId || '').trim();
    const issueId = String(req.body?.issueId || '').trim();
    const actionType = String(req.body?.actionType || '').trim();
    const reasoning = String(req.body?.reasoning || '').trim();

    if (!workspaceId || !issueId || !actionType) {
      return res.status(400).json({
        error: 'workspaceId, issueId, and actionType are required.',
      });
    }

    const context = await resolveWorkspaceContext(req.user, workspaceId);
    if (context.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot request approvals.' });
    }

    const approval = await createApprovalRequest(workspaceId, {
      issueId,
      requestedByType: 'user',
      requestedByUserId: req.user.id,
      actionType,
      payload: req.body?.payload || {},
      reasoning: reasoning || null,
    });

    await logWorkspaceActivity(workspaceId, {
      actorUserId: req.user.id,
      actorType: 'user',
      actionType: 'approval_requested',
      entityType: 'approval_request',
      entityId: approval.id,
      summary: `Requested approval for ${actionType}.`,
      metadata: {
        issueId,
        actionType,
      },
    });

    res.status(201).json({ approval });
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error ? error.message : 'Failed to create approval request.',
    });
  }
}

async function updateApprovalHandler(req, res) {
  try {
    const status = String(req.body?.status || '').trim().toLowerCase();
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be approved or rejected.' });
    }

    const { data: current, error: fetchError } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!current) {
      return res.status(404).json({ error: 'Approval request not found.' });
    }

    const context = await resolveWorkspaceContext(req.user, current.workspace_id);
    if (context.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot approve actions.' });
    }

    const approval = await resolveApprovalRequest(current.id, req.user.id, status);

    if (status === 'approved') {
      const payload = current.payload || {};
      if (current.action_type === 'create_ticket') {
        const { data: createdTicket } = await supabase
          .from('tickets')
          .insert({
            user_id: req.user.id,
            title: payload.title || 'Team approved ticket',
            description: payload.description || current.reasoning || 'Approved by workspace.',
            priority: payload.priority || 'medium',
            linked_issue_id: current.issue_id || null,
            status: 'open',
            updated_at: new Date().toISOString(),
          })
          .select('*')
          .maybeSingle();

        approval.executedTicketId = createdTicket?.id || null;
      }

      if (current.action_type === 'schedule_reminder') {
        const remindAt =
          payload.remindAt ||
          new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
        const { data: createdReminder } = await supabase
          .from('reminders')
          .insert({
            user_id: req.user.id,
            title: payload.title || 'Team approved reminder',
            description: payload.description || current.reasoning || null,
            remind_at: remindAt,
            linked_issue_id: current.issue_id || null,
            status: 'pending',
            updated_at: new Date().toISOString(),
          })
          .select('*')
          .maybeSingle();

        approval.executedReminderId = createdReminder?.id || null;
      }
    }

    await logWorkspaceActivity(current.workspace_id, {
      actorUserId: req.user.id,
      actorType: 'user',
      actionType: `approval_${status}`,
      entityType: 'approval_request',
      entityId: current.id,
      summary: `${status === 'approved' ? 'Approved' : 'Rejected'} an AI suggestion.`,
      metadata: {
        issueId: current.issue_id,
        actionType: current.action_type,
      },
    });

    res.json({ approval });
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error ? error.message : 'Failed to update approval request.',
    });
  }
}

module.exports = {
  addCommentHandler,
  assignIssueHandler,
  createApprovalHandler,
  createWorkspaceHandler,
  getIssueCollaboration,
  getWorkspaceDashboard,
  joinWorkspaceHandler,
  listWorkspaces,
  updateApprovalHandler,
  updateMemberRole,
};
