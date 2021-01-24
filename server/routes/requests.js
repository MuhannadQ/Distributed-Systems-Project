const express = require('express');
const router = express.Router();
const { servers, cities, rides, requests } = require('../db');
const serverId = process.env.SERVER_ID;
const myCities = servers[serverId].cities;
const RidesClient = require('../rpc/client');
const { createLock, freeLock, freeLocks} = require('../zookeeper');
const { broadcastPost, findPermutation, PostType, chooseAliveServer, getDeviation, updateRideLocally, getAllRequests } = require('../utils');
const colors = require('colors');

function getValidLocalRides(departure, destination, date, onlyOne) {
  let res = [];
  for (const rideId in rides) {
    if(onlyOne && res.length === 1) break;
    const ride = rides[rideId];
    // console.log(typeof ride.departure);
    // console.log(typeof departure);
    // console.log(typeof ride.destination);
    // console.log(typeof destination);
    
    if(ride.date !== date) continue;
    if(ride.departure !== departure && ride.destination !== destination) continue;
    let stops = ride.stops;
    //let destinationStop = stops.pop();
    let startIndex = 0, endIndex = stops.length - 1, deviation = 0;
    let vacanciesCond = true;

    if (ride.departure === departure && ride.destination !== destination) { // (same Departure only)
      deviation = getDeviation(cities[ride.departure], cities[ride.destination], cities[destination]);
      //endIndex = stops.findIndex(stop => stop.cityId === destination);
      //if(endIndex === -1) endIndex = stops.length - 1;
    }
    if(ride.departure !== departure && ride.destination === destination) { // (same Destination only)
      deviation = getDeviation(cities[ride.departure], cities[ride.destination], cities[departure]);
      startIndex = stops.length - 1;
      //startIndex = stops.findIndex(stop => stop.cityId === departure);
      //if(startIndex === -1) startIndex = stops.length - 2;
    }
    //stops.push(destinationStop);

    for(let i = startIndex; i < endIndex; i++) {
      if(stops[i].vacancies == 0) {
        vacanciesCond = false;
        break;
      }
    }
    //date already Checked
    if(vacanciesCond && deviation <= ride.pd) {
      res.push(rideId);
    }
    // if(ride.departure === departure && ride.destination === destination) {
    //   // TODO check vacancies > 0 for all 
    //   res.push(rideId);
    // }

    //     const deviation = getDeviation(cities[ride.departure], cities[ride.destination], cities[destination]);
    //     const stops = ride.stops;
    //     let stopIndex = stops.findIndex(stop => stop.cityId === rideRequest.departure);
    //     if(stopIndex === -1) stopIndex = stops.length - 2;
    //     const canStop = stops[stopIndex].vacancies > 0;
    //     if(deviation <= ride.pd)
    //       res.push(rideId);
    //   } else if(ride.destination == destination && getDeviation(cities[ride.departure], cities[ride.destination], cities[departure]) <= ride.pd) {
    //     res.push(rideId);
    //   }
    // }   
  }
  return res;
}

router.post('/', async (req, res) => {
  // stops include departure and destination
  const version = 0;
  let { firstName, lastName, phoneNumber, stops, dates } = req.body;
  stops = stops.map(stop => parseInt(stop));
  const passenger = { firstName, lastName, phoneNumber };
  const onlyOneRide = (stops.length === 2);
  let rideIds = [], results = {}, pathRides = [], myLocks = [];
  const departure = stops[0]; //this server is responsible of the city "departure"

  for(let i = 0; i < stops.length - 1; i++) {
    const curDeparture = stops[i];
    const curDestination = stops[i + 1];
    const date = (typeof dates === 'string') ? dates : dates[i];
    //LOCAL
    let segmentRides = getValidLocalRides(curDeparture, curDestination, date, onlyOneRide);
    if (segmentRides.length > 0) {
      createLock(`/cities/city_${departure}/locks/lock_${curDestination}_${date}`)
        .then(lockPath => myLocks.push(lockPath))
        .catch(error => console.log(colors.bgRed("ERROR with createLock in requests POST %s"), error.stack))
    }
    //LOCK 
    console.log("SEGMENT RIDES", segmentRides);
    //NON-LOCAL
    for(const cityId in cities) {
      if(onlyOneRide && segmentRides.length === 1) break;
      if(myCities.includes(parseInt(cityId))) continue;//if I'm responsible for this city I don't need to request rides from other servers
      //TODODODODODOD  if(sameStopAGAIN) don't create lock and take same result
      // t5so5 request to cityid when doing same destination and date
      try {
        const lockPath = await createLock(`/cities/city_${cityId}/locks/lock_${curDestination}_${date}`);
        myLocks.push(lockPath);

        const deviation = getDeviation(cities[cityId], cities[curDestination], cities[curDeparture]);

        const rpcServer = await chooseAliveServer(cityId);//servers[Math.random*cities[cityId].servers.length];
        const rpcClient = new RidesClient(`${rpcServer.ip}:${rpcServer.port}`);
        //if server died during call  get another server
        if(onlyOneRide) {
          console.log("REQUESTING RIDE#############");
          const cityRide = await rpcClient.requestRide({cityId, departure: curDeparture, destination: curDestination, date, deviation});
          console.log("RIDE FROM CITY");
          console.log(cityRide);
          if(cityRide === 'null') {
            freeLock(myLocks[0]); //if we only need one and we got nothing from this city then we free lock
            myLocks.pop();
          }
          else segmentRides = [cityRide];//cityRide is an id
            
        } else {
          let cityRides = [];
          if(results[`${curDestination}_${date}_${cityId}`] === undefined) {
            cityRides = await rpcClient.requestRides({cityId, departure: curDeparture, destination: curDestination, date, deviation});
            results[`${curDestination}_${date}_${cityId}`] = cityRides;
          } else {
            cityRides = results[`${curDestination}_${date}_${cityId}`];
          }
          if(cityRides.length == 0) {// we are not attached to this city so we free lock
            freeLock(myLocks[myLocks.length - 1]);
            myLocks.pop();
          }
          segmentRides = [...segmentRides, ...cityRides];
        }
      } catch (e) {
        console.log(colors.bgRed("CAUGHT ERROR IN RIDE REQUEST %s"), e);
      }
    }
    if(segmentRides.length === 0) // a ride in the path isn't satisfied
      break;
    pathRides.push(segmentRides);
  }
  console.log("PATH RIDES", pathRides);
  if(pathRides.length === stops.length - 1) { // all rides in the path are satisfied
    rideIds = findPermutation(pathRides);
  }
  console.log("RIDE IDS", rideIds);
  const requestId = await broadcastPost(departure, serverId, PostType.NEW_REQUEST, version);  // version = 0
  const newRequest = { id: requestId, passenger, stops, rides: rideIds, version };
  requests[requestId] = newRequest;
  
  const message = rideIds.length > 0 ? "SUCCESS" : "Try Again Later";
  res.render('index', { tracking_id: requestId, message, cities, servers });

  if(rideIds.length > 0)
    updateRides(rideIds, requestId, stops);
  freeLocks(myLocks);
  
})

router.get('/:id', (req, res) => {
  const request = requests[req.params.id];
  let result = request ? {request} : {message: "REQUEST_NOT_FOUND"};
  result = JSON.stringify(result, null, 2); 
  res.render('result', { result, servers });
})

router.get('/', async (_, res) => { //returns the IDs of all requests in the system
  try {
    const requests = await getAllRequests();
    const result = JSON.stringify(requests, null, 2);
    res.render('result', {result, servers});
  } catch(e) {
    console.log("ERROR IN GET /REQUESTS", e);
    res.render('error', {message: "Error While Reading Requests", servers});
  }
})

function updateRides(rideIds, requestId, stops) {
  if(rideIds.length !== stops.length - 1) { console.log(colors.bgRed("RIDES ARE NOT 1 LESS THAN STOPS LENGTH"));}

  rideIds.forEach((rideId, stopIndex) => {
    const cityId = parseInt(rideId.split('-')[0].split('c')[1]);
    const departure = stops[stopIndex];
    const destination = stops[stopIndex + 1];

    if (myCities.includes(cityId)) {
      console.log("SECRET");
      const newVersion = updateRideLocally({rideId, requestId, departure, destination});
      broadcastPost(departure, serverId, PostType.UPDATE_RIDE, newVersion, rideId)
        .then(id => console.log("updateRides -> broadcastPost ID: ",id))
        .catch(error => console.log(colors.bgRed("ERROR CAUGHT IN updateRides FROM broadcastPost "), error.stack))
    } else {
      chooseAliveServer(cityId) //choosing alive server from another city(not my city) so: that server won't be me
        .then(rpcServer => {
          const rpcClient = new RidesClient(`${rpcServer.ip}:${rpcServer.port}`);
          console.log("CALING UPDATERIDE FOR"+`${rpcServer.ip}:${rpcServer.port}`);
          rpcClient.updateRide({rideId, requestId, departure, destination})
            .catch(error => {
              //if there's an error try to update it using another server
              console.log(colors.red("ERROR CAUGHT IN updateRides FROM updateRide"), error.stack);
            })
        })
        .catch(error => console.log(colors.red("ERROR CAUGHT IN updateRides BY chooseAliveServer"),error.stack))
    }
  })
}


module.exports = router;