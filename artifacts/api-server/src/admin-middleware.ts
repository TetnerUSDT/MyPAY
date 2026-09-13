import { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { admins } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export interface AdminRequest extends Request {
  admin?: {
    id?: number;
    username: string;
    isSuperAdmin: boolean;
    permissions: string[];
  };
}

function parseBasicCredentials(
  authorizationHeader: string | undefined,
): { username: string; password: string } | null {
  if (!authorizationHeader?.startsWith("Basic ")) {
    return null;
  }

  const encodedCredentials = authorizationHeader.slice("Basic ".length).trim();
  if (!encodedCredentials) {
    return null;
  }

  const credentials = Buffer.from(encodedCredentials, "base64").toString("utf-8");
  const separatorIndex = credentials.indexOf(":");

  if (separatorIndex <= 0) {
    return null;
  }

  return {
    username: credentials.slice(0, separatorIndex),
    password: credentials.slice(separatorIndex + 1),
  };
}

// Middleware to check if user is super admin (from env)
export const requireSuperAdmin = async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const credentials = parseBasicCredentials(req.headers.authorization);

    if (!credentials) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const superAdminLogin = process.env.ADMIN_LOGIN;
    const superAdminPassword = process.env.ADMIN_PASSWORD;

    if (!superAdminLogin || !superAdminPassword) {
      return res.status(500).json({ message: "Admin credentials not configured" });
    }

    if (
      credentials.username === superAdminLogin &&
      credentials.password === superAdminPassword
    ) {
      req.admin = {
        username: superAdminLogin,
        isSuperAdmin: true,
        permissions: ['*'], // All permissions
      };
      return next();
    }

    return res.status(401).json({ message: "Unauthorized" });
  } catch (error) {
    console.error('Super admin auth error:', error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Middleware to check if user is admin (super admin or regular admin from DB)
export const requireAdmin = async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const credentials = parseBasicCredentials(req.headers.authorization);

    if (!credentials) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Check super admin first
    const superAdminLogin = process.env.ADMIN_LOGIN;
    const superAdminPassword = process.env.ADMIN_PASSWORD;

    if (superAdminLogin && superAdminPassword) {
      if (
        credentials.username === superAdminLogin &&
        credentials.password === superAdminPassword
      ) {
        req.admin = {
          username: superAdminLogin,
          isSuperAdmin: true,
          permissions: ['*'],
        };
        return next();
      }
    }

    // Check regular admins from database
    const [admin] = await db
      .select()
      .from(admins)
      .where(eq(admins.username, credentials.username));

    if (!admin || admin.status !== 'active') {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Simple password check (in production, use bcrypt)
    if (admin.passwordHash !== credentials.password) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.admin = {
      id: admin.id,
      username: admin.username,
      isSuperAdmin: false,
      permissions: (admin.permissions as string[]) || [],
    };

    return next();
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Middleware to check specific permission
export const requirePermission = (permission: string) => {
  return (req: AdminRequest, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Super admin has all permissions
    if (req.admin.isSuperAdmin || req.admin.permissions.includes('*')) {
      return next();
    }

    // Check if admin has the specific permission
    if (req.admin.permissions.includes(permission)) {
      return next();
    }

    return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
  };
};
