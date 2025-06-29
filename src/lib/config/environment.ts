// Environment Configuration Manager
// REFACTORED: Focused only on environment variables, removed service health coupling

export interface EnvironmentServiceInfo {
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
    openai: EnvironmentServiceInfo;
    supabase: EnvironmentServiceInfo;
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
  ): EnvironmentServiceInfo {
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

    let status: EnvironmentServiceInfo['status'];
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
      message = `${description} environment variables properly configured`;
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

    // Validate OpenAI environment variables
    const openaiConfig = this.validateService(
      'OpenAI',
      ['OPENAI_API_KEY'],
      'OpenAI API'
    );

    // Validate Supabase environment variables
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

  // ✅ REMOVED: isServiceAvailable() - services handle their own health
  // ✅ REMOVED: getServiceStatus() - services handle their own health

  getEnvironmentServiceInfo(serviceName: 'openai' | 'supabase'): EnvironmentServiceInfo {
    return this.config.services[serviceName];
  }

  logConfigurationStatus(): void {
    const { services, isDevelopment, isProduction } = this.config;
    
    console.log('\n🔧 Environment Configuration Status:');
    console.log(`📊 Mode: ${isDevelopment ? 'Development' : isProduction ? 'Production' : 'Unknown'}`);
    
    // Log environment variable status only
    Object.values(services).forEach(service => {
      const icon = service.isAvailable ? '✅' : service.status === 'placeholder' ? '⚠️' : '❌';
      
      if (service.isAvailable) {
        console.log(`${icon} ${service.name}: Environment variables configured`);
      } else {
        console.warn(`${icon} ${service.name}: ${service.message}`);
      }
    });

    // Provide guidance based on environment
    const unconfiguredServices = Object.values(services).filter(s => !s.isAvailable);
    if (unconfiguredServices.length > 0) {
      console.log('\n💡 Environment Variable Configuration:');
      console.log('   To enable services, configure the following environment variables:');
      
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

  // ✅ REFACTORED: Only report environment configuration, not service health
  getEnvironmentStatus() {
    const { services, isDevelopment } = this.config;
    const configuredServices = Object.values(services).filter(s => s.isAvailable).length;
    const totalServices = Object.values(services).length;
    
    return {
      environment: {
        mode: this.config.isDevelopment ? 'development' : 'production',
        variablesConfigured: `${configuredServices}/${totalServices}`,
        fullyConfigured: configuredServices === totalServices,
        degradedMode: configuredServices < totalServices
      },
      services: Object.fromEntries(
        Object.entries(services).map(([key, service]) => [
          key, 
          {
            status: service.status,
            configured: service.isAvailable,
            message: service.message,
            missingVars: service.missingVars
          }
        ])
      )
    };
  }
}

// Export singleton instance
export const environmentManager = new EnvironmentManager();
export default environmentManager;