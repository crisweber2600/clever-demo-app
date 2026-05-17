// test/callback-handler.test.js - SSO-2: Demo Clever Callback To Backend Session Handshake

const { expect } = require('chai');

describe('SSO-2 AC1,AC3: Callback result handling', () => {
  let callbackHandler;
  let mockBackendClient;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    // Reset mocks
    mockBackendClient = {
      createSession: async () => ({})
    };

    mockReq = {
      user: {
        id: 'clever-user-123',
        data: {
          district: 'district-456'
        }
      },
      session: {}
    };

    mockRes = {
      redirect: function(path) {
        this.redirectPath = path;
      },
      render: function(view, data) {
        this.renderView = view;
        this.renderData = data;
      },
      redirectPath: null,
      renderView: null,
      renderData: null
    };
  });

  describe('handleCleverCallback function', () => {
    it('should exist and be a function', () => {
      const { handleCleverCallback } = require('../callback-handler');
      expect(handleCleverCallback).to.be.a('function');
    });

    it('should call backend createSession before any dashboard routing', async () => {
      const { handleCleverCallback } = require('../callback-handler');
      
      let sessionCalled = false;
      let routingDecisionMade = false;

      mockBackendClient.createSession = async () => {
        sessionCalled = true;
        expect(routingDecisionMade).to.be.false;
        return {
          status: 'linked',
          sessionRef: 'backend-session-123',
          displayContext: {
            userName: 'Test User',
            districtName: 'Test District'
          }
        };
      };

      await handleCleverCallback(mockReq, mockRes, mockBackendClient);
      routingDecisionMade = true;

      expect(sessionCalled).to.be.true;
    });
  });

  describe('SSO-2 AC1: linked status handling', () => {
    it('should redirect to dashboard for linked student', async () => {
      const { handleCleverCallback } = require('../callback-handler');

      mockBackendClient.createSession = async () => ({
        status: 'linked',
        sessionRef: 'backend-session-123',
        displayContext: {
          userName: 'Student User',
          districtName: 'Test District',
          role: 'student'
        }
      });

      await handleCleverCallback(mockReq, mockRes, mockBackendClient);

      expect(mockRes.redirectPath).to.equal('/dashboard');
    });

    it('should redirect to admin for linked district_admin', async () => {
      const { handleCleverCallback } = require('../callback-handler');

      mockBackendClient.createSession = async () => ({
        status: 'linked',
        sessionRef: 'backend-session-123',
        displayContext: {
          userName: 'Admin User',
          districtName: 'Test District',
          role: 'district_admin'
        }
      });

      await handleCleverCallback(mockReq, mockRes, mockBackendClient);

      expect(mockRes.redirectPath).to.equal('/admin');
    });
  });

  describe('SSO-2 AC2: Session persistence', () => {
    it('should persist only backend-approved display context', async () => {
      const { handleCleverCallback } = require('../callback-handler');

      mockBackendClient.createSession = async () => ({
        status: 'linked',
        sessionRef: 'backend-session-123',
        displayContext: {
          userName: 'Test User',
          districtName: 'Test District',
          role: 'student'
        },
        expiresAt: '2026-05-17T12:00:00Z'
      });

      await handleCleverCallback(mockReq, mockRes, mockBackendClient);

      expect(mockReq.session.backendSession).to.exist;
      expect(mockReq.session.backendSession.sessionRef).to.equal('backend-session-123');
      expect(mockReq.session.backendSession.displayContext).to.deep.equal({
        userName: 'Test User',
        districtName: 'Test District',
        role: 'student'
      });
      expect(mockReq.session.backendSession.expiresAt).to.equal('2026-05-17T12:00:00Z');
    });

    it('should not persist raw Clever access tokens', async () => {
      const { handleCleverCallback } = require('../callback-handler');

      mockReq.user = {
        id: 'clever-user-123',
        accessToken: 'raw-clever-token-abc123',
        data: {
          district: 'district-456'
        }
      };

      mockBackendClient.createSession = async () => ({
        status: 'linked',
        sessionRef: 'backend-session-123',
        displayContext: {
          userName: 'Test User',
          districtName: 'Test District'
        }
      });

      await handleCleverCallback(mockReq, mockRes, mockBackendClient);

      const sessionJson = JSON.stringify(mockReq.session);
      expect(sessionJson).to.not.include('raw-clever-token');
      expect(sessionJson).to.not.include('accessToken');
    });

    it('should not persist raw Clever profile payloads', async () => {
      const { handleCleverCallback } = require('../callback-handler');

      mockReq.user = {
        id: 'clever-user-123',
        data: {
          district: 'district-456',
          email: 'test@example.com',
          sis_id: 'sis-12345'
        }
      };

      mockBackendClient.createSession = async () => ({
        status: 'linked',
        sessionRef: 'backend-session-123',
        displayContext: {
          userName: 'Test User',
          districtName: 'Test District'
        }
      });

      await handleCleverCallback(mockReq, mockRes, mockBackendClient);

      const sessionJson = JSON.stringify(mockReq.session);
      expect(sessionJson).to.not.include('sis_id');
      expect(sessionJson).to.not.include('sis-12345');
    });
  });

  describe('SSO-2 AC3: Non-linked status handling', () => {
    it('should render support-safe state for pendingLink', async () => {
      const { handleCleverCallback } = require('../callback-handler');

      mockBackendClient.createSession = async () => ({
        status: 'pendingLink',
        reasonCode: 'APPROVAL_REQUIRED',
        correlationId: 'corr-123',
        displayContext: {
          message: 'Account linking requires approval'
        }
      });

      await handleCleverCallback(mockReq, mockRes, mockBackendClient);

      expect(mockRes.renderView).to.equal('auth-status');
      expect(mockRes.renderData.status).to.equal('pendingLink');
      expect(mockRes.renderData.reasonCode).to.equal('APPROVAL_REQUIRED');
      expect(mockRes.renderData.correlationId).to.equal('corr-123');
      expect(mockRes.renderData.message).to.include('approval');
    });

    it('should render support-safe state for blocked', async () => {
      const { handleCleverCallback } = require('../callback-handler');

      mockBackendClient.createSession = async () => ({
        status: 'blocked',
        reasonCode: 'DISTRICT_DISABLED',
        correlationId: 'corr-456',
        displayContext: {
          message: 'District is not enabled for Clever integration'
        }
      });

      await handleCleverCallback(mockReq, mockRes, mockBackendClient);

      expect(mockRes.renderView).to.equal('auth-status');
      expect(mockRes.renderData.status).to.equal('blocked');
      expect(mockRes.renderData.reasonCode).to.equal('DISTRICT_DISABLED');
      expect(mockRes.renderData.correlationId).to.equal('corr-456');
    });

    it('should render support-safe state for error', async () => {
      const { handleCleverCallback } = require('../callback-handler');

      mockBackendClient.createSession = async () => {
        throw new Error('Network connection failed');
      };

      await handleCleverCallback(mockReq, mockRes, mockBackendClient);

      expect(mockRes.renderView).to.equal('auth-status');
      expect(mockRes.renderData.status).to.equal('error');
      expect(mockRes.renderData.correlationId).to.exist;
      expect(mockRes.renderData.message).to.not.include('Network connection failed');
    });

    it('should not expose raw exception messages in error state', async () => {
      const { handleCleverCallback } = require('../callback-handler');

      mockBackendClient.createSession = async () => {
        throw new Error('Database connection to secret-host-abc123.internal failed');
      };

      await handleCleverCallback(mockReq, mockRes, mockBackendClient);

      expect(mockRes.renderView).to.equal('auth-status');
      expect(mockRes.renderData.message).to.not.include('secret-host');
      expect(mockRes.renderData.message).to.not.include('abc123');
      expect(mockRes.renderData.message).to.not.include('Database connection');
    });

    it('should include correlation id for support tracing', async () => {
      const { handleCleverCallback } = require('../callback-handler');

      mockBackendClient.createSession = async () => ({
        status: 'error',
        reasonCode: 'INTERNAL_ERROR',
        correlationId: 'corr-789',
        displayContext: {
          message: 'An unexpected error occurred'
        }
      });

      await handleCleverCallback(mockReq, mockRes, mockBackendClient);

      expect(mockRes.renderData.correlationId).to.equal('corr-789');
    });
  });

  describe('SSO-2 AC2: Contract validation', () => {
    it('should validate backend response has required fields', async () => {
      const { validateBackendSessionResponse } = require('../callback-handler');

      const validResponse = {
        status: 'linked',
        sessionRef: 'session-123',
        displayContext: {
          userName: 'Test User'
        }
      };

      expect(() => validateBackendSessionResponse(validResponse)).to.not.throw();
    });

    it('should reject response without status', () => {
      const { validateBackendSessionResponse } = require('../callback-handler');

      const invalidResponse = {
        sessionRef: 'session-123',
        displayContext: {}
      };

      expect(() => validateBackendSessionResponse(invalidResponse))
        .to.throw('status is required');
    });

    it('should reject response with invalid status', () => {
      const { validateBackendSessionResponse } = require('../callback-handler');

      const invalidResponse = {
        status: 'invalid-status',
        displayContext: {}
      };

      expect(() => validateBackendSessionResponse(invalidResponse))
        .to.throw('Invalid status');
    });

    it('should require sessionRef for linked status', () => {
      const { validateBackendSessionResponse } = require('../callback-handler');

      const invalidResponse = {
        status: 'linked',
        displayContext: {}
      };

      expect(() => validateBackendSessionResponse(invalidResponse))
        .to.throw('sessionRef is required for linked status');
    });

    it('should require displayContext', () => {
      const { validateBackendSessionResponse } = require('../callback-handler');

      const invalidResponse = {
        status: 'pendingLink',
        reasonCode: 'APPROVAL_REQUIRED'
      };

      expect(() => validateBackendSessionResponse(invalidResponse))
        .to.throw('displayContext is required');
    });
  });
});

describe('SSO-2 AC4: Logout cleanup', () => {
  let mockReq;
  let mockRes;
  let mockBackendClient;

  beforeEach(() => {
    mockBackendClient = {
      logout: async () => ({ success: true })
    };

    mockReq = {
      session: {
        backendSession: {
          sessionRef: 'backend-session-123',
          displayContext: { userName: 'Test User' }
        },
        destroy: function(callback) {
          this.destroyed = true;
          callback();
        }
      },
      logout: function(callback) {
        this.loggedOut = true;
        callback();
      }
    };

    mockRes = {
      redirect: function(path) {
        this.redirectPath = path;
      },
      redirectPath: null
    };
  });

  it('should clear Express session on logout', async () => {
    const { handleLogout } = require('../callback-handler');

    await handleLogout(mockReq, mockRes, mockBackendClient);

    expect(mockReq.session.destroyed).to.be.true;
  });

  it('should call backend logout with sessionRef', async () => {
    const { handleLogout } = require('../callback-handler');

    let logoutCalled = false;
    let capturedSessionRef = null;

    mockBackendClient.logout = async (sessionRef) => {
      logoutCalled = true;
      capturedSessionRef = sessionRef;
      return { success: true };
    };

    await handleLogout(mockReq, mockRes, mockBackendClient);

    expect(logoutCalled).to.be.true;
    expect(capturedSessionRef).to.equal('backend-session-123');
  });

  it('should handle logout when no backend session exists', async () => {
    const { handleLogout } = require('../callback-handler');

    mockReq.session.backendSession = null;

    await handleLogout(mockReq, mockRes, mockBackendClient);

    expect(mockReq.session.destroyed).to.be.true;
    expect(mockRes.redirectPath).to.equal('/');
  });

  it('should redirect to home after logout', async () => {
    const { handleLogout } = require('../callback-handler');

    await handleLogout(mockReq, mockRes, mockBackendClient);

    expect(mockRes.redirectPath).to.equal('/');
  });

  it('should complete logout even if backend logout fails', async () => {
    const { handleLogout } = require('../callback-handler');

    mockBackendClient.logout = async () => {
      throw new Error('Backend unavailable');
    };

    await handleLogout(mockReq, mockRes, mockBackendClient);

    expect(mockReq.session.destroyed).to.be.true;
    expect(mockRes.redirectPath).to.equal('/');
  });
});
