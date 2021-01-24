//const { Empty, Driver, Ride, RideRequest, RideId } = require('./protos/uber_pb');
const { rides, requests } = require('../../db');
const {broadcastPost, PostType, updateRideLocally} = require('../../utils');
const SERVER_ID = process.env.SERVER_ID;
class RidesService {

  getRide(call, callback) {
    const id = call.request.id;
    
    const ride = rides[id];
    if (!ride) {
      const error = { name: "Ride Missing", message: `Ride with ID ${id} does not exist.` };
      callback(error, null);
      return;
    }
    console.log(`getRide: returning ride with id: ${id} with driver ${ride.driver.firstName} from ${ride.departure} to ${ride.destination}`);
    callback(null, ride);
  }

  getRidesStream(call) { //empty
    console.log(`getRidesStream: streaming ALL rides.`);
    const requestedCityId = call.request.id;
    for (const rideId in rides) {
      const rideCityId = parseInt(rideId.split('-')[0].split('c')[1]);
      if (requestedCityId === rideCityId) {
        call.write(rides[rideId]);
        console.log(rides[rideId]);
      }
    } 
    call.end();
  }

  updateRide(call, callback) {
    const {rideId, requestId, departure, destination} =  call.request;
    const cityId = parseInt(rideId.split('-')[0].split('c')[1]);
    console.log(`updateRide: updating ride ${rideId}.`);
    const newVersion = updateRideLocally({rideId, requestId, departure, destination});
    
    broadcastPost(cityId, SERVER_ID, PostType.UPDATE_RIDE, newVersion, rideId)
      .then(id => callback(null, id))
      .catch(error => callback(error, null))
  }

  getRequest(call, callback) { //id
    const id = call.request.id;

    const request = requests[id];
    if (!request) {
      const error = { name: "Request Missing", message: `Request with ID ${id} does not exist.` };
      callback(error, null);
      return;
    }
    console.log(`getRequest: returning request with id: ${id} with passenger ${request.passenger.firstName}`);
    callback(null, request);
  }
  getRequestsStream(call) { //empty
    console.log(`getRequestsStream: streaming ALL requests.`);
    const requestedCityId = call.request.id;
    for (const requestId in requests) {
      const requestCityId = parseInt(requestId.split('-')[0].split('c')[1]);
      if (requestedCityId === requestCityId) {
        call.write(requests[requestId]);
        console.log(requests[requestId]);
      }
    } 
    call.end();
  }
// TODO : check pd
// TODO : check vacancies
// FEATURE: r(t) stuff and updating range of ride stops while checking vacancies
  static validRide(ride, rideRequest) {
    // ride.id is : c<cityId>-<rideNumber>
    const stops = ride.stops;
    //let stopIndex = stops.findIndex(stop => stop.cityId === rideRequest.departure);
    //if(stopIndex === -1) stopIndex = stops.length - 2;
    //const canStop = 

    const rideCityId = parseInt(ride.id.split('-')[0].split('c')[1]);
    
    return (
      stops[stops.length - 2].vacancies > 0 &&
      rideCityId === rideRequest.cityId && //checking if this ride in the city we requested
      ride.destination === rideRequest.destination &&
      ride.date === rideRequest.date &&
      ride.pd >= rideRequest.deviation
    );
  }

  // in this service we don't look for services with the same departure since the caller's city is the departure of the request
  // so we only ask for rides that their destination is the same as te request's destination
  requestRide(call, callback) { //RideRequest
    console.log(`requestRide`);
    console.log(call.request);
    for(const id in rides) {
      console.log(id);
      if (RidesService.validRide(rides[id], call.request) ) {
        callback(null, {id});
        return;
      }
    }
    let id = "null";
    callback(null, {id});
    // temporarily I assume that the vacancies conditon is met
  }

  requestRidesStream(call) {
    console.log(`requestRidesStream`);
    for(const id in rides) {
      const ride = rides[id];
      console.log(id);
      if (RidesService.validRide(ride, call.request) ) {
        //let stops = ride.stops;      
        //stops.push({cityId: call.request.cityId, vacancies: stops[stops.length-1]-1});
        call.write({id});
      }
    }
    call.end();
  }

  
}

module.exports = RidesService;