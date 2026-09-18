export const USER_LIST_STATUSES = ['active', 'blocked', 'deleted'] as const;
export type UserListStatus = (typeof USER_LIST_STATUSES)[number];

export const USER_LIST_SORTS = ['created_at', 'email'] as const;
export type UserListSort = (typeof USER_LIST_SORTS)[number];

export const USER_LIST_ORDERS = ['asc', 'desc'] as const;
export type UserListOrder = (typeof USER_LIST_ORDERS)[number];

export const USER_LIST_DEFAULT_LIMIT = 20;
export const USER_LIST_MIN_LIMIT = 1;
export const USER_LIST_MAX_LIMIT = 100;
export const USER_LIST_DEFAULT_SORT: UserListSort = 'created_at';
export const USER_LIST_DEFAULT_ORDER: UserListOrder = 'desc';

export interface UserListItem {
  id: string;
  email: string;
  photo: string | null;
  createdAt: Date;
  status: UserListStatus;
}

export interface UserListResponse {
  items: UserListItem[];
  nextCursor: string | null;
}

export function userListStatus(user: {
  isActive: boolean;
  deletedAt: Date | null;
}): UserListStatus {
  if (user.deletedAt) {
    return 'deleted';
  }
  return user.isActive ? 'active' : 'blocked';
}

export function userListStatusWhere(status: UserListStatus) {
  if (status === 'deleted') {
    return { deletedAt: { not: null } };
  }
  return {
    deletedAt: null,
    isActive: status === 'active',
  };
}

export interface UserListCursorPayload {
  sort: UserListSort;
  order: UserListOrder;
  v: string;
  id: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUserListUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function isUserListSort(value: unknown): value is UserListSort {
  return (
    typeof value === 'string' &&
    (USER_LIST_SORTS as readonly string[]).includes(value)
  );
}

function isUserListOrder(value: unknown): value is UserListOrder {
  return (
    typeof value === 'string' &&
    (USER_LIST_ORDERS as readonly string[]).includes(value)
  );
}

function isCursorPayload(value: unknown): value is UserListCursorPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const payload = value as Record<string, unknown>;
  return (
    isUserListSort(payload.sort) &&
    isUserListOrder(payload.order) &&
    typeof payload.v === 'string' &&
    payload.v.length > 0 &&
    typeof payload.id === 'string' &&
    isUserListUuid(payload.id)
  );
}

export function encodeUserListCursor(payload: UserListCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeUserListCursor(
  raw: string,
): UserListCursorPayload | null {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    );
    return isCursorPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
