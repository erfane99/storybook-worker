// Auth service for authentication and user validation
import { BaseService, ServiceConfig } from '../base/base-service.js';
import { databaseService } from '../database/database-service.js';

export interface AuthConfig extends ServiceConfig {
  jwtSecret: string;
  tokenExpiration: number;
  serviceRoleKey: string;
}

export interface UserContext {
  id: string;
  email?: string;
  role: 'user' | 'admin' | 'service';
  permissions: string[];
}

export interface TokenValidationResult {
  valid: boolean;
  user?: UserContext;
  error?: string;
}

export class AuthService extends BaseService {
  private jwtSecret: string | null = null;
  private serviceRoleKey: string | null = null;

  constructor() {
    const config: AuthConfig = {
      name: 'AuthService',
      timeout: 10000,
      retryAttempts: 2,
      retryDelay: 1000,
      circuitBreakerThreshold: 5,
      jwtSecret: '',
      tokenExpiration: 3600000, // 1 hour
      serviceRoleKey: '',
    };
    
    super(config);
  }

  protected async initialize(): Promise<void> {
    this.jwtSecret = process.env.JWT_SECRET || null;
    this.serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || null;

    if (!this.jwtSecret) {
      this.log('warn', 'JWT secret not configured - token validation will be limited');
    }

    if (!this.serviceRoleKey) {
      this.log('warn', 'Service role key not configured - service authentication will be limited');
    }

    this.log('info', 'Auth service initialized');
  }

  /**
   * Validate JWT token
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    await this.ensureInitialized();
    
    if (!token) {
      return { valid: false, error: 'No token provided' };
    }

    try {
      // For now, implement basic validation
      // In a real implementation, you would use a JWT library
      if (token === this.serviceRoleKey) {
        return {
          valid: true,
          user: {
            id: 'service',
            role: 'service',
            permissions: ['*'],
          },
        };
      }

      // Mock user validation for development
      if (token.startsWith('user_')) {
        const userId = token.replace('user_', '');
        return {
          valid: true,
          user: {
            id: userId,
            role: 'user',
            permissions: ['read', 'write'],
          },
        };
      }

      return { valid: false, error: 'Invalid token' };
      
    } catch (error: any) {
      this.log('error', 'Token validation failed', error);
      return { valid: false, error: 'Token validation error' };
    }
  }

  /**
   * Check if user has permission
   */
  async checkPermission(userContext: UserContext, permission: string): Promise<boolean> {
    if (userContext.role === 'service' || userContext.permissions.includes('*')) {
      return true;
    }

    return userContext.permissions.includes(permission);
  }

  /**
   * Get user context from token
   */
  async getUserContext(token: string): Promise<UserContext | null> {
    const validation = await this.validateToken(token);
    return validation.valid ? validation.user || null : null;
  }

  /**
   * Validate service role authentication
   */
  async validateServiceRole(key: string): Promise<boolean> {
    await this.ensureInitialized();
    
    if (!this.serviceRoleKey) {
      this.log('warn', 'Service role key not configured');
      return false;
    }

    return key === this.serviceRoleKey;
  }

  /**
   * Create service context for worker operations
   */
  getServiceContext(): UserContext {
    return {
      id: 'worker-service',
      role: 'service',
      permissions: ['*'],
    };
  }

  isHealthy(): boolean {
    return this.isInitialized;
  }

  getStatus() {
    return {
      name: this.config.name,
      initialized: this.isInitialized,
      available: this.isHealthy(),
      jwtConfigured: this.jwtSecret !== null,
      serviceRoleConfigured: this.serviceRoleKey !== null,
    };
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;