/**
 * Version Endpoint
 * 
 * Provides deployment metadata including git commit, build timestamp,
 * and version information to verify which version is deployed.
 * 
 * @module routes/version
 */

import express from 'express'

const router = express.Router()

/**
 * GET /api/version
 * Returns deployment metadata
 */
router.get('/', (req, res) => {
  const versionInfo = {
    version: process.env.npm_package_version || '1.0.0',
    gitCommit: process.env.GIT_COMMIT_HASH || 'unknown',
    gitBranch: process.env.GIT_BRANCH || 'unknown',
    buildTimestamp: process.env.BUILD_TIMESTAMP || 'unknown',
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    deployedAt: process.env.DEPLOYED_AT || 'unknown',
    platform: 'fly.io',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }

  res.json(versionInfo)
})

export default router
