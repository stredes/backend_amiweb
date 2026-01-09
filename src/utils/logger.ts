/**
 * Sistema de logging centralizado para eventos y errores
 * Proporciona diferentes niveles de log: ERROR, WARN, INFO, DEBUG
 */

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  message: string;
  context?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
  request?: {
    method?: string;
    endpoint?: string;
    userId?: string;
    ip?: string;
    userAgent?: string;
  };
}

class Logger {
  private env: string;

  constructor() {
    this.env = process.env.NODE_ENV || 'development';
  }

  /**
   * Formatea y escribe el log
   */
  private writeLog(entry: LogEntry): void {
    const logOutput = {
      ...entry,
      environment: this.env
    };

    // En desarrollo, log legible
    if (this.env === 'development') {
      const emoji = this.getEmoji(entry.level);
      console.log(`${emoji} [${entry.level}] ${entry.timestamp}`);
      console.log(`  Message: ${entry.message}`);
      
      if (entry.request) {
        console.log(`  Request: ${entry.request.method} ${entry.request.endpoint}`);
        if (entry.request.userId) console.log(`  User: ${entry.request.userId}`);
      }
      
      if (entry.context) {
        console.log('  Context:', JSON.stringify(entry.context, null, 2));
      }
      
      if (entry.error) {
        console.log(`  Error: ${entry.error.message}`);
        if (entry.error.stack) console.log(entry.error.stack);
      }
      console.log('---');
    } else {
      // En producción, JSON estructurado para sistemas de monitoreo
      console.log(JSON.stringify(logOutput));
    }
  }

  private getEmoji(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR: return '❌';
      case LogLevel.WARN: return '⚠️';
      case LogLevel.INFO: return 'ℹ️';
      case LogLevel.DEBUG: return '🔍';
      default: return '📝';
    }
  }

  /**
   * Log de error
   */
  error(message: string, error?: Error | unknown, context?: Record<string, any>): void {
    const entry: LogEntry = {
      level: LogLevel.ERROR,
      timestamp: new Date().toISOString(),
      message,
      context
    };

    if (error instanceof Error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        name: error.name
      };
    } else if (error) {
      entry.error = {
        message: String(error)
      };
    }

    this.writeLog(entry);
  }

  /**
   * Log de advertencia
   */
  warn(message: string, context?: Record<string, any>): void {
    this.writeLog({
      level: LogLevel.WARN,
      timestamp: new Date().toISOString(),
      message,
      context
    });
  }

  /**
   * Log de información general
   */
  info(message: string, context?: Record<string, any>): void {
    this.writeLog({
      level: LogLevel.INFO,
      timestamp: new Date().toISOString(),
      message,
      context
    });
  }

  /**
   * Log de debug (solo en desarrollo)
   */
  debug(message: string, context?: Record<string, any>): void {
    if (this.env === 'development' || process.env.DEBUG === 'true') {
      this.writeLog({
        level: LogLevel.DEBUG,
        timestamp: new Date().toISOString(),
        message,
        context
      });
    }
  }

  /**
   * Log de solicitud HTTP
   */
  request(
    method: string,
    endpoint: string,
    statusCode: number,
    duration?: number,
    userId?: string,
    ip?: string
  ): void {
    const entry: LogEntry = {
      level: statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO,
      timestamp: new Date().toISOString(),
      message: `${method} ${endpoint} - ${statusCode}`,
      request: {
        method,
        endpoint,
        userId,
        ip
      },
      context: duration ? { duration: `${duration}ms` } : undefined
    };

    this.writeLog(entry);
  }

  /**
   * Log de evento de negocio
   */
  event(eventName: string, context?: Record<string, any>): void {
    this.info(`Event: ${eventName}`, context);
  }

  /**
   * Log de acceso a base de datos
   */
  database(operation: string, collection: string, success: boolean, duration?: number): void {
    this.debug(`Database ${operation} on ${collection}`, {
      success,
      duration: duration ? `${duration}ms` : undefined
    });
  }

  /**
   * Log de autenticación
   */
  auth(event: string, userId?: string, success: boolean = true): void {
    this.info(`Auth: ${event}`, {
      userId,
      success
    });
  }
}

// Instancia singleton
export const logger = new Logger();

// Exportar para uso directo
export default logger;
