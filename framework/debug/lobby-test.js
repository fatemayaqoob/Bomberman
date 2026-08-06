(function () {
  const WS_URL = "ws://localhost:8080/ws";

  const nicknameInput = document.getElementById("nickname");
  const connectBtn = document.getElementById("connectBtn");
  const statusEl = document.getElementById("status");
  const messagesEl = document.getElementById("messages");
  const outgoingInput = document.getElementById("outgoing");
  const sendBtn = document.getElementById("sendBtn");

  let socket = null;

  function setStatus(text, stateClass) {
    statusEl.textContent = text;
    statusEl.classList.remove("connected", "connecting", "disconnected");
    statusEl.classList.add(stateClass);
  }

  function appendMessage(prefix, message) {
    const timestamp = new Date().toLocaleTimeString();
    messagesEl.textContent += `[${timestamp}] ${prefix}: ${message}\n`;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function connect() {
    const nickname = nicknameInput.value.trim();
    if (!nickname) {
      appendMessage("client", "Please enter a nickname before connecting.");
      return;
    }

    if (socket && socket.readyState === WebSocket.OPEN) {
      appendMessage("client", "Already connected.");
      return;
    }

    if (socket && socket.readyState === WebSocket.CONNECTING) {
      appendMessage("client", "Connection is already in progress.");
      return;
    }

    setStatus("Connecting", "connecting");
    connectBtn.disabled = true;

    socket = new WebSocket(WS_URL);

    socket.addEventListener("open", function () {
      setStatus("Connected", "connected");
      connectBtn.textContent = "Reconnect";
      connectBtn.disabled = false;
      sendBtn.disabled = false;

      // Send nickname as first message for lobby registration.
      socket.send(JSON.stringify({ nickname: nickname }));
      appendMessage("client", `Connected to ${WS_URL}`);
    });

    socket.addEventListener("message", function (event) {
      appendMessage("server", event.data);
    });

    socket.addEventListener("close", function (event) {
      setStatus("Disconnected", "disconnected");
      sendBtn.disabled = true;
      connectBtn.disabled = false;
      appendMessage("client", `Socket closed (code=${event.code}, reason=${event.reason || "none"})`);
    });

    socket.addEventListener("error", function () {
      appendMessage("client", "WebSocket error occurred.");
    });
  }

  function sendMessage() {
    const message = outgoingInput.value.trim();
    if (!message) {
      return;
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      appendMessage("client", "Cannot send: not connected.");
      return;
    }

    socket.send(message);
    appendMessage("client", message);
    outgoingInput.value = "";
    outgoingInput.focus();
  }

  connectBtn.addEventListener("click", connect);
  sendBtn.addEventListener("click", sendMessage);

  outgoingInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      sendMessage();
    }
  });

  setStatus("Disconnected", "disconnected");
})();
