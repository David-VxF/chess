// === public/chesspng/script.js ===
const boardSize = 8;
const tileSize = 64;
const boardEl = document.getElementById('chess-board');
const piecesEl = document.getElementById('pieces-layer');
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log') || createLogElement();

const game = new Chess();
let selectedSquare = null;
let waitingForAI = false;

const piecePosition = {
  'wp': [0, 0], 'wr': [1, 0], 'wn': [2, 0], 'wb': [3, 0], 'wq': [4, 0], 'wk': [5, 0],
  'bk': [0, 1], 'bq': [1, 1], 'bb': [2, 1], 'bn': [3, 1], 'br': [4, 1], 'bp': [5, 1]
};

function createLogElement() {
  const el = document.createElement('pre');
  el.id = 'log';
  el.style.background = '#111';
  el.style.color = '#0f0';
  el.style.padding = '10px';
  el.style.margin = '10px auto';
  el.style.width = '90%';
  el.style.maxHeight = '300px';
  el.style.overflowY = 'auto';
  el.style.fontSize = '12px';
  document.body.appendChild(el);
  return el;
}

function log(msg) {
  if (typeof msg !== 'string') msg = JSON.stringify(msg);
  logEl.textContent += msg + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}

function createPromotionPopup(from, to, callback) {
  const popup = document.createElement('div');
  popup.id = 'promotion-popup';
  popup.innerHTML = '<button data-piece="q">♕</button><button data-piece="r">♖</button><button data-piece="b">♗</button><button data-piece="n">♘</button>';
  popup.style.position = 'absolute';
  popup.style.left = '50%';
  popup.style.top = '50%';
  popup.style.transform = 'translate(-50%, -50%)';
  popup.style.zIndex = '99';
  popup.style.background = '#222';
  popup.style.padding = '10px';
  popup.style.border = '2px solid white';

  popup.querySelectorAll('button').forEach(btn => {
    btn.style.fontSize = '32px';
    btn.style.margin = '5px';
    btn.onclick = () => {
      document.body.removeChild(popup);
      callback({ from, to, promotion: btn.dataset.piece });
    };
  });

  document.body.appendChild(popup);
}

function createPieceElements(fen) {
  piecesEl.innerHTML = '';
  const rows = fen.split(' ')[0].split('/');

  for (let y = 0; y < boardSize; y++) {
    let x = 0;
    for (let char of rows[y]) {
      if (!isNaN(char)) {
        x += parseInt(char);
      } else {
        const color = char === char.toUpperCase() ? 'w' : 'b';
        const type = char.toLowerCase();
        const key = color + type;
        const pos = piecePosition[key];
        if (!pos) continue;

        const el = document.createElement('div');
        el.className = 'sprite-piece';
        el.dataset.square = `${'abcdefgh'[x]}${8 - y}`;
        el.style.left = `${x * tileSize}px`;
        el.style.top = `${y * tileSize}px`;
        el.style.backgroundPosition = `-${pos[0] * tileSize}px -${pos[1] * tileSize}px`;
        piecesEl.appendChild(el);
        x++;
      }
    }
  }
  highlightCheck();
}

function animateMove(from, to) {
  const piece = [...piecesEl.children].find(p => p.dataset.square === from);
  if (!piece) return;

  const [fx, fy] = [from.charCodeAt(0) - 97, 8 - parseInt(from[1])];
  const [tx, ty] = [to.charCodeAt(0) - 97, 8 - parseInt(to[1])];
  piece.style.transition = 'top 0.2s, left 0.2s';
  piece.style.left = `${tx * tileSize}px`;
  piece.style.top = `${ty * tileSize}px`;
  piece.dataset.square = to;

  const target = [...piecesEl.children].find(p => p.dataset.square === to && p !== piece);
  if (target) {
    setTimeout(() => moveToGraveyard(target), 200);
  }

  const isPromotionRow = (game.turn() === 'b' && to[1] === '8') || (game.turn() === 'w' && to[1] === '1');
  if (isPromotionRow) {
    piece.classList.add('promoted');
    setTimeout(() => piece.classList.remove('promoted'), 800);
  }
}
function moveToGraveyard(pieceEl) {
  const clone = document.createElement('div');
  clone.className = 'sprite-piece';
  clone.style.width = '32px';
  clone.style.height = '32px';
  clone.style.backgroundImage = pieceEl.style.backgroundImage;
  clone.style.backgroundPosition = pieceEl.style.backgroundPosition;
  clone.style.transform = 'scale(0.6)';
  clone.style.opacity = '0';

  const isWhite = pieceEl.style.backgroundPosition.includes('0px 0px') || pieceEl.style.backgroundPosition.includes('0 0');
  const targetGrave = isWhite ? document.getElementById('lost-white') : document.getElementById('lost-black');
  targetGrave.appendChild(clone);

  // Tunggu 1 frame agar layout terjadi, lalu beri animasi
  requestAnimationFrame(() => {
    clone.style.animation = 'slide-in 0.5s forwards';
  });

  // Hapus dari papan
  pieceEl.remove();
}
function highlightCheck() {
  document.querySelectorAll('.square-check, .square-checkmate').forEach(el => {
    el.classList.remove('square-check', 'square-checkmate');
  });

  const kingSquare = findKing(game.turn());
  if (!kingSquare) return;

  const attackers = getAttackersToSquare(kingSquare, game.turn());

  if (game.in_check() || game.in_checkmate()) {
    const kingEl = document.querySelector(`[data-square='${kingSquare}']`);
    if (kingEl) {
      kingEl.classList.add(game.in_checkmate() ? 'square-checkmate' : 'square-check');
    }

    attackers.forEach(att => {
      const attackerEl = document.querySelector(`[data-square='${att}']`);
      if (attackerEl) attackerEl.classList.add('square-check');
    });

    updateStatus(game.in_checkmate() ? '♛ Checkmate' : '☗ Check');
  }
}

function findKing(color) {
  const board = game.board();
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const piece = board[y][x];
      if (piece && piece.type === 'k' && piece.color === color) {
        return `${'abcdefgh'[x]}${8 - y}`;
      }
    }
  }
  return null;
}

function getAttackersToSquare(square, color) {
  const temp = new Chess(game.fen());
  const enemy = color === 'w' ? 'b' : 'w';
  return temp.moves({ verbose: true })
    .filter(m => m.to === square && m.color === enemy)
    .map(m => m.from);
}

function getSquareFromEvent(e) {
  const rect = boardEl.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / tileSize);
  const y = Math.floor((e.clientY - rect.top) / tileSize);
  return `${'abcdefgh'[x]}${8 - y}`;
}

boardEl.addEventListener('click', (e) => {
  if (waitingForAI || game.game_over()) return;

  const square = getSquareFromEvent(e);
  log("🖱️ Klik pada petak: " + square);

  if (selectedSquare) {
    const moves = game.moves({ verbose: true });
    const isPromotion = moves.some(m => m.from === selectedSquare && m.to === square && m.promotion);

    if (isPromotion) {
      createPromotionPopup(selectedSquare, square, (moveObj) => {
        const move = game.move(moveObj);
        if (move) {
          animateMove(move.from, move.to);
          selectedSquare = null;
          updateStatus('Giliran AI...');
          waitingForAI = true;
          log("✅ Langkah pemain: " + move.from + " → " + move.to);
          setTimeout(() => {
            createPieceElements(game.fen());
            getAIMove();
          }, 300);
        }
      });
    } else {
      const move = game.move({ from: selectedSquare, to: square });
      if (move) {
        animateMove(move.from, move.to);
        setTimeout(() => {
          createPieceElements(game.fen());
        }, 200);
        selectedSquare = null;
        updateStatus('Giliran AI...');
        waitingForAI = true;
        log("✅ Langkah pemain: " + move.from + " → " + move.to);
        setTimeout(() => getAIMove(), 300);
      } else {
        selectedSquare = square;
        log("⚠️ Langkah tidak valid: " + selectedSquare + " → " + square);
      }
    }
  } else {
    selectedSquare = square;
  }
});

function getAIMove() {
  const currentFEN = game.fen();

  fetch('/stockfish-move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen: currentFEN })
  })
    .then(res => res.json())
    .then(data => {
      log("🤖 Jawaban AI: " + JSON.stringify(data));

      if (!data.move) {
        updateStatus('⚠️ AI tidak memberikan langkah.');
        waitingForAI = false;
        return;
      }

      const parsedMove = {
        from: data.move.substring(0, 2),
        to: data.move.substring(2, 4),
        promotion: 'q'
      };

      const aiGame = new Chess();
      aiGame.load(currentFEN);
      const move = aiGame.move(parsedMove);

      if (!move) {
        log("❌ Langkah AI tidak valid bahkan pada game salinan: " + data.move);
        updateStatus('⚠️ Langkah AI tidak valid.');
        waitingForAI = false;
        return;
      }

      game.load(currentFEN);
      game.move(parsedMove);
      animateMove(parsedMove.from, parsedMove.to);
      setTimeout(() => {
        createPieceElements(game.fen());
      }, 200);
      updateStatus('Giliran Anda');
      log("✅ AI jalan: " + move.from + " → " + move.to);
      waitingForAI = false;
    })
    .catch(err => {
      log("❌ Error komunikasi AI: " + err);
      updateStatus('⚠️ Gagal koneksi AI.');
      waitingForAI = false;
    });
}

function updateStatus(msg) {
  if (statusEl) statusEl.innerText = msg;
}

createPieceElements(game.fen());
updateStatus('Giliran Anda');
log("♟️ Game dimulai");