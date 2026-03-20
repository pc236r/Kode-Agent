import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  statSync,
  unlinkSync,
  renameSync,
} from "node:fs";
import {
  dirname,
  normalize,
  resolve,
  extname,
  relative,
  isAbsolute,
} from "node:path";
import { homedir } from "node:os";
export class SecureFileService {
  static instance;
  allowedBasePaths;
  maxFileSize;
  allowedExtensions;
  constructor() {
    this.allowedBasePaths = new Set([
      process.cwd(),
      homedir(),
      "/tmp",
      "/var/tmp",
    ]);
    this.maxFileSize = 10 * 1024 * 1024;
    this.allowedExtensions = new Set();
  }
  static getInstance() {
    if (!SecureFileService.instance) {
      SecureFileService.instance = new SecureFileService();
    }
    return SecureFileService.instance;
  }
  validateFilePath(filePath) {
    try {
      const normalizedPath = normalize(filePath);
      if (normalizedPath.length > 4096) {
        return {
          isValid: false,
          normalizedPath,
          error: "Path too long (max 4096 characters)",
        };
      }
      if (normalizedPath.includes("..") || normalizedPath.includes("~")) {
        return {
          isValid: false,
          normalizedPath,
          error: "Path contains traversal characters",
        };
      }
      const suspiciousPatterns = [
        /\.\./,
        /~/,
        /\$\{/,
        /`/,
        /\|/,
        /;/,
        /&/,
        />/,
        /</,
      ];
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(normalizedPath)) {
          return {
            isValid: false,
            normalizedPath,
            error: `Path contains suspicious pattern: ${pattern}`,
          };
        }
      }
      const absolutePath = resolve(normalizedPath);
      const isInAllowedPath = Array.from(this.allowedBasePaths).some(
        (basePath) => {
          const base = resolve(basePath);
          const rel = relative(base, absolutePath);
          if (!rel || rel === "") return true;
          if (rel.startsWith("..")) return false;
          if (isAbsolute(rel)) return false;
          return true;
        },
      );
      if (!isInAllowedPath) {
        return {
          isValid: false,
          normalizedPath,
          error: "Path is outside allowed directories",
        };
      }
      return { isValid: true, normalizedPath: absolutePath };
    } catch (error) {
      return {
        isValid: false,
        normalizedPath: filePath,
        error: `Path validation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  safeExists(filePath) {
    const validation = this.validateFilePath(filePath);
    if (!validation.isValid) {
      return false;
    }
    try {
      return existsSync(validation.normalizedPath);
    } catch (error) {
      return false;
    }
  }
  safeReadFile(filePath, options = {}) {
    const validation = this.validateFilePath(filePath);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }
    try {
      const normalizedPath = validation.normalizedPath;
      if (options.checkFileExtension !== false) {
        const ext = extname(normalizedPath).toLowerCase();
        const allowedExts =
          options.allowedExtensions || Array.from(this.allowedExtensions);
        if (allowedExts.length > 0 && !allowedExts.includes(ext)) {
          return {
            success: false,
            error: `File extension '${ext}' is not allowed`,
          };
        }
      }
      if (!existsSync(normalizedPath)) {
        return { success: false, error: "File does not exist" };
      }
      const stats = statSync(normalizedPath);
      const maxSize = options.maxFileSize || this.maxFileSize;
      if (stats.size > maxSize) {
        return {
          success: false,
          error: `File too large (${stats.size} bytes, max ${maxSize} bytes)`,
        };
      }
      if (!stats.isFile()) {
        return { success: false, error: "Path is not a file" };
      }
      if ((stats.mode & parseInt("400", 8)) === 0) {
        return { success: false, error: "No read permission" };
      }
      const content = readFileSync(normalizedPath, {
        encoding: options.encoding || "utf8",
      });
      return {
        success: true,
        content,
        stats: {
          size: stats.size,
          mtime: stats.mtime,
          atime: stats.atime,
          mode: stats.mode,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  safeWriteFile(filePath, content, options = {}) {
    const validation = this.validateFilePath(filePath);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }
    try {
      const normalizedPath = validation.normalizedPath;
      if (options.checkFileExtension !== false) {
        const ext = extname(normalizedPath).toLowerCase();
        const allowedExts =
          options.allowedExtensions || Array.from(this.allowedExtensions);
        if (allowedExts.length > 0 && !allowedExts.includes(ext)) {
          return {
            success: false,
            error: `File extension '${ext}' is not allowed`,
          };
        }
      }
      const contentSize =
        typeof content === "string"
          ? Buffer.byteLength(content, options.encoding || "utf8")
          : content.length;
      const maxSize = options.maxSize || this.maxFileSize;
      if (contentSize > maxSize) {
        return {
          success: false,
          error: `Content too large (${contentSize} bytes, max ${maxSize} bytes)`,
        };
      }
      if (options.createDirectory) {
        const dir = dirname(normalizedPath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true, mode: 0o755 });
        }
      }
      if (options.atomic) {
        const tempPath = `${normalizedPath}.tmp.${Date.now()}`;
        try {
          writeFileSync(tempPath, content, {
            encoding: options.encoding || "utf8",
            mode: options.mode || 0o644,
          });
          renameSync(tempPath, normalizedPath);
        } catch (renameError) {
          try {
            if (existsSync(tempPath)) {
              unlinkSync(tempPath);
            }
          } catch {}
          throw renameError;
        }
      } else {
        writeFileSync(normalizedPath, content, {
          encoding: options.encoding || "utf8",
          mode: options.mode || 0o644,
        });
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  safeDeleteFile(filePath) {
    const validation = this.validateFilePath(filePath);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }
    try {
      const normalizedPath = validation.normalizedPath;
      if (!existsSync(normalizedPath)) {
        return { success: false, error: "File does not exist" };
      }
      const stats = statSync(normalizedPath);
      if (!stats.isFile()) {
        return { success: false, error: "Path is not a file" };
      }
      if ((stats.mode & parseInt("200", 8)) === 0) {
        return { success: false, error: "No write permission" };
      }
      unlinkSync(normalizedPath);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  safeCreateDirectory(dirPath, mode = 0o755) {
    const validation = this.validateFilePath(dirPath);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }
    try {
      const normalizedPath = validation.normalizedPath;
      if (existsSync(normalizedPath)) {
        const stats = statSync(normalizedPath);
        if (!stats.isDirectory()) {
          return {
            success: false,
            error: "Path already exists and is not a directory",
          };
        }
        return { success: true };
      }
      mkdirSync(normalizedPath, { recursive: true, mode });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create directory: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  safeGetFileInfo(filePath) {
    const validation = this.validateFilePath(filePath);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }
    try {
      const normalizedPath = validation.normalizedPath;
      if (!existsSync(normalizedPath)) {
        return { success: false, error: "File does not exist" };
      }
      const stats = statSync(normalizedPath);
      return {
        success: true,
        stats: {
          size: stats.size,
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          mode: stats.mode,
          atime: stats.atime,
          mtime: stats.mtime,
          ctime: stats.ctime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get file info: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  addAllowedBasePath(basePath) {
    try {
      const normalized = normalize(resolve(basePath));
      if (!existsSync(normalized)) {
        return { success: false, error: "Base path does not exist" };
      }
      this.allowedBasePaths.add(normalized);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add base path: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  setMaxFileSize(maxSize) {
    this.maxFileSize = maxSize;
  }
  addAllowedExtensions(extensions) {
    extensions.forEach((ext) => {
      if (!ext.startsWith(".")) {
        ext = "." + ext;
      }
      this.allowedExtensions.add(ext.toLowerCase());
    });
  }
  isPathAllowed(filePath) {
    const validation = this.validateFilePath(filePath);
    return validation.isValid;
  }
  validateFileName(filename) {
    if (filename.length === 0) {
      return { isValid: false, error: "Filename cannot be empty" };
    }
    if (filename.length > 255) {
      return {
        isValid: false,
        error: "Filename too long (max 255 characters)",
      };
    }
    const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;
    if (invalidChars.test(filename)) {
      return { isValid: false, error: "Filename contains invalid characters" };
    }
    const reservedNames = [
      "CON",
      "PRN",
      "AUX",
      "NUL",
      "COM1",
      "COM2",
      "COM3",
      "COM4",
      "COM5",
      "COM6",
      "COM7",
      "COM8",
      "COM9",
      "LPT1",
      "LPT2",
      "LPT3",
      "LPT4",
      "LPT5",
      "LPT6",
      "LPT7",
      "LPT8",
      "LPT9",
    ];
    const baseName = filename.split(".")[0].toUpperCase();
    if (reservedNames.includes(baseName)) {
      return { isValid: false, error: "Filename is reserved" };
    }
    if (filename.startsWith(".") || filename.endsWith(".")) {
      return {
        isValid: false,
        error: "Filename cannot start or end with a dot",
      };
    }
    if (filename.startsWith(" ") || filename.endsWith(" ")) {
      return {
        isValid: false,
        error: "Filename cannot start or end with spaces",
      };
    }
    return { isValid: true };
  }
}
export const secureFileService = SecureFileService.getInstance();
//# sourceMappingURL=secureFile.js.map
