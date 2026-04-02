const { getGitHubConnection } = require('../services/githubService');
const {
  getProductSetupStatus,
  saveProductSetup,
} = require('../services/productSetupService');
const { setSelectedRepository } = require('../services/githubService');

async function getSetupStatus(req, res) {
  try {
    const status = await getProductSetupStatus(req.user);
    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to load setup status.',
    });
  }
}

async function completeSetup(req, res) {
  try {
    const productName = String(req.body?.productName || '').trim();
    const requestedRepoOwner = String(req.body?.repoOwner || '').trim();
    const requestedRepoName = String(req.body?.repoName || '').trim();

    if (!productName) {
      return res.status(400).json({ error: 'productName is required.' });
    }

    if (Boolean(requestedRepoOwner) !== Boolean(requestedRepoName)) {
      return res.status(400).json({
        error: 'repoOwner and repoName must be provided together.',
      });
    }

    let githubConnection = await getGitHubConnection(req.user.id);

    if (requestedRepoOwner && requestedRepoName) {
      if (!githubConnection) {
        return res.status(400).json({
          error: 'Connect GitHub before selecting a primary repository.',
        });
      }

      await setSelectedRepository(req.user.id, requestedRepoOwner, requestedRepoName);
      githubConnection = await getGitHubConnection(req.user.id);
    }

    const repoOwner =
      requestedRepoOwner ||
      githubConnection?.repoOwner ||
      githubConnection?.metadata?.repo_owner;
    const repoName =
      requestedRepoName ||
      githubConnection?.repoName ||
      githubConnection?.metadata?.repo_name;

    if (!repoOwner || !repoName) {
      return res.status(400).json({
        error: 'Connect GitHub and select a primary repository before continuing.',
      });
    }

    const record = await saveProductSetup(req.user.id, {
      productName,
      repoOwner,
      repoName,
    });

    res.json({
      complete: true,
      productName: record.product_name,
      repository: {
        owner: record.repo_owner,
        name: record.repo_name,
      },
      githubConnected: true,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to complete setup.',
    });
  }
}

module.exports = {
  completeSetup,
  getSetupStatus,
};
