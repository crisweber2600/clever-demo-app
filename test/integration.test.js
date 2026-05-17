// test/integration.test.js - SSO-2 Integration Tests

const { expect } = require('chai');

describe('SSO-2 Integration: Full callback flow', () => {
  let mockBackendClient;
  let callbackHandler;

  beforeEach(() => {
    // Reset module cache to get fresh handler
    delete require.cache[require.resolve('../callback-handler')];
    callbackHandler = require('../callback-handler');

    mockBackendClient = {
      createSession: async () => ({}),
      logout: async () => ({ success: true })
    };
  });

  describe('Successful linked flow', () => {
    it('should complete full flow for linked student', async () => {
      const mockReq = {
        user: {
          id: 'clever-123',
          data: { district: 'district-456' }
        },
        session: {},
        logout: (cb) => { mockReq.loggedOut = true; cb(); }
      };

      const mockRes = {
        redirect: function(path) { this.redirectPath = path; },
        render: function(view, data) { this.renderView = view; this.renderData = data; }
      };

      mockBackendClient.createSession = async () => ({
        status: 'linked',
        sessionRef: 'backend-session-xyz',
        displayContext: {
          userName: 'Test Student',
          districtName: 'Demo District',
          role: 'student'
        },
        expiresAt: '2026-05-17T12:00:00Z'
      });

      // Step 1: Handle callback
      await callbackHandler.handleCleverCallback(mockReq, mockRes, mockBackendClient);

      // Verify backend-approved session is stored
      expect(mockReq.session.backendSession).to.exist;
      expect(mockReq.session.backendSession.sessionRef).to.equal('backend-session-xyz');
      expect(mockReq.session.backendSession.displayContext.userName).to.equal('Test Student');

      // Verify no raw Clever tokens stored
      const sessionJson = JSON.stringify(mockReq.session);
      expect(sessionJson).to.not.include('clever-123');

      // Verify redirect to student dashboard
      expect(mockRes.redirectPath).to.equal('/dashboard');

      // Step 2: Handle logout
      mockRes.redirectPath = null;
      mockReq.session.destroy = (cb) => { mockReq.session.destroyed = true; cb(); };

      await callbackHandler.handleLogout(mockReq, mockRes, mockBackendClient);

      // Verify session cleanup
      expect(mockReq.session.destroyed).to.be.true;
      expect(mockReq.loggedOut).to.be.true;
      expect(mockRes.redirectPath).to.equal('/');
    });

    it('should complete full flow for linked district admin', async () => {
      const mockReq = {
        user: {
          id: 'clever-admin-789',
          data: { district: 'district-456' }
        },
        session: {}
      };

      const mockRes = {
        redirect: function(path) { this.redirectPath = path; },
        render: function(view, data) { this.renderView = view; this.renderData = data; }
      };

      mockBackendClient.createSession = async () => ({
        status: 'linked',
        sessionRef: 'backend-session-admin',
        displayContext: {
          userName: 'Admin User',
          districtName: 'Demo District',
          role: 'district_admin'
        },
        expiresAt: '2026-05-17T12:00:00Z'
      });

      await callbackHandler.handleCleverCallback(mockReq, mockRes, mockBackendClient);

      // Verify redirect to admin dashboard
      expect(mockRes.redirectPath).to.equal('/admin');
      expect(mockReq.session.backendSession.displayContext.role).to.equal('district_admin');
    });
  });

  describe('Non-linked flow', () => {
    it('should handle pendingLink without storing session', async () => {
      const mockReq = {
        user: {
          id: 'clever-pending-999',
          data: { district: 'district-789' }
        },
        session: {}
      };

      const mockRes = {
        redirect: function(path) { this.redirectPath = path; },
        render: function(view, data) { this.renderView = view; this.renderData = data; }
      };

      mockBackendClient.createSession = async () => ({
        status: 'pendingLink',
        reasonCode: 'APPROVAL_REQUIRED',
        correlationId: 'corr-pending-123',
        displayContext: {
          message: 'Your account requires approval before linking'
        }
      });

      await callbackHandler.handleCleverCallback(mockReq, mockRes, mockBackendClient);

      // Verify no session stored for pendingLink
      expect(mockReq.session.backendSession).to.not.exist;

      // Verify support-safe status page rendered
      expect(mockRes.renderView).to.equal('auth-status');
      expect(mockRes.renderData.status).to.equal('pendingLink');
      expect(mockRes.renderData.correlationId).to.exist;
    });

    it('should handle blocked without storing session', async () => {
      const mockReq = {
        user: {
          id: 'clever-blocked-888',
          data: { district: 'district-disabled' }
        },
        session: {}
      };

      const mockRes = {
        redirect: function(path) { this.redirectPath = path; },
        render: function(view, data) { this.renderView = view; this.renderData = data; }
      };

      mockBackendClient.createSession = async () => ({
        status: 'blocked',
        reasonCode: 'DISTRICT_DISABLED',
        correlationId: 'corr-blocked-456',
        displayContext: {
          message: 'This district is not enabled for Clever integration'
        }
      });

      await callbackHandler.handleCleverCallback(mockReq, mockRes, mockBackendClient);

      // Verify no session stored for blocked
      expect(mockReq.session.backendSession).to.not.exist;

      // Verify support-safe status page rendered
      expect(mockRes.renderView).to.equal('auth-status');
      expect(mockRes.renderData.status).to.equal('blocked');
      expect(mockRes.renderData.correlationId).to.exist;
    });
  });

  describe('Error handling flow', () => {
    it('should render support-safe error on backend failure', async () => {
      const mockReq = {
        user: {
          id: 'clever-error-777',
          data: { district: 'district-456' }
        },
        session: {}
      };

      const mockRes = {
        redirect: function(path) { this.redirectPath = path; },
        render: function(view, data) { this.renderView = view; this.renderData = data; }
      };

      mockBackendClient.createSession = async () => {
        throw new Error('Connection timeout to internal-db-host-12345.local');
      };

      await callbackHandler.handleCleverCallback(mockReq, mockRes, mockBackendClient);

      // Verify no session stored on error
      expect(mockReq.session.backendSession).to.not.exist;

      // Verify support-safe error page rendered
      expect(mockRes.renderView).to.equal('auth-status');
      expect(mockRes.renderData.status).to.equal('error');
      expect(mockRes.renderData.correlationId).to.exist;

      // Verify no sensitive info leaked
      expect(mockRes.renderData.message).to.not.include('internal-db-host');
      expect(mockRes.renderData.message).to.not.include('12345');
    });
  });

  describe('Session data sanitization', () => {
    it('should never persist raw Clever tokens or auth codes', async () => {
      const mockReq = {
        user: {
          id: 'clever-123',
          accessToken: 'SUPER_SECRET_CLEVER_TOKEN_ABC123',
          refreshToken: 'REFRESH_TOKEN_XYZ789',
          authCode: 'AUTH_CODE_DEF456',
          data: {
            district: 'district-456',
            email: 'user@example.com',
            sis_id: 'sis-secret-id-999'
          }
        },
        session: {}
      };

      const mockRes = {
        redirect: function(path) { this.redirectPath = path; }
      };

      mockBackendClient.createSession = async () => ({
        status: 'linked',
        sessionRef: 'backend-session-safe',
        displayContext: {
          userName: 'Safe User',
          districtName: 'Safe District',
          role: 'student'
        }
      });

      await callbackHandler.handleCleverCallback(mockReq, mockRes, mockBackendClient);

      // Serialize session and verify no sensitive data
      const sessionJson = JSON.stringify(mockReq.session);

      expect(sessionJson).to.not.include('SUPER_SECRET_CLEVER_TOKEN');
      expect(sessionJson).to.not.include('ABC123');
      expect(sessionJson).to.not.include('REFRESH_TOKEN');
      expect(sessionJson).to.not.include('XYZ789');
      expect(sessionJson).to.not.include('AUTH_CODE');
      expect(sessionJson).to.not.include('DEF456');
      expect(sessionJson).to.not.include('sis-secret-id');
      expect(sessionJson).to.not.include('accessToken');
      expect(sessionJson).to.not.include('refreshToken');
      expect(sessionJson).to.not.include('authCode');

      // Verify only backend-approved context is stored
      expect(mockReq.session.backendSession).to.exist;
      expect(mockReq.session.backendSession.sessionRef).to.equal('backend-session-safe');
      expect(mockReq.session.backendSession.displayContext).to.deep.equal({
        userName: 'Safe User',
        districtName: 'Safe District',
        role: 'student'
      });
    });
  });
});
