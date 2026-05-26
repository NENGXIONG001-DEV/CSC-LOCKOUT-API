import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp }) =>
  `[${timestamp}] ${level}: ${message}`
);

const logger = winston.createLogger({
  level: 'info',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
    }),
    new DailyRotateFile({
      dirname:       'logs',
      filename:      'app-%DATE%.log',
      datePattern:   'YYYY-MM-DD',
      maxSize:       '20m',
    }),
  ],
});

export default logger;
