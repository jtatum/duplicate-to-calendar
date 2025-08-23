// Main authentication service

import { TokenManager } from './token-manager.js';
import { AuthError } from '../../shared/types.js';
import { log } from '../../shared/utils.js';

export class Authenticator {
  private tokenManager: TokenManager;

  constructor(tokenManager?: TokenManager) {
    this.tokenManager = tokenManager || new TokenManager();
  }

  /**
   * Authenticates the user and returns a valid token
   */
  async authenticate(): Promise<string> {
    return this.tokenManager.getToken(true);
  }

  /**
   * Gets a token without forcing interactive authentication
   */
  async getTokenSilently(): Promise<string> {
    return this.tokenManager.getToken(false);
  }

  /**
   * Logs the user out by revoking tokens and clearing cache
   */
  async logout(): Promise<void> {
    try {
      log('info', 'Starting logout process');
      
      // Get current token before revoking it
      let currentToken: string | undefined;
      try {
        currentToken = await this.tokenManager.getToken(false);
      } catch (error) {
        log('info', 'No current token to revoke during logout');
      }
      
      // Revoke token with Google if we have one
      if (currentToken) {
        await this.tokenManager.revokeToken(currentToken);
      }
      
      // Set logout state to prevent re-authentication
      this.tokenManager.setLoggedOut(true);
      
      // Clear all cached auth tokens from Chrome
      await this.tokenManager.clearTokens();
      
      log('info', 'Logout completed successfully');
      
    } catch (error) {
      log('error', 'Error during logout', { error });
      throw new AuthError('Logout failed', error);
    }
  }

  /**
   * Logs the user in by resetting logout state and getting a fresh token
   */
  async login(): Promise<string> {
    try {
      log('info', 'Starting login process');
      
      // Reset logout state to allow re-authentication
      this.tokenManager.setLoggedOut(false);
      
      // Get a fresh token with interactive authentication
      const token = await this.authenticate();
      
      log('info', 'Login completed successfully');
      return token;
      
    } catch (error) {
      log('error', 'Login failed', { error });
      throw new AuthError('Login failed', error);
    }
  }

  /**
   * Tests if the current authentication is valid
   */
  async testAuthentication(): Promise<boolean> {
    return this.tokenManager.testAuthentication();
  }

  /**
   * Checks if the user is currently logged out
   */
  isLoggedOut(): boolean {
    return this.tokenManager.isLoggedOut();
  }

  /**
   * Refreshes the authentication token by clearing cache and getting a new one
   */
  async refreshToken(): Promise<string> {
    try {
      log('info', 'Refreshing authentication token');
      
      // Clear cached tokens
      await this.tokenManager.clearTokens();
      
      // Get a fresh token
      return await this.authenticate();
      
    } catch (error) {
      log('error', 'Token refresh failed', { error });
      throw new AuthError('Token refresh failed', error);
    }
  }
}