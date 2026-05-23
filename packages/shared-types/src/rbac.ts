/**
 * Enhanced Role-Based Access Control (RBAC) System
 * Provides granular permission management and resource-level access control
 */

export enum UserRole {
  PLAYER = 'player',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

export enum Permission {
  // Game permissions
  GAME_CREATE = 'game:create',
  GAME_JOIN = 'game:join',
  GAME_PLAY = 'game:play',
  GAME_SPECTATE = 'game:spectate',
  GAME_END_EARLY = 'game:end_early',

  // User management
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  USER_BAN = 'user:ban',
  USER_UNBAN = 'user:unban',

  // Financial
  WALLET_READ = 'wallet:read',
  WALLET_WITHDRAW = 'wallet:withdraw',
  WALLET_MANAGE = 'wallet:manage',
  TRANSACTION_REFUND = 'transaction:refund',

  // Anti-cheating
  ANTICHEAT_REVIEW = 'anticheat:review',
  ANTICHEAT_BAN = 'anticheat:ban',
  ANTICHEAT_UNBAN = 'anticheat:unban',

  // Moderation
  CHAT_MODERATE = 'chat:moderate',
  REPORT_HANDLE = 'report:handle',
  REPORT_ESCALATE = 'report:escalate',

  // Administration
  CONFIG_READ = 'config:read',
  CONFIG_UPDATE = 'config:update',
  AUDIT_LOG_READ = 'audit:log:read',
  SYSTEM_MANAGE = 'system:manage',

  // Content
  CONTENT_CREATE = 'content:create',
  CONTENT_EDIT = 'content:edit',
  CONTENT_DELETE = 'content:delete',

  // Leaderboard
  LEADERBOARD_READ = 'leaderboard:read',
  LEADERBOARD_MANAGE = 'leaderboard:manage',

  // Room management
  ROOM_CREATE = 'room:create',
  ROOM_MANAGE = 'room:manage',
}

interface RolePermissions {
  role: UserRole;
  permissions: Permission[];
  description: string;
}

/**
 * Default role permission mappings
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.PLAYER]: [
    Permission.GAME_CREATE,
    Permission.GAME_JOIN,
    Permission.GAME_PLAY,
    Permission.GAME_SPECTATE,
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.WALLET_READ,
    Permission.LEADERBOARD_READ,
    Permission.ROOM_CREATE,
  ],

  [UserRole.MODERATOR]: [
    ...ROLE_PERMISSIONS[UserRole.PLAYER] || [],
    Permission.CHAT_MODERATE,
    Permission.REPORT_HANDLE,
    Permission.USER_BAN,
    Permission.ANTICHEAT_REVIEW,
    Permission.USER_READ,
    Permission.AUDIT_LOG_READ,
  ],

  [UserRole.ADMIN]: [
    ...ROLE_PERMISSIONS[UserRole.MODERATOR] || [],
    Permission.USER_DELETE,
    Permission.USER_UNBAN,
    Permission.ANTICHEAT_BAN,
    Permission.ANTICHEAT_UNBAN,
    Permission.WALLET_MANAGE,
    Permission.TRANSACTION_REFUND,
    Permission.REPORT_ESCALATE,
    Permission.CONFIG_READ,
    Permission.CONFIG_UPDATE,
    Permission.CONTENT_CREATE,
    Permission.CONTENT_EDIT,
    Permission.CONTENT_DELETE,
    Permission.ROOM_MANAGE,
    Permission.LEADERBOARD_MANAGE,
  ],

  [UserRole.SUPER_ADMIN]: [
    // Super admin has all permissions
    ...Object.values(Permission),
  ],
};

/**
 * Enum for resource types for granular access control
 */
export enum ResourceType {
  GAME = 'game',
  USER = 'user',
  ROOM = 'room',
  WALLET = 'wallet',
  REPORT = 'report',
  LEADERBOARD = 'leaderboard',
  CHAT = 'chat',
}

/**
 * Resource-level access control context
 */
export interface ResourceAccessContext {
  resourceType: ResourceType;
  resourceId: string;
  userId: string;
  userRole: UserRole;
  requiredPermission: Permission;
  action: 'read' | 'write' | 'delete' | 'manage';
}

/**
 * RBAC Service for checking permissions
 */
export class RbacService {
  /**
   * Check if user has permission
   */
  static hasPermission(userRole: UserRole, permission: Permission): boolean {
    const permissions = ROLE_PERMISSIONS[userRole] || [];
    return permissions.includes(permission);
  }

  /**
   * Check if user has any of the specified permissions
   */
  static hasAnyPermission(userRole: UserRole, permissions: Permission[]): boolean {
    return permissions.some(p => this.hasPermission(userRole, p));
  }

  /**
   * Check if user has all specified permissions
   */
  static hasAllPermissions(userRole: UserRole, permissions: Permission[]): boolean {
    return permissions.every(p => this.hasPermission(userRole, p));
  }

  /**
   * Get all permissions for a role
   */
  static getPermissions(userRole: UserRole): Permission[] {
    return ROLE_PERMISSIONS[userRole] || [];
  }

  /**
   * Check if user can perform action on resource
   */
  static canAccessResource(
    userRole: UserRole,
    resourceOwnerId: string,
    userId: string,
    permission: Permission,
  ): boolean {
    // Admins can access any resource
    if (this.hasPermission(userRole, Permission.SYSTEM_MANAGE)) {
      return true;
    }

    // Owner can access their own resources
    if (resourceOwnerId === userId) {
      return true;
    }

    // Check role permission
    return this.hasPermission(userRole, permission);
  }
}
