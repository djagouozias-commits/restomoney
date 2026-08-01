export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const ERROR_CODES = {
  AUTH_INVALID_CREDENTIALS: { code: 'AUTH_INVALID_CREDENTIALS', statusCode: 401 },
  AUTH_SESSION_EXPIRED: { code: 'AUTH_SESSION_EXPIRED', statusCode: 401 },
  AUTH_FORBIDDEN: { code: 'AUTH_FORBIDDEN', statusCode: 403 },
  CRENEAU_NOT_AVAILABLE: { code: 'CRENEAU_NOT_AVAILABLE', statusCode: 422 },
  CRENEAU_NO_SLOTS: { code: 'CRENEAU_NO_SLOTS', statusCode: 422 },
  MENU_OPTION_REQUIRED: { code: 'MENU_OPTION_REQUIRED', statusCode: 422 },
  PLAT_INACTIVE: { code: 'PLAT_INACTIVE', statusCode: 422 },
  RESOURCE_NOT_FOUND: { code: 'RESOURCE_NOT_FOUND', statusCode: 404 },
  VALIDATION_ERROR: { code: 'VALIDATION_ERROR', statusCode: 400 },
  ROTATION_FAILED: { code: 'ROTATION_FAILED', statusCode: 500 },
  MISSION_INVALID_TRANSITION: { code: 'MISSION_INVALID_TRANSITION', statusCode: 409 },
} as const;
