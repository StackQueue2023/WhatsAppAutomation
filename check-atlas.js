const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

const uri = "mongodb+srv://STACK_QUEUE:Stack2023@stackqueuecluster.wfarxbd.mongodb.net/whatsapp_automation?retryWrites=true&w=majority";

console.log("Checking MongoDB connection...");
mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log("CONNECTED TO ATLAS SUCCESSFULLY!");
    process.exit(0);
  })
  .catch(err => {
    console.log("ATLAS_CONNECTION_STATUS:", err.message);
    process.exit(0);
  });
