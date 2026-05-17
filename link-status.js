const FRIENDLY_STATUS_MESSAGES = {
  pendingLink: 'We found your Clever sign-in, but your NorthStar account link is still pending approval. Please contact support if you need access now.',
  blocked: 'This Clever district or account is not enabled for NorthStar access. Please contact support with the reference below.',
  error: 'We could not complete your NorthStar sign-in right now. Please try again later or contact support with the reference below.'
};

const BACKEND_ADMIN_CAPABILITIES = new Set([
  'admin',
  'admin:write',
  'backend:admin',
  'backend:migration',
  'migration:write',
  'clever:migration:write'
]);

function safeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildDashboardLinkStatus(backendSession) {
  const displayContext = backendSession?.displayContext || {};
  const linked = Boolean(backendSession?.sessionRef && displayContext);
  const rosterAuthority = safeString(displayContext.rosterAuthority);
  const rosterConfirmed = rosterAuthority === 'northstar' || displayContext.rosterConfirmed === true;

  return {
    state: linked ? 'linked' : 'not-linked',
    title: linked ? 'NorthStar Link Confirmed' : 'NorthStar Link Not Confirmed',
    message: linked
      ? 'Backend-approved NorthStar context is shown separately from demo roster data.'
      : 'This dashboard is showing local Clever demo data only.',
    northstarUserName: safeString(displayContext.userName) || safeString(displayContext.northstarUserName),
    northstarUserId: safeString(displayContext.userId) || safeString(displayContext.northstarUserId),
    northstarDistrictName: safeString(displayContext.districtName) || safeString(displayContext.northstarDistrictName),
    northstarDistrictId: safeString(displayContext.districtId) || safeString(displayContext.northstarDistrictId),
    northstarRole: safeString(displayContext.role),
    rosterSourceLabel: rosterConfirmed
      ? 'NorthStar-confirmed roster context'
      : 'Clever-sourced demo roster data',
    rosterSourceDescription: rosterConfirmed
      ? 'Backend mapping confirms this roster context for NorthStar use.'
      : 'Classes, schools, and roster rows below come from the local SQLite demo database and are not authoritative NorthStar account state.'
  };
}

function toSafeAuthStatusViewModel(response = {}) {
  const status = ['pendingLink', 'blocked', 'error'].includes(response.status)
    ? response.status
    : 'error';

  return {
    status,
    reasonCode: safeString(response.reasonCode) || (status === 'error' ? 'SIGN_IN_ERROR' : 'LINK_STATUS'),
    correlationId: safeString(response.correlationId),
    message: FRIENDLY_STATUS_MESSAGES[status]
  };
}

function hasBackendAdminCapability(req) {
  const backendSession = req?.session?.backendSession || {};
  const displayContext = backendSession.displayContext || {};

  if (backendSession.adminCapability === true || displayContext.adminCapability === true) {
    return true;
  }

  const capabilities = [
    ...(Array.isArray(backendSession.capabilities) ? backendSession.capabilities : []),
    ...(Array.isArray(displayContext.capabilities) ? displayContext.capabilities : [])
  ];

  return capabilities.some(capability => BACKEND_ADMIN_CAPABILITIES.has(String(capability)));
}

function hasDemoAdminAccess(req) {
  const email = req?.user?.email;
  const isSuperAdmin = email === 'katie.gardner+demo@clever.com';
  const isCleverAdmin = req?.user?.data && req.user.data.type === 'district_admin';
  return Boolean(isSuperAdmin || isCleverAdmin);
}

function sendBackendAdminDenied(res) {
  return res.status(403).send(
    'Backend authorization is required for this migration action. Your demo admin role is not sufficient for this operation.'
  );
}

module.exports = {
  buildDashboardLinkStatus,
  hasBackendAdminCapability,
  hasDemoAdminAccess,
  sendBackendAdminDenied,
  toSafeAuthStatusViewModel
};
