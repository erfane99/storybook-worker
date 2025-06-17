// Environment Configuration Manager
// Implements graceful degradation pattern for development environments

export interface ServiceConfig {
  name: string;
  isConfigured: boolean;
  isAvailable: boolean;
  status: 'configured' | 'not_configured' | 'placeholder' | 'invalid';
  message: string;
  requiredVars: string[];
  missingVars: string[];
  isCritical: boolean; // NEW: Indicates if service is critical for worker operation
}

export interface EnvironmentConfig {
  isDevelopment: boolean;
  isProduction: boolean;
  services: {
    openai: ServiceConfig;
    supabase: ServiceConfig;
  };
  worker: {
    port: number;
    environment: string;
    jobScanInterval: string; // Fixed: Use consistent property name
    maxConcurrentJobs: number;
    initialScanDelay: number;
  };
}

class EnvironmentManager {
  private config: EnvironmentConfig;

  constructor() {
    this.config = this.validateEnvironment();
  }

  private isPlaceholderValue(value: string | undefined): boolean {
    if (!value) return true;
    
    const placeholderPatterns = [
      'your_',
      'placeholder',
      'example',
      'test_key',
      'demo_',
      'sk-proj-',
      'localhost',
      'http://localhost'
    ];

    return placeholderPatterns.some(pattern => 
      value.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  private validateService(
    name: string, 
    requiredVars: string[], 
    description: string,
    isCritical: boolean = false // NEW: Critical services are required for worker operation
  ): ServiceConfig {
    const missingVars: string[] = [];
    const placeholderVars: string[] = [];
    
    for (const varName of requiredVars) {
      const value = process.env[varName];
      
      if (!value || value.trim() === '') {
        missingVars.push(varName);
      } else if (this.isPlaceholderValue(value)) {
        placeholderVars.push(varName);
      }
    }

    let status: ServiceConfig['status'];
    let message: string;
    let isConfigured: boolean;
    let isAvailable: boolean;

    if (missingVars.length > 0) {
      status = 'not_configured';
      message = `Missing environment variables: ${missingVars.join(', ')}`;
      isConfigured = false;
      isAvailable = false;
    } else if (placeholderVars.length > 0) {
      status = 'placeholder';
      message = `Using placeholder values for: ${placeholderVars.join(', ')}. Service will be unavailable until real ${description} credentials are provided.`;
      isConfigured = false;
      isAvailable = false;
    } else {
      status = 'configured';
      message = `${description} service properly configured`;
      isConfigured = true;
      isAvailable = true;
    }

    return {
      name,
      isConfigured,
      isAvailable,
      status,
      message,
      requiredVars,
      missingVars: [...missingVars, ...placeholderVars],
      isCritical
    };
  }

  private validateEnvironment(): EnvironmentConfig {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isDevelopment = nodeEnv === 'development';
    const isProduction = nodeEnv === 'production';

    // Validate OpenAI service (NOT CRITICAL - worker can run without it)
    const openaiConfig = this.validateService(
      'OpenAI',
      ['OPENAI_API_KEY'],
      'OpenAI API',
      false // ✅ OpenAI is NOT critical - worker can start without it
    );

    // Validate Supabase service (CRITICAL - required for job management)
    const supabaseConfig = this.validateService(
      'Supabase',
      ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
      'Supabase database',
      true // ✅ Supabase IS critical - required for job management
    );

    return {
      isDevelopment,
      isProduction,
      services: {
        openai: openaiConfig,
        supabase: supabaseConfig
      },
      worker: {
        port: Number(process.env.PORT) || 3000,
        environment: nodeEnv,
        jobScanInterval: '*/30 * * * * *', // Fixed: Use consistent property name
        maxConcurrentJobs: 5,
        initialScanDelay: 10000
      }
    };
  }

  getConfig(): EnvironmentConfig {
    return this.config;
  }

  isServiceAvailable(serviceName: 'openai' | 'supabase'): boolean {
    return this.config.services[serviceName].isAvailable;
  }

  getServiceStatus(serviceName: 'openai' | 'supabase'): ServiceConfig {
    return this.config.services[serviceName];
  }

  // NEW: Check if critical services are available
  areCriticalServicesAvailable(): boolean {
    const { services } = this.config;
    return Object.values(services)
      .filter(service => service.isCritical)
      .every(service => service.isAvailable);
  }

  // NEW: Get list of missing critical services
  getMissingCriticalServices(): ServiceConfig[] {
    const { services } = this.config;
    return Object.values(services)
      .filter(service => service.isCritical && !service.isAvailable);
  }

  // NEW: Get list of missing non-critical services
  getMissingNonCriticalServices(): ServiceConfig[] {
    const { services } = this.config;
    return Object.values(services)
      .filter(service => !service.isCritical && !service.isAvailable);
  }

  logConfigurationStatus(): void {
    const { services, isDevelopment, isProduction } = this.config;
    
    console.log('\n🔧 Environment Configuration Status:');
    console.log(`📊 Mode: ${isDevelopment ? 'Development' : isProduction ? 'Production' : 'Unknown'}`);
    
    // Log service statuses with criticality awareness
    Object.values(services).forEach(service => {
      const criticalityLabel = service.isCritical ? '[CRITICAL]' : '[OPTIONAL]';
      const icon = service.isAvailable ? '✅' : service.status === 'placeholder' ? '⚠️' : '❌';
      
      // Determine log level based on criticality and environment
      let logLevel: 'info' | 'warn' | 'error' = 'info';
      
      if (!service.isAvailable) {
        if (service.isCritical && isProduction) {
          logLevel = 'error'; // Critical services missing in production = error
        } else if (service.isCritical && isDevelopment) {
          logLevel = 'warn'; // Critical services missing in development = warning
        } else {
          logLevel = 'warn'; // Non-critical services missing = warning
        }
      }
      
      const message = `${icon} ${service.name} ${criticalityLabel}: ${service.message}`;
      
      if (logLevel === 'info') {
        console.log(message);
      } else if (logLevel === 'warn') {
        console.warn(message);
      } else {
        console.error(message);
      }
    });

    // Environment-specific guidance
    if (isDevelopment) {
      const unconfiguredServices = Object.values(services).filter(s => !s.isAvailable);
      if (unconfiguredServices.length > 0) {
        console.log('\n💡 Development Mode - Service Configuration:');
        console.log('   The worker will start successfully but some services will be unavailable.');
        console.log('   To enable full functionality, update your .env file with real credentials:');
        
        unconfiguredServices.forEach(service => {
          service.missingVars.forEach(varName => {
            console.log(`   - ${varName}=your_real_${varName.toLowerCase()}_here`);
          });
        });
        
        console.log('   Then restart the worker with: npm run dev\n');
      }
    }

    if (isProduction) {
      const missingCritical = this.getMissingCriticalServices();
      const missingNonCritical = this.getMissingNonCriticalServices();
      
      if (missingCritical.length > 0) {
        console.error('\n🚨 PRODUCTION ERROR: Critical services not configured!');
        missingCritical.forEach(service => {
          console.error(`   ${service.name}: ${service.message}`);
        });
        console.error('   Worker cannot function without these services.\n');
      }
      
      if (missingNonCritical.length > 0) {
        console.warn('\n⚠️ PRODUCTION WARNING: Optional services not configured');
        missingNonCritical.forEach(service => {
          console.warn(`   ${service.name}: ${service.message}`);
        });
        console.warn('   Worker will start with limited functionality.');
        console.warn('   Add these environment variables to enable full features:\n');
        
        missingNonCritical.forEach(service => {
          service.missingVars.forEach(varName => {
            console.warn(`   - ${varName}=your_real_${varName.toLowerCase()}_here`);
          });
        });
        console.warn('');
      }
    }
  }

  getHealthStatus() {
    const { services, isDevelopment } = this.config;
    const availableServices = Object.values(services).filter(s => s.isAvailable).length;
    const totalServices = Object.values(services).length;
    const criticalServicesAvailable = this.areCriticalServicesAvailable();
    
    // Overall health: healthy if critical services are available
    let overallHealth: 'healthy' | 'degraded' | 'unhealthy';
    
    if (criticalServicesAvailable) {
      overallHealth = availableServices === totalServices ? 'healthy' : 'degraded';
    } else {
      overallHealth = 'unhealthy';
    }
    
    // In development, always report as healthy if we can start
    if (isDevelopment) {
      overallHealth = 'healthy';
    }
    
    return {
      overall: overallHealth,
      services: Object.fromEntries(
        Object.entries(services).map(([key, service]) => [
          key, 
          {
            status: service.status,
            available: service.isAvailable,
            critical: service.isCritical,
            message: service.message
          }
        ])
      ),
      configuration: {
        mode: this.config.isDevelopment ? 'development' : 'production',
        servicesAvailable: `${availableServices}/${totalServices}`,
        criticalServicesAvailable: criticalServicesAvailable,
        fullyConfigured: availableServices === totalServices
      }
    };
  }
}

// Export singleton instance
export const environmentManager = new EnvironmentManager();
export default environmentManager;