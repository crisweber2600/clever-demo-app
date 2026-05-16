// test/backend-client.test.js - SSO-1 AC1,AC2: Backend API client credential handling

const { expect } = require('chai');
const { createBackendClient } = require('../backend-client');

describe('SSO-1 AC1,AC2: Backend client integration credential handling', () => {
  describe('Backend client creation', () => {
    it('should fail closed when required config is missing', () => {
      expect(() => createBackendClient({}))
        .to.throw('Backend API configuration validation failed');
    });

    it('should create client with valid config', () => {
      const config = {
        UPGRADE_API_BASE_URL: 'https://api.example.com',
        UPGRADE_API_CLIENT_ID: 'test-client',
        UPGRADE_API_CLIENT_SECRET: 'test-secret',
        UPGRADE_API_TIMEOUT_MS: 5000
      };
      
      const client = createBackendClient(config);
      expect(client).to.exist;
      expect(client.createSession).to.be.a('function');
    });
  });

  describe('Backend client credential authentication', () => {
    it('should include integration credential in request headers', async () => {
      const config = {
        UPGRADE_API_BASE_URL: 'https://api.example.com',
        UPGRADE_API_CLIENT_ID: 'test-client',
        UPGRADE_API_CLIENT_SECRET: 'test-secret',
        UPGRADE_API_TIMEOUT_MS: 5000
      };
      
      const client = createBackendClient(config);
      
      let capturedHeaders = null;
      client._httpClient = {
        post: async (url, data, options) => {
          capturedHeaders = options.headers;
          return {
            data: { status: 'linked', sessionRef: 'test-session' }
          };
        }
      };
      
      await client.createSession({
        userId: 'clever-123',
        districtId: 'district-456'
      });
      
      expect(capturedHeaders).to.exist;
      expect(capturedHeaders['Authorization']).to.exist;
      expect(capturedHeaders['X-Integration-Client-Id']).to.equal('test-client');
    });

    it('should not expose secrets in error messages', async () => {
      const config = {
        UPGRADE_API_BASE_URL: 'https://api.example.com',
        UPGRADE_API_CLIENT_ID: 'client-secret-abc',
        UPGRADE_API_CLIENT_SECRET: 'very-secret-token-xyz',
        UPGRADE_API_TIMEOUT_MS: 5000
      };
      
      const client = createBackendClient(config);
      
      client._httpClient = {
        post: async () => {
          throw new Error('Connection failed');
        }
      };
      
      try {
        await client.createSession({
          userId: 'clever-123',
          districtId: 'district-456'
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.not.include('very-secret-token');
        expect(error.message).to.not.include('client-secret-abc');
      }
    });

    it('should fail closed on network errors', async () => {
      const config = {
        UPGRADE_API_BASE_URL: 'https://api.example.com',
        UPGRADE_API_CLIENT_ID: 'test-client',
        UPGRADE_API_CLIENT_SECRET: 'test-secret',
        UPGRADE_API_TIMEOUT_MS: 5000
      };
      
      const client = createBackendClient(config);
      
      client._httpClient = {
        post: async () => {
          throw new Error('ECONNREFUSED');
        }
      };
      
      try {
        await client.createSession({
          userId: 'clever-123',
          districtId: 'district-456'
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Backend API request failed');
      }
    });

    it('should respect timeout configuration', async () => {
      const config = {
        UPGRADE_API_BASE_URL: 'https://api.example.com',
        UPGRADE_API_CLIENT_ID: 'test-client',
        UPGRADE_API_CLIENT_SECRET: 'test-secret',
        UPGRADE_API_TIMEOUT_MS: 100
      };
      
      const client = createBackendClient(config);
      
      let capturedTimeout = null;
      client._httpClient = {
        post: async (url, data, options) => {
          capturedTimeout = options.timeout;
          return {
            data: { status: 'linked', sessionRef: 'test-session' }
          };
        }
      };
      
      await client.createSession({
        userId: 'clever-123',
        districtId: 'district-456'
      });
      
      expect(capturedTimeout).to.equal(100);
    });
  });

  describe('Backend session creation response', () => {
    it('should return linked status for successful integration', async () => {
      const config = {
        UPGRADE_API_BASE_URL: 'https://api.example.com',
        UPGRADE_API_CLIENT_ID: 'test-client',
        UPGRADE_API_CLIENT_SECRET: 'test-secret',
        UPGRADE_API_TIMEOUT_MS: 5000
      };
      
      const client = createBackendClient(config);
      
      client._httpClient = {
        post: async () => ({
          data: {
            status: 'linked',
            sessionRef: 'backend-session-123',
            displayContext: {
              userName: 'Test User',
              districtName: 'Test District'
            }
          }
        })
      };
      
      const result = await client.createSession({
        userId: 'clever-123',
        districtId: 'district-456'
      });
      
      expect(result.status).to.equal('linked');
      expect(result.sessionRef).to.exist;
    });

    it('should handle pendingLink status', async () => {
      const config = {
        UPGRADE_API_BASE_URL: 'https://api.example.com',
        UPGRADE_API_CLIENT_ID: 'test-client',
        UPGRADE_API_CLIENT_SECRET: 'test-secret',
        UPGRADE_API_TIMEOUT_MS: 5000
      };
      
      const client = createBackendClient(config);
      
      client._httpClient = {
        post: async () => ({
          data: {
            status: 'pendingLink',
            reasonCode: 'APPROVAL_REQUIRED',
            displayContext: {
              message: 'Account linking requires approval'
            }
          }
        })
      };
      
      const result = await client.createSession({
        userId: 'clever-123',
        districtId: 'district-456'
      });
      
      expect(result.status).to.equal('pendingLink');
      expect(result.reasonCode).to.equal('APPROVAL_REQUIRED');
    });

    it('should handle blocked status', async () => {
      const config = {
        UPGRADE_API_BASE_URL: 'https://api.example.com',
        UPGRADE_API_CLIENT_ID: 'test-client',
        UPGRADE_API_CLIENT_SECRET: 'test-secret',
        UPGRADE_API_TIMEOUT_MS: 5000
      };
      
      const client = createBackendClient(config);
      
      client._httpClient = {
        post: async () => ({
          data: {
            status: 'blocked',
            reasonCode: 'DISTRICT_DISABLED',
            displayContext: {
              message: 'District is not enabled for Clever integration'
            }
          }
        })
      };
      
      const result = await client.createSession({
        userId: 'clever-123',
        districtId: 'district-456'
      });
      
      expect(result.status).to.equal('blocked');
      expect(result.reasonCode).to.equal('DISTRICT_DISABLED');
    });
  });
});
