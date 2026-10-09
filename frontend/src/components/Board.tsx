interface BoardProps {
  cells: number[]; // length 42, index = row*7 + col, row 0 = bottom
  onDrop: (column: number) => void;
  canPlay: boolean;
  lastMove?: { row: number; column: number } | null;
}

const COLS = 7;
const ROWS = 6;

function cellClass(value: number): string {
  if (value === 1) return "cell p1";
  if (value === 2) return "cell p2";
  return "cell";
}

export default function Board({ cells, onDrop, canPlay, lastMove }: BoardProps) {
  const rows = [];
  for (let row = ROWS - 1; row >= 0; row--) {
    const cols = [];
    for (let col = 0; col < COLS; col++) {
      const value = cells[row * COLS + col] ?? 0;
      const isLast = lastMove?.row === row && lastMove?.column === col;
      cols.push(
        <div key={col} className={cellClass(value) + (isLast ? " last" : "")} />,
      );
    }
    rows.push(
      <div key={row} className="board-row">
        {cols}
      </div>,
    );
  }

  const dropButtons = [];
  for (let col = 0; col < COLS; col++) {
    dropButtons.push(
      <button
        key={col}
        className="drop-btn"
        disabled={!canPlay}
        onClick={() => onDrop(col)}
        title={`Drop in column ${col + 1}`}
      >
        ▼
      </button>,
    );
  }

  return (
    <div className="board-wrap">
      <div className="drop-row">{dropButtons}</div>
      <div className="board">{rows}</div>
    </div>
  );
}
