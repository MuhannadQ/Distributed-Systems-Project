const rides = {};

const requests = {};

const ZooKeeperAddress = '172.18.1.2:2181';
//const ZooKeeperAddress = 'localhost:2181';
const CleanerAddress = '172.18.1.3:2181'; //cot used

const cities = [
  { name: "city_0",    x: 0, y: 0,      servers: [0, 1] },
  { name: "city_1",    x: 0, y: 10,     servers: [0,1] },
  { name: "city_2",    x: 0, y: 20,     servers: [2,3] },
  { name: "city_3",    x: 10, y: 0,     servers: [2,3] },
  // {name: "city_4",    x: 20, y: 0,     servers: [0]},
  // {name: "city_5",    x: 10, y: 10,    servers: [0]},
  // {name: "city_6",    x: 20, y: 20,    servers: [0]},
  // {name: "city_7",    x: 10, y: 20,    servers: [0]},
  // {name: "city_8",    x: 20, y: 10,    servers: [0]},
];

const servers = [ //ip for both rest and rpc but port is just for rpc
  { localip:"localhost", ip: "172.18.1.10", port:"9000", restPort:"3000", cities: [0,1] },
  { localip:"localhost", ip: "172.18.1.11", port:"9001", restPort:"3001", cities: [0,1] },
  { localip:"localhost", ip: "172.18.1.12", port:"9002", restPort:"3002", cities: [2,3] },
  { localip:"localhost", ip: "172.18.1.13", port:"9003", restPort:"3003", cities: [2,3] },
];

module.exports = { servers, cities, rides, requests, ZooKeeperAddress }; // TIMESTAMP