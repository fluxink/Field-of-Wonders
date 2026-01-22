import { transport } from "./shared.js";

const $ = (selector) => document.querySelector(selector);

const elements = {
  wheel: $("#wheel"),
  callout: $("#wheel-callout"),
  audio: $("#wheel-audio"),
  category: $("#category"),
  puzzle: $("#puzzle"),
  hint: $("#hint"),
  scoreboard: $("#scoreboard"),
  status: $("#status"),
  round: $("#round"),
  player: $("#player"),
  lastAction: $("#last-action")
};

let lastLayout = [];
let lastRotation = 0;
let spinTimeout = null;
let lastSectorsSignature = "";

const getSectorIcon = (sector) => {
  if (sector.type === "bankrupt") {
    return "💥";
  }
  if (sector.type === "loseTurn") {
    return "⏭️";
  }
  if (sector.type === "prize") {
    return sector.label === "Ключ" ? "🔑" : "🎁";
  }
  return "💰";
};

const buildWheelSectors = (sectors) => {
  if (!sectors?.length) {
    return;
  }
  const signature = sectors.map((sector) => `${sector.type}:${sector.label}`).join("|");
  if (signature === lastSectorsSignature) {
    return;
  }
  lastSectorsSignature = signature;

  elements.wheel.innerHTML = "";
  const segmentAngle = 360 / sectors.length;
  const colors = ["#2c2f8a", "#f6f7ff"];
  const gradientStops = sectors.map((_, index) => {
    const start = index * segmentAngle;
    const end = start + segmentAngle;
    const color = colors[index % colors.length];
    return `${color} ${start}deg ${end}deg`;
  });
  elements.wheel.style.background = `conic-gradient(${gradientStops.join(", ")})`;

  sectors.forEach((sector, index) => {
    const angle = index * segmentAngle + segmentAngle / 2;
    const badge = document.createElement("div");
    badge.className = "wheel-sector";
    badge.style.setProperty("--angle", `${angle}deg`);
    badge.innerHTML = `
      <span class="wheel-icon">${getSectorIcon(sector)}</span>
      <span>${sector.label}</span>
    `;
    elements.wheel.append(badge);
  });

  const center = document.createElement("div");
  center.className = "wheel-center";
  elements.wheel.append(center);
};

const stopWheelAudio = () => {
  if (!elements.audio) {
    return;
  }
  elements.audio.pause();
  elements.audio.currentTime = 0;
};

const startSpin = (wheel) => {
  if (elements.audio) {
    elements.audio.currentTime = 0;
    elements.audio.loop = true;
    elements.audio.play().catch(() => null);
  }
  const durationMs = (wheel.spinDuration ?? 6) * 1000;
  clearTimeout(spinTimeout);
  spinTimeout = setTimeout(() => {
    stopWheelAudio();
    elements.callout.textContent = wheel.lastResult?.label ? `Сектор: ${wheel.lastResult.label}` : "Ожидание вращения";
    spinTimeout = null;
  }, durationMs);
};

const renderWheel = (wheel) => {
  if (!wheel) {
    return;
  }
  buildWheelSectors(wheel.sectors);
  elements.wheel.style.setProperty("--spin-duration", `${wheel.spinDuration ?? 6}s`);
  elements.wheel.style.transform = `rotate(${wheel.rotation}deg)`;

  if (wheel.rotation !== lastRotation) {
    elements.callout.textContent = "Вращение...";
    startSpin(wheel);
    lastRotation = wheel.rotation;
    return;
  }

  if (!spinTimeout) {
    elements.callout.textContent = wheel.lastResult?.label ? `Сектор: ${wheel.lastResult.label}` : "Ожидание вращения";
  }
};

const renderPuzzle = (puzzle) => {
  elements.category.textContent = puzzle.category ? `Категория: ${puzzle.category}` : "";
  elements.hint.textContent = puzzle.hint ? `Подсказка: ${puzzle.hint}` : "";
  elements.puzzle.innerHTML = "";

  puzzle.maskedLayout.forEach((tile, index) => {
    const cell = document.createElement("div");
    cell.className = "tile";

    if (tile.type === "space") {
      cell.classList.add("space");
    } else if (tile.type === "hyphen") {
      cell.classList.add("hyphen");
      if (tile.revealed) {
        cell.textContent = tile.char;
      }
    } else if (tile.type === "symbol") {
      if (tile.revealed) {
        cell.textContent = tile.char;
      }
    } else if (tile.type === "letter") {
      if (tile.revealed) {
        cell.textContent = tile.char;
        const prev = lastLayout[index];
        if (!prev?.revealed) {
          cell.classList.add("reveal-pop");
        }
        cell.classList.add("revealed");
      }
    }

    elements.puzzle.append(cell);
  });

  lastLayout = puzzle.maskedLayout.map((item) => ({ ...item }));
};

const renderScoreboard = (players, activePlayerId) => {
  elements.scoreboard.innerHTML = "";
  players.forEach((player) => {
    const row = document.createElement("div");
    row.className = "score-item";
    if (player.id === activePlayerId) {
      row.classList.add("active");
    }

    row.innerHTML = `
      <strong>${player.name}</strong>
      <span>${player.scoreRound} / ${player.scoreTotal}</span>
    `;

    elements.scoreboard.append(row);
  });
};

const render = (state) => {
  renderWheel(state.wheel);
  renderPuzzle(state.puzzle);
  renderScoreboard(state.players, state.round.activePlayerId);
  elements.status.textContent = state.lastAction;
  elements.round.textContent = `${state.round.phase} ${state.round.index}`;
  const activePlayer = state.players.find((player) => player.id === state.round.activePlayerId);
  elements.player.textContent = activePlayer ? `Ход: ${activePlayer.name}` : "";
  elements.lastAction.textContent = `Последнее действие: ${state.lastAction}`;
};

transport.on((message) => {
  if (message.type === "public_state") {
    render(message.payload);
  }
});
