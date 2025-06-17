// Environment Configuration Manager
// Implements graceful degradation pattern for enterprise microservices

export interface ServiceConfig {
  name: string;
  isConfigured: boolean;
  isAvailable: boolean;
  status: 'configured' | 'not_configured' | 'placeholder' | 'invalid';
  message: string;
  requiredVars: string[];
  missingVars: string[];
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
    jobScanInterval: string;
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
    description: string
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
      missingVars: [...missingVars, ...placeholderVars]
    };
  }

  private validateEnvironment(): EnvironmentConfig {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isDevelopment = nodeEnv === 'development';
    const isProduction = nodeEnv === 'production';

    // Validate OpenAI service
    const openaiConfig = this.validateService(
      'OpenAI',
      ['OPENAI_API_KEY'],
      'OpenAI API'
    );

    // Validate Supabase service
    const supabaseConfig = this.validateService(
      'Supabase',
      ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
      'Supabase database'
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
        jobScanInterval: '*/30 * * * * *',
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

  logConfigurationStatus(): void {
    const { services, isDevelopment, isProduction } = this.config;
    
    console.log('\n🔧 Environment Configuration Status:');
    console.log(`📊 Mode: ${isDevelopment ? 'Development' : isProduction ? 'Production' : 'Unknown'}`);
    
    // Log service statuses with appropriate levels
    Object.values(services).forEach(service => {
      const icon = service.isAvailable ? '✅' : service.status === 'placeholder' ? '⚠️' : '❌';
      
      if (service.isAvailable) {
        console.log(`${icon} ${service.name}: ${service.message}`);
      } else {
        console.warn(`${icon} ${service.name}: ${service.message}`);
      }
    });

    // Provide guidance based on environment
    const unconfiguredServices = Object.values(services).filter(s => !s.isAvailable);
    if (unconfiguredServices.length > 0) {
      console.log('\n💡 Service Configuration Status:');
      console.log('   Worker will start with partial functionality.');
      console.log('   To enable full functionality, configure the following services:');
      
      unconfiguredServices.forEach(service => {
        service.missingVars.forEach(varName => {
          console.log(`   - ${varName}=your_real_${varName.toLowerCase()}_here`);
        });
      });
      
      if (isDevelopment) {
        console.log('   Update your .env file and restart with: npm run dev');
      } else {
        console.log('   Update your environment variables and restart the service');
      }
      console.log('');
    }
  }

  getHealthStatus() {
    const { services, isDevelopment } = this.config;
    const availableServices = Object.values(services).filter(s => s.isAvailable).length;
    const totalServices = Object.values(services).length;
    
    // Worker is healthy if it can start (graceful degradation)
    // Individual services may be unavailable
    return {
      overall: 'healthy', // Always healthy - services degrade gracefully
      services: Object.fromEntries(
        Object.entries(services).map(([key, service]) => [
          key, 
          {
            status: service.status,
            available: service.isAvailable,
            message: service.message
          }
        ])
      ),
      configuration: {
        mode: this.config.isDevelopment ? 'development' : 'production',
        servicesAvailable: `${availableServices}/${totalServices}`,
        fullyConfigured: availableServices === totalServices,
        degradedMode: availableServices < totalServices
      }
    };
  }
}

// Export singleton instance
export const environmentManager = new EnvironmentManager();
export default environmentManager;