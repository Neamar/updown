import uWS from "uWebSockets.js";
import { getGameById } from './game.js';
import { readdir } from 'node:fs/promises';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'node:fs';

// Read all files in dist, and serve them directly.
const __filename = fileURLToPath(import.meta.url);
export const distFolder = `${dirname(__filename)}/../dist`;

const files = await readdir(distFolder, { recursive: true });
const content = files.reduce((acc, file) => {
  try {
    acc[file] = readFileSync(distFolder + '/' + file);
  } catch (e) {
    // skip directories
  }
  return acc;
}, {});

console.log("Will serve files", Object.keys(content));

const port = parseInt(process.env.PORT || "") || 9001;

uWS
  .App()
  .ws("/:gameId", {
    /* Options */
    compression: uWS.SHARED_COMPRESSOR,
    maxPayloadLength: 16 * 1024 * 1024,
    idleTimeout: 10,
    /* Handlers */
    upgrade: (res, req, context) => {
      res.upgrade(
        { gameId: req.getParameter((0)) }, // pass path to ws object
        req.getHeader('sec-websocket-key'),
        req.getHeader('sec-websocket-protocol'),
        req.getHeader('sec-websocket-extensions'), // 3 headers are used to setup websocket
        context // also used to setup websocket
      )
    },
    open: (ws) => {
      console.log("A WebSocket connected!");
      getGameById(ws.gameId).addConnection(ws);
    },
    message: (ws, message, isBinary) => {
      try {
        const decodedMessage = JSON.parse(Buffer.from(message).toString());
        getGameById(ws.gameId).receive(decodedMessage);
      } catch (e) {
        console.log("Invalid message received, skipping", e);
      }
    },
    drain: (ws) => {
      console.log("WebSocket backpressure: " + ws.getBufferedAmount());
    },
    close: (ws, code, message) => {
      console.log("WebSocket closed");
      getGameById(ws.gameId).removeConnection(ws);
    },
  })
  .any("/*", async (res, req) => {
    console.log('<-- ' + req.getUrl());
    const url = req.getUrl() == '/' ? 'index.html' : req.getUrl().slice(1);
    if (content[url]) {
      if (url.endsWith('.js')) {
        res.writeHeader('Content-Type', 'text/javascript');
      }
      res.end(content[url]);
    }
    else {
      res.writeStatus('404');
      res.end("There ain't a game here.");
    }
  })
  .listen(port, (token) => {
    if (token) {
      console.log("Listening to port " + port);
    } else {
      console.log("Failed to listen to port " + port);
    }
  });
