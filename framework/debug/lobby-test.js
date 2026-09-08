(function () {
  const WS_URL = "ws://localhost:8080/ws";

  const nicknameInput = document.getElementById("nickname");
  const connectBtn = document.getElementById("connectBtn");
  const statusEl = document.getElementById("status");
  const messagesEl = document.getElementById("messages");
  const outgoingInput = document.getElementById("outgoing");
  const sendBtn = document.getElementById("sendBtn");
  const playersEl = document.getElementById("players");

  let socket = null;
  let myNickname = null;
  let myPos = { x: 0, y: 0, direction: "idle" };

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

  function renderPlayers(players) {
    playersEl.innerHTML = "";
    players.forEach(function (p) {
      const li = document.createElement("li");
      const isMe = p.nickname === myNickname;
      li.textContent = `${p.nickname} [${p.id.slice(0, 6)}] x:${p.x} y:${p.y} dir:${p.direction}${isMe ? " (you)" : ""}`;
      if (isMe) {
        li.className = "me";
      }
      playersEl.appendChild(li);
    });
  }

  function handleServerMessage(raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return;
    }

    if (parsed.type === "player_state" && Array.isArray(parsed.players)) {
      renderPlayers(parsed.players);

      const me = parsed.players.find(function (p) {
        return p.nickname === myNickname;
      });
      if (me) {
        myPos = { x: me.x, y: me.y, direction: me.direction };
      }
    }
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
    myNickname = nickname;

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
      handleServerMessage(event.data);
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

    const payload = JSON.stringify({ type: "chat_message", message: message });
    socket.send(payload);
    appendMessage("client", payload);
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

  const arrowDirections = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right"
  };

  document.addEventListener("keydown", function (event) {
    // Don't hijack arrow keys while typing in a text field.
    if (event.target === nicknameInput || event.target === outgoingInput) {
      return;
    }

    const direction = arrowDirections[event.key];
    if (!direction || !socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    event.preventDefault();

    const step = 1;
    switch (direction) {
      case "up":
        myPos.y -= step;
        break;
      case "down":
        myPos.y += step;
        break;
      case "left":
        myPos.x -= step;
        break;
      case "right":
        myPos.x += step;
        break;
    }
    myPos.direction = direction;

    socket.send(JSON.stringify({ type: "player_move", x: myPos.x, y: myPos.y, direction: myPos.direction }));
  });

  setStatus("Disconnected", "disconnected");
})();
