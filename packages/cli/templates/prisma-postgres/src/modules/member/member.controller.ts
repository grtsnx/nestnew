import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { InviteMemberDto, UpdateMemberRoleDto } from 'src/dto';

import { MemberService } from './member.service';

@ApiTags('Member')
@ApiBearerAuth('bearer')
@Controller({ path: 'organisation/member', version: '1' })
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Post('invite')
  @ApiOperation({ summary: 'Invite a member' })
  invite(@Req() req: Request, @Body() body: InviteMemberDto): Promise<never> {
    return this.memberService.invite(req, body);
  }

  @Get()
  @ApiOperation({ summary: 'List members' })
  list(@Req() req: Request): Promise<never> {
    return this.memberService.list(req);
  }

  @Patch(':memberId/role')
  @ApiOperation({ summary: 'Change member role' })
  updateRole(
    @Req() req: Request,
    @Param('memberId') memberId: string,
    @Body() body: UpdateMemberRoleDto,
  ): Promise<never> {
    return this.memberService.updateRole(req, memberId, body);
  }

  @Delete(':memberId')
  @ApiOperation({ summary: 'Remove a member' })
  remove(
    @Req() req: Request,
    @Param('memberId') memberId: string,
  ): Promise<never> {
    return this.memberService.remove(req, memberId);
  }
}
