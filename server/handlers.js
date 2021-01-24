const SERVER_ID = process.env.SERVER_ID;
const RidesClient = require('./rpc/client');
const { servers, rides, requests } = require('./db');
const { chooseRandomChild, watchCityServers, watchPostServers } = require('./utils');
const { createNode, getNodeData, getChildren, removeNode, checkNodeExists } = require('./zookeeper');
const { CreateMode, Exception } = require('node-zookeeper-client');
const colors = require('colors');

function chooseAliveServerFromPost(postPath) { //returns an alive server object that's responsible for city with cityId
  return new Promise((resolve, reject) => {
    chooseRandomChild(postPath)
      .then(serverName => {
        if (serverName)
          resolve(servers[serverName.split('@')[1]]);
        else
          resolve(null);
      })
      .catch(error => reject(error))
  })
}
function publisherFailed(cityServersPath, serverId) {
  return new Promise((resolve, _) => {
    checkNodeExists(`${cityServersPath}/server_${serverId}`)
      .then(result => resolve(!result))
      .catch(error => reject(error))
  })
}
function handlePost(postPath) { //the problem is when we remove a post but some other server is just coming to handle it
  // VERY IMOPORTANT TO CHECK IF THE POST EXISTS
return new Promise(async (resolve, reject) => {
  console.log("At handlePost ", postPath);
  const rideId = postPath.split('ride#')[1];
  const requestId = postPath.split('request#')[1];
  let postServers, publisherId, postVersion, myVersion;
  try {
    const postData = JSON.parse(await getNodeData(postPath));
    publisherId = postData.publisher;
    if(SERVER_ID == publisherId) {console.log("Getting out of handlePost");return resolve(1);} //publisher shouldn't do anything
    postVersion = postData.version;
    myVersion = getPostVersion(rideId, requestId);
    // We still need to add ourselves as servers of the post even if our version is higher
    postServers = await getChildren(postPath);
    if(postServers.length === 0) {
      removeNode(postPath);//if the publisher server failed/no servers we remove the post
      return resolve(1);
    }
    console.log("CHECKING IF SERVER EXISTS AS POST SERVER");
    console.log(postServers);
    if(postServers.includes(`server@${SERVER_ID}`)) return resolve(1); //end if you already got this post
  } catch(error) {
    if (error.getCode() == Exception.NO_NODE) return resolve(1); // return if the post is removed
    console.log(colors.bgRed("ERROR in handlePost from getChildren OR getNodeData "),error.stack);
  }
  const cityServersPath = postPath.split('posts')[0] + "servers";
  
  //if im not the publisher and there might be someone
  if (myVersion <= postVersion) { //publisherId is string
    let rpcServer = servers[postServers[Math.floor(Math.random() * postServers.length)].split('@')[1]]; 
    /*
    If the rpc server failed we still need to find another server to get the ride from 
    for that we can use: await chooseAliveServerFromPost(postPath);
    */
    //even if rpcServer is not null and we reach here we might get an error if the serving server failed during the rpc connection
    const rpcClient = new RidesClient(`${rpcServer.ip}:${rpcServer.port}`);
    try {// LOOOOP
      if(rideId) rides[rideId] = await rpcClient.getRide(rideId);
      else requests[requestId] = await rpcClient.getRequest(requestId); //if (requestId)
    } catch(err) {//connection error or rpcServer failed //kill yourself if you're disconnected from the system or find another server to copy from
      console.log(colors.bgRed("ERROR IN GETTING A RIDE/REQUEST getRide/getRequest in handlePost (Maybe the postServer I chose failed because I got the postServers previously) "), err);      
    }
  } 
  /*
  Watches are ordered with respect to other events, other watches, and asynchronous replies.
  The ZooKeeper client libraries ensures that everything is dispatched in order.
  THIS MEANS I GET a POST Event Before I Get a failure event of some server which died
  */
  try {
    await watchPostServers(postPath, cityServersPath);
    const path = await createNode(`${postPath}/server@${SERVER_ID}`, CreateMode.EPHEMERAL);
    console.log('Ephemeral: %s is created.', path);
  } catch(error) {
    if (error.getCode() == Exception.NO_NODE) return resolve(1);
    console.log(colors.bgRed("ERROR CAUGHT IN watchPostServers/createNode in handlePost"), error.stack);
  }
    
  return resolve(1);
})
  
    // await watchCityServers(cityServersPath, postPath);
    //const path = await createNode(`${postPath}/server@${SERVER_ID}`, CreateMode.EPHEMERAL);
}

function handlePosts(postsPath, posts) {
return new Promise((resolve, reject) => {
    //path is: /cities/city_<id>/posts
    console.log(`posts in ${postsPath} are ${posts}`);
    //let maxTimestamp = TIMESTAMP;
    posts.forEach(async post => {
      await handlePost(`${postsPath}/${post}`);
      // if(postTimestamp > maxTimestamp)
      //   maxTimestamp = postTimestamp;
    })
    return resolve(1);
})
}



function getPostVersion(rideId, requestId) {
   //I don't have the post
  if(rideId && rides[rideId]) { //I have the post and it is a ride
    return rides[rideId].version;
  } else if(requestId && requests[requestId]) {
    return requests[requestId].version;
  } else {
    return -1;
  }
}

module.exports = { handlePosts }