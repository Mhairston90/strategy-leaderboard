export const STATES = ['bear', 'sideways', 'bull'];

export function labelRegimes(closes, {
  lookback = 20,
  bullThreshold = 0.05,
  bearThreshold = -0.05,
} = {}) {
  return closes.map((close, i) => {
    if (i < lookback) return null;
    const start = closes[i - lookback];
    if (!Number.isFinite(close) || !Number.isFinite(start) || start === 0) return null;
    const trailingReturn = close / start - 1;
    if (trailingReturn >= bullThreshold) return 'bull';
    if (trailingReturn <= bearThreshold) return 'bear';
    return 'sideways';
  });
}

export function fitTransitionMatrix(labels, {
  states = STATES,
  smoothing = 1,
} = {}) {
  const counts = Object.fromEntries(states.map(state => [
    state,
    Object.fromEntries(states.map(next => [next, smoothing])),
  ]));

  for (let i = 0; i < labels.length - 1; i += 1) {
    const from = labels[i];
    const to = labels[i + 1];
    if (!states.includes(from) || !states.includes(to)) continue;
    counts[from][to] += 1;
  }

  return Object.fromEntries(states.map(state => {
    const rowTotal = states.reduce((sum, next) => sum + counts[state][next], 0);
    const row = rowTotal === 0
      ? Object.fromEntries(states.map(next => [next, 1 / states.length]))
      : Object.fromEntries(states.map(next => [next, counts[state][next] / rowTotal]));
    return [state, row];
  }));
}

export function forecastRegime(matrix, currentState, horizon = 1, states = STATES) {
  if (!states.includes(currentState)) {
    throw new Error(`Unknown currentState: ${currentState}`);
  }
  if (!Number.isInteger(horizon) || horizon < 1) {
    throw new Error('horizon must be a positive integer');
  }

  let probabilities = Object.fromEntries(states.map(state => [state, state === currentState ? 1 : 0]));
  for (let step = 0; step < horizon; step += 1) {
    probabilities = multiplyDistribution(probabilities, matrix, states);
  }
  return probabilities;
}

export function stationaryDistribution(matrix, {
  states = STATES,
  iterations = 1000,
  tolerance = 1e-12,
} = {}) {
  let probabilities = Object.fromEntries(states.map(state => [state, 1 / states.length]));
  for (let i = 0; i < iterations; i += 1) {
    const next = multiplyDistribution(probabilities, matrix, states);
    const delta = states.reduce((sum, state) => sum + Math.abs(next[state] - probabilities[state]), 0);
    probabilities = next;
    if (delta < tolerance) break;
  }
  return probabilities;
}

export function signalFromProbabilities(probabilities) {
  return probabilities.bull - probabilities.bear;
}

export function markovSignal(closes, {
  lookback = 20,
  bullThreshold = 0.05,
  bearThreshold = -0.05,
  smoothing = 1,
  horizon = 1,
} = {}) {
  const labels = labelRegimes(closes, { lookback, bullThreshold, bearThreshold });
  const currentState = latestState(labels);
  if (!currentState) {
    return {
      currentState: null,
      matrix: fitTransitionMatrix(labels, { smoothing }),
      forecast: null,
      signal: null,
      labels,
    };
  }

  const matrix = fitTransitionMatrix(labels, { smoothing });
  const forecast = forecastRegime(matrix, currentState, horizon);
  return {
    currentState,
    matrix,
    forecast,
    signal: signalFromProbabilities(forecast),
    labels,
  };
}

export function walkForwardSignals(closes, {
  lookback = 20,
  bullThreshold = 0.05,
  bearThreshold = -0.05,
  smoothing = 1,
  horizon = 1,
  minTrainingBars = Math.max(lookback + 2, 40),
} = {}) {
  const out = [];
  for (let i = minTrainingBars - 1; i < closes.length; i += 1) {
    const prefix = closes.slice(0, i + 1);
    const signal = markovSignal(prefix, {
      lookback,
      bullThreshold,
      bearThreshold,
      smoothing,
      horizon,
    });
    out.push({
      index: i,
      close: closes[i],
      currentState: signal.currentState,
      forecast: signal.forecast,
      signal: signal.signal,
    });
  }
  return out;
}

function latestState(labels) {
  for (let i = labels.length - 1; i >= 0; i -= 1) {
    if (labels[i]) return labels[i];
  }
  return null;
}

function multiplyDistribution(probabilities, matrix, states) {
  return Object.fromEntries(states.map(to => {
    const value = states.reduce((sum, from) => {
      const fromWeight = probabilities[from] || 0;
      const transition = matrix[from]?.[to] || 0;
      return sum + fromWeight * transition;
    }, 0);
    return [to, value];
  }));
}
