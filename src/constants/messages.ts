export const MESSAGES = {
  USERCODE_REQUIRED:    'usercode is required',
  UNLOCKED_BY_REQUIRED: 'unlocked_by is required',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  INVALID_ADMIN_KEY:    'Invalid or missing admin key',
  userNotFound:  (usercode: string) => `Usercode ${usercode} not found in lockout system`,
  unlockSuccess: (usercode: string) => `Usercode ${usercode} has been unlocked successfully`,
  resetSuccess:  (usercode: string) => `Usercode ${usercode} login attempts reset successfully`,
} as const;