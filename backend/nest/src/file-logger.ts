import { LoggerService } from '@nestjs/common';
import fs from 'fs';
import path from 'path';

class FileLogger implements LoggerService {
  private logPath: string;

  constructor(logPath: string = '/app/logs/nest.log') {
    this.logPath = logPath;
    try {
      fs.mkdirSync(path.dirname(this.logPath), { recursive: true });
    } catch {}
  }

  private stringify(message: any, optionalParams: any[]): string {
    try {
      const extras = optionalParams?.length
        ? ' ' + optionalParams.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ')
        : '';
      return typeof message === 'string' ? message + extras : JSON.stringify(message) + extras;
    } catch {
      return String(message);
    }
  }

  private write(level: string, message: any, ...optionalParams: any[]) {
    const ts = new Date().toISOString();
    const line = `[${ts}] ${level} ${this.stringify(message, optionalParams)}\n`;
    try {
      fs.appendFileSync(this.logPath, line);
    } catch {}

    // Mirror para console
    switch (level) {
      case 'ERROR':
        console.error(message, ...optionalParams);
        break;
      case 'WARN':
        console.warn(message, ...optionalParams);
        break;
      default:
        console.log(message, ...optionalParams);
        break;
    }
  }

  log(message: any, ...optionalParams: any[]) {
    this.write('LOG', message, ...optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    this.write('ERROR', message, ...optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    this.write('WARN', message, ...optionalParams);
  }

  debug?(message: any, ...optionalParams: any[]) {
    this.write('DEBUG', message, ...optionalParams);
  }

  verbose?(message: any, ...optionalParams: any[]) {
    this.write('VERBOSE', message, ...optionalParams);
  }
}

export default FileLogger;