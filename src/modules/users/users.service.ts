import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { hash, verify } from 'argon2';
import { PrismaService } from '@/core/prisma/prisma.service';
import { RbacService } from '@/modules/rbac/rbac.service';
import { Prisma, type User } from '../../../generated/prisma/client';
import {
  patchAllowlist,
  photoUrl,
  toUserProfileDto,
  UserProfileDto,
} from './helpers/profile-field-policy';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import {
  USER_LIST_DEFAULT_LIMIT,
  USER_LIST_DEFAULT_ORDER,
  USER_LIST_DEFAULT_SORT,
  decodeUserListCursor,
  encodeUserListCursor,
  isUserListUuid,
  userListStatus,
  userListStatusWhere,
  type UserListCursorPayload,
  type UserListOrder,
  type UserListResponse,
  type UserListSort,
} from './helpers/user-list';
import { UpdateUserDto } from './dto/update-user.dto';
import { MailService } from '@/core/mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { InitiateEmailChangeDto } from './dto/initiate-email-change.dto';
import { randomInt, randomUUID } from 'crypto';
import { ConfirmEmailChangeDto } from './dto/confirm-email-change.dto';
import { MultipartFile } from '@fastify/multipart';
import { join } from 'path';
import { mkdir, rm, writeFile } from 'fs/promises';
import { ConfirmAccountDeletionDto } from './dto/confirm-account-deletion.dto';
import { InitiateAccountDeletionDto } from './dto/initiate-account-deletion.dto';

export interface ProfileViewer {
  userId: string;
  roles: string[];
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
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

  async listUsers(
    actor: ProfileViewer,
    query: ListUsersQueryDto,
  ): Promise<UserListResponse> {
    const limit = query.limit ?? USER_LIST_DEFAULT_LIMIT;
    const sort = query.sort ?? USER_LIST_DEFAULT_SORT;
    const order = query.order ?? USER_LIST_DEFAULT_ORDER;
    const q = query.q?.trim() ? query.q.trim() : undefined;

    const logBase =
      `actorUserId=${actor.userId} event=user-list hasQ=${Boolean(q)} ` +
      `status=${query.status ?? 'all'} sort=${sort} order=${order} limit=${limit}`;

    if (!this.rbacService.canAccess(actor.roles, 'users', 'read')) {
      this.logger.log(`${logBase} outcome=403`);
      throw new ForbiddenException('Access denied');
    }

    const whereParts: Prisma.UserWhereInput[] = [];

    if (query.status) {
      whereParts.push(userListStatusWhere(query.status));
    }
    if (q) {
      whereParts.push(this.userListSearchWhere(q));
    }
    if (query.cursor) {
      const decoded = decodeUserListCursor(query.cursor);
      if (!decoded) {
        this.logger.log(`${logBase} outcome=400`);
        throw new BadRequestException('Invalid cursor');
      }
      if (decoded.sort !== sort || decoded.order !== order) {
        this.logger.log(`${logBase} outcome=400`);
        throw new BadRequestException('Cursor does not match sort/order');
      }
      const cursorWhere = this.userListCursorWhere(decoded, sort, order);
      if (!cursorWhere) {
        this.logger.log(`${logBase} outcome=400`);
        throw new BadRequestException('Invalid cursor');
      }
      whereParts.push(cursorWhere);
    }

    const rows = await this.prisma.user.findMany({
      where: whereParts.length > 0 ? { AND: whereParts } : undefined,
      orderBy: [
        sort === 'email' ? { email: order } : { createdAt: order },
        { id: order },
      ],
      take: limit + 1,
      select: {
        id: true,
        email: true,
        photoFilename: true,
        createdAt: true,
        isActive: true,
        deletedAt: true,
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeUserListCursor({
            sort,
            order,
            v: sort === 'email' ? last.email : last.createdAt.toISOString(),
            id: last.id,
          })
        : null;

    this.logger.log(`${logBase} outcome=200 count=${page.length}`);

    return {
      items: page.map((row) => ({
        id: row.id,
        email: row.email,
        photo: photoUrl(row.photoFilename),
        createdAt: row.createdAt,
        status: userListStatus(row),
      })),
      nextCursor,
    };
  }

  async updateProfile(
    actor: ProfileViewer,
    targetId: string,
    dto: UpdateUserDto,
  ): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
    });
    if (!user) {
      this.logger.log(
        `actorUserId=${actor.userId} targetUserId=${targetId} outcome=404`,
      );
      throw new NotFoundException('User not found');
    }

    const isSelf = actor.userId === targetId;
    const canUpdate = this.rbacService.canAccess(
      actor.roles,
      'users',
      'update',
    );
    if (!isSelf && !canUpdate) {
      this.logger.log(
        `actorUserId=${actor.userId} targetUserId=${targetId} outcome=403`,
      );
      throw new ForbiddenException('Access denied');
    }

    const requested = Object.entries(dto).filter(
      ([, value]) => value !== undefined,
    );
    const requestedKeys = requested.map(([key]) => key);
    const allowed = new Set(patchAllowlist(canUpdate));
    const forbidden = requestedKeys.filter((key) => !allowed.has(key));

    if (forbidden.length > 0) {
      this.logger.log(
        `actorUserId=${actor.userId} targetUserId=${targetId} fields=${forbidden.join(',')} outcome=403`,
      );
      throw new ForbiddenException('Access denied');
    }

    const data: Record<string, unknown> = Object.fromEntries(requested);

    if (typeof data.email === 'string') {
      const email = this.normalizeEmail(data.email);
      data.email = email;
      if (email !== user.email) {
        const taken = await this.findByEmail(email);
        if (taken && taken.id !== user.id) {
          this.logger.log(
            `actorUserId=${actor.userId} targetUserId=${targetId} fields=email outcome=409`,
          );
          throw new ConflictException('Email is already registered');
        }
        data.emailVerifiedAt = new Date();
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data,
    });

    this.logger.log(
      `actorUserId=${actor.userId} targetUserId=${targetId} fields=${requestedKeys.join(',')} outcome=200`,
    );

    return toUserProfileDto(updated, isSelf ? 'self' : 'users.read');
  }

  async initiateEmailChange(
    actor: ProfileViewer,
    targetId: string,
    dto: InitiateEmailChangeDto,
  ): Promise<{ requiresConfirmation: true; challengeId: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
    });
    if (!user) {
      this.logger.log(
        `actorUserId=${actor.userId} targetUserId=${targetId} event=email-change-initiated outcome=404`,
      );
      throw new NotFoundException('User not found');
    }

    if (actor.userId !== targetId) {
      this.logger.log(
        `actorUserId=${actor.userId} targetUserId=${targetId} event=email-change-initiated outcome=403`,
      );
      throw new ForbiddenException('Access denied');
    }

    const newEmail = this.normalizeEmail(dto.newEmail);

    if (newEmail === user.email) {
      throw new BadRequestException(
        'New email must be different from the current email',
      );
    }

    const taken = await this.findByEmail(newEmail);
    if (taken) {
      this.logger.log(
        `actorUserId=${actor.userId} targetUserId=${targetId} event=email-change-initiated outcome=409`,
      );
      throw new ConflictException('Email is already registered');
    }

    const lastOtp = await this.prisma.emailOtp.findFirst({
      where: {
        userId: targetId,
        purpose: 'EMAIL_CHANGE',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (lastOtp && lastOtp.resendAvailableAt > new Date()) {
      this.logger.log(
        `actorUserId=${actor.userId} targetUserId=${targetId} event=email-change-initiated outcome=429`,
      );
      throw new HttpException(
        'Please wait before requesting another code',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.prisma.emailOtp.updateMany({
      where: {
        userId: targetId,
        purpose: 'EMAIL_CHANGE',
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });

    const { code, challengeId } = await this.createEmailChangeOtp(
      targetId,
      newEmail,
    );

    try {
      await this.mailService.sendEmailChangeOtp(newEmail, code);
    } catch (error) {
      this.logger.error(
        `actorUserId=${actor.userId} targetUserId=${targetId} event=email-change-initiated outcome=500`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to send confirmation email. Please try again later.',
      );
    }

    this.logger.log(
      `actorUserId=${actor.userId} targetUserId=${targetId} event=email-change-initiated outcome=200`,
    );

    return { requiresConfirmation: true, challengeId };
  }

  private async createEmailChangeOtp(
    userId: string,
    destinationEmail: string,
  ): Promise<{ code: string; challengeId: string }> {
    const length = Number(this.config.get('AUTH_EMAIL_CHANGE_OTP_LENGTH'));
    const ttlSeconds = Number(
      this.config.get('AUTH_EMAIL_CHANGE_OTP_TTL_SECONDS'),
    );
    const maxAttempts = Number(
      this.config.get('AUTH_EMAIL_CHANGE_OTP_MAX_ATTEMPTS'),
    );
    const resendSeconds = Number(
      this.config.get('AUTH_EMAIL_CHANGE_OTP_RESEND_SECONDS'),
    );

    const code = this.generateOtp(length);
    const codeHash = await hash(code);
    const now = new Date();

    const otp = await this.prisma.emailOtp.create({
      data: {
        userId,
        purpose: 'EMAIL_CHANGE',
        destinationEmail,
        codeHash,
        expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
        maxAttempts,
        resendAvailableAt: new Date(now.getTime() + resendSeconds * 1000),
      },
      select: { id: true },
    });

    return { code, challengeId: otp.id };
  }

  async confirmEmailChange(
    actor: ProfileViewer,
    targetId: string,
    dto: ConfirmEmailChangeDto,
  ): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
    });
    if (!user) {
      this.logger.log(
        `actorUserId=${actor.userId} targetUserId=${targetId} event=email-change-confirmed outcome=404`,
      );
      throw new NotFoundException('User not found');
    }

    if (actor.userId !== targetId) {
      this.logger.log(
        `actorUserId=${actor.userId} targetUserId=${targetId} event=email-change-confirmed outcome=403`,
      );
      throw new ForbiddenException('Access denied');
    }

    const otp = await this.prisma.emailOtp.findFirst({
      where: {
        id: dto.challengeId,
        userId: targetId,
        purpose: 'EMAIL_CHANGE',
        consumedAt: null,
      },
    });

    if (!otp) {
      this.logger.log(
        `actorUserId=${actor.userId} targetUserId=${targetId} event=email-change-confirmed outcome=400`,
      );
      throw new BadRequestException('Invalid confirmation code');
    }

    if (otp.expiresAt < new Date()) {
      throw new BadRequestException('Confirmation code has expired');
    }

    if (otp.attempts >= otp.maxAttempts) {
      throw new BadRequestException('Too many confirmation attempts');
    }

    const isValid = await verify(otp.codeHash, dto.code);
    if (!isValid) {
      await this.prisma.emailOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid confirmation code');
    }

    if (!otp.destinationEmail) {
      throw new BadRequestException('Invalid confirmation code');
    }

    const newEmail = this.normalizeEmail(otp.destinationEmail);
    const taken = await this.findByEmail(newEmail);
    if (taken && taken.id !== user.id) {
      this.logger.log(
        `actorUserId=${actor.userId} targetUserId=${targetId} event=email-change-confirmed outcome=409`,
      );
      throw new ConflictException('Email is already registered');
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.emailOtp.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: targetId },
        data: {
          email: newEmail,
          emailVerifiedAt: new Date(),
        },
      }),
    ]);

    this.logger.log(
      `actorUserId=${actor.userId} targetUserId=${targetId} event=email-change-confirmed outcome=200`,
    );

    return toUserProfileDto(updated, 'self');
  }

  async initiateAccountDeletion(
    actor: ProfileViewer,
    targetId: string,
    dto: InitiateAccountDeletionDto,
  ): Promise<{ requiresConfirmation: true; challengeId: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!user) {
      this.logger.log(
        `actorUserId=${actor.userId} targetUserId=${targetId} op=self event=deletion-initiated outcome=404`,
      );
      throw new NotFoundException('User not found');
    }
    if (user.deletedAt) {
      this.logger.log(
        `actorUserId=${actor.userId} targetUserId=${targetId} op=self event=deletion-initiated outcome=409`,
      );
      throw new ConflictException('User already deleted');
    }
    if (actor.userId !== targetId) {
      this.logger.log(
        `actorUserId=${actor.userId} targetUserId=${targetId} op=self event=deletion-initiated outcome=403`,
      );
      throw new ForbiddenException('Access denied');
    }

    const lastOtp = await this.prisma.emailOtp.findFirst({
      where: { userId: targetId, purpose: 'ACCOUNT_DELETION' },
      orderBy: { createdAt: 'desc' },
    });
    if (lastOtp && lastOtp.resendAvailableAt > new Date()) {
      this.logger.log(
        `actorUserId=${actor.userId} targetUserId=${targetId} op=self event=deletion-initiated outcome=429`,
      );
      throw new HttpException(
        'Please wait before requesting another code',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.prisma.emailOtp.updateMany({
      where: {
        userId: targetId,
        purpose: 'ACCOUNT_DELETION',
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });

    const { code, challengeId } = await this.createAccountDeletionOtp(targetId);

    try {
      this.logger.log(
        `[TEST ONLY] Account deletion OTP for userId=${targetId}: ${code}`,
      );
      await this.mailService.sendAccountDeletionOtp(user.email, code);
    } catch (error) {
      this.logger.error(
        `actorUserId=${actor.userId} targetUserId=${targetId} op=self event=deletion-initiated outcome=500`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to send confirmation email. Please try again later.',
      );
    }

    this.logger.log(
      `actorUserId=${actor.userId} targetUserId=${targetId} op=self event=deletion-initiated outcome=200 hasReason=${Boolean(dto.reason)}`,
    );

    return { requiresConfirmation: true, challengeId };
  }

  private async createAccountDeletionOtp(
    userId: string,
  ): Promise<{ code: string; challengeId: string }> {
    const length = Number(this.config.get('AUTH_ACCOUNT_DELETION_OTP_LENGTH'));
    const ttlSeconds = Number(
      this.config.get('AUTH_ACCOUNT_DELETION_OTP_TTL_SECONDS'),
    );
    const maxAttempts = Number(
      this.config.get('AUTH_ACCOUNT_DELETION_OTP_MAX_ATTEMPTS'),
    );
    const resendSeconds = Number(
      this.config.get('AUTH_ACCOUNT_DELETION_OTP_RESEND_SECONDS'),
    );

    const code = this.generateOtp(length);
    const codeHash = await hash(code);
    const now = new Date();

    const otp = await this.prisma.emailOtp.create({
      data: {
        userId,
        purpose: 'ACCOUNT_DELETION',
        codeHash,
        expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
        maxAttempts,
        resendAvailableAt: new Date(now.getTime() + resendSeconds * 1000),
      },
      select: { id: true },
    });

    return { code, challengeId: otp.id };
  }

  async confirmAccountDeletion(
    actor: ProfileViewer,
    targetId: string,
    dto: ConfirmAccountDeletionDto,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!user) {
      this.logger.log(
        `actorUserId=${actor.userId} targetUserId=${targetId} op=self event=deletion-confirmed outcome=404`,
      );
      throw new NotFoundException('User not found');
    }
    if (user.deletedAt) {
      throw new ConflictException('User already deleted');
    }
    if (actor.userId !== targetId) {
      this.logger.log(
        `actorUserId=${actor.userId} targetUserId=${targetId} op=self event=deletion-confirmed outcome=403`,
      );
      throw new ForbiddenException('Access denied');
    }

    const otp = await this.prisma.emailOtp.findFirst({
      where: {
        id: dto.challengeId,
        userId: targetId,
        purpose: 'ACCOUNT_DELETION',
        consumedAt: null,
      },
    });
    if (!otp) {
      throw new BadRequestException('Invalid confirmation code');
    }
    if (otp.expiresAt < new Date()) {
      throw new BadRequestException('Confirmation code has expired');
    }
    if (otp.attempts >= otp.maxAttempts) {
      throw new BadRequestException('Too many confirmation attempts');
    }

    const isValid = await verify(otp.codeHash, dto.code);
    if (!isValid) {
      await this.prisma.emailOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid confirmation code');
    }

    await this.prisma.emailOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    await this.anonymizeAccount(targetId, user.photoFilename);

    this.logger.log(
      `actorUserId=${actor.userId} targetUserId=${targetId} op=self event=deletion-confirmed outcome=204`,
    );
  }

  async anonymizeAccount(
    userId: string,
    photoFilename: string | null,
  ): Promise<void> {
    const passwordHash = await hash(randomUUID());

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          deletedAt: new Date(),
          email: `deleted.${userId}@deleted.invalid`,
          passwordHash,
          emailVerifiedAt: null,
          displayName: null,
          firstName: null,
          lastName: null,
          phone: null,
          bio: null,
          locale: null,
          photoFilename: null,
        },
      }),
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.emailOtp.deleteMany({ where: { userId } }),
      this.prisma.loginAttempt.deleteMany({ where: { userId } }),
    ]);

    await this.removeAvatarFile(photoFilename);
  }

  async deleteUserByAdmin(
    actor: ProfileViewer,
    targetId: string,
    dto: InitiateAccountDeletionDto,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!user) {
      this.logger.log(
        `actorUserId=${actor.userId} targetUserId=${targetId} op=admin event=deletion outcome=404`,
      );
      throw new NotFoundException('User not found');
    }
    if (user.deletedAt) {
      this.logger.log(
        `actorUserId=${actor.userId} targetUserId=${targetId} op=admin event=deletion outcome=409`,
      );
      throw new ConflictException('User already deleted');
    }
    if (actor.userId === targetId) {
      this.logger.log(
        `actorUserId=${actor.userId} targetUserId=${targetId} op=admin event=deletion outcome=403`,
      );
      throw new ForbiddenException(
        'Use POST /users/:id/deletion to delete your own account',
      );
    }
    if (!this.rbacService.canAccess(actor.roles, 'users', 'delete')) {
      this.logger.log(
        `actorUserId=${actor.userId} targetUserId=${targetId} op=admin event=deletion outcome=403`,
      );
      throw new ForbiddenException('Access denied');
    }

    await this.anonymizeAccount(targetId, user.photoFilename);

    this.logger.log(
      `actorUserId=${actor.userId} targetUserId=${targetId} op=admin event=deletion outcome=204 hasReason=${Boolean(dto.reason)}`,
    );
  }

  private async requireProfileMutation(actor: ProfileViewer, targetId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const isSelf = actor.userId === targetId;
    const canUpdate = this.rbacService.canAccess(
      actor.roles,
      'users',
      'update',
    );
    if (!isSelf && !canUpdate) {
      throw new ForbiddenException('Access denied');
    }
    return { user, isSelf };
  }

  private userListSearchWhere(q: string): Prisma.UserWhereInput {
    if (isUserListUuid(q)) {
      return { id: q };
    }
    return {
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
      ],
    };
  }

  private userListCursorWhere(
    cursor: UserListCursorPayload,
    sort: UserListSort,
    order: UserListOrder,
  ): Prisma.UserWhereInput | null {
    const cmp = order === 'asc' ? 'gt' : 'lt';

    if (sort === 'created_at') {
      const createdAt = new Date(cursor.v);
      if (Number.isNaN(createdAt.getTime())) {
        return null;
      }
      return {
        OR: [
          { createdAt: { [cmp]: createdAt } },
          { createdAt, id: { [cmp]: cursor.id } },
        ],
      };
    }

    return {
      OR: [
        { email: { [cmp]: cursor.v } },
        { email: cursor.v, id: { [cmp]: cursor.id } },
      ],
    };
  }

  async updatePhoto(
    actor: ProfileViewer,
    targetId: string,
    file: MultipartFile | undefined,
  ) {
    const { user, isSelf } = await this.requireProfileMutation(actor, targetId);
    if (!file) {
      throw new BadRequestException('Photo file is required');
    }
    const ext = MIME_TO_EXT[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Photo must be a JPEG, PNG, or WebP image');
    }
    const buffer = await file.toBuffer();
    if (buffer.length === 0) {
      throw new BadRequestException('Photo file is empty');
    }
    const filename = `${randomUUID()}${ext}`;
    const dir = join(process.cwd(), 'uploads', 'avatars');
    await mkdir(dir, { recursive: true });
    const dest = join(dir, filename);
    try {
      await writeFile(dest, buffer);
      const updated = await this.prisma.user.update({
        where: { id: targetId },
        data: { photoFilename: filename },
      });
      await this.removeAvatarFile(user.photoFilename);
      this.logger.log(
        `actorUserId=${actor.userId} targetUserId=${targetId} fields=photo outcome=200`,
      );
      return toUserProfileDto(updated, isSelf ? 'self' : 'users.read');
    } catch (error) {
      await rm(dest, { force: true });
      throw error;
    }
  }

  async deletePhoto(
    actor: ProfileViewer,
    targetId: string,
  ): Promise<UserProfileDto> {
    const { user, isSelf } = await this.requireProfileMutation(actor, targetId);

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { photoFilename: null },
    });

    await this.removeAvatarFile(user.photoFilename);

    this.logger.log(
      `actorUserId=${actor.userId} targetUserId=${targetId} fields=photo outcome=200`,
    );

    return toUserProfileDto(updated, isSelf ? 'self' : 'users.read');
  }

  private async removeAvatarFile(filename: string | null): Promise<void> {
    if (!filename) {
      return;
    }
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(
        filename,
      )
    ) {
      return;
    }
    await rm(join(process.cwd(), 'uploads', 'avatars', filename), {
      force: true,
    });
  }

  private generateOtp(length: number): string {
    const min = 10 ** (length - 1);
    const max = 10 ** length - 1;
    return String(randomInt(min, max + 1));
  }
}
