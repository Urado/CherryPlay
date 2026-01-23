export interface FileSystemItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number; // File size in bytes (optional, only for files)
}

export interface FileSystemNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileSystemNode[]; // Nested items (only for directories)
  size?: number; // File size in bytes (optional, only for files)
}
