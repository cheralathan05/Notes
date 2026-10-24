import { prisma } from '../src/lib/prisma';
import { getOrCreateUserWorkspace } from '../src/lib/workspace';
import { hashToken } from '../src/lib/tokens';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'cheralathannandha9098@gmail.com' },
  });

  if (!user) {
    console.error('User not found!');
    process.exit(1);
  }

  const ws = await getOrCreateUserWorkspace(user.id);
  const rawToken = `atlas_dev_${crypto.randomBytes(32).toString('hex')}`;
  const tokenHash = hashToken(rawToken);

  const devToken = await prisma.developerToken.create({
    data: {
      userId: user.id,
      workspaceId: ws.workspaceId,
      name: 'Local CLI Token',
      tokenHash,
    },
  });

  const configDir = path.join(os.homedir(), '.atlas');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const configFile = path.join(configDir, 'config.json');
  const config = {
    apiUrl: 'http://localhost:4000',
    token: rawToken,
    workspaceId: ws.workspaceId,
    userEmail: user.email,
  };

  fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf-8');

  console.log('Successfully provisioned CLI Developer Token:');
  console.log('User:', user.email);
  console.log('Workspace ID:', ws.workspaceId);
  console.log('Saved to:', configFile);
  console.log('Raw Token:', rawToken);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
