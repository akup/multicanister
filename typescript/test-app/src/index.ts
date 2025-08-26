import express from 'express';
import { Ed25519KeyIdentity } from '@dfinity/identity';
import { HttpAgent } from '@dfinity/agent';
import { createAgent } from '@dfinity/utils';

const app = express();
const PORT = process.env.PORT || 3000;
const ICGatewayAPIHost = 'http://pocket-ic-core:4944';

let agent: HttpAgent | null = null;
// Middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  console.log('Hello world called');
  //TODO: try to call canister here
  res.send('Hello world');
});

app.get('/test', (req, res) => {
  res.send('Hello world');
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`  GET http://localhost:${PORT}/`);
  console.log(`  GET http://localhost:${PORT}/test`);

  // Initialize management canister
  const identity = Ed25519KeyIdentity.generate();
  agent = await createAgent({
    identity,
    host: ICGatewayAPIHost,
  });
  console.log(`Try to access Pocket IC at ${ICGatewayAPIHost}`);
  // Fetch root key as we are talking to the Pocket IC and not the mainnet
  await agent.fetchRootKey();
  console.log(`Root key fetched`);
});
