export type ProfileViewerKind = 'self' | 'users.read';

export const SELF_PATCH_FIELDS = [
  'displayName',
  'firstName',
  'lastName',
  'phone',
  'bio',
  'locale',
] as const;

export const ADMIN_ONLY_PATCH_FIELDS = ['email', 'isActive'] as const;

export const ADMIN_PATCH_FIELDS = [
  ...SELF_PATCH_FIELDS,
  ...ADMIN_ONLY_PATCH_FIELDS,
] as const;

export type SelfPatchField = (typeof SELF_PATCH_FIELDS)[number];
export type AdminPatchField = (typeof ADMIN_PATCH_FIELDS)[number];

export function patchAllowlist(canUpdateOthers: boolean): readonly string[] {
  return canUpdateOthers ? ADMIN_PATCH_FIELDS : SELF_PATCH_FIELDS;
}

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
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  bio: string | null;
  locale: string | null;
}

export const AVATAR_PUBLIC_PREFIX = '/uploads/avatars';

export function photoUrl(photoFilename: string | null): string | null {
  return photoFilename ? `${AVATAR_PUBLIC_PREFIX}/${photoFilename}` : null;
}

export function toUserProfileDto(
  user: ProfileSource,
  viewer: ProfileViewerKind,
): UserProfileDto {
  const fields: Record<string, unknown> = {
    displayName: user.displayName,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    bio: user.bio,
    locale: user.locale,
    isActive: user.isActive,
  };

  if (viewer === 'self') {
    fields.emailVerifiedAt = user.emailVerifiedAt;
    fields.createdAt = user.createdAt;
  }

  return {
    id: user.id,
    email: user.email,
    photo: photoUrl(user.photoFilename),
    fields,
  };
}
