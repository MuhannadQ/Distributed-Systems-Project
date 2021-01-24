const Math = require('mathjs');
const colors = require('colors');
const { client: zooClient, createNode, checkNodeExists, removeNode } = require('./zookeeper');
const { cities, servers, rides, requests } = require('./db');
const RidesClient = require('./rpc/client');
const {CreateMode, Exception} = require('node-zookeeper-client');
const SERVER_ID = process.env.SERVER_ID;
const myCities = servers[SERVER_ID].cities;
const PostType = Object.freeze({ NEW_RIDE: 0, UPDATE_RIDE: 1, NEW_REQUEST: 2 });


function chooseRandomChild(path) {
  return new Promise((resolve, reject) => {
    zooClient.getChildren( path, function (error, children, _) {
      if (error) {
        return reject(error);
      }
      if (children.length > 0) {
        console.log(`children of ${path} are ${children}`);
        const index = Math.floor(Math.random() * children.length);
        resolve(children[index]);
      } else {
        resolve(null);
      }
    });
  }) 
}
function chooseAliveServer(cityId) { //returns an alive server object that's responsible for city with cityId
  // /cities/city_cityId/servers/server_serverId
  return new Promise((resolve, reject) => {
    console.log("cityId", cityId);
    chooseRandomChild(`/cities/city_${cityId}/servers`)
      .then(serverName => {
        console.log(serverName);
        if(!serverName) {
          throw("Unexpected Error, We assume there's at least one alive server ineach city");
        }
        resolve(servers[serverName.split('_')[1]]);
      })
      .catch(error => reject(error))
  })
}
function publishTransaction(postPath, serverPath, data) {
  data = Buffer.from(data);
  return new Promise((resolve ,reject) => {
    zooClient.transaction().
      create(postPath, data, CreateMode.PERSISTENT).
      create(serverPath, CreateMode.EPHEMERAL).
      commit(function (error, results) {
        if (error) {
          console.log('Failed to execute the transaction: %s, results: %j',error,results);
          return reject(error);
        }
        console.log('Transaction completed. %j', results);
        resolve(1);
        
          //client.close();
      });
  })
}

function broadcastPost(cityId, serverId, postType, version, rideId=null) {
  return new Promise(async (resolve, reject) => {
    const data = JSON.stringify({publisher: serverId, version});
    const cityPath = `/cities/city_${cityId}`;
    let postPath, counter;
    
    if(postType !== PostType.UPDATE_RIDE ) {
      const counterPath = await createNode(`${cityPath}/counters/#`, CreateMode.EPHEMERAL_SEQUENTIAL);
      removeNode(counterPath);
      counter = counterPath.split('#')[1];
    }
    if (postType === PostType.NEW_RIDE) {
      postPath = `${cityPath}/posts/ver${version}-ride#c${cityId}-${counter}`;
    } else if (postType === PostType.UPDATE_RIDE) {
      postPath = `${cityPath}/posts/ver${version}-ride#${rideId}`;
    } else { // postType === PostType.NEW_REQUEST
      postPath = `${cityPath}/posts/request#c${cityId}-${counter}`;
    }
    const serverPath = `${postPath}/server@${SERVER_ID}`
    try {  
      //transaction
      await publishTransaction(postPath, serverPath, data)
      console.log('post transaction: %s is created.', postPath);
      const id = postPath.split('#')[1];

      const cityServersPath = `${cityPath}/servers`;
      try {
        await watchPostServers(postPath, cityServersPath);
      } catch(error) {
        console.log(colors.bgRed("ERROR CAUGHT IN watchPostServers in broadcastPost"), error.stack);
      }
        // .then(_ => {
        //   watchCityServers(cityServersPath, postPath)
        //     .catch(error => console.log(colors.bgRed("ERROR CAUGHT IN watchCityServers in broadcastPost"), error.stack))
        // })

      resolve(id);
    } catch(error) {
      reject(error);
    }
  });
}

//const PassengerSituation = Object.freeze({GET_ON: "GET_ON", GET_OFF: "GET_OFF"});

function updateRideLocally(updateData){
  //departure and destination are the stops of the person who requested a ride (not the departure of the ride)
  const {rideId, requestId, departure, destination} = updateData; 
  console.log("updateData ", updateData);
  let ride = rides[rideId];
  let stops = ride.stops;
  const getOnRequest = requestId;//{id: requestId, situation: PassengerSituation.GET_ON};
  const getOffRequest = requestId;//{id: requestId, situation: PassengerSituation.GET_OFF};
  let startIndex = 0, endIndex = stops.length - 1;
  let destinationStop = stops.pop();
  

  if (departure === ride.departure && destination !== ride.destination) { // (same Departure only)
    //stops[0].requests.push(getOnRequest);
    // endIndex = stops.findIndex(stop => stop.cityId === destination);
    // if(endIndex === -1) {    
    stops.push({ cityId: destination, vacancies: stops[stops.length - 1].vacancies, requests: ["new"] });
    startIndex = 0;
    endIndex = stops.length - 1;
    // endIndex = stops.length - 1;
    // }
  }
  if(departure !== ride.departure && destination === ride.destination) { // (same Destination only)
    // startIndex = stops.findIndex(stop => stop.cityId === departure);
    // if(startIndex === -1) {
    stops.push({ cityId: departure, vacancies: stops[stops.length - 1].vacancies, requests: ["new"] });
    startIndex = stops.length - 1;
    endIndex = stops.length;
      // startIndex = stops.length - 1;
    // }
  }
  
  stops.push(destinationStop);

  for(let i = startIndex; i < endIndex; i++) {
    stops[i].vacancies--;
  }
  console.log(stops);
  console.log("startIndex: %s, endIndex: %s", startIndex, endIndex);
  stops[startIndex].requests.push(getOnRequest);
  stops[endIndex].requests.push(getOffRequest);
  return ++ride.version;
  // maybe checkVacancies helps if I want to allow some concurrent work
  // checkVacancies
  // rides[rideId] = ride;
}

// function watchServersToRemovePost(postPath, cityServersPath) {
//   return new Promise((resolve, reject) => {
    
//     zooClient.getChildren(
//       postPath,
//       function (event) {
//         //definitely server died
//         console.log('Got watcher event: %s', event);
//         tryRemovePost(postPath,cityServersPath)//watchServersToRemovePost(postPath, cityServersPath);
//       },
//       function (error, children, _) {
//         if (error) throw(error);
  
//         const numCityServers = children.length;
  
//         zooClient.getChildren(comparePath, (error, children, _) => {
//           if (error) throw(error);
//           const numPostServers = children.length;
//           if(numCityServers === numPostServers) {
//             zooClient.removeRecursive(deletePath, (error) => {
//               ///////SHOULD DO SOMETHING HERE AFTER DELETING
//               if (error) throw(error);
//               console.log(`${deletePath} Nodes removed.`);
//             });
//           }
//         });
//       }
//     );
//   })
  
// }
// function syncServers(cityId) {
//   const postsPath = `/cities/city_${cityId}/posts`;
//   return new Promise((resolve, reject) => {
//     getChildren(postsPath)
//       .then(children => {
//         if(children > 0) {
//           handlePosts(postsPath, children)
//             .then(rs => resolve("synced"))
//         }
//       })
//       .catch(error => reject(error))
//   })
// }

//let postDeleted = false;
function checkNoNode(error, path) { //used to check if the post is deleted
  if (error) {
    if (error.getCode() == Exception.NO_NODE) { 
      console.log('%s was removed.', path);
      //postDeleted = true;
      return true;
    } else {
      return false;
      // console.log(colors.bgRed('ERROR with post: %s. '), path, error.stack);
      // throw(error);
    }
  }
  return false;
}

function checkAndDelete(error, children, watchPath, comparePath, deletePath) {
  if(checkNoNode(error, watchPath)) return;// (in case watchPath = postPath), this is used because maybe another server already deleted the post before him
  //if(!fromWatch) return;

  const watchedNodeServers = children.length;

  zooClient.getChildren(comparePath, function (error, children, _) {
    if(checkNoNode(error, comparePath)) return;
    const otherNodeServers = children.length;

    if(watchedNodeServers === otherNodeServers) {
      zooClient.removeRecursive(deletePath, function (error) {
        if(checkNoNode(error, deletePath)) return;
        console.log(`${deletePath} Nodes removed.`);
      });
    }
  });
}
// async function watchServersAndDelete(watchPath, comparePath, deletePath) {//fromWatch=false
//   //if(!await checkNodeExists(deletePath)) return; //if removed return
//   zooClient.getChildren(
//     watchPath,
//     function (event) {
//       console.log('Got watcher event: %s', event);
//       // if(!postDeleted) {
//       //   postDeleted = false;
//       watchServersAndDelete(watchPath, comparePath, deletePath);
//       // }
//     },
//     function(error, children, _) {
//       checkAndDelete(error, children, watchPath, comparePath, deletePath);
//     }
    
//   );
// }

function watchCityServers(cityServersPath, postPath, fromWatch=false) {
  return new Promise((resolve, reject) => {
    try {
      zooClient.getChildren(
        cityServersPath,
        function (event) {
          console.log('Got watcher event: %s', event);
          if(!fromWatch) {
            watchCityServers(cityServersPath, postPath, true);
          }
        },
        function(error, children, _) {
          checkAndDelete(error, children, cityServersPath, postPath, postPath);
        }   
      );
    } catch(error) {
      return reject(error);
    }
    resolve(null);
  })
}
function watchPostServers(postPath, cityServersPath) {
  return new Promise((resolve, reject) => {
    zooClient.getChildren(
      postPath,
      function (event) {
        console.log('Got watcher event: %s', event);
        watchPostServers(postPath, cityServersPath);
      },
      function(error, children, _) {
        checkAndDelete(error, children, postPath, cityServersPath, postPath);
      }
    );
    resolve(1);
  })
}

// function watchPostPublisher(postPath, handler) { //handler=handlePost
//   zooClient.getChildren(
//     postPath,
//     function (event) {
//       console.log('watchPostPublisher got watcher event: %s', event);
//       handler(postPath, fromPostWatcher=true);
//     },
//     function(error, children, _) {
//       if(error) {
//         if (error.getCode() == Exception.NO_NODE) { 
//           console.log('watchPostPublisher post: %s was removed.', path);
//         } else {
//           throw(error);
//         }
//         return;
//       }
//       handler(postPath, fromPostWatcher=true);
//     }
//   );
// }
function getLineEquation({x1, y1},{x2, y2}) {
  if(y2 === y1) {
    // ax + by + c = 0
    // 0x + y - y1 = 0 : y = y1
    return {a: 0, b: 1, c: -y1}
  }
  if(x1 === x2) {
    // ax + by + c = 0
    // 1x + 0y - x1 = 0 : x = x1
    return {a: 1,b: 0, c: -x1};
  }
  // ax + by + c = 0
  // mx + -1y + (y1-mx1) = 0 : x = x1
  const m = (y2 - y1) / (x2 - x1);
  return {a: m, b: -1, c: y1 - m*x1};
}
//calculates distance between line and point
function distance(line, point) {
  const {a, b ,c} = line;
  const {x, y} = point;
  //line is : {a, b, c} which is : ax + by + c = 0
  //point is {x, y}
  return Math.abs(a*x + b*y + c) / Math.sqrt(a*a + b*b);
}
function getDeviation({x: x1, y: y1}, {x: x2, y: y2}, {x: x0, y: y0}) {
  const line = getLineEquation({x1, y1}, {x2, y2});
  return distance(line, {x: x0, y: y0});
}

function findPermutationAux(listOfLists, index, seen, res) {
  if(index === listOfLists.length) {
    return true;
  } 
  for(const id of listOfLists[index]) {
    if(seen[id]) continue;

    res[index] = id;
    seen[id] = true;
    if(findPermutationAux(listOfLists, index + 1, seen, res)) {
      return true;
    }
    seen[id] = false;
  }
  return false;
}

function findPermutation(listOfLists) { //return empty array if not found
  let res = new Array(listOfLists.length);
  let seen = {};
  if(findPermutationAux(listOfLists, 0, seen, res)) {
    return res;
  }
  return [];
}
// function waitUntil(lockIsFree) {
//   return new Promise((resolve, reject) => {
//     const interval = setInterval(() => {
//       if (lockIsFree()) {
//         resolve('free');
//         clearInterval(interval);
//       };
//     }, 100);
//   });
// }



function getAllRides() { //returns the rideIds not the rides themselves
  return new Promise(async (resolve, reject) => {
    let data = initDataFrom(rides); //gets the local rides
    for(const cityId in cities) {
      if(myCities.includes(parseInt(cityId)))
        continue;
      try {
        const rpcServer = await chooseAliveServer(cityId);
        console.log(rpcServer);
        const rpcClient = new RidesClient(`${rpcServer.ip}:${rpcServer.port}`);
        const cityRides = await rpcClient.getAllRides(cityId);
        cityRides.forEach(cityRide => {
          data[cities[cityId].name].push(cityRide.id);
        })
      } catch (e) {
        reject(e);
      }
    }
    resolve(data);
  })
}
function getAllRequests() { //returns the requestIds not the requests themselves
  return new Promise(async (resolve, reject) => {
    let data = initDataFrom(requests);
    for(const cityId in cities) {
      if(myCities.includes(parseInt(cityId)))
        continue;
      try {
        const rpcServer = await chooseAliveServer(cityId);
        const rpcClient = new RidesClient(`${rpcServer.ip}:${rpcServer.port}`);
        const cityRequests = await rpcClient.getAllRequests(cityId);
        cityRequests.forEach(cityRequest => {
          data[cities[cityId].name].push(cityRequest.id);
        })
      } catch (e) {
        reject(e);
      }
    }
    resolve(data);
  })
}
function initDataFrom(items) {
  let data = {};
  cities.forEach(city => {
    data[city.name] = [];
  })
  for(const itemId in items) {
    const cityId = parseInt(itemId.split('-')[0].split('c')[1]);
    data[cities[cityId].name].push(itemId);
  }
  return data;
}


function renderJSON(obj) {
  'use strict';
  var keys = [],retValue = "";
  for (var key in obj) {
    if (typeof obj[key] === 'object') {
      retValue += "<div class='tree'>" + key;
      retValue += renderJSON(obj[key]);
      retValue += "</div>";
    } else {
      retValue += "<div class='tree'>" + key + " : " + obj[key] + "</div>";
    }
    keys.push(key);
  }
  return retValue;
}
module.exports = {broadcastPost, findPermutation, PostType, chooseRandomChild,chooseAliveServer, updateRideLocally, watchCityServers, watchPostServers, createNode , getDeviation, getAllRides, getAllRequests, renderJSON, checkAndDelete }