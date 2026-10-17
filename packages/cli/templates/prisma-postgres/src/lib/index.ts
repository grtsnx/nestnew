export { LibModule } from './lib.module';
export { SendMailsModule } from './email/sendMail.module';
export {
  SendMailsService,
  type SendEmailJobPayload,
  type WelcomeEmailContext,
} from './email/sendMail.service';
export { RedisModule } from './redis/redis.module';
export { RedisService } from './redis/redis.service';
export { GravatarModule } from './gravatar/gravatar.module';
export {
  GravatarService,
  ensureHttpsUrl,
  buildDicebearUrl,
  resolveDicebearStyle,
  resolveProfileImage,
  assignSignupImage,
  DEFAULT_DICEBEAR_STYLE,
  type GravatarDefaultImage,
  type GravatarOptions,
  type GravatarRating,
} from './gravatar/gravatar.service';
export { FilesModule } from './files/files.module';
export { FilesService } from './files/files.service';
export { PrismaModule } from './prisma/prisma.module';
export { PrismaService } from './prisma/prisma.service';
export { normalizePgConnectionString } from './prisma/pg-connection';
export { auth, type Session } from './betterauth/auth';
export {
  setAuthMailer,
  type AuthMailer,
  type AuthOtpType,
} from './betterauth/auth-email';
export { ac, roles, orgAc, orgRoles } from './betterauth/permissions';
export {
  isFreeTrialAbuseEnabled,
  isMultiSessionEnabled,
} from './betterauth/feature-flags';
export {
  DEFAULT_SIGNUP_CREDITS,
  SIGNUP_CREDITS_KEY,
  SIGNUP_GRANT_REASON,
  getSignupCredits,
  grantAndAttachSignupCredits,
  grantSignupCreditsIfEligible,
  grantSignupCreditsSafe,
  applyCreditBalanceToAuthPayload,
  extractAuthUserId,
  mapCreditRewardError,
  parseCreditAmount,
  parseCreditAudience,
  parseRewardAmount,
  rewardCredits,
  setSignupCredits,
  type CreditAudience,
} from './betterauth/credits';
export { hashPassword, verifyPassword } from './betterauth/password';
export {
  CREDENTIAL_ISSUER,
  oauthSyntheticIssuer,
  resolveAccountForUnlink,
  type LinkedAccountRow,
} from './betterauth/account-issuer';
export { getAutumnClient, requireAutumnClient } from './autumn/autumn.client';
