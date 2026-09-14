import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'argon2';
import { PrismaService } from '@/core/prisma/prisma.service';
import { RbacService } from '@/modules/rbac/rbac.service';
import { User } from '../../../generated/prisma/client';
import { toUserProfileDto, UserProfileDto } from './profile-field-policy';

export interface ProfileViewer {
  userId: string;
  roles: string[];
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
  ) {}

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
    });
  }

  async create(
    email: string,
    password: string,
    emailVerified = false,
  ): Promise<User> {
    const passwordHash = await hash(password);

    return this.prisma.user.create({
      data: {
        email: this.normalizeEmail(email),
        passwordHash,
        emailVerifiedAt: emailVerified ? new Date() : null,
        isActive: true,
      },
    });
  }

  async markEmailVerified(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
  }

  async findByIdWithRoles(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: { include: { role: true } },
      },
    });
  }

  async getProfile(
    viewer: ProfileViewer,
    targetId: string,
  ): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
    });
    if (!user) {
      this.logger.log(
        `viewerUserId=${viewer.userId} targetUserId=${targetId} outcome=404`,
      );
      throw new NotFoundException('User not found');
    }
    const isSelf = viewer.userId === targetId;
    const canReadOthers = this.rbacService.canAccess(
      viewer.roles,
      'users',
      'read',
    );
    if (!isSelf && !canReadOthers) {
      this.logger.log(
        `viewerUserId=${viewer.userId} targetUserId=${targetId} outcome=403`,
      );
      throw new ForbiddenException('Access denied');
    }
    this.logger.log(
      `viewerUserId=${viewer.userId} targetUserId=${targetId} outcome=200`,
    );
    return toUserProfileDto(user, isSelf ? 'self' : 'users.read');
  }
}
