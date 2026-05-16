// backend-client.js - Backend API client for Clever demo app integration
// SSO-1 AC1,AC2: Integration credential handling and fail-closed behavior

const axios = require('axios');
const { validateBackendConfig } = require('./config');

function createBackendClient(config) {
  try {
    validateBackendConfig(config);
  } catch (error) {
    throw new Error(`Backend API configuration validation failed: ${error.message}`);
  }
  
  const httpClient = axios.create({
    baseURL: config.UPGRADE_API_BASE_URL,
    timeout: config.UPGRADE_API_TIMEOUT_MS || 5000,
    headers: {
      'Content-Type': 'application/json',
      'X-Integration-Client-Id': config.UPGRADE_API_CLIENT_ID
    }
  });
  
  const client = {
    _httpClient: httpClient,
    
    async createSession(cleverIdentity) {
      const authHeader = `Basic ${Buffer.from(
        `${config.UPGRADE_API_CLIENT_ID}:${config.UPGRADE_API_CLIENT_SECRET}`
      ).toString('base64')}`;
      
      try {
        const response = await this._httpClient.post(
          '/api/integrations/clever/sessions',
          cleverIdentity,
          {
            headers: {
              'Authorization': authHeader,
              'X-Integration-Client-Id': config.UPGRADE_API_CLIENT_ID
            },
            timeout: config.UPGRADE_API_TIMEOUT_MS
          }
        );
        
        return response.data;
      } catch (error) {
        if (error.response) {
          throw new Error(`Backend API request failed: ${error.response.status} ${error.response.statusText}`);
        } else if (error.request) {
          throw new Error('Backend API request failed: No response received');
        } else {
          throw new Error('Backend API request failed: Request setup error');
        }
      }
    },
    
    async logout(sessionRef) {
      if (!sessionRef) {
        return { success: true };
      }
      
      const authHeader = `Basic ${Buffer.from(
        `${config.UPGRADE_API_CLIENT_ID}:${config.UPGRADE_API_CLIENT_SECRET}`
      ).toString('base64')}`;
      
      try {
        await this._httpClient.delete(`/api/integrations/clever/sessions/${sessionRef}`, {
          headers: {
            'Authorization': authHeader,
            'X-Integration-Client-Id': config.UPGRADE_API_CLIENT_ID
          }
        });
        
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  };
  
  return client;
}

module.exports = {
  createBackendClient
};
