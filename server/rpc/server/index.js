const grpc = require("grpc");
const protoLoader = require("@grpc/proto-loader")
const packageDef = protoLoader.loadSync("rpc/protos/uber.proto", {});
const grpcObject = grpc.loadPackageDefinition(packageDef);
const uberPackage = grpcObject.uberPackage;
const { servers } = require('../../db');
const RidesService = require('./service');

const myServer = servers[process.env.SERVER_ID];
const address = `${myServer.ip}:${myServer.port}`;

const server = new grpc.Server();
const ridesService = new RidesService();
server.addService(uberPackage.Uber.service, {
  "getRide": ridesService.getRide,
  "getRidesStream": ridesService.getRidesStream,
  "updateRide": ridesService.updateRide,
  "getRequest": ridesService.getRequest,  
  "getRequestsStream": ridesService.getRequestsStream,
  "requestRide": ridesService.requestRide,
  "requestRidesStream": ridesService.requestRidesStream
});
server.bind(address, grpc.ServerCredentials.createInsecure());
console.log(`Starting RPC Server on address=${address}`);
server.start();
