require('events').EventEmitter.defaultMaxListeners = 25;
const colors = require('colors');
const { handlePosts } = require('./handlers');
const { initialize: initializeZookeeper } = require('./zookeeper');
initializeZookeeper(handlePosts);

require('./rpc/server');
const {chooseAliveServer, getAllRides, getAllRequests, renderJSON} = require('./utils');
const {servers, cities} = require('./db');
const myServer = servers[process.env.SERVER_ID];

const address = `${myServer.ip}:${myServer.restPort}`;

const express = require('express');
const app = express();
const expressLayouts = require('express-ejs-layouts');
const bodyParser = require('body-parser');
const ridesRouter = require('./routes/rides');
const requestsRouter = require('./routes/requests');

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.set('layout', 'layouts/layout');
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(expressLayouts);
app.use(express.static('public'));
app.use('/rides', express.static('public'));
app.use('/rides', ridesRouter);
app.use('/requests', express.static('public'));
app.use('/requests', requestsRouter);
// setTimeout(() => res.render('index', { cities }), 500);
app.get('/', (_, res) =>  res.render('index', { cities, servers }));
app.post('/', (_, res) =>  res.render('index', { cities, servers }));
app.get('/links', (_, res) => res.render('error', {result: "Nav and Footer Links are'nt Usable", servers}));
app.get('/servers', (req, res) => {
  // console.log(req);
  // chooses a random server for the city //for production
  const cityId = req.query.city_id;
  chooseAliveServer(cityId) // without docker I used this ${dedicatedServer.ip}
    .then(dedicatedServer => res.send(`${req.protocol}://localhost:${dedicatedServer.restPort}`))
    .catch(error => console.log(colors.bgRed("ERROR in index from chooseAliveServer "), error.stack))
 
});


app.get('/state', async (_, res) => {
  try {
    const rides = await getAllRides();
    const requests = await getAllRequests();
    const Rides = renderJSON(rides);
    const Requests = renderJSON(requests);
    res.render('state', { Rides, Requests, servers});
  } catch(e) {
    console.log(colors.bgRed("ERROR IN STATE "), e);
    res.render('error', {result: "Error While Preparing Snapshot", servers});
  }
});


app.listen(myServer.restPort);
console.log(`REST Server listening on address=${address}`);

//const cors = require('cors')
//app.use(cors())
// app.use((_, res, next) => {
// 	res.setHeader('Access-Control-Allow-Origin', '*');
// 	res.setHeader('Access-Control-Allow-Methods', '*');
// 	res.setHeader('Access-Control-Allow-Headers', '*');
// 	next();
// });
// app.use(cookieParser());
// app.use(cookieParser("secret"));onst createError = require('http-errors');
// const cookieParser = require('cookie-parser');