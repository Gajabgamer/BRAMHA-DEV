const {
  getAgentStatus,
  listAgentActions,
  runAgent,
  updateAgentEnabled,
} = require('../services/agentService');

async function getStatus(req, res) {
  try {
    const status = await getAgentStatus(req.user.id);
    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to load agent status.',
    });
  }
}

async function getActions(req, res) {
  try {
    const actions = await listAgentActions(req.user.id, 40);
    res.json(actions);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to load agent actions.',
    });
  }
}

async function updateSettings(req, res) {
  try {
    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean.' });
    }

    const settings = await updateAgentEnabled(req.user.id, enabled);
    res.json({
      enabled: settings.enabled,
      state: settings.state,
      lastRunAt: settings.lastRunAt,
      latestBanner: settings.lastSummary,
      latestAction: null,
      actions: [],
      listening: settings.enabled,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to update agent settings.',
    });
  }
}

async function runNow(req, res) {
  try {
    const result = await runAgent(req.user);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to run agent.',
    });
  }
}

module.exports = {
  getActions,
  getStatus,
  runNow,
  updateSettings,
};
