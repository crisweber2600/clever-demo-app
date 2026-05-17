const { expect } = require('chai');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

const { createBackendClient } = require('../backend-client');
const { handleCleverCallback, handleLogout } = require('../callback-handler');
const { buildDashboardLinkStatus, toSafeAuthStatusViewModel } = require('../link-status');

const dashboardTemplate = fs.readFileSync(path.join(__dirname, '..', 'views', 'dashboard.ejs'), 'utf8');
const authStatusTemplate = fs.readFileSync(path.join(__dirname, '..', 'views', 'auth-status.ejs'), 'utf8');

function renderDashboard(linkStatus) {
  return ejs.render(dashboardTemplate, {
    user: { name: 'Sandbox User' },
    dbUser: { name: 'Sandbox User' },
    roles: ['student'],
    activeRole: 'student',
    role: 'student',
    PrettyRole: 'Student',
    userSchools: [{ cleverId: 'school-1', name: 'Sandbox School' }],
    classes: [{ name: 'Sandbox Homeroom', schoolName: 'Sandbox School' }],
    linkStatus
  });
}

function createCallbackRequest(role, districtId = 'clever-district-a') {
  return {
    user: {
      id: `clever-${role}-1`,
      token: `access-token-${role}`,
      email: `${role}@sandbox.example`,
      data: {
        id: `clever-user-${role}-1`,
        district: districtId,
        type: role,
        email: `${role}@sandbox.example`
      },
      name: { first: 'Sandbox', last: role }
    },
    session: {}
  };
}

function createResponse() {
  return {
    redirectPath: null,
    renderView: null,
    renderData: null,
    redirect(path) {
      this.redirectPath = path;
    },
    render(view, data) {
      this.renderView = view;
      this.renderData = data;
    }
  };
}

describe('SSO-7 Certification Evidence, Rollout Controls, And Fallback', () => {
  it('Given supported sandbox user types, when certification login runs through the demo app, then backend-approved outcomes route by support policy', async () => {
    const cases = [
      { role: 'district_admin', expectedRoute: '/admin' },
      { role: 'school_admin', expectedRoute: '/admin' },
      { role: 'teacher', expectedRoute: '/dashboard' },
      { role: 'student', expectedRoute: '/dashboard' }
    ];

    for (const certificationCase of cases) {
      const req = createCallbackRequest(certificationCase.role);
      const res = createResponse();
      const backendClient = {
        createSession: async (payload) => {
          expect(payload.accessToken).to.equal(`access-token-${certificationCase.role}`);
          expect(payload.districtId).to.equal('clever-district-a');
          expect(payload.userType).to.equal(certificationCase.role);

          return {
            status: 'linked',
            sessionRef: `session-${certificationCase.role}`,
            displayContext: {
              userName: `Sandbox ${certificationCase.role}`,
              districtName: 'NorthStar District A',
              districtId: '100',
              role: certificationCase.role
            },
            expiresAt: '2026-05-17T12:00:00Z'
          };
        }
      };

      await handleCleverCallback(req, res, backendClient);

      expect(res.redirectPath).to.equal(certificationCase.expectedRoute);
      expect(req.session.backendSession.displayContext.role).to.equal(certificationCase.role);
      expect(req.session.backendSession.displayContext.districtId).to.equal('100');
    }
  });

  it('Given desktop browser coverage is required, when login, link-status, blocked-state, and logout flows render, then support-safe screens pass', async () => {
    const dashboardHtml = renderDashboard(buildDashboardLinkStatus({
      sessionRef: 'backend-session-browser',
      displayContext: {
        userName: 'Browser Test User',
        districtName: 'NorthStar Browser District',
        districtId: '200',
        role: 'student'
      }
    }));

    expect(dashboardHtml).to.include('name="viewport"');
    expect(dashboardHtml).to.include('NorthStar Account Context');
    expect(dashboardHtml).to.include('Browser Test User');
    expect(dashboardHtml).to.include('NorthStar Browser District');

    const blockedHtml = ejs.render(authStatusTemplate, toSafeAuthStatusViewModel({
      status: 'blocked',
      reasonCode: 'DISTRICT_NOT_MAPPED',
      correlationId: 'corr-browser-blocked',
      displayContext: { message: 'raw token should not appear' }
    }));

    expect(blockedHtml).to.include('Access Not Available');
    expect(blockedHtml).to.include('corr-browser-blocked');
    expect(blockedHtml).to.not.include('raw token');

    const req = {
      session: {
        backendSession: { sessionRef: 'backend-session-browser' },
        destroy(callback) {
          this.destroyed = true;
          callback();
        }
      },
      logout(callback) {
        this.loggedOut = true;
        callback();
      }
    };
    const res = createResponse();
    let logoutCalled = false;

    await handleLogout(req, res, {
      logout: async (sessionRef) => {
        logoutCalled = sessionRef === 'backend-session-browser';
        return { success: true };
      }
    });

    expect(logoutCalled).to.equal(true);
    expect(req.session.destroyed).to.equal(true);
    expect(res.redirectPath).to.equal('/');
  });

  it('Given a mapped district user, when backend context is approved, then the demo uses the selected NorthStar district context', async () => {
    const req = createCallbackRequest('teacher', 'clever-district-b');
    const res = createResponse();

    await handleCleverCallback(req, res, {
      createSession: async () => ({
        status: 'linked',
        sessionRef: 'session-district-b',
        displayContext: {
          userName: 'Mapped Teacher',
          districtName: 'NorthStar District B',
          districtId: '300',
          role: 'teacher'
        }
      })
    });

    const linkStatus = buildDashboardLinkStatus(req.session.backendSession);

    expect(linkStatus.northstarDistrictName).to.equal('NorthStar District B');
    expect(linkStatus.northstarDistrictId).to.equal('300');
  });

  it('Given rollout disables the backend feature flag, when demo integration is used, then no backend calls are made and local link evidence is preserved', async () => {
    const client = createBackendClient({
      NODE_ENV: 'test',
      UPGRADE_API_BASE_URL: 'https://api.example.com',
      UPGRADE_API_CLIENT_ID: 'test-client',
      UPGRADE_API_CLIENT_SECRET: 'test-secret',
      CLEVER_BACKEND_INTEGRATION_ENABLED: false
    });

    const preservedLinkEvidence = [{ cleverUserId: 'clever-student-1', linkStatus: 'active' }];
    let postCalls = 0;
    let deleteCalls = 0;

    client._httpClient = {
      post: async () => {
        postCalls += 1;
        throw new Error('disabled client should not post');
      },
      delete: async () => {
        deleteCalls += 1;
        throw new Error('disabled client should not delete');
      }
    };

    const sessionResult = await client.createSession({ userId: 'clever-student-1' });
    const logoutResult = await client.logout('backend-session-disabled');

    expect(sessionResult.status).to.equal('blocked');
    expect(sessionResult.reasonCode).to.equal('INTEGRATION_DISABLED');
    expect(logoutResult.skipped).to.equal(true);
    expect(postCalls).to.equal(0);
    expect(deleteCalls).to.equal(0);
    expect(preservedLinkEvidence).to.deep.equal([{ cleverUserId: 'clever-student-1', linkStatus: 'active' }]);
  });

  it('Given backend certification returns a success contract, when the demo client receives it, then it normalizes the outcome for login handling', async () => {
    const client = createBackendClient({
      NODE_ENV: 'test',
      UPGRADE_API_BASE_URL: 'https://api.example.com',
      UPGRADE_API_CLIENT_ID: 'test-client',
      UPGRADE_API_CLIENT_SECRET: 'test-secret'
    });

    client._httpClient = {
      post: async () => ({
        data: {
          status: 'success',
          sessionRef: 'backend-session-123',
          displayContext: {
            userName: 'Backend Approved Teacher',
            districtName: 'NorthStar District A',
            role: 'teacher'
          }
        }
      })
    };

    const result = await client.createSession({ accessToken: 'token-teacher' });

    expect(result.status).to.equal('linked');
    expect(result.sessionRef).to.equal('backend-session-123');
    expect(result.displayContext.role).to.equal('teacher');
  });
});
