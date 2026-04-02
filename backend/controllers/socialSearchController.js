const supabase = require('../lib/supabaseClient');
const { insertFeedbackEventsDeduped } = require('../lib/feedbackDedup');
const { ensureUserRecords } = require('../lib/ensureUserRecords');
const { rebuildIssuesFromFeedback, detectSentiment } = require('../lib/issueAggregator');
const { classifyFeedbackEvents } = require('../lib/groqFeedbackClassifier');
const { extractLocation } = require('../services/locationService');
const { searchSocialMentions } = require('../services/googleSearchService');
const { runAgent } = require('../services/agentService');

async function fetchSocialMentions(req, res) {
  try {
    await ensureUserRecords(req.user);

    const query = String(req.body?.query || '').trim();

    if (!query) {
      return res.status(400).json({ error: 'query is required.' });
    }

    const mentions = await searchSocialMentions(query);

    if (mentions.length === 0) {
      return res.status(404).json({ error: 'No social mentions found for this query.' });
    }

    const candidates = mentions.map((mention) => ({
      externalId: mention.externalId,
      title: mention.title,
      body: mention.body,
      snippet: mention.body,
      occurredAt: mention.occurredAt,
      metadata: mention.metadata,
    }));

    const classifications = await classifyFeedbackEvents(candidates, {
      source: 'social_search',
      userId: req.user.id,
      query,
    });
    const classificationById = new Map(
      classifications.map((classification) => [classification.externalId, classification])
    );
    const shortlistedMentions = mentions.filter(
      (mention) => classificationById.get(mention.externalId)?.include
    );

    if (shortlistedMentions.length === 0) {
      return res.status(404).json({
        error: 'No relevant social mentions matched your keywords after filtering.',
      });
    }

    const rows = shortlistedMentions
      .map((mention) => {
        const classification = classificationById.get(mention.externalId);

        return {
          user_id: req.user.id,
          source: 'social_search',
          external_id: mention.externalId,
          title: mention.title,
          body: mention.body,
          author: mention.author,
          url: mention.metadata.url,
          occurred_at: mention.occurredAt,
          sentiment:
            classification?.sentiment ||
            detectSentiment(`${mention.title} ${mention.body}`),
          location: extractLocation({
            source: 'social_search',
            title: mention.title,
            body: mention.body,
            author: mention.author,
            metadata: mention.metadata,
          }),
          metadata: {
            ...mention.metadata,
            query,
            classificationReason: classification?.reason || null,
            isProductFeedback: true,
          },
        };
      });

    const insertResult = await insertFeedbackEventsDeduped(req.user.id, rows, {
      logLabel: 'social_search',
    });

    if (insertResult.inserted > 0) {
      await rebuildIssuesFromFeedback(req.user.id);
      await runAgent(req.user);
    }

    return res.json({
      success: true,
      fetched: mentions.length,
      count: insertResult.inserted,
      duplicatesSkipped: insertResult.duplicatesSkipped,
      filteredOut: mentions.length - shortlistedMentions.length,
      mentions: shortlistedMentions.map((mention) => ({
        title: mention.title,
        snippet: mention.body,
        platform: mention.metadata.platform,
        link: mention.metadata.url,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to fetch social mentions.';

    if (message.toLowerCase().includes('rate-limited')) {
      return res.status(429).json({
        error: message,
      });
    }

    return res.status(500).json({
      error: message,
    });
  }
}

module.exports = {
  fetchSocialMentions,
};
