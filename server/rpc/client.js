const grpc = require("grpc");
const protoLoader = require("@grpc/proto-loader")
const packageDef = protoLoader.loadSync("rpc/protos/uber.proto", {});
const grpcObject = grpc.loadPackageDefinition(packageDef);
const uberPackage = grpcObject.uberPackage;


// function RidesClient(url) {
//   return new uberPackage.Uber(url, grpc.credentials.createInsecure());
// }
// module.exports = RidesClient;

// const { servers } = require('../db');
// const serverId = 1;//process.argv[2];
// const url = servers[serverId].ip+":"+servers[serverId].ip;
// const port = servers[serverId].port;

// const client = RidesClient(`url);

// client.getRide({ id: 100 }, (err, ride) => {
//   if (err) console.log(err);
//   else console.log(ride);
// });

// const ridesFromStream = [];
// const stream = client.getRidesStream({});
// stream.on("data", (ride) => ridesFromStream.push(ride));
// stream.on("error", () => console.log("shit"));
// stream.on("end", () => console.log(ridesFromStream));

// client.requestRide({ destination: 1, date: (new Date("2015-03-25")).toString() }, (err, ride) => {
//   if (err) console.log(err);
//   else console.log(ride);
// });

// const ridesFromStream = [];
// const stream = client.requestRidesStream({ destination: 1, date: (new Date("2015-03-25")).toString() });
// stream.on("data", (ride) => ridesFromStream.push(ride));
// stream.on("error", () => console.log("shit"));
// stream.on("end", () => console.log(ridesFromStream));

class RidesClient {

  constructor(url) {
    this.client = new uberPackage.Uber(url, grpc.credentials.createInsecure());
  }

  getRide(id) {
    return new Promise((resolve, reject) => {
      this.client.getRide({ id }, (err, ride) => {
        if (err) reject(err);
        else resolve(ride);
      });
    });
    
  }

  getAllRides(cityId) {
    return new Promise((resolve, reject) => {
      const stream = this.client.getRidesStream({id: cityId});
      const rides = [];
      stream.on("data", (ride) => {console.log(ride);rides.push(ride);});
      stream.on("error", reject);
      stream.on("end", () => resolve(rides));
    });
  }
  getRequest(id) {
    return new Promise((resolve, reject) => {
      this.client.getRequest({ id }, (err, request) => {
        if (err) reject(err);
        else resolve(request);
      });
    });
    
  }
  getAllRequests(cityId) {
    return new Promise((resolve, reject) => {
      const stream = this.client.getRequestsStream({id: cityId});
      const requests = [];
      stream.on("data", (request) => requests.push(request));
      stream.on("error", reject);
      stream.on("end", () => resolve(requests));
    });
  }

  //LOCK before calling this
  requestRide(request) { //{departure, destination, date, lineVar}
    return new Promise((resolve, reject) => {
      //const request = rideRequestToClass(departure, destination, date, lineVar);
      
      this.client.requestRide(request, (err, rideIdMessage) => {
        if (err) reject(err);
        else resolve(rideIdMessage.id);//can be null which means didn't find ride
      });
    });
  }
  
  requestRides(request) { //{departure, destination, date, lineVar}
    return new Promise((resolve, reject) => {
      //const request = rideRequestToClass(departure, destination, date,lineVar);
      const stream = this.client.requestRidesStream(request);

      const rideIds = [];

      stream.on("data", (rideIdMessage) => rideIds.push(rideIdMessage.id));
      stream.on("error", reject);
      stream.on("end", () => resolve(rideIds));
    });
  }

  updateRide(updateData) {
    return new Promise((resolve, reject) => {
      this.client.updateRide(updateData, (error, rideId) => {
        if (error) reject(error);
        else resolve(rideId);
      });
    });
  }
}

module.exports = RidesClient;
