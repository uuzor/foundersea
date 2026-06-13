import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Custom exceptions for FounderSea backend
 */
export class BlockchainException extends HttpException {
  constructor(message: string, code?: string) {
    super(
      {
        statusCode: HttpStatus.BAD_GATEWAY,
        error: 'BlockchainError',
        message,
        code,
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}

export class ContractCallException extends BlockchainException {
  constructor(method: string, details?: string) {
    super(`Contract call failed: ${method}${details ? ` - ${details}` : ''}`, 'CONTRACT_CALL_FAILED');
  }
}

export class ContractWriteException extends BlockchainException {
  constructor(method: string, txHash?: string) {
    super(
      `Contract write failed: ${method}${txHash ? ` (tx: ${txHash})` : ''}`,
      'CONTRACT_WRITE_FAILED',
    );
  }
}

export class IdeaNotFoundException extends HttpException {
  constructor(ideaId: string | number) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'IdeaNotFound',
        message: `Idea ${ideaId} not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class InvalidTrancheStateException extends HttpException {
  constructor(currentState: string, expectedState: string) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'InvalidTrancheState',
        message: `Invalid tranche state transition: current=${currentState}, expected=${expectedState}`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class AIAgentException extends HttpException {
  constructor(message: string, details?: string) {
    super(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'AIAgentError',
        message: `AI Agent error: ${message}${details ? ` - ${details}` : ''}`,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class ValidationException extends HttpException {
  constructor(message: string, errors?: any) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'ValidationError',
        message,
        errors,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}