import { setup as welcomeSetup } from './welcome.js';
import { setup as commandsSetup } from './commands.js';
import { setup as moderationSetup } from './moderation.js';
import { setup as serverlogSetup } from './serverlog.js';
import { setup as ticketsSetup } from './tickets.js';

export function loadModules(client) {
  welcomeSetup(client);
  commandsSetup(client);
  moderationSetup(client);
  serverlogSetup(client);
  ticketsSetup(client);
}
