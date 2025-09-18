import { HttpClient } from "../http-client"

const vultrApiKey = "MT2PCQOJOMBBBA4QPNJVVI7PBBM6GEIUGKTA";

async function getSnapshot() {
  const snapshotResponse = await HttpClient.get("https://api.vultr.com/v2/snapshots", {
    headers: {
      Authorization: `Bearer ${vultrApiKey}`
    }
  });
  return snapshotResponse;
}

getSnapshot().then(console.log)