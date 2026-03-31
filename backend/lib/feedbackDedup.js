const crypto = require('crypto');
const supabase = require('./supabaseClient');

const CROSS_SOURCE_DUPLICATE_WINDOW_MS = 1000 * 60 * 15;

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTimestamp(value) {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function buildContentHash(record) {
  const title = normalizeText(record.title).toLowerCase();
  const body = normalizeText(record.body).toLowerCase();
  const author = normalizeText(record.author).toLowerCase();
  return sha256([title, body, author].join('|'));
}

function buildUniqueKey(record, externalIdInput = record.external_id) {
  if (externalIdInput) {
    return `${record.source}_${externalIdInput}`;
  }

  return sha256(
    [
      record.source,
      normalizeText(record.body),
      normalizeText(record.author),
      normalizeTimestamp(record.occurred_at),
    ].join('|')
  );
}

function normalizeIncomingData(input) {
  const source = normalizeText(input.source);
  const body = normalizeText(input.body);
  const author = normalizeText(input.author) || 'Unknown';
  const occurredAt = normalizeTimestamp(input.occurred_at);
  const externalIdInput = normalizeText(input.external_id) || null;

  const normalized = {
    ...input,
    source,
    body,
    author,
    occurred_at: occurredAt,
  };

  const uniqueKey = buildUniqueKey(normalized, externalIdInput);
  const externalId =
    externalIdInput || `generated-${uniqueKey.slice(0, 32)}`;

  return {
    ...normalized,
    external_id: externalId,
    content_hash: buildContentHash(normalized),
    unique_key: uniqueKey,
  };
}

function hasRecentContentDuplicate(row, existingRows) {
  const occurredAt = new Date(row.occurred_at).getTime();
  return existingRows.some((existingRow) => {
    const existingTime = new Date(existingRow.occurred_at).getTime();
    return Math.abs(occurredAt - existingTime) <= CROSS_SOURCE_DUPLICATE_WINDOW_MS;
  });
}

async function insertFeedbackEventsDeduped(userId, rows, options = {}) {
  const normalizedRows = rows.map((row) =>
    normalizeIncomingData({
      ...row,
      user_id: userId,
    })
  );

  if (normalizedRows.length === 0) {
    return {
      fetched: 0,
      inserted: 0,
      duplicatesSkipped: 0,
      rows: [],
    };
  }

  const uniqueKeys = normalizedRows.map((row) => row.unique_key);
  const contentHashes = [...new Set(normalizedRows.map((row) => row.content_hash).filter(Boolean))];
  const sourceExternalPairs = normalizedRows
    .filter((row) => row.source && row.external_id)
    .map((row) => ({ source: row.source, external_id: row.external_id }));

  const [existingByKeyResult, existingByHashResult, existingByExternalResult] = await Promise.all([
    supabase
      .from('feedback_events')
      .select('unique_key')
      .eq('user_id', userId)
      .in('unique_key', uniqueKeys),
    contentHashes.length > 0
      ? supabase
          .from('feedback_events')
          .select('content_hash, occurred_at')
          .eq('user_id', userId)
          .in('content_hash', contentHashes)
      : Promise.resolve({ data: [], error: null }),
    sourceExternalPairs.length > 0
      ? supabase
          .from('feedback_events')
          .select('source, external_id')
          .eq('user_id', userId)
          .or(
            sourceExternalPairs
              .map(
                (pair) =>
                  `and(source.eq.${String(pair.source).replace(/,/g, '\\,')},external_id.eq.${String(
                    pair.external_id
                  ).replace(/,/g, '\\,')})`
              )
              .join(',')
          )
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (existingByKeyResult.error) {
    throw existingByKeyResult.error;
  }

  if (existingByHashResult.error) {
    throw existingByHashResult.error;
  }

  if (existingByExternalResult.error) {
    throw existingByExternalResult.error;
  }

  const existingKeys = new Set((existingByKeyResult.data || []).map((row) => row.unique_key));
  const existingSourceExternalKeys = new Set(
    (existingByExternalResult.data || []).map(
      (row) => `${row.source}::${row.external_id}`
    )
  );
  const existingHashes = (existingByHashResult.data || []).reduce((acc, row) => {
    if (!acc.has(row.content_hash)) {
      acc.set(row.content_hash, []);
    }
    acc.get(row.content_hash).push(row);
    return acc;
  }, new Map());

  const rowsToInsert = normalizedRows.filter((row) => {
    if (existingKeys.has(row.unique_key)) {
      return false;
    }

    if (existingSourceExternalKeys.has(`${row.source}::${row.external_id}`)) {
      return false;
    }

    const matchingHashRows = existingHashes.get(row.content_hash) || [];
    if (matchingHashRows.length === 0) {
      return true;
    }

    return !hasRecentContentDuplicate(row, matchingHashRows);
  });

  if (rowsToInsert.length > 0) {
    const { error } = await supabase.from('feedback_events').upsert(rowsToInsert, {
      onConflict: 'user_id,unique_key',
      ignoreDuplicates: true,
    });

    if (error) {
      throw error;
    }
  }

  const duplicatesSkipped = normalizedRows.length - rowsToInsert.length;
  if (options.logLabel) {
    console.info(
      `[dedup:${options.logLabel}] ${normalizedRows.length} fetched, ${rowsToInsert.length} inserted, ${duplicatesSkipped} duplicates skipped`
    );
  }

  return {
    fetched: normalizedRows.length,
    inserted: rowsToInsert.length,
    duplicatesSkipped,
    rows: rowsToInsert,
  };
}

module.exports = {
  insertFeedbackEventsDeduped,
  normalizeIncomingData,
  sha256,
};
