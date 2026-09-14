export type ProfileViewerKind = 'self' | 'users.read';

export interface UserProfileDto {
  id: string;
  email: string;
  photo: string | null;
  fields: Record<string, unknown>;
}

export interface ProfileSource {
  id: string;
  email: string;
  photoFilename: string | null;
  emailVerifiedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export const AVATAR_PUBLIC_PREFIX = '/uploads/avatars';

export function photoUrl(photoFilename: string | null): string | null {
  return photoFilename ? `${AVATAR_PUBLIC_PREFIX}/${photoFilename}` : null;
}

export function toUserProfileDto(
  user: ProfileSource,
  viewer: ProfileViewerKind,
): UserProfileDto {
  const fields: Record<string, unknown> =
    viewer === 'self'
      ? {
          emailVerifiedAt: user.emailVerifiedAt,
          isActive: user.isActive,
          createdAt: user.createdAt,
        }
      : { isActive: user.isActive };

  return {
    id: user.id,
    email: user.email,
    photo: photoUrl(user.photoFilename),
    fields,
  };
}
