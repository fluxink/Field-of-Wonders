import { transport, createQrUrl, russianAlphabet } from "./shared.js";

const STORAGE_KEY = "fow-host-state";
const PUZZLES_KEY = "fow-puzzles";
const PIN_KEY = "fow-host-pin";

const $ = (selector) => document.querySelector(selector);

const elements = {
  spin: $("#spin"),
  nextPlayer: $("#next-player"),
  undo: $("#undo"),
  letter: $("#letter"),
  guess: $("#guess"),
  solve: $("#solve"),
  markSolved: $("#mark-solved"),
  bankrupt: $("#bankrupt"),
  loseTurn: $("#lose-turn"),
  categoryInput: $("#category-input"),
  puzzleInput: $("#puzzle-input"),
  hintInput: $("#hint-input"),
  autoHyphen: $("#auto-hyphen"),
  setPuzzle: $("#set-puzzle"),
  puzzleWarning: $("#puzzle-warning"),
  fileInput: $("#file-input"),
  categoryFilter: $("#category-filter"),
  randomPuzzle: $("#random-puzzle"),
  importStatus: $("#import-status"),
  players: $("#players"),
  addPlayer: $("#add-player"),
  sector: $("#sector"),
  manualPoints: $("#manual-points"),
  applyPoints: $("#apply-points"),
  takePrize: $("#take-prize"),
  hostUrl: $("#host-url"),
  qr: $("#qr"),
  pin: $("#pin"),
  copyLink: $("#copy-link")
};

const defaultState = () => ({
  version: 1,
  players: [
    { id: crypto.randomUUID(), name: "Игрок 1", scoreRound: 0, scoreTotal: 0 },
    { id: crypto.randomUUID(), name: "Игрок 2", scoreRound: 0, scoreTotal: 0 },
    { id: crypto.randomUUID(), name: "Игрок 3", scoreRound: 0, scoreTotal: 0 }
  ],
  round: {
    index: 1,
    phase: "Раунд",
    activePlayerId: null
  },
  wheel: {
    sectors: [
      { type: "points", label: "100", value: 100 },
      { type: "points", label: "200", value: 200 },
      { type: "points", label: "300", value: 300 },
      { type: "points", label: "400", value: 400 },
      { type: "points", label: "500", value: 500 },
      { type: "points", label: "600", value: 600 },
      { type: "points", label: "700", value: 700 },
      { type: "points", label: "800", value: 800 },
      { type: "points", label: "900", value: 900 },
      { type: "points", label: "1000", value: 1000 },
      { type: "points", label: "200", value: 200 },
      { type: "points", label: "300", value: 300 },
      { type: "points", label: "400", value: 400 },
      { type: "points", label: "500", value: 500 },
      { type: "points", label: "600", value: 600 },
      { type: "prize", label: "Ключ" },
      { type: "bankrupt", label: "Банкрот" },
      { type: "loseTurn", label: "Переход" },
      { type: "points", label: "700", value: 700 },
      { type: "prize", label: "Приз" }
    ],
    lastResult: null,
    rotation: 0,
    spinDuration: 0
  },
  puzzle: {
    category: "",
    hint: "",
    solution: "",
    autoRevealHyphen: true,
    revealed: [],
    usedLetters: []
  },
  history: [],
  lastAction: "Ожидание действий ведущего."
});

const normalizeText = (value) => value.toUpperCase().replace(/\s+/g, " ").trim();
const normalizeLetter = (value) => value.toUpperCase().trim();
const isLetter = (value) => russianAlphabet.includes(value);

const loadState = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    const state = defaultState();
    state.round.activePlayerId = state.players[0].id;
    return state;
  }
  const parsed = JSON.parse(saved);
  if (!parsed.round.activePlayerId && parsed.players.length) {
    parsed.round.activePlayerId = parsed.players[0].id;
  }
  return parsed;
};

let state = loadState();
let puzzles = JSON.parse(localStorage.getItem(PUZZLES_KEY) ?? "[]");

const saveState = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const pushHistory = () => {
  state.history.push(JSON.stringify(state));
  if (state.history.length > 50) {
    state.history.shift();
  }
};

const applyStateFromHistory = () => {
  const snapshot = state.history.pop();
  if (!snapshot) {
    return;
  }
  state = JSON.parse(snapshot);
  saveState();
  render();
  syncPublicState();
};

const buildMaskedLayout = () => {
  const solution = state.puzzle.solution;
  const layout = [];
  for (let index = 0; index < solution.length; index += 1) {
    const char = solution[index];
    if (char === " ") {
      layout.push({ type: "space", revealed: true });
    } else if (["-", "—", "–"].includes(char)) {
      layout.push({ type: "hyphen", revealed: state.puzzle.autoRevealHyphen, char: char });
    } else if (isLetter(char)) {
      const revealed = state.puzzle.revealed.includes(index);
      layout.push({ type: "letter", revealed, char: revealed ? char : "" });
    } else {
      const revealed = state.puzzle.autoRevealHyphen;
      layout.push({ type: "symbol", revealed, char: revealed ? char : "" });
    }
  }
  return layout;
};

const buildPublicState = () => ({
  wheel: {
    rotation: state.wheel.rotation,
    lastResult: state.wheel.lastResult,
    spinDuration: state.wheel.spinDuration,
    sectors: state.wheel.sectors
  },
  puzzle: {
    category: state.puzzle.category,
    hint: state.puzzle.hint,
    maskedLayout: buildMaskedLayout(),
    usedLetters: state.puzzle.usedLetters
  },
  players: state.players,
  round: state.round,
  lastAction: state.lastAction
});

const syncPublicState = () => {
  transport.send({
    type: "public_state",
    payload: buildPublicState()
  });
};

const setLastAction = (message) => {
  state.lastAction = message;
};

const setPuzzle = () => {
  const category = normalizeText(elements.categoryInput.value);
  const puzzle = normalizeText(elements.puzzleInput.value);
  const hint = normalizeText(elements.hintInput.value);

  if (!puzzle) {
    elements.puzzleWarning.hidden = false;
    return;
  }
  elements.puzzleWarning.hidden = true;

  pushHistory();
  state.puzzle.category = category;
  state.puzzle.solution = puzzle;
  state.puzzle.hint = hint;
  state.puzzle.autoRevealHyphen = elements.autoHyphen.checked;
  state.puzzle.revealed = [];
  state.puzzle.usedLetters = [];
  setLastAction("Новая загадка установлена.");

  saveState();
  render();
  syncPublicState();
};

const revealLetter = (letter) => {
  const solution = state.puzzle.solution;
  const indices = [];

  for (let index = 0; index < solution.length; index += 1) {
    if (solution[index] === letter) {
      indices.push(index);
    }
  }

  indices.forEach((index) => {
    if (!state.puzzle.revealed.includes(index)) {
      state.puzzle.revealed.push(index);
    }
  });

  return indices.length;
};

const applyPoints = (points) => {
  const player = state.players.find((item) => item.id === state.round.activePlayerId);
  if (!player) {
    return;
  }
  player.scoreRound += points;
  player.scoreTotal += points;
};

const handleGuess = () => {
  const letter = normalizeLetter(elements.letter.value);
  elements.letter.value = "";

  if (!letter || !isLetter(letter)) {
    setLastAction("Введите букву из русского алфавита.");
    render();
    syncPublicState();
    return;
  }
  if (!state.puzzle.solution) {
    setLastAction("Сначала задайте загадку.");
    render();
    syncPublicState();
    return;
  }

  if (state.puzzle.usedLetters.includes(letter)) {
    setLastAction(`Буква «${letter}» уже была названа.`);
    render();
    syncPublicState();
    return;
  }

  pushHistory();
  state.puzzle.usedLetters.push(letter);
  const hits = revealLetter(letter);

  if (hits > 0) {
    const sector = state.wheel.lastResult;
    if (sector?.type === "points" && sector.value) {
      applyPoints(sector.value * hits);
      setLastAction(`Буква «${letter}» — ${hits} совпадений, +${sector.value * hits} очков.`);
    } else {
      setLastAction(`Буква «${letter}» — ${hits} совпадений.`);
    }
  } else {
    setLastAction(`Такой буквы нет: «${letter}». Переход хода.`);
    nextPlayer();
  }

  saveState();
  render();
  syncPublicState();
};

const nextPlayer = () => {
  const currentIndex = state.players.findIndex((player) => player.id === state.round.activePlayerId);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % state.players.length;
  state.round.activePlayerId = state.players[nextIndex]?.id ?? null;
};

const applyBankrupt = () => {
  pushHistory();
  const player = state.players.find((item) => item.id === state.round.activePlayerId);
  if (player) {
    player.scoreRound = 0;
  }
  nextPlayer();
  setLastAction("Банкрот. Очки раунда обнулены.");
  saveState();
  render();
  syncPublicState();
};

const applyLoseTurn = () => {
  pushHistory();
  nextPlayer();
  setLastAction("Переход хода без изменения счета.");
  saveState();
  render();
  syncPublicState();
};

const spinWheel = () => {
  pushHistory();
  const sectors = state.wheel.sectors;
  const index = Math.floor(Math.random() * sectors.length);
  const sector = sectors[index];
  const segmentAngle = 360 / sectors.length;
  const extraTurns = 3 + Math.floor(Math.random() * 3);
  const landingAngle = index * segmentAngle + segmentAngle / 2;
  const rotation = state.wheel.rotation + extraTurns * 360 + landingAngle;
  const spinDuration = 6 + Math.random() * 4;
  state.wheel.rotation = rotation;
  state.wheel.lastResult = sector;
  state.wheel.spinDuration = Number(spinDuration.toFixed(2));
  setLastAction(`Барабан: ${sector.label}.`);
  saveState();
  render();
  syncPublicState();
};

const markSolved = () => {
  if (!state.puzzle.solution) {
    setLastAction("Нет активной загадки.");
    render();
    syncPublicState();
    return;
  }
  pushHistory();
  const solutionGuess = normalizeText(elements.solve.value);
  if (solutionGuess && solutionGuess !== state.puzzle.solution) {
    setLastAction("Введенное решение не совпадает. Проверьте и решите вручную.");
  } else {
    setLastAction("Загадка решена. Раунд завершён.");
  }
  state.round.index += 1;
  state.players.forEach((player) => {
    player.scoreRound = 0;
  });
  elements.solve.value = "";
  saveState();
  render();
  syncPublicState();
};

const applyManualPoints = () => {
  const value = Number(elements.manualPoints.value);
  if (!Number.isFinite(value) || value === 0) {
    return;
  }
  pushHistory();
  applyPoints(value);
  setLastAction(`Вручную начислено ${value} очков.`);
  elements.manualPoints.value = "";
  saveState();
  render();
  syncPublicState();
};

const takePrize = () => {
  pushHistory();
  setLastAction("Приз принят. Раунд завершён.");
  state.round.index += 1;
  state.players.forEach((player) => {
    player.scoreRound = 0;
  });
  saveState();
  render();
  syncPublicState();
};

const updatePlayersList = () => {
  elements.players.innerHTML = "";
  state.players.forEach((player) => {
    const wrapper = document.createElement("div");
    wrapper.className = "inline";

    const nameInput = document.createElement("input");
    nameInput.value = player.name;
    nameInput.addEventListener("change", () => {
      player.name = nameInput.value.trim() || player.name;
      saveState();
      render();
      syncPublicState();
    });

    const roundInput = document.createElement("input");
    roundInput.type = "number";
    roundInput.value = player.scoreRound;
    roundInput.addEventListener("change", () => {
      player.scoreRound = Number(roundInput.value);
      saveState();
      render();
      syncPublicState();
    });

    const totalInput = document.createElement("input");
    totalInput.type = "number";
    totalInput.value = player.scoreTotal;
    totalInput.addEventListener("change", () => {
      player.scoreTotal = Number(totalInput.value);
      saveState();
      render();
      syncPublicState();
    });

    wrapper.append(nameInput, roundInput, totalInput);
    elements.players.append(wrapper);
  });
};

const addPlayer = () => {
  pushHistory();
  state.players.push({
    id: crypto.randomUUID(),
    name: `Игрок ${state.players.length + 1}`,
    scoreRound: 0,
    scoreTotal: 0
  });
  saveState();
  render();
  syncPublicState();
};

const parseCsv = (text) => {
  const lines = text.split(/\r?\n/).filter(Boolean);
  return lines.map((line) => {
    const [category, puzzle, hint] = line.split(",");
    return {
      category: normalizeText(category ?? ""),
      puzzle: normalizeText(puzzle ?? ""),
      hint: normalizeText(hint ?? "")
    };
  });
};

const updateCategoryFilter = () => {
  const categories = new Set(puzzles.map((puzzle) => puzzle.category).filter(Boolean));
  elements.categoryFilter.innerHTML = "<option value=\"\">Все категории</option>";
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    elements.categoryFilter.append(option);
  });
};

const loadPuzzles = (items) => {
  puzzles = items.map((item) => ({ ...item, used: Boolean(item.used) }));
  localStorage.setItem(PUZZLES_KEY, JSON.stringify(puzzles));
  elements.importStatus.textContent = `Загружено загадок: ${puzzles.length}.`;
  updateCategoryFilter();
};

const handleFileUpload = async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  const text = await file.text();
  let items = [];
  if (file.name.endsWith(".json")) {
    items = JSON.parse(text);
  } else {
    items = parseCsv(text);
  }
  loadPuzzles(items);
};

const chooseRandomPuzzle = () => {
  const category = elements.categoryFilter.value;
  const available = puzzles.filter((puzzle) => !puzzle.used && (!category || puzzle.category === category));
  if (!available.length) {
    elements.importStatus.textContent = "Нет доступных загадок.";
    return;
  }
  const pick = available[Math.floor(Math.random() * available.length)];
  elements.categoryInput.value = pick.category;
  elements.puzzleInput.value = pick.puzzle;
  elements.hintInput.value = pick.hint;
  pick.used = true;
  localStorage.setItem(PUZZLES_KEY, JSON.stringify(puzzles));
  elements.importStatus.textContent = `Выбрана загадка: ${pick.category || "Без категории"}.`;
};

const render = () => {
  updatePlayersList();
  elements.sector.textContent = `Последний сектор: ${state.wheel.lastResult?.label ?? "—"}`;
  elements.undo.disabled = state.history.length === 0;
};

const ensurePin = () => {
  let pin = localStorage.getItem(PIN_KEY);
  if (!pin) {
    pin = String(Math.floor(1000 + Math.random() * 9000));
    localStorage.setItem(PIN_KEY, pin);
  }
  return pin;
};

const setupNetworkInfo = () => {
  const hostUrl = `${location.origin}/host.html`;
  elements.hostUrl.textContent = `URL хоста: ${hostUrl}`;
  elements.qr.src = createQrUrl(hostUrl);
  const pin = ensurePin();
  elements.pin.textContent = pin;
  elements.copyLink.addEventListener("click", () => {
    navigator.clipboard.writeText(hostUrl).catch(() => null);
  });
};

const bindEvents = () => {
  elements.setPuzzle.addEventListener("click", setPuzzle);
  elements.spin.addEventListener("click", spinWheel);
  elements.guess.addEventListener("click", handleGuess);
  elements.letter.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      handleGuess();
    }
  });
  elements.nextPlayer.addEventListener("click", () => {
    pushHistory();
    nextPlayer();
    setLastAction("Ход передан следующему игроку.");
    saveState();
    render();
    syncPublicState();
  });
  elements.bankrupt.addEventListener("click", applyBankrupt);
  elements.loseTurn.addEventListener("click", applyLoseTurn);
  elements.markSolved.addEventListener("click", markSolved);
  elements.applyPoints.addEventListener("click", applyManualPoints);
  elements.takePrize.addEventListener("click", takePrize);
  elements.undo.addEventListener("click", applyStateFromHistory);
  elements.addPlayer.addEventListener("click", addPlayer);
  elements.fileInput.addEventListener("change", handleFileUpload);
  elements.randomPuzzle.addEventListener("click", chooseRandomPuzzle);
};

bindEvents();
setupNetworkInfo();
render();
syncPublicState();
