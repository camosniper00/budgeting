import { useState, useEffect, useRef, useCallback } from 'react';
import { COUNTRIES } from '../lib/flagleCountries';
import {
  getDailyCountry,
  haversineDistance,
  getBearing,
  getDirectionLabel,
  getProximityPercent,
  getProximityEmoji,
  getPuzzleNumber,
} from '../lib/flagleUtils';

const MAX_GUESSES = 6;
const STORAGE_KEY = 'flagle-state-v1';

// ─── Persistence ─────────────────────────────────────────────────────────────

function loadState(targetCode) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    if (saved.date === today && saved.targetCode === targetCode) return saved;
  } catch {}
  return null;
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

// ─── Flag tile grid ───────────────────────────────────────────────────────────

function FlagGrid({ code, revealedCount }) {
  const src = `https://flagcdn.com/w640/${code}.png`;

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden shadow-2xl border-2 border-border bg-gray-200"
      style={{ aspectRatio: '3 / 2' }}
    >
      {/* Actual flag, always rendered underneath */}
      <img
        src={src}
        alt="Country flag"
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />

      {/* 3 × 2 overlay grid */}
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-2">
        {Array.from({ length: 6 }, (_, i) => {
          const revealed = i < revealedCount;
          return (
            <div
              key={i}
              className="border border-white/20 flex items-center justify-center transition-all duration-500"
              style={{
                backgroundColor: revealed ? 'transparent' : 'rgba(30, 41, 59, 0.88)',
              }}
            >
              {!revealed && (
                <span
                  className="text-slate-400 font-bold select-none"
                  style={{ fontSize: 'clamp(1rem, 3vw, 2rem)' }}
                >
                  ?
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Guess tracker dots ───────────────────────────────────────────────────────

function GuessDots({ guesses }) {
  return (
    <div className="flex justify-center gap-2 mt-4">
      {Array.from({ length: MAX_GUESSES }, (_, i) => {
        const g = guesses[i];
        let bg = 'bg-gray-200 border-gray-300';
        let label = String(i + 1);
        if (g) {
          if (g.correct) { bg = 'bg-green-500 border-green-600'; label = '✓'; }
          else if (g.proximity >= 80) { bg = 'bg-yellow-400 border-yellow-500'; label = '✗'; }
          else if (g.proximity >= 50) { bg = 'bg-orange-400 border-orange-500'; label = '✗'; }
          else { bg = 'bg-red-400 border-red-500'; label = '✗'; }
        }
        return (
          <div
            key={i}
            className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-bold text-white ${bg}`}
          >
            {g ? label : <span className="text-gray-400 text-xs">{i + 1}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Autocomplete input ───────────────────────────────────────────────────────

function CountryInput({ guesses, onGuess, disabled }) {
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState('');
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const alreadyGuessed = new Set(guesses.map(g => g.country.code));

  useEffect(() => {
    if (value.trim().length < 1) { setSuggestions([]); return; }
    const q = value.toLowerCase();
    const filtered = COUNTRIES
      .filter(c => !alreadyGuessed.has(c.code))
      .filter(c => c.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aS = a.name.toLowerCase().startsWith(q);
        const bS = b.name.toLowerCase().startsWith(q);
        if (aS && !bS) return -1;
        if (!aS && bS) return 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 8);
    setSuggestions(filtered);
    setActiveSuggestion(-1);
  }, [value, guesses.length]);

  const commit = useCallback((country) => {
    setValue('');
    setSuggestions([]);
    setError('');
    onGuess(country);
  }, [onGuess]);

  const handleKeyDown = (e) => {
    if (suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion(v => Math.min(v + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion(v => Math.max(v - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestion >= 0) {
        commit(suggestions[activeSuggestion]);
      } else {
        const exact = COUNTRIES.find(c => c.name.toLowerCase() === value.toLowerCase());
        if (exact && !alreadyGuessed.has(exact.code)) {
          commit(exact);
        } else if (suggestions.length === 1) {
          commit(suggestions[0]);
        } else {
          setError(exact ? 'Already guessed!' : 'Select a country from the list');
          setTimeout(() => setError(''), 2500);
        }
      }
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setActiveSuggestion(-1);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const exact = COUNTRIES.find(c => c.name.toLowerCase() === value.toLowerCase());
    if (exact && !alreadyGuessed.has(exact.code)) { commit(exact); return; }
    if (suggestions.length === 1) { commit(suggestions[0]); return; }
    setError('Select a country from the list');
    setTimeout(() => setError(''), 2500);
  };

  return (
    <div className="relative mt-5">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Type a country name…"
            autoComplete="off"
            spellCheck={false}
            className="w-full px-4 py-3 rounded-xl border-2 border-input bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {/* Dropdown */}
          {suggestions.length > 0 && (
            <ul
              ref={listRef}
              className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-background border border-border rounded-xl shadow-xl max-h-60 overflow-y-auto"
            >
              {suggestions.map((country, idx) => (
                <li key={country.code}>
                  <button
                    type="button"
                    onMouseDown={() => commit(country)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                      idx === activeSuggestion ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                    }`}
                  >
                    <img
                      src={`https://flagcdn.com/w40/${country.code}.png`}
                      alt=""
                      className="w-7 h-[18px] object-cover rounded flex-shrink-0"
                    />
                    <span>{country.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{country.continent}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="px-5 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Guess
        </button>
      </form>

      {error && (
        <p className="text-destructive text-xs mt-2 text-center animate-fade-in">{error}</p>
      )}
    </div>
  );
}

// ─── Single guess row ─────────────────────────────────────────────────────────

function GuessRow({ guess, index }) {
  const { country, correct, distance, bearing, proximity } = guess;

  const barColor = correct
    ? 'bg-green-500'
    : proximity >= 80 ? 'bg-yellow-400'
    : proximity >= 50 ? 'bg-orange-400'
    : 'bg-red-400';

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all animate-fade-in ${
        correct
          ? 'border-green-300 bg-green-50 dark:bg-green-950/30'
          : 'border-border bg-card'
      }`}
    >
      <span className="text-muted-foreground text-xs w-4 text-center tabular-nums">{index + 1}</span>

      <img
        src={`https://flagcdn.com/w40/${country.code}.png`}
        alt={country.name}
        className="w-9 h-6 object-cover rounded flex-shrink-0 shadow-sm"
      />

      <span className="font-medium text-sm flex-1 truncate">{country.name}</span>

      {correct ? (
        <span className="text-green-600 font-bold text-sm whitespace-nowrap">✓ Correct!</span>
      ) : (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-mono tabular-nums text-muted-foreground whitespace-nowrap">
            {Math.round(distance).toLocaleString()} km
          </span>
          <span className="text-sm w-10 text-center">{bearing}</span>
          {/* Proximity bar */}
          <div className="w-14 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${proximity}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-7 text-right tabular-nums">{proximity}%</span>
        </div>
      )}
    </div>
  );
}

// ─── Result overlay ───────────────────────────────────────────────────────────

function ResultOverlay({ gameStatus, target, guesses, onClose }) {
  const [copied, setCopied] = useState(false);

  const puzzleNum = getPuzzleNumber();
  const guessCount = gameStatus === 'won' ? guesses.length : 'X';
  const emojiGrid = guesses
    .map(g => getProximityEmoji(g.distance, g.correct))
    .join('');

  const shareText =
    `Flagle #${puzzleNum} ${guessCount}/${MAX_GUESSES}\n` +
    `${emojiGrid}\n` +
    `🏳️ flagle-game.com`;

  const copy = () => {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full text-center border border-border"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-5xl mb-3">{gameStatus === 'won' ? '🎉' : '😢'}</div>
        <h2 className="text-xl font-bold mb-1">
          {gameStatus === 'won' ? 'Brilliant!' : 'Better luck tomorrow!'}
        </h2>
        <p className="text-muted-foreground text-sm mb-4">
          {gameStatus === 'won'
            ? `Guessed in ${guesses.length} of ${MAX_GUESSES} tries`
            : 'You ran out of guesses'}
        </p>

        {/* Answer */}
        <div className="flex items-center justify-center gap-3 p-3 bg-muted rounded-xl mb-4">
          <img
            src={`https://flagcdn.com/w80/${target.code}.png`}
            alt={target.name}
            className="h-8 rounded shadow-sm"
          />
          <span className="font-semibold text-lg">{target.name}</span>
        </div>

        {/* Emoji grid */}
        <div className="font-mono text-2xl tracking-widest mb-5">{emojiGrid}</div>

        <div className="flex gap-2">
          <button
            onClick={copy}
            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-all"
          >
            {copied ? '✓ Copied!' : '📋 Share'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-muted text-muted-foreground rounded-xl font-semibold text-sm hover:bg-muted/70 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── How to play ──────────────────────────────────────────────────────────────

function HowToPlay() {
  return (
    <div className="mt-5 p-4 bg-muted/40 rounded-xl text-sm text-muted-foreground border border-border/50">
      <p className="font-semibold text-foreground mb-2">How to play</p>
      <ul className="space-y-1.5">
        <li>🏳️ Guess the country from its flag — <strong>{MAX_GUESSES} attempts</strong></li>
        <li>🔍 Each wrong guess reveals one more tile of the flag</li>
        <li>📏 Hints show <strong>distance</strong> and <strong>direction</strong> to the answer</li>
        <li>🎯 The bar shows how close your guess is (green = very close)</li>
        <li>🔄 A new flag drops every day</li>
      </ul>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Flagle() {
  const target = getDailyCountry(COUNTRIES);

  const [guesses, setGuesses] = useState([]);
  const [gameStatus, setGameStatus] = useState('playing'); // 'playing' | 'won' | 'lost'
  const [showResult, setShowResult] = useState(false);

  // Restore persisted state for today
  useEffect(() => {
    const saved = loadState(target.code);
    if (saved) {
      setGuesses(saved.guesses);
      setGameStatus(saved.gameStatus);
      if (saved.gameStatus !== 'playing') setShowResult(true);
    }
  }, []); // eslint-disable-line

  const wrongGuesses = guesses.filter(g => !g.correct).length;
  // Reveal one tile per wrong guess; reveal all on win
  const revealedCount = gameStatus === 'won' ? 6 : wrongGuesses;

  const handleGuess = useCallback((country) => {
    if (gameStatus !== 'playing') return;

    const isCorrect = country.code === target.code;
    const distance = isCorrect ? 0 : haversineDistance(country.lat, country.lng, target.lat, target.lng);
    const bearing = isCorrect ? '' : getDirectionLabel(getBearing(country.lat, country.lng, target.lat, target.lng));
    const proximity = getProximityPercent(distance);

    const newGuesses = [
      ...guesses,
      { country, correct: isCorrect, distance, bearing, proximity },
    ];
    setGuesses(newGuesses);

    const newWrong = newGuesses.filter(g => !g.correct).length;
    let newStatus = 'playing';
    if (isCorrect) newStatus = 'won';
    else if (newWrong >= MAX_GUESSES) newStatus = 'lost';

    setGameStatus(newStatus);

    saveState({
      date: new Date().toISOString().slice(0, 10),
      targetCode: target.code,
      guesses: newGuesses,
      gameStatus: newStatus,
    });

    if (newStatus !== 'playing') {
      setTimeout(() => setShowResult(true), 800);
    }
  }, [guesses, gameStatus, target]);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="max-w-xl mx-auto px-4 py-8 select-none">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-2xl">🏳️</span>
          <h1 className="text-4xl font-extrabold tracking-widest uppercase text-foreground">
            Flagle
          </h1>
          <span className="text-2xl">🏳️</span>
        </div>
        <p className="text-muted-foreground text-sm">#{getPuzzleNumber()} — {today}</p>
      </div>

      {/* Flag */}
      <FlagGrid code={target.code} revealedCount={revealedCount} />

      {/* Guess dots */}
      <GuessDots guesses={guesses} />

      {/* Game-over banner (inline, before result modal opens) */}
      {gameStatus !== 'playing' && !showResult && (
        <div
          className={`mt-4 py-3 px-4 rounded-xl text-center text-sm font-semibold ${
            gameStatus === 'won'
              ? 'bg-green-100 text-green-700 border border-green-200'
              : 'bg-red-100 text-red-700 border border-red-200'
          }`}
        >
          {gameStatus === 'won' ? `🎉 Correct! It's ${target.name}!` : `😢 The answer was ${target.name}`}
        </div>
      )}

      {/* Input */}
      <CountryInput
        guesses={guesses}
        onGuess={handleGuess}
        disabled={gameStatus !== 'playing'}
      />

      {/* Show result button after game ends */}
      {gameStatus !== 'playing' && (
        <button
          onClick={() => setShowResult(true)}
          className="w-full mt-3 py-2.5 bg-primary/10 text-primary rounded-xl text-sm font-semibold hover:bg-primary/20 transition-colors border border-primary/20"
        >
          See Results
        </button>
      )}

      {/* Guess history */}
      {guesses.length > 0 && (
        <div className="mt-6 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Your guesses
          </p>
          {guesses.map((g, i) => <GuessRow key={i} guess={g} index={i} />)}
        </div>
      )}

      {/* How to play (only when no guesses yet) */}
      {guesses.length === 0 && <HowToPlay />}

      {/* Result modal */}
      {showResult && (
        <ResultOverlay
          gameStatus={gameStatus}
          target={target}
          guesses={guesses}
          onClose={() => setShowResult(false)}
        />
      )}
    </div>
  );
}
