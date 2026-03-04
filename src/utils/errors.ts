export class EdgexError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'EdgexError';
  }
}

export class ApiError extends EdgexError {
  constructor(code: string, msg: string) {
    super(msg, code);
    this.name = 'ApiError';
  }
}

export class ConfigError extends EdgexError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
