// callback-handler.js - SSO-2: Demo Clever Callback To Backend Session Handshake
// Handles the OAuth callback flow and integrates with the backend session API

const crypto = require('crypto');
const { toSafeAuthStatusViewModel } = require('./link-status');

/**
 * Validates the backend session response schema
 * @param {Object} response - Backend session response
 * @throws {Error} If response is invalid
 */
function validateBackendSessionResponse(response) {
  if (!response || typeof response !== 'object') {
    throw new Error('Response must be an object');
  }

  if (!response.status) {
    throw new Error('status is required');
  }

  const validStatuses = ['linked', 'pendingLink', 'blocked', 'error'];
  if (!validStatuses.includes(response.status)) {
    throw new Error(`Invalid status: ${response.status}`);
  }

  if (response.status === 'linked' && !response.sessionRef) {
    throw new Error('sessionRef is required for linked status');
  }

  if (!response.displayContext) {
    throw new Error('displayContext is required');
  }
}

/**
 * Handles the Clever OAuth callback and backend session handshake
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} backendClient - Backend API client
 */
async function handleCleverCallback(req, res, backendClient) {
  try {
    // Prepare the Clever identity payload for backend verification
    const cleverIdentity = {
      userId: req.user.id,
      districtId: req.user.data?.district || req.user.data?.district_id
    };

    // Call backend session endpoint before any routing decision
    let backendResponse;
    try {
      backendResponse = await backendClient.createSession(cleverIdentity);
      validateBackendSessionResponse(backendResponse);
    } catch (error) {
      // Backend error - render support-safe error state
      const correlationId = crypto.randomUUID();
      return res.render('auth-status', toSafeAuthStatusViewModel({
        status: 'error',
        reasonCode: 'BACKEND_UNAVAILABLE',
        correlationId: correlationId
      }));
    }

    // Handle backend response based on status
    if (backendResponse.status === 'linked') {
      // Success - persist only backend-approved context
      req.session.backendSession = {
        sessionRef: backendResponse.sessionRef,
        displayContext: backendResponse.displayContext,
        expiresAt: backendResponse.expiresAt
      };

      // Route based on backend-approved role
      const role = backendResponse.displayContext.role;
      if (role === 'district_admin') {
        return res.redirect('/admin');
      } else {
        return res.redirect('/dashboard');
      }
    } else {
      // Non-linked status (pendingLink, blocked, error) - render support-safe state
      return res.render('auth-status', toSafeAuthStatusViewModel(backendResponse));
    }
  } catch (error) {
    // Unexpected error - render generic support-safe state
    const correlationId = crypto.randomUUID();
    return res.render('auth-status', toSafeAuthStatusViewModel({
      status: 'error',
      reasonCode: 'UNEXPECTED_ERROR',
      correlationId: correlationId
    }));
  }
}

/**
 * Handles user logout and backend session cleanup
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} backendClient - Backend API client
 */
async function handleLogout(req, res, backendClient) {
  try {
    // Call backend logout if session exists
    const sessionRef = req.session?.backendSession?.sessionRef;
    if (sessionRef) {
      try {
        await backendClient.logout(sessionRef);
      } catch (error) {
        // Log but don't block logout on backend error
        console.error('Backend logout failed');
      }
    }

    // Clear Express session
    req.logout(() => {
      req.session.destroy(() => {
        res.redirect('/');
      });
    });
  } catch (error) {
    // Ensure logout always completes
    console.error('Logout error');
    req.session.destroy(() => {
      res.redirect('/');
    });
  }
}

module.exports = {
  handleCleverCallback,
  handleLogout,
  validateBackendSessionResponse
};
