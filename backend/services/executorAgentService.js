async function executePlannerActions({
  userId,
  candidate,
  decision,
  confidence,
  reasoning,
  existingActions,
  openTicketForIssue,
  hasPendingReminder,
  callbacks,
}) {
  const newActions = [];
  let createdTicket = null;

  if (decision.executionMode !== 'auto') {
    return {
      newActions,
      createdTicket,
    };
  }

  if (
    decision.actions.includes('create_ticket') &&
    !openTicketForIssue &&
    !callbacks.hasRecentAction(existingActions, 'ticket_created', candidate.issue.id)
  ) {
    createdTicket = await callbacks.createTicket(userId, candidate, reasoning);
    const action = await callbacks.logAgentAction(
      userId,
      'ticket_created',
      `Created a ticket for ${candidate.issue.title}.`,
      {
        issueId: candidate.issue.id,
        issueType: confidence.issueType,
        ticketId: createdTicket.id,
        severity: candidate.severity,
        confidenceScore: confidence.confidenceScore,
        confidenceLevel: confidence.confidenceLevel,
        confidenceReasoning: confidence.reasoning,
        plannerReasoning: decision.reasoning,
        priorityScore: decision.priorityScore,
        priorityLevel: decision.priority,
        why: candidate.reason,
        reasoning: reasoning.summary,
      }
    );
    newActions.push(action);
    await callbacks.notifyAgentAction(userId, {
      title: `Ticket created for ${candidate.issue.title}`,
      message: `${candidate.userCount} reports are linked to this issue. A ticket has been created automatically.`,
      type: 'ticket',
      metadata: action.metadata,
    });
  }

  if (
    decision.actions.includes('schedule_reminder') &&
    !hasPendingReminder &&
    !callbacks.hasRecentAction(existingActions, 'reminder_created', candidate.issue.id)
  ) {
    const reminder = await callbacks.createReminder(
      userId,
      candidate,
      createdTicket?.id || openTicketForIssue?.id || null,
      reasoning
    );
    const action = await callbacks.logAgentAction(
      userId,
      'reminder_created',
      `Scheduled a follow-up reminder for ${candidate.issue.title}.`,
      {
        issueId: candidate.issue.id,
        issueType: confidence.issueType,
        ticketId: createdTicket?.id || openTicketForIssue?.id || null,
        reminderId: reminder.id,
        severity: candidate.severity,
        confidenceScore: confidence.confidenceScore,
        confidenceLevel: confidence.confidenceLevel,
        confidenceReasoning: confidence.reasoning,
        plannerReasoning: decision.reasoning,
        priorityScore: decision.priorityScore,
        priorityLevel: decision.priority,
        why: candidate.reason,
        reasoning: reasoning.summary,
      }
    );
    newActions.push(action);
    await callbacks.notifyAgentAction(userId, {
      title: `Reminder scheduled for ${candidate.issue.title}`,
      message: 'A follow-up reminder has been scheduled automatically so this issue is not missed.',
      type: 'reminder',
      metadata: action.metadata,
    });
  }

  if (
    decision.actions.includes('notify_user') &&
    !callbacks.hasRecentAction(existingActions, 'predictive_alert', candidate.issue.id)
  ) {
    const action = await callbacks.logAgentAction(
      userId,
      'predictive_alert',
      decision.prediction.prediction,
      {
        issueId: candidate.issue.id,
        issueType: confidence.issueType,
        priorityScore: decision.priorityScore,
        priorityLevel: decision.priority,
        confidenceScore: confidence.confidenceScore,
        confidenceLevel: confidence.confidenceLevel,
        anomaly: decision.anomaly,
        trend: decision.trend,
        prediction: decision.prediction,
      }
    );
    newActions.push(action);
    await callbacks.notifyAgentAction(userId, {
      title: `${candidate.issue.title} is escalating`,
      message: decision.prediction.prediction,
      type: 'prediction',
      metadata: action.metadata,
    });
  }

  if (
    (candidate.severity === 'high' || candidate.severity === 'critical') &&
    decision.actions.includes('schedule_reminder') &&
    !callbacks.hasRecentAction(existingActions, 'calendar_event_created', candidate.issue.id) &&
    !callbacks.hasRecentAction(existingActions, 'calendar_event_skipped', candidate.issue.id)
  ) {
    const calendarResult = await callbacks.createCalendarEvent(
      userId,
      candidate,
      createdTicket?.id || openTicketForIssue?.id || null,
      reasoning
    );

    if (calendarResult.skipped) {
      newActions.push(
        await callbacks.logAgentAction(
          userId,
          'calendar_event_skipped',
          `Skipped calendar event for ${candidate.issue.title}.`,
          {
            issueId: candidate.issue.id,
            issueType: confidence.issueType,
            ticketId: createdTicket?.id || openTicketForIssue?.id || null,
            severity: candidate.severity,
            confidenceScore: confidence.confidenceScore,
            confidenceLevel: confidence.confidenceLevel,
            priorityScore: decision.priorityScore,
            priorityLevel: decision.priority,
            why: candidate.reason,
            reason: calendarResult.reason,
          }
        )
      );
    } else {
      newActions.push(
        await callbacks.logAgentAction(
          userId,
          'calendar_event_created',
          `Scheduled a calendar follow-up for ${candidate.issue.title}.`,
          {
            issueId: candidate.issue.id,
            issueType: confidence.issueType,
            ticketId: createdTicket?.id || openTicketForIssue?.id || null,
            severity: candidate.severity,
            confidenceScore: confidence.confidenceScore,
            confidenceLevel: confidence.confidenceLevel,
            priorityScore: decision.priorityScore,
            priorityLevel: decision.priority,
            why: candidate.reason,
            eventId: calendarResult.event?.id || null,
            eventLink: calendarResult.event?.htmlLink || null,
          }
        )
      );
    }
  }

  return {
    newActions,
    createdTicket,
  };
}

module.exports = {
  executePlannerActions,
};
