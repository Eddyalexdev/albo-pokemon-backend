export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'DOMAIN_ERROR',
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class InvalidOperationError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_OPERATION');
    this.name = 'InvalidOperationError';
  }
}
