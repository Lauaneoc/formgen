import { createFormGenServer } from './app.js';
import { loadLocalEnvironment, readApiConfig } from './config.js';

loadLocalEnvironment();
const config = readApiConfig();
const server = createFormGenServer(config);

server.listen(config.port, config.host, () => {
  console.log(`API FormGen disponivel em http://${config.host}:${config.port}`);
  console.log(`Assistencia de IA configurada: ${Boolean(config.apiKey && config.model)}`);
});

function shutdown(): void {
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
