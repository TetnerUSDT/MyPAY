import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';

// Ensure uploads directories exist
async function ensureUploadDirs() {
  const dirs = [
    'public/uploads',
    'public/uploads/system',
    'public/uploads/users',
    'public/uploads/icons',
    'public/uploads/icons/cryptocurrency',
    'public/uploads/assets',
    'public/uploads/support',
  ];
  
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      console.error(`Error creating directory ${dir}:`, error);
    }
  }
}

// Initialize directories
ensureUploadDirs().catch(console.error);

// Storage configuration for system uploads (bot images, etc.)
const systemStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = 'public/uploads/system';
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error: any) {
      cb(error, uploadPath);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// Storage configuration for user uploads
const userStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = 'public/uploads/users';
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error: any) {
      cb(error, uploadPath);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// File filter for images only
const imageFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP images are allowed.'));
  }
};

// Multer instances
export const systemUpload = multer({
  storage: systemStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

export const userUpload = multer({
  storage: userStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Helper function to delete a file
export async function deleteUploadedFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);
  }
}
