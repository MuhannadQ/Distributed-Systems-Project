const { servers, ZooKeeperAddress } = require('./db');
const serverId = process.env.SERVER_ID;
const { CreateMode, Event } = zookeeper = require('node-zookeeper-client');
const colors = require('colors');
//const { checkAndDelete } = require('./utils');

const client = zookeeper.createClient(ZooKeeperAddress);

function initialize(handlePosts) {
  client.once('connected', function () {
    console.log(`server_${serverId} is Connected to Zookeeper.`);
    createCitiesNode();
    servers[serverId].cities.forEach(cityId => {
      createCityNode(cityId);
      createServersNode(cityId);
      createServerNode(cityId);
      createLocksNode(cityId);
      createCountersNode(cityId);

      createPostsNode(cityId)
        .then(_ => watchPostsNode(cityId, handlePosts))
        .catch(error => console.log(colors.bgRed("createPostsNode %s"), error.stack))
      
      
      watchCityServers(cityId);
    });

  });
  client.connect();
}



function tryCreateNode(path, mode=CreateMode.PERSISTENT) {
  client.create(path, mode, function (error, path) {
    if (error) {
      if (error.getCode() == zookeeper.Exception.NODE_EXISTS) {
        console.log('Node: %s already exists.', path);
      } else {
        throw(error);
      }
      return;
    }
    console.log('Node: %s is created.', path);
  });
}

function createCitiesNode() {
  try {
    tryCreateNode('/cities');
  } catch(error) {
    console.log(error.stack);
  }
}
function createCityNode(cityId) {
  try {
    tryCreateNode(`/cities/city_${cityId}`);
  } catch(error) {
    console.log(error.stack);
  }
}
function createServersNode(cityId) {
  try {
    tryCreateNode(`/cities/city_${cityId}/servers`);
  } catch(error) {
    console.log(error.stack);
  }
  
}

function createServerNode(cityId) {
  try {
    tryCreateNode(`/cities/city_${cityId}/servers/server_${serverId}`, CreateMode.EPHEMERAL);
  } catch(error) {
    console.log(error.stack);
  }
}

function createPostsNode(cityId) {
  return new Promise((resolve, reject) => {
    try {
      tryCreateNode(`/cities/city_${cityId}/posts`);
    } catch(err) {
      return reject(err);
    }
    resolve(null);
  });
}

function createLocksNode(cityId) {
  try {
    tryCreateNode(`/cities/city_${cityId}/locks`);
  } catch(error) {
    console.log(error.stack);
  }
}
function createCountersNode(cityId) {
  try {
    tryCreateNode(`/cities/city_${cityId}/counters`);
  } catch(error) {
    console.log(error.stack);
  }
}


function watchPostsNode(cityId, handlePosts) {
  watchChildren(`/cities/city_${cityId}/posts`, handlePosts)
}



function createLock(path) {
  return new Promise((resolve, reject) => {
    client.create(path, CreateMode.EPHEMERAL, function (error, path) {
      if (error) {
        if (error.getCode() == zookeeper.Exception.NODE_EXISTS) {
          console.log('Node: %s already exists.', path);
          setTimeout(() => {
            createLock(path)
              .then(res => resolve(res))
              .catch(err => reject(err))
          }, 200);
        } else {
          reject(error);
        }
        return;
      }
      resolve(path);
      //console.log('Node: %s is created.', path);
    });
  })
  
}

function removeNode(path) {
  client.remove(path, function (error) {
    if (error) {
      if (error.getCode() == zookeeper.Exception.NO_NODE)
        console.log("removeNode %s but it was removed previously", path);
      else
        console.log("removeNode %s %s", path, error.stack);
      return;
    }
    console.log("removeNode %s success", path);
  });
}


function freeLock(lock) {
  client.remove(lock, function (error) {
    if (error) {
      console.log("freeLock %s %s", lock, error.stack);
      return;
    }
    console.log('Lock %s is deleted.', lock);
  });
}
function freeLocks(locks) {
  locks.forEach(lock => {
    freeLock(lock);
  })
}

function watchChildren(path, handler) {
  client.getChildren(
    path,
    function (event) {
      //definitely server died
      console.log('Got watcher event: %s', event);
      //if(passChildren) //because handle post needs to work only once
      watchChildren(path, handler);
    },
    async function (error, children, _) {
      if (error) {
        console.log(colors.bgRed("watchPosts fail %s %s"), path, error.stack);
        return;
      }
      if(children.length !== 0) {
        await handler(path, children);//handlePosts
      }
    }
  );
}

function getChildren(path) {
  return new Promise((resolve, reject) => {
    client.getChildren( path, function (error, children, _) {
      //console.log(stats);
      if (error) {
        return reject(error);
      }
      resolve(children);
    });
  })  
}

function createNode(path, mode, data=null) {
  if (data) {
    data = Buffer.from(data);
  }
  return new Promise((resolve, reject) => {
    client.create(path, data, mode, (error, path) => {
      if (error) {
        if (error.getCode() == zookeeper.Exception.NODE_EXISTS) {
          console.log('Node: %s already exists.', path);
        } else {
          reject(error);
        }
        return;
      }
      resolve(path);
    })
  })
}
function getNodeData(path) {
  return new Promise((resolve, reject) => {
    client.getData(path, function (error, data, _) {
      if (error) {
        return reject(error);
      }
      console.log('Got data: %s', data.toString('utf8'));
      resolve(data.toString('utf8'));
    });
  })
}
function checkNodeExists(path) {
  return new Promise((resolve, reject) => {
    client.exists(path, (error, stat) => {
      if (error) {
        return reject(error);
      }
      if (stat) {
        resolve(true); //exists
      } else {
        resolve(false); //doesn't exist
      }
    });
  })
}

function watchCityServers(cityId) {
  const cityServersPath = `/cities/city_${cityId}/servers`;
  const cityPostsPath = `/cities/city_${cityId}/posts`;
  client.getChildren(
    cityServersPath,
    function (event) {
      console.log('Got watcher event: %s', event);
      watchCityServers(cityId);
    },
    function(error, serversNames, _) {
      //checkAndDelete(error, children, cityServersPath, postPath, postPath);
      if(error) throw(error);
      client.getChildren(cityPostsPath, function(error, postsNames, _) {
        if(error) throw(error);
        postsNames.forEach(postName => {
          const postPath = `${cityPostsPath}/${postName}`;
          checkAndDelete(error, serversNames, cityServersPath, postPath, postPath);
        })
      });
    }
  );
}
module.exports = {initialize, client, CreateMode, getChildren, watchChildren, createNode, getNodeData, createLock, freeLock, freeLocks, removeNode, checkNodeExists, Event};