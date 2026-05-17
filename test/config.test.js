const { expect } = require('chai');
const {
  createValidatedConfig,
  loadConfig,
  validateBackendConfig,
  validateCleverConfig
} = require('../config');

describe('SSO-1 AC1: fail closed on missing config', () => {
  describe('backend API configuration validation', () => {
    it('should reject missing UPGRADE_API_BASE_URL', () => {
      expect(() => validateBackendConfig({
        NODE_ENV: 'development',
        UPGRADE_API_CLIENT_ID: 'test-client',
        UPGRADE_API_CLIENT_SECRET: 'test-secret'
      })).to.throw('UPGRADE_API_BASE_URL is required');
    });

    it('should reject non-HTTPS backend URLs in production', () => {
      expect(() => validateBackendConfig({
        NODE_ENV: 'production',
        UPGRADE_API_BASE_URL: 'http://api.example.com',
        UPGRADE_API_CLIENT_ID: 'test-client',
        UPGRADE_API_CLIENT_SECRET: 'test-secret'
      })).to.throw('HTTPS is required for non-local environments');
    });

    it('should reject loopback lookalike hosts in development', () => {
      expect(() => validateBackendConfig({
        NODE_ENV: 'development',
        UPGRADE_API_BASE_URL: 'http://localhost.attacker.example.com',
        UPGRADE_API_CLIENT_ID: 'test-client',
        UPGRADE_API_CLIENT_SECRET: 'test-secret'
      })).to.throw('UPGRADE_API_BASE_URL must use HTTPS outside loopback development hosts');
    });

    it('should allow loopback HTTP during development', () => {
      expect(() => validateBackendConfig({
        NODE_ENV: 'development',
        UPGRADE_API_BASE_URL: 'http://127.0.0.1:5000',
        UPGRADE_API_CLIENT_ID: 'test-client',
        UPGRADE_API_CLIENT_SECRET: 'test-secret'
      })).to.not.throw();
    });
  });

  describe('Clever OAuth configuration validation', () => {
    it('should reject missing CLEVER_CALLBACK_URL outside local development', () => {
      expect(() => createValidatedConfig({
        NODE_ENV: 'production',
        SESSION_SECRET: 'session-secret',
        UPGRADE_API_BASE_URL: 'https://api.example.com',
        UPGRADE_API_CLIENT_ID: 'test-client',
        UPGRADE_API_CLIENT_SECRET: 'test-secret',
        CLEVER_CLIENT_ID: 'clever-client',
        CLEVER_CLIENT_SECRET: 'clever-secret'
      })).to.throw('CLEVER_CALLBACK_URL is required');
    });

    it('should default the callback URL only for local environments', () => {
      const config = loadConfig({
        NODE_ENV: 'development',
        SESSION_SECRET: 'session-secret',
        UPGRADE_API_BASE_URL: 'http://localhost:5000',
        UPGRADE_API_CLIENT_ID: 'test-client',
        UPGRADE_API_CLIENT_SECRET: 'test-secret',
        CLEVER_CLIENT_ID: 'clever-client',
        CLEVER_CLIENT_SECRET: 'clever-secret'
      });

      expect(config.CLEVER_CALLBACK_URL).to.equal('http://localhost:3000/auth/clever/callback');
    });

    it('should require HTTPS for non-local Clever callback URLs', () => {
      expect(() => validateCleverConfig({
        NODE_ENV: 'production',
        CLEVER_CLIENT_ID: 'test-client',
        CLEVER_CLIENT_SECRET: 'test-secret',
        CLEVER_CALLBACK_URL: 'http://app.example.com/auth/clever/callback'
      })).to.throw('HTTPS is required for non-local environments');
    });

    it('should accept HTTPS callback URLs in production', () => {
      expect(() => validateCleverConfig({
        NODE_ENV: 'production',
        CLEVER_CLIENT_ID: 'test-client',
        CLEVER_CLIENT_SECRET: 'test-secret',
        CLEVER_CALLBACK_URL: 'https://app.example.com/auth/clever/callback'
      })).to.not.throw();
    });
  });
});

describe('SSO-1 AC4: secret-safe validation', () => {
  it('should not expose secrets in validation errors', () => {
    try {
      validateBackendConfig({
        NODE_ENV: 'production',
        UPGRADE_API_BASE_URL: 'http://api.example.com',
        UPGRADE_API_CLIENT_ID: 'secret-client-id-abc123',
        UPGRADE_API_CLIENT_SECRET: 'very-secret-token-xyz789'
      });

      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error.message).to.not.include('secret-client-id');
      expect(error.message).to.not.include('very-secret-token');
      expect(error.message).to.not.include('xyz789');
    }
  });
});
