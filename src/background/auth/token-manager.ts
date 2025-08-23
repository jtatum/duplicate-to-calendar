// Token management for OAuth authentication

import { AuthToken, AuthError } from '../../shared/types.js';
import { validateAccessToken } from '../../shared/validators.js';
import { extractErrorMessage, log } from '../../shared/utils.js';

export class TokenManager {
  private loggedOut = false;

  /**
   * Gets the current auth token, optionally requesting interactive authentication
   */
  async getToken(interactive = false): Promise<string> {
    try {
      if (this.loggedOut && !interactive) {
        throw new AuthError('User has logged out. Please log in again.');
      }

      log('info', `Getting auth token (interactive: ${interactive})`);
      
      const tokenResult = await chrome.identity.getAuthToken({ interactive });
      
      let actualToken: string;
      
      // Handle both old format (string) and new format (object with token property)
      if (typeof tokenResult === 'string') {
        actualToken = tokenResult;
      } else if (tokenResult && typeof tokenResult === 'object' && 'token' in tokenResult) {
        actualToken = (tokenResult as { token: string }).token;
      } else {
        throw new AuthError('Token is not in expected format');
      }
      
      // Validate token format
      if (!validateAccessToken(actualToken)) {
        throw new AuthError('Invalid token format received');
      }
      
      // Reset logout state on successful authentication
      this.loggedOut = false;
      
      log('info', 'Authentication successful');
      return actualToken;
      
    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Authentication failed', { error: message });
      throw new AuthError(`Authentication failed: ${message}`, error);
    }
  }

  /**
   * Clears all cached auth tokens
   */
  async clearTokens(): Promise<void> {
    try {
      log('info', 'Clearing cached auth tokens');
      await chrome.identity.clearAllCachedAuthTokens();
      log('info', 'Auth tokens cleared successfully');
    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Failed to clear auth tokens', { error: message });
      throw new AuthError(`Failed to clear tokens: ${message}`, error);
    }
  }

  /**
   * Revokes the current token with Google
   */
  async revokeToken(token?: string): Promise<void> {
    try {
      let tokenToRevoke = token;
      
      // Get current token if none provided
      if (!tokenToRevoke) {
        try {
          tokenToRevoke = await this.getToken(false);
        } catch {
          log('info', 'No current token to revoke');
          return;
        }
      }

      if (tokenToRevoke) {
        log('info', 'Revoking token with Google');
        
        const revokeResponse = await fetch(`https://oauth2.googleapis.com/revoke?token=${tokenToRevoke}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
        
        if (revokeResponse.ok) {
          log('info', 'Token revoked successfully with Google');
        } else {
          const responseText = await revokeResponse.text();
          log('warn', 'Token revocation response', { 
            status: revokeResponse.status, 
            response: responseText 
          });
        }
      }
    } catch (error) {
      const message = extractErrorMessage(error);
      log('warn', 'Error revoking token with Google', { error: message });
      // Don't throw here - revocation failure shouldn't prevent logout
    }
  }

  /**
   * Sets the logged out state
   */
  setLoggedOut(loggedOut: boolean): void {
    this.loggedOut = loggedOut;
    log('info', `Logout state set to: ${loggedOut}`);
  }

  /**
   * Checks if the user is currently logged out
   */
  isLoggedOut(): boolean {
    return this.loggedOut;
  }

  /**
   * Performs a test authentication to verify the token works
   */
  async testAuthentication(): Promise<boolean> {
    try {
      const token = await this.getToken(false);
      
      // Simple API call to test authentication with minimal data fetch
      const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        log('info', 'Authentication test successful');
        return true;
      } else {
        log('error', 'Authentication test failed', { 
          status: response.status, 
          statusText: response.statusText 
        });
        
        // Try to clear the token cache and retry if unauthorized
        if (response.status === 401) {
          log('info', 'Token invalid, clearing cache and retrying');
          await this.clearTokens();
          
          // Retry with fresh token
          const newToken = await this.getToken(false);
          const retryResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1', {
            headers: {
              'Authorization': `Bearer ${newToken}`,
              'Accept': 'application/json'
            }
          });
          
          if (retryResponse.ok) {
            log('info', 'Authentication retry successful');
            return true;
          } else {
            log('error', 'Authentication retry also failed', { 
              status: retryResponse.status 
            });
          }
        }
        return false;
      }
    } catch (error) {
      const message = extractErrorMessage(error);
      log('error', 'Authentication test failed', { error: message });
      return false;
    }
  }
}