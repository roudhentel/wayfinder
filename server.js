// library
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var path = require('path');

var PORT = process.env.port || 3600;
var http = require('http').Server(app);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, '/')));

app.get('/', function (request, response) {
    response.sendFile(__dirname + "/");
});

http.listen(PORT, function () {
    console.log('Listening on port: ' + PORT);
});