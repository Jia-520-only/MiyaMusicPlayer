// ====================================================================
//  MIYA Music Player Control Plugin
//  - WebSocket server mounted at /miya path
//  - Bidirectional: frontend (index.html) + external clients (MCP Server)
//  - Command routing + state broadcast
//  - Clients identified by first identity message (NOT HTTP headers —
//    browser WebSocket API doesn't support custom headers)
// ====================================================================

const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');

const PORT_FILE = path.join(__dirname, '.miya-port');

class MiyaPlugin {
  constructor() {
    this.wss = null;
    this.frontendClient = null;
    this.externalClients = new Map();
    this.unclassifiedClients = new Map(); // pending classification
    this._clientIdSeq = 0;
    this._state = {
      song: null,
      playing: false,
      progress: 0,
      duration: 0,
      volume: 0,
      muted: false,
      mode: 'loop',
      queue: [],
      queueIndex: -1,
    };
  }

  // ---- Startup ----

  attach(httpServer) {
    this.wss = new WebSocketServer({ server: httpServer, path: '/miya' });

    this.wss.on('connection', (ws) => {
      const clientId = `c${++this._clientIdSeq}`;

      // Store as unclassified until we receive the identity message
      this.unclassifiedClients.set(clientId, { ws, id: clientId });
      console.log(`[MiyaPlugin] Client connected, awaiting identity (${clientId})`);

      ws.on('message', (raw) => this._handleMessage(ws, clientId, raw));
      ws.on('close', () => this._handleClose(clientId));
      ws.on('error', (err) => console.error(`[MiyaPlugin] WS error (${clientId}):`, err.message));
    });

    this.wss.on('error', (err) => console.error('[MiyaPlugin] WSS error:', err.message));
    console.log('[MiyaPlugin] WebSocket started (path: /miya)');
  }

  // ---- Write port file for MCP discovery ----

  writePortFile(port) {
    try {
      fs.writeFileSync(PORT_FILE, String(port), 'utf-8');
      console.log(`[MiyaPlugin] Port file written: ${PORT_FILE} -> ${port}`);
    } catch (e) {
      console.error('[MiyaPlugin] Failed to write port file:', e.message);
    }
  }

  // ---- Message handling ----

  _handleMessage(ws, clientId, raw) {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (e) {
      return;
    }

    // First message: classify the client
    if (this.unclassifiedClients.has(clientId)) {
      this._classifyClient(clientId, ws, msg);
      return;
    }

    // Classified: route by role
    const isFrontend = (this.frontendClient === ws);

    switch (msg.type) {
      case 'state_sync':
        if (isFrontend) {
          this._state = Object.assign(this._state, msg.data || {});
          this._broadcastState();
        }
        break;

      case 'command':
        if (!isFrontend) {
          this._routeCommand(ws, clientId, msg);
        }
        break;

      case 'command_response':
        if (isFrontend) {
          this._relayResponse(msg);
        }
        break;

      case 'state_response':
        if (isFrontend) {
          this._relayResponse(msg);
        }
        break;
    }
  }

  _classifyClient(clientId, ws, msg) {
    this.unclassifiedClients.delete(clientId);

    if (msg.type === 'identity' && msg.role === 'frontend') {
      this.frontendClient = ws;
      console.log(`[MiyaPlugin] Frontend connected (${clientId})`);
    } else {
      this.externalClients.set(clientId, { ws, id: clientId });
      console.log(`[MiyaPlugin] External client connected (${clientId})`);
      ws.send(JSON.stringify({
        type: 'state_update',
        data: this._state,
      }));
    }
  }

  _handleClose(clientId) {
    // Check if this was the frontend
    if (this.frontendClient) {
      // Find which client disconnected
      const ws = this.externalClients.get(clientId)?.ws;
      if (ws === this.frontendClient || this.unclassifiedClients.get(clientId)?.ws === this.frontendClient) {
        this.frontendClient = null;
        console.log(`[MiyaPlugin] Frontend disconnected (${clientId})`);
        this.unclassifiedClients.delete(clientId);
        return;
      }
    }

    this.externalClients.delete(clientId);
    this.unclassifiedClients.delete(clientId);
    if (this.externalClients.has(clientId) || this.unclassifiedClients.has(clientId)) {
      // Already handled above
    } else {
      console.log(`[MiyaPlugin] Client disconnected (${clientId})`);
    }
  }

  // ---- Command routing: forward external commands to frontend ----

  _routeCommand(ws, clientId, msg) {
    const requestId = msg.request_id || '';

    if (!this.frontendClient || this.frontendClient.readyState !== 1) {
      ws.send(JSON.stringify({
        type: 'response',
        request_id: requestId,
        ok: false,
        error: 'Frontend not connected. Please ensure Mineradio window is open.',
      }));
      return;
    }

    try {
      this.frontendClient.send(JSON.stringify({
        type: 'command',
        action: msg.action,
        params: msg.params || {},
        request_id: requestId,
        client_id: clientId,
      }));
    } catch (e) {
      ws.send(JSON.stringify({
        type: 'response',
        request_id: requestId,
        ok: false,
        error: 'Failed to send command: ' + e.message,
      }));
    }
  }

  // ---- Response relay: frontend -> external client ----

  _relayResponse(msg) {
    const client = this.externalClients.get(msg.client_id);
    if (client && client.ws.readyState === 1) {
      try {
        client.ws.send(JSON.stringify({
          type: 'response',
          request_id: msg.request_id,
          ok: msg.ok !== false,
          data: msg.data || null,
          error: msg.error || null,
        }));
      } catch (e) {
        // Client disconnected, ignore
      }
    }
  }

  // ---- State broadcast ----

  _broadcastState() {
    const payload = JSON.stringify({
      type: 'state_update',
      data: this._state,
    });

    for (const [, client] of this.externalClients) {
      if (client.ws.readyState === 1) {
        try { client.ws.send(payload); } catch (e) { /* ignore */ }
      }
    }
  }

  // ---- Health check (for HTTP API) ----

  healthStatus() {
    return {
      ok: true,
      frontend_connected: !!(this.frontendClient && this.frontendClient.readyState === 1),
      external_clients: this.externalClients.size,
      port_file: PORT_FILE,
      state: this._state,
    };
  }
}

let _instance = null;

function getInstance() {
  if (!_instance) _instance = new MiyaPlugin();
  return _instance;
}

module.exports = { MiyaPlugin, getInstance };
