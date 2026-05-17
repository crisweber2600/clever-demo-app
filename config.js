// SSO-1 AC1, AC3, AC4: fail-closed runtime configuration for the demo/backend boundary.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const LOCAL_ENVIRONMENTS = new Set(['development', 'test']);

function normalizeEnvironment(config) {
  return (config.APP_ENV || config.NODE_ENV || 'development').toLowerCase();
}

function isLocalEnvironment(config) {
  return LOCAL_ENVIRONMENTS.has(normalizeEnvironment(config));
}

function parseUrl(value, fieldName) {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${fieldName} must be a valid URL`);
  }
}

function validateRequiredFields(config, requiredFields) {
  for (const field of requiredFields) {
    if (!config[field]) {
      throw new Error(`${field} is required`);
    }
  }
}

function validateTransport(url, fieldName, config) {
  const parsedUrl = parseUrl(url, fieldName);
  const localEnvironment = isLocalEnvironment(config);
  const isLoopbackHost = LOCAL_HOSTS.has(parsedUrl.hostname);

  if (localEnvironment) {
    if (parsedUrl.protocol !== 'https:' && !isLoopbackHost) {
      throw new Error(`${fieldName} must use HTTPS outside loopback development hosts`);
    }

    return;
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('HTTPS is required for non-local environments');
  }
}

function validateBackendConfig(config) {
  validateRequiredFields(config, ['UPGRADE_API_BASE_URL', 'UPGRADE_API_CLIENT_ID', 'UPGRADE_API_CLIENT_SECRET']);
  validateTransport(config.UPGRADE_API_BASE_URL, 'UPGRADE_API_BASE_URL', config);

  return true;
}

function validateCleverConfig(config) {
  validateRequiredFields(config, ['CLEVER_CLIENT_ID', 'CLEVER_CLIENT_SECRET', 'CLEVER_CALLBACK_URL']);
  validateTransport(config.CLEVER_CALLBACK_URL, 'CLEVER_CALLBACK_URL', config);

  return true;
}

function loadConfig(env = process.env) {
  const config = {
    NODE_ENV: env.NODE_ENV,
    APP_ENV: env.APP_ENV,
    UPGRADE_API_BASE_URL: env.UPGRADE_API_BASE_URL,
    UPGRADE_API_CLIENT_ID: env.UPGRADE_API_CLIENT_ID,
    UPGRADE_API_CLIENT_SECRET: env.UPGRADE_API_CLIENT_SECRET,
    UPGRADE_API_TIMEOUT_MS: parseInt(env.UPGRADE_API_TIMEOUT_MS || '5000', 10),
    CLEVER_CLIENT_ID: env.CLEVER_CLIENT_ID,
    CLEVER_CLIENT_SECRET: env.CLEVER_CLIENT_SECRET,
    CLEVER_CALLBACK_URL: env.CLEVER_CALLBACK_URL,
    CLEVER_BACKEND_INTEGRATION_ENABLED: env.CLEVER_BACKEND_INTEGRATION_ENABLED !== 'false',
    SESSION_SECRET: env.SESSION_SECRET
  };

  if (!config.CLEVER_CALLBACK_URL && isLocalEnvironment(config)) {
    config.CLEVER_CALLBACK_URL = 'http://localhost:3000/auth/clever/callback';
  }

  return config;
}

function createValidatedConfig(env = process.env) {
  const config = loadConfig(env);

  validateRequiredFields(config, ['SESSION_SECRET']);
  validateBackendConfig(config);
  validateCleverConfig(config);

  return config;
}

module.exports = {
  createValidatedConfig,
  isLocalEnvironment,
  loadConfig,
  validateBackendConfig,
  validateCleverConfig
};
