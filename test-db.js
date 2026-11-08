const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');

const uri = "mongodb+srv://STACK_QUEUE:Stack2023@stackqueuecluster.wfarxbd.mongodb.net/whatsapp_automation?retryWrites=true&w=majority";

async function testConnection() {
  try {
    console.log("Connecting to MongoDB Atlas with Google DNS...");
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log("SUCCESS! Connected to MongoDB Atlas!");
    const dbs = await mongoose.connection.db.admin().listDatabases();
    console.log("Databases in cluster:", dbs.databases.map(d => d.name));
    await mongoose.disconnect();
    console.log("Disconnected cleanly.");
  } catch (err) {
    console.error("Connection error:", err.message);
  }
}

testConnection();
