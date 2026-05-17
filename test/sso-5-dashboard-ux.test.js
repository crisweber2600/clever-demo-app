const { expect } = require('chai');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

const {
  buildDashboardLinkStatus,
  hasBackendAdminCapability,
  toSafeAuthStatusViewModel
} = require('../link-status');

const dashboardTemplate = fs.readFileSync(
  path.join(__dirname, '..', 'views', 'dashboard.ejs'),
  'utf8'
);

function renderDashboard(overrides = {}) {
  return ejs.render(dashboardTemplate, {
    user: { name: 'Clever Demo User' },
    dbUser: { name: 'Clever Demo User' },
    roles: ['student'],
    activeRole: 'student',
    role: 'student',
    PrettyRole: 'Student',
    userSchools: [{ cleverId: 'clever-school-1', name: 'Clever Middle School' }],
    classes: [{ name: 'Clever Homeroom', schoolName: 'Clever Middle School' }],
    linkStatus: buildDashboardLinkStatus(null),
    ...overrides
  });
}

describe('SSO-5 Dashboard Link Status And Blocked-State UX', () => {
  it('Given linked backend context, when dashboard renders, then NorthStar district and user context are separate from Clever roster data', () => {
    const linkStatus = buildDashboardLinkStatus({
      sessionRef: 'backend-session-123',
      displayContext: {
        userName: 'NorthStar User',
        userId: 'ns-user-42',
        districtName: 'NorthStar District',
        districtId: 'ns-district-7',
        role: 'student'
      }
    });

    const html = renderDashboard({ linkStatus });

    expect(html).to.include('NorthStar Account Context');
    expect(html).to.include('NorthStar User');
    expect(html).to.include('NorthStar District');
    expect(html).to.include('Clever Demo Roster Data');
    expect(html).to.include('Clever-sourced demo roster data');
  });

  it('Given pending, blocked, and error states, when status text is prepared, then friendly messages do not expose secrets or raw payload details', () => {
    const unsafeMessage = 'token=abc.secret payload {"accessToken":"raw-token"} Error: stack trace';

    for (const status of ['pendingLink', 'blocked', 'error']) {
      const model = toSafeAuthStatusViewModel({
        status,
        reasonCode: 'RAW_PROFILE_ERROR',
        correlationId: 'corr-safe-123',
        displayContext: { message: unsafeMessage }
      });

      expect(model.message).to.not.include('abc.secret');
      expect(model.message).to.not.include('raw-token');
      expect(model.message).to.not.include('accessToken');
      expect(model.message).to.not.include('stack trace');
      expect(model.message.length).to.be.greaterThan(20);
    }
  });

  it('Given local SQLite roster data without backend roster confirmation, when dashboard renders, then data is labeled Clever-sourced demo data', () => {
    const html = renderDashboard({
      linkStatus: buildDashboardLinkStatus({
        sessionRef: 'backend-session-456',
        displayContext: {
          userName: 'NorthStar User',
          districtName: 'NorthStar District',
          role: 'teacher'
        }
      })
    });

    expect(html).to.include('Clever-sourced demo roster data');
    expect(html).to.not.include('NorthStar-confirmed roster context');
  });

  it('Given demo super-admin override but no backend admin capability, when migration authorization is checked, then backend migration actions are denied', () => {
    const req = {
      user: {
        email: 'katie.gardner+demo@clever.com',
        data: { type: 'district_admin' }
      },
      session: {
        backendSession: {
          displayContext: {
            role: 'district_admin',
            capabilities: []
          }
        }
      }
    };

    expect(hasBackendAdminCapability(req)).to.equal(false);
  });
});
