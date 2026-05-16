// config.js - Configuration validation for Clever demo app and backend integration
// SSO-1 AC1,AC3,AC4: Fail closed on missing config, HTTPS requirement, secret-safe errors

function validateBackendConfig(config) {
  const required = ['UPGRADE_API_BASE_URL', 'UPGRADE_API_CLIENT_ID', 'UPGRADE_API_CLIENT_SECRET'];
  
  for (const field of required) {
    if (!config[field]) {
      throw new Error(`${field} is required`);
    }
  }
  
  const baseUrl = config.UPGRADE_API_BASE_URL;
  const isLocal = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
  
  if (!isLocal && !baseUrl.startsWith('https://')) {
    throw new Error('HTTPS is required for non-local environments');
  }
  
  return true;
}

function validateCleverConfig(config) {
  const required = ['CLEVER_CLIENT_ID', 'CLEVER_CLIENT_SECRET'];
  
  for (const field of required) {
    if (!config[field]) {
      throw new Error(`${field} is required`);
    }
  }
  
  if (config.CLEVER_CALLBACK_URL) {
    const callbackUrl = config.CLEVER_CALLBACK_URL;
    const isLocal = callbackUrl.includes('localhost') || callbackUrl.includes('127.0.0.1');
    
    if (!isLocal && !callbackUrl.startsWith('https://')) {
      throw new Error('HTTPS is required for non-local environments');
    }
  }
  
  return true;
}

function loadConfig() {
  const config = {
    UPGRADE_API_BASE_URL: process.env.UPGRADE_API_BASE_URL,
    UPGRADE_API_CLIENT_ID: process.env.UPGRADE_API_CLIENT_ID,
    UPGRADE_API_CLIENT_SECRET: process.env.UPGRADE_API_CLIENT_SECRET,
    UPGRADE_API_TIMEOUT_MS: parseInt(process.env.UPGRADE_API_TIMEOUT_MS || '5000', 10),
    CLEVER_CLIENT_ID: process.env.CLEVER_CLIENT_ID,
    CLEVER_CLIENT_SECRET: process.env.CLEVER_CLIENT_SECRET,
    CLEVER_CALLBACK_URL: process.env.CLEVER_CALLBACK_URL || 'http://localhost:3000/auth/clever/callback',
    SESSION_SECRET: process.env.SESSION_SECRET
  };
  
  return config;
}

module.exports = {
  validateBackendConfig,
  validateCleverConfig,
  loadConfig
};
