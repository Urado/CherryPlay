import { existsSync, readFileSync } from 'fs';
import path from 'path';

/**
 * Web client version for X-Client-Version header.
 * Primary source: CherryPlayServer/appsettings.json → ClientCompatibility.ServerVersion
 * Fallback: CherryPlayWeb/package.json version
 */
export function readWebClientVersion(webRootDir) {
  const appsettingsCandidates = [
    path.join(webRootDir, '../CherryPlayServer/appsettings.json'),
    path.join(webRootDir, 'CherryPlayServer/appsettings.json'),
  ];

  for (const appsettingsPath of appsettingsCandidates) {
    if (!existsSync(appsettingsPath)) {
      continue;
    }

    const appsettings = JSON.parse(readFileSync(appsettingsPath, 'utf-8'));
    const serverVersion = appsettings?.ClientCompatibility?.ServerVersion;
    if (typeof serverVersion === 'string' && serverVersion.trim() !== '') {
      return serverVersion.trim();
    }
  }

  const packageJsonPath = path.join(webRootDir, 'package.json');
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  return pkg.version;
}
