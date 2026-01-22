const CHANNEL_NAME = "fow-channel";

const listeners = new Set();

const broadcastChannel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;

const wsUrl = (() => {
  if (!location.origin.startsWith("http")) {
    return null;
  }
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${location.host}/ws`;
})();

let socket = null;
let socketReady = false;
const socketQueue = [];

const notify = (message) => {
  listeners.forEach((listener) => listener(message));
};

const openSocket = () => {
  if (!wsUrl) {
    return;
  }
  socket = new WebSocket(wsUrl);
  socket.addEventListener("open", () => {
    socketReady = true;
    while (socketQueue.length) {
      socket.send(socketQueue.shift());
    }
  });
  socket.addEventListener("message", (event) => {
    try {
      const parsed = JSON.parse(event.data);
      notify(parsed);
    } catch {
      // ignore malformed messages
    }
  });
  socket.addEventListener("close", () => {
    socketReady = false;
    setTimeout(openSocket, 1500);
  });
};

if (broadcastChannel) {
  broadcastChannel.addEventListener("message", (event) => notify(event.data));
}

openSocket();

export const transport = {
  on(handler) {
    listeners.add(handler);
    return () => listeners.delete(handler);
  },
  send(message) {
    if (broadcastChannel) {
      broadcastChannel.postMessage(message);
    }
    if (socket && socketReady) {
      socket.send(JSON.stringify(message));
    } else if (socket) {
      socketQueue.push(JSON.stringify(message));
    }
  }
};

export const createQrUrl = (url) => {
  const encoded = encodeURIComponent(url);
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encoded}`;
};

export const russianAlphabet = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ".split("");
