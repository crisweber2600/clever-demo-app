// test/config.test.js - SSO-1 AC1,AC4: Config validation and fail-closed behavior

const { expect } = require('chai');
const { validateBackendConfig, validateCleverConfig } = require('../config');

describe('SSO-1 AC1: Fail closed on missing config', () => {
  describe('Backend API configuration validation', () => {
    it('should reject missing UPGRADE_API_BASE_URL', () => {
      const config = {
        UPGRADE_API_CLIENT_ID: 'test-client',
        UPGRADE_API_CLIENT_SECRET: 'test-secret',
        UPGRADE_API_TIMEOUT_MS: 5000
      };
      
      expect(() => validateBackendConfig(config))
        .to.throw('UPGRADE_API_BASE_URL is required');
    });

    it('should reject missing UPGRADE_API_CLIENT_ID', () => {
      const config = {
        UPGRADE_API_BASE_URL: 'https://api.example.com',
        UPGRADE_API_CLIENT_SECRET: 'test-secret',
        UPGRADE_API_TIMEOUT_MS: 5000
      };
      
      expect(() => validateBackendConfig(config))
        .to.throw('UPGRADE_API_CLIENT_ID is required');
    });

    it('should reject missing UPGRADE_API_CLIENT_SECRET', () => {
      const config = {
        UPGRADE_API_BASE_URL: 'https://api.example.com',
        UPGRADE_API_CLIENT_ID: 'test-client',
        UPGRADE_API_TIMEOUT_MS: 5000
      };
      
      expect(() => validateBackendConfig(config))
        .to.throw('UPGRADE_API_CLIENT_SECRET is required');
    });

    it('should require HTTPS for non-local UPGRADE_API_BASE_URL', () => {
      const config = {
        UPGRADE_API_BASE_URL: 'http://production.example.com',
        UPGRADE_API_CLIENT_ID: 'test-client',
        UPGRADE_API_CLIENT_SECRET: 'test-secret',
        UPGRADE_API_TIMEOUT_MS: 5000
      };
      
      expect(() => validateBackendConfig(config))
        .to.throw('HTTPS is required for non-local environments');
    });

    it('should allow http://localhost for local development', () => {
      const config = {
        UPGRADE_API_BASE_URL: 'http://localhost:5000',
        UPGRADE_API_CLIENT_ID: 'test-client',
        UPGRADE_API_CLIENT_SECRET: 'test-secret',
        UPGRADE_API_TIMEOUT_MS: 5000
      };
      
      expect(() => validateBackendConfig(config)).to.not.throw();
    });

    it('should allow http://127.0.0.1 for local development', () => {
      const config = {
        UPGRADE_API_BASE_URL: 'http://127.0.0.1:5000',
        UPGRADE_API_CLIENT_ID: 'test-client',
        UPGRADE_API_CLIENT_SECRET: 'test-secret',
        UPGRADE_API_TIMEOUT_MS: 5000
      };
      
      expect(() => validateBackendConfig(config)).to.not.throw();
    });

    it('should accept valid production config with HTTPS', () => {
      const config = {
        UPGRADE_API_BASE_URL: 'https://api.production.com',
        UPGRADE_API_CLIENT_ID: 'test-client',
        UPGRADE_API_CLIENT_SECRET: 'test-secret',
        UPGRADE_API_TIMEOUT_MS: 5000
      };
      
      expect(() => validateBackendConfig(config)).to.not.throw();
    });
  });

  describe('Clever OAuth configuration validation', () => {
    it('should reject missing CLEVER_CLIENT_ID', () => {
      const config = {
        CLEVER_CLIENT_SECRET: 'test-secret',
        CLEVER_CALLBACK_URL: 'http://localhost:3000/auth/clever/callback'
      };
      
      expect(() => validateCleverConfig(config))
        .to.throw('CLEVER_CLIENT_ID is required');
    });

    it('should reject missing CLEVER_CLIENT_SECRET', () => {
      const config = {
        CLEVER_CLIENT_ID: 'test-client',
        CLEVER_CALLBACK_URL: 'http://localhost:3000/auth/clever/callback'
      };
      
      expect(() => validateCleverConfig(config))
        .to.throw('CLEVER_CLIENT_SECRET is required');
    });

    it('should require HTTPS for non-local CLEVER_CALLBACK_URL', () => {
      const config = {
        CLEVER_CLIENT_ID: 'test-client',
        CLEVER_CLIENT_SECRET: 'test-secret',
        CLEVER_CALLBACK_URL: 'http://production.example.com/auth/clever/callback'
      };
      
      expect(() => validateCleverConfig(config))
        .to.throw('HTTPS is required for non-local environments');
    });

    it('should allow http://localhost callback for local development', () => {
      const config = {
        CLEVER_CLIENT_ID: 'test-client',
        CLEVER_CLIENT_SECRET: 'test-secret',
        CLEVER_CALLBACK_URL: 'http://localhost:3000/auth/clever/callback'
      };
      
      expect(() => validateCleverConfig(config)).to.not.throw();
    });

    it('should accept valid production config with HTTPS callback', () => {
      const config = {
        CLEVER_CLIENT_ID: 'test-client',
        CLEVER_CLIENT_SECRET: 'test-secret',
        CLEVER_CALLBACK_URL: 'https://app.production.com/auth/clever/callback'
      };
      
      expect(() => validateCleverConfig(config)).to.not.throw();
    });
  });
});

describe('SSO-1 AC4: Secret-safe error handling', () => {
  it('should not expose secrets in validation errors', () => {
    const config = {
      UPGRADE_API_BASE_URL: 'http://production.example.com',
      UPGRADE_API_CLIENT_ID: 'secret-client-id-abc123',
      UPGRADE_API_CLIENT_SECRET: 'very-secret-token-xyz789',
      UPGRADE_API_TIMEOUT_MS: 5000
    };
    
    try {
      validateBackendConfig(config);
      expect.fail('Should have thrown error');
    } catch (error) {
      expect(error.message).to.not.include('secret-client-id');
      expect(error.message).to.not.include('very-secret-token');
      expect(error.message).to.not.include('xyz789');
    }
  });

  it('should not log secrets during config validation', () => {
    const logs = [];
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = (...args) => logs.push(args.join(' '));
    console.error = (...args) => logs.push(args.join(' '));
    
    try {
      const config = {
        UPGRADE_API_BASE_URL: 'https://api.example.com',
        UPGRADE_API_CLIENT_ID: 'secret-client',
        UPGRADE_API_CLIENT_SECRET: 'secret-value-12345',
        UPGRADE_API_TIMEOUT_MS: 5000
      };
      
      validateBackendConfig(config);
      
      const allLogs = logs.join(' ');
      expect(allLogs).to.not.include('secret-value-12345');
      expect(allLogs).to.not.include('secret-client');
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }
  });
});
