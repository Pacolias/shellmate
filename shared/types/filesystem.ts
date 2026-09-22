export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface ListDirectoryResult {
  path: string;
  entries: DirectoryEntry[];
  /** Set instead of throwing when the directory can't be read (permissions, gone, not a directory). */
  error: string | null;
}
