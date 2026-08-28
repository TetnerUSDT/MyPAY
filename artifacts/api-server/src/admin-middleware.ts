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

// Middleware to check if user is super admin (from env)
export const requireSuperAdmin = async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    const superAdminLogin = process.env.ADMIN_LOGIN;
    const superAdminPassword = process.env.ADMIN_PASSWORD;

    if (!superAdminLogin || !superAdminPassword) {
      return res.status(500).json({ message: "Admin credentials not configured" });
    }

    if (username === superAdminLogin && password === superAdminPassword) {
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
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    // Check super admin first
    const superAdminLogin = process.env.ADMIN_LOGIN;
    const superAdminPassword = process.env.ADMIN_PASSWORD;

    if (superAdminLogin && superAdminPassword) {
      if (username === superAdminLogin && password === superAdminPassword) {
        req.admin = {
          username: superAdminLogin,
          isSuperAdmin: true,
          permissions: ['*'],
        };
        return next();
      }
    }

    // Check regular admins from database
    const [admin] = await db.select().from(admins).where(eq(admins.username, username));

    if (!admin || admin.status !== 'active') {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Simple password check (in production, use bcrypt)
    if (admin.passwordHash !== password) {
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
