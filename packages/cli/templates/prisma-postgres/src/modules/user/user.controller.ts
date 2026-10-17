import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous, Session } from '@thallesp/nestjs-better-auth';
import type { Request } from 'express';

import type { Session as AuthSession } from 'src/lib';
import {
  ChangePasswordDto,
  CheckTelephoneQueryDto,
  CheckUsernameQueryDto,
  LinkAccountDto,
  OnboardingDto,
  RevokeSessionsQueryDto,
  TwoFactorDto,
  UpdateProfileDto,
  DeleteAccountDto,
  VerifyTwoFactorDto,
} from 'src/dto';

import { UserService } from './user.service';

@ApiTags('User')
@ApiBearerAuth('bearer')
@Controller({ path: 'user', version: '1' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: 'See your profile' })
  me(@Session() session: AuthSession): never {
    return this.userService.me(session);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update your profile' })
  updateProfile(
    @Req() req: Request,
    @Body() body: UpdateProfileDto,
  ): Promise<never> {
    return this.userService.updateProfile(req, body);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Load account overview' })
  overview(@Session() session: AuthSession): Promise<never> {
    return this.userService.overview(session);
  }

  @Patch('onboarding')
  @ApiOperation({ summary: 'Finish account setup' })
  onboarding(@Req() req: Request, @Body() body: OnboardingDto): Promise<never> {
    return this.userService.onboarding(req, body);
  }

  @Patch('password')
  @ApiOperation({ summary: 'Update your password' })
  changePassword(
    @Req() req: Request,
    @Body() body: ChangePasswordDto,
  ): Promise<never> {
    return this.userService.changePassword(req, body);
  }

  @AllowAnonymous()
  @Get('check/username')
  @ApiOperation({ summary: 'Is this username free' })
  checkUsername(@Query() query: CheckUsernameQueryDto): Promise<never> {
    return this.userService.checkUsername(query);
  }

  @AllowAnonymous()
  @Get('check/telephone')
  @ApiOperation({ summary: 'Is this phone free' })
  checkTelephone(@Query() query: CheckTelephoneQueryDto): Promise<never> {
    return this.userService.checkTelephone(query);
  }

  @Post('2fa/enable')
  @ApiOperation({ summary: 'Turn on two-factor' })
  enableTwoFactor(
    @Req() req: Request,
    @Body() body: TwoFactorDto,
  ): Promise<never> {
    return this.userService.enableTwoFactor(req, body);
  }

  @Post('2fa/disable')
  @ApiOperation({ summary: 'Turn off two-factor' })
  disableTwoFactor(
    @Req() req: Request,
    @Body() body: TwoFactorDto,
  ): Promise<never> {
    return this.userService.disableTwoFactor(req, body);
  }

  @Post('2fa/verify')
  @ApiOperation({ summary: 'Confirm two-factor code' })
  verifyTwoFactor(
    @Req() req: Request,
    @Body() body: VerifyTwoFactorDto,
  ): Promise<never> {
    return this.userService.verifyTwoFactor(req, body);
  }

  @Get('accounts')
  @ApiOperation({ summary: 'List linked accounts' })
  listAccounts(@Req() req: Request): Promise<never> {
    return this.userService.listAccounts(req);
  }

  @Post('accounts/link')
  @ApiOperation({ summary: 'Link a social account' })
  linkAccount(
    @Req() req: Request,
    @Body() body: LinkAccountDto,
  ): Promise<never> {
    return this.userService.linkAccount(req, body);
  }

  @Delete('accounts/:provider')
  @ApiOperation({ summary: 'Unlink a social account' })
  unlinkAccount(
    @Req() req: Request,
    @Param('provider') provider: string,
  ): Promise<never> {
    return this.userService.unlinkAccount(req, provider);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List active sessions' })
  listSessions(
    @Req() req: Request,
    @Session() session: AuthSession,
  ): Promise<never> {
    return this.userService.listSessions(req, session);
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: 'End one session' })
  revokeSession(
    @Req() req: Request,
    @Session() session: AuthSession,
    @Param('id') id: string,
  ): Promise<never> {
    return this.userService.revokeSession(req, session, id);
  }

  @Delete('sessions')
  @ApiOperation({ summary: 'End other sessions' })
  revokeSessions(
    @Req() req: Request,
    @Query() query: RevokeSessionsQueryDto,
  ): Promise<never> {
    return this.userService.revokeSessions(req, query.mode ?? 'others');
  }

  @Post('sign/out')
  @ApiOperation({ summary: 'Sign out' })
  signOut(@Req() req: Request): Promise<never> {
    return this.userService.signOut(req);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete your account' })
  deleteAccount(
    @Req() req: Request,
    @Body() body: DeleteAccountDto,
  ): Promise<never> {
    return this.userService.deleteAccount(req, body);
  }
}
