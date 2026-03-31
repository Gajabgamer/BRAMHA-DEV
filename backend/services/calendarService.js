const supabase = require('../lib/supabaseClient');
const { refreshAccessToken } = require('../lib/gmail');

const GOOGLE_CALENDAR_EVENTS_URL =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const GOOGLE_CALENDAR_FREE_BUSY_URL =
  'https://www.googleapis.com/calendar/v3/freeBusy';
const WORKDAY_START_HOUR = 9;
const WORKDAY_END_HOUR = 18;
const DEFAULT_EVENT_DURATION_MINUTES = 30;
const SLOT_STEP_MINUTES = 30;
const DEFAULT_SEARCH_DAYS = 14;

async function getCalendarConnection(userId) {
  const { data, error } = await supabase
    .from('connected_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google_calendar')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function ensureCalendarAccessToken(userId) {
  const connection = await getCalendarConnection(userId);
  if (!connection) {
    return null;
  }

  const expiry = connection.expiry ? new Date(connection.expiry) : null;
  const expiresSoon =
    expiry && !Number.isNaN(expiry.getTime())
      ? expiry.getTime() - Date.now() < 1000 * 60 * 5
      : false;

  if (!connection.refresh_token || !expiresSoon) {
    return connection;
  }

  const refreshed = await refreshAccessToken(connection.refresh_token);
  const nextExpiry = refreshed.expires_in
    ? new Date(Date.now() + Number(refreshed.expires_in) * 1000).toISOString()
    : connection.expiry || null;

  const { data, error } = await supabase
    .from('connected_accounts')
    .update({
      access_token: refreshed.access_token || connection.access_token,
      refresh_token: refreshed.refresh_token || connection.refresh_token,
      expiry: nextExpiry,
      metadata: {
        ...(connection.metadata || {}),
        expiry: nextExpiry,
      },
      status: 'connected',
      last_error: null,
    })
    .eq('id', connection.id)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

function roundUpToNextSlot(date, slotMinutes = SLOT_STEP_MINUTES) {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const minutes = rounded.getMinutes();
  const remainder = minutes % slotMinutes;
  if (remainder !== 0) {
    rounded.setMinutes(minutes + (slotMinutes - remainder));
  }
  return rounded;
}

function getWorkingWindowStart(baseDate) {
  const next = new Date(baseDate);
  next.setHours(WORKDAY_START_HOUR, 0, 0, 0);
  return next;
}

function getWorkingWindowEnd(baseDate) {
  const next = new Date(baseDate);
  next.setHours(WORKDAY_END_HOUR, 0, 0, 0);
  return next;
}

function overlapsBusy(candidateStart, candidateEnd, busyWindows) {
  return busyWindows.some((window) => {
    const busyStart = new Date(window.start).getTime();
    const busyEnd = new Date(window.end).getTime();
    return candidateStart < busyEnd && candidateEnd > busyStart;
  });
}

async function fetchCalendarBusyTimes(userId, options = {}) {
  const connection = await ensureCalendarAccessToken(userId);
  if (!connection) {
    return {
      skipped: true,
      reason: 'Google Calendar is not connected.',
      busy: [],
      connection: null,
    };
  }

  const earliestStart = options.earliestStart
    ? new Date(options.earliestStart)
    : new Date();
  const timeMin = Number.isNaN(earliestStart.getTime())
    ? new Date().toISOString()
    : earliestStart.toISOString();
  const timeMaxDate = new Date(earliestStart);
  timeMaxDate.setDate(timeMaxDate.getDate() + (options.searchDays || DEFAULT_SEARCH_DAYS));
  const timeMax = timeMaxDate.toISOString();

  const response = await fetch(GOOGLE_CALENDAR_FREE_BUSY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${connection.access_token}`,
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: 'primary' }],
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    await supabase
      .from('connected_accounts')
      .update({
        status: 'error',
        last_error: payload?.error?.message || 'Calendar freeBusy lookup failed.',
      })
      .eq('id', connection.id);

    throw new Error(
      payload?.error?.message || 'Failed to fetch Google Calendar availability.'
    );
  }

  return {
    skipped: false,
    reason: null,
    connection,
    busy: payload?.calendars?.primary?.busy || [],
  };
}

async function findFreeSlot(userId, options = {}) {
  const durationMinutes =
    Number(options.durationMinutes) > 0
      ? Number(options.durationMinutes)
      : DEFAULT_EVENT_DURATION_MINUTES;
  const searchDays =
    Number(options.searchDays) > 0 ? Number(options.searchDays) : DEFAULT_SEARCH_DAYS;
  const earliestRequested = options.earliestStart
    ? new Date(options.earliestStart)
    : new Date();

  const busyResult = await fetchCalendarBusyTimes(userId, {
    earliestStart: earliestRequested.toISOString(),
    searchDays,
  });

  if (busyResult.skipped) {
    return {
      skipped: true,
      reason: busyResult.reason,
      startTime: null,
      endTime: null,
    };
  }

  const searchStart = roundUpToNextSlot(earliestRequested);

  for (let dayOffset = 0; dayOffset < searchDays; dayOffset += 1) {
    const day = new Date(searchStart);
    day.setDate(searchStart.getDate() + dayOffset);

    const windowStart = getWorkingWindowStart(day);
    const windowEnd = getWorkingWindowEnd(day);

    let candidateStart =
      dayOffset === 0 && searchStart > windowStart
        ? new Date(searchStart)
        : new Date(windowStart);

    if (candidateStart >= windowEnd) {
      continue;
    }

    candidateStart = roundUpToNextSlot(candidateStart);

    while (candidateStart < windowEnd) {
      const candidateEnd = new Date(
        candidateStart.getTime() + durationMinutes * 60 * 1000
      );

      if (candidateEnd > windowEnd) {
        break;
      }

      if (
        !overlapsBusy(
          candidateStart.getTime(),
          candidateEnd.getTime(),
          busyResult.busy
        )
      ) {
        return {
          skipped: false,
          reason: null,
          startTime: candidateStart.toISOString(),
          endTime: candidateEnd.toISOString(),
        };
      }

      candidateStart = new Date(
        candidateStart.getTime() + SLOT_STEP_MINUTES * 60 * 1000
      );
    }
  }

  return {
    skipped: true,
    reason: 'No free working-hour slot was found in the next two weeks.',
    startTime: null,
    endTime: null,
  };
}

async function createCalendarEvent(userId, event) {
  const connection = await ensureCalendarAccessToken(userId);
  if (!connection) {
    return {
      skipped: true,
      reason: 'Google Calendar is not connected.',
      event: null,
    };
  }

  const response = await fetch(GOOGLE_CALENDAR_EVENTS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${connection.access_token}`,
    },
    body: JSON.stringify({
      summary: event.title,
      description: event.description,
      start: {
        dateTime: event.startTime,
      },
      end: {
        dateTime: event.endTime,
      },
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    await supabase
      .from('connected_accounts')
      .update({
        status: 'error',
        last_error: payload?.error?.message || 'Calendar event creation failed.',
      })
      .eq('id', connection.id);

    throw new Error(
      payload?.error?.message || 'Failed to create Google Calendar event.'
    );
  }

  return {
    skipped: false,
    reason: null,
    event: {
      id: payload.id,
      htmlLink: payload.htmlLink,
      startTime: payload.start?.dateTime || event.startTime,
      endTime: payload.end?.dateTime || event.endTime,
    },
  };
}

module.exports = {
  createCalendarEvent,
  ensureCalendarAccessToken,
  fetchCalendarBusyTimes,
  findFreeSlot,
  getCalendarConnection,
};
