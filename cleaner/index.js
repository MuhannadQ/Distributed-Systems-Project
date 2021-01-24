const zookeeper = require('node-zookeeper-client');
 console.log(process.env.ZK_ADDRESS);
const client = zookeeper.createClient(process.env.ZK_ADDRESS);
 
client.once('connected', function () {
  console.log('Cleaner Connected to the Zookeeper.');
  client.removeRecursive('/cities', function (error) {
    if (error) {
      if(error.getCode() == zookeeper.Exception.NO_NODE) {
        console.log("Already Clean :|");
      } else {
        console.log(error.stack);
      }
      return;
    }
    console.log('Cleaned Everything :)');
    client.close();
  });
});
 
client.connect();