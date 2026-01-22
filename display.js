import { transport } from "./shared.js";

const $ = (selector) => document.querySelector(selector);

const elements = {
  wheel: $("#wheel"),
  callout: $("#wheel-callout"),
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

const renderWheel = (wheel) => {
  if (!wheel) {
    return;
  }
  elements.wheel.style.transform = `rotate(${wheel.rotation}deg)`;
  elements.callout.textContent = wheel.lastResult?.label ? `Сектор: ${wheel.lastResult.label}` : "Ожидание вращения";
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
