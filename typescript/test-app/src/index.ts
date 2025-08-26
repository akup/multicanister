import express from 'express';
import { Ed25519KeyIdentity } from '@dfinity/identity';
import { Actor, ActorSubclass, HttpAgent } from '@dfinity/agent';
import { createAgent } from '@dfinity/utils';
import type { _SERVICE, idlFactory } from './declarations/hello.did';

const app = express();
const PORT = process.env.PORT || 3000;
const ICGatewayAPIHost = 'http://pocket-ic-core:4944';

let agent: HttpAgent | null = null;
// Middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Test App</title>
      </head>
      <body>
        <h1>Send a Number to POST /</h1>
        <form id="numForm">
          <label for="num">Number:</label>
          <input type="number" id="num" name="num" value="1" required>
          <button type="submit">Send</button>
        </form>
        <div id="result"></div>
        <script>
          document.getElementById('numForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const num = document.getElementById('num').value;
            const response = await fetch('/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              // Send as query param for compatibility with backend
              // (could also send in body if backend is changed)
              // body: JSON.stringify({ num })
            });
            const text = await response.text();
            document.getElementById('result').innerText = text;
          });
        </script>
      </body>
    </html>
  `);
});

app.post('/', async (req, res) => {
  const num = req.query.num && typeof req.query.num === 'string' ? BigInt(req.query.num) : 1n;

  try {
    // Note: You'll need to define factoryCanisterId or get it from environment/config
    const actor: ActorSubclass<_SERVICE> = Actor.createActor(idlFactory, {
      agent: agent!,
      canisterId: '75lp5-u7777-77776-qaaba-cai',
    });

    const result = await actor.get(num);
    console.log(`got result: ${result}`);
    res.send(`ok: ${result}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('error');
  }
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
  try {
    const identity = Ed25519KeyIdentity.generate();
    agent = await createAgent({
      identity,
      host: ICGatewayAPIHost,
    });
    console.log(`Try to access Pocket IC at ${ICGatewayAPIHost}`);
    // Fetch root key as we are talking to the Pocket IC and not the mainnet
    await agent.fetchRootKey();
    console.log(`Root key fetched`);
  } catch (error) {
    console.error(error);
    console.log(`Error fetching root key: ${error}`);
  }
});
