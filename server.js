const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const userRoutes = require('./routes/userRoutes');
/**
 * Initializes the WebSocket connection by requiring and invoking the 
 * initializeWebSocket function from the wsHandler module.
 * 
 * @module server
 * @requires ./websocket/wsHandler
 */
const { initializeWebSocket } = require('./websocket/wsHandler');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static('public'));

app.use('/api/users', userRoutes);

initializeWebSocket(wss);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Serveur en écoute sur http://localhost:${PORT}`);
});

