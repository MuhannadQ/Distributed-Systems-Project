const express = require('express');
const router = express.Router();
const serverId = process.env.SERVER_ID;
const { rides, cities, servers } = require('../db');
const { broadcastPost, PostType, getAllRides, syncServers } = require('../utils');
const colors = require('colors');

function convertTypes(body) {
  const departure = parseInt(body.departure);
  const destination = parseInt(body.destination);
  const vacancies = parseInt(body.vacancies);
  const pd = parseInt(body.pd);
  return {departure, destination, vacancies, pd};
}
router.post('/', async (req, res) => {
  console.log("at RIDES");
  const version = 0;
  const { firstName, lastName, phoneNumber, date } = req.body;
  const { departure, destination, vacancies, pd } = convertTypes(req.body);
  const driver = { firstName, lastName, phoneNumber };
  const stops = [ {cityId: departure, vacancies, requests: ["driver start"]}, {cityId: destination, vacancies, requests: ["driver end"]} ];
  console.log(req.body);
  
  try {
    const rideId = await broadcastPost(departure, serverId, PostType.NEW_RIDE, version);
    const newRide = { id: rideId, driver, departure, destination, date, pd, stops, version};
    rides[rideId] = newRide;
    console.log("AFTER STORING LOCALLY");
    //const result = JSON.stringify({message, ride: newRide}, null, 2);
    res.render('index', { tracking_id: rideId, message: "SUCCESS", cities, servers });
    //post#c1-123/server@321
  } catch (error) {
    console.log(colors.red("CAUGHT ERROR IN RIDE OFFER"), error.stack);
  }
  // setTimeout(() => {
  //   res.json("someting");
  // }, 13000);
  
})

//frontend redirects to responsible server so the id is local here
router.get('/:id', async (req, res) => { 
  const ride = rides[req.params.id];
  let result = {message: "RIDE_NOT_FOUND"};
  if(ride) {
    // ride.stops.forEach(stop => {
    //   stop.requests.forEach(request => {
    //     console.log(request.situation);
    //     request.situation = request.situation === 0 ? "GET_ON" : "GET_OFF";
    //     console.log(request.situation);
    //   })
    // })
    result = {ride};
  }
  result = JSON.stringify(result, null, 2); 
  res.render('result', { result, servers });
  // if (!ride) {
  //   const cityId = rideId.split('-')[0].split('c')[1];
  //   try {
  //     const rpcServer = await chooseAliveServer(cityId);
  //     const rpcClient = new RidesClient(`${rpcServer.ip}:${rpcServer.port}`);
  //     ride = await rpcClient.getRide(rideId);
  //   } catch(e) {
  //     message = "NOT FOUND";
  //     console.log(e);
  //   }
  // }
  
})

router.get('/', async (_, res) => { //returns the ids of all rides inthe system
  try {
    const rides = await getAllRides();
    const result = JSON.stringify(rides, null, 2);
    res.render('result', {result, servers});
  } catch(e) {
    console.log(colors.red("ERROR IN GET /RIDES "), e);
    res.render('error', {message: "Error While Reading Rides", servers});
  }
})



module.exports = router;