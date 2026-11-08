const { MongoClient } = require('mongodb');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const uri = "mongodb+srv://STACK_QUEUE:Stack2023@stackqueuecluster.wfarxbd.mongodb.net/?retryWrites=true&w=majority&appName=StackQueueCluster";

async function run() {
  const client = new MongoClient(uri, {
    tls: true,
    serverSelectionTimeoutMS: 10000
  });

  try {
    console.log("Connecting with MongoClient...");
    await client.connect();
    console.log("Successfully connected!");
    const adminDb = client.db('admin');
    const dbs = await adminDb.command({ listDatabases: 1 });
    console.log("Databases:", dbs.databases.map(d => d.name));
    
    // Check or create whatsapp_automation db
    const appDb = client.db('whatsapp_automation');
    const cols = await appDb.listCollections().toArray();
    console.log("Collections in whatsapp_automation:", cols.map(c => c.name));
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await client.close();
  }
}

run();
