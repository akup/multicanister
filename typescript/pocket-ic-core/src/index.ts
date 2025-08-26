import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import express from 'express';
import coreRoutes from './routes/core';
import { PocketICService } from './services/PocketICService';
import chalk from 'chalk';

import * as dotenv from 'dotenv';
import { DATA_DIR } from './models/DataDir';
dotenv.config();

const argv = yargs(hideBin(process.argv))
  .option('port', {
    alias: 'p',
    type: 'number',
    description: 'Port to start the server on',
    default: 8091,
  })
  .option('pic-port', {
    alias: 'pic-p',
    type: 'number',
    description: 'Port to start PocketIC on',
    default: 4943,
  })
  .option('gateway-port', {
    alias: 'gw-p',
    type: 'number',
    description: 'Port to start the gateway on',
    default: 4944,
  })
  .parseSync();

const port = argv.port;
const picPort = argv.picPort;
const gatewayPort = argv.gatewayPort;
const app = express();

// Middleware
app.use(express.json());

// Routes
app.use('/api', coreRoutes);

console.log('Try to start with state dir: ', DATA_DIR);

// Start PocketIC
export const pocketICService = PocketICService.getInstance();
pocketICService
  .start({ port: picPort, gatewayPort })
  .then(() => {
    console.log(
      chalk.bold(
        `PocketIC started on port ${picPort}, process id: ${pocketICService.getPocketICProcessId()}`
      )
    );
    const server = app.listen(port, () => {
      console.log(chalk.bold(`Server is running on port ${port}`));
    });
    server.on('error', error => {
      console.error(chalk.red('Failed to start server:'), error);
      process.exit(1);
    });

    const app2 = express();
    app2.use(express.json());
    app2.use('/', (req, res) => {
      res.send('Hello world');
    });
    const server2 = app2.listen(3000, () => {
      console.log(chalk.bold(`Debug server is running on port 3000`));
    });
    server2.on('error', error => {
      console.error(chalk.red('Failed to start server:'), error);
      process.exit(1);
    });
  })
  .catch(error => {
    console.error(chalk.red('Failed to start PocketIC:'), error);
    process.exit(1);
  });

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down...');
  pocketICService
    .stop()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error during shutdown:', error);
      process.exit(1);
    });
});
