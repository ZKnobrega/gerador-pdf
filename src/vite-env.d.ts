/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    isElectron: boolean;
    platform: string;
    savePdfDialog: (defaultFilename: string) => Promise<{ success: boolean; filePath?: string; cancelled?: boolean; error?: string }>;
  };
}
