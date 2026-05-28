import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  STATES,
  fitTransitionMatrix,
  forecastRegime,
  labelRegimes,
  markovSignal,
  signalFromProbabilities,
  stationaryDistribution,
  walkForwardSignals,
} from './markov_regime.js';

test('labelRegimes classifies trailing returns into bear sideways and bull states', () => {
  const closes = [
    100, 100, 100, 100, 100,
    106, 103, 94, 100,
  ];

  const labels = labelRegimes(closes, {
    lookback: 5,
    bullThreshold: 0.05,
    bearThreshold: -0.05,
  });

  assert.deepEqual(labels, [
    null, null, null, null, null,
    'bull', 'sideways', 'bear', 'sideways',
  ]);
});

test('fitTransitionMatrix counts state-to-state transitions and normalizes rows', () => {
  const labels = [
    null,
    'bull', 'bull', 'sideways', 'bear', 'bear', 'bull',
  ];

  const matrix = fitTransitionMatrix(labels, { smoothing: 0 });

  assert.deepEqual(STATES, ['bear', 'sideways', 'bull']);
  assert.deepEqual(matrix.bull, { bear: 0, sideways: 0.5, bull: 0.5 });
  assert.deepEqual(matrix.sideways, { bear: 1, sideways: 0, bull: 0 });
  assert.deepEqual(matrix.bear, { bear: 0.5, sideways: 0, bull: 0.5 });
});

test('forecastRegime raises the transition matrix to an n-step horizon', () => {
  const matrix = {
    bear: { bear: 0.6, sideways: 0.2, bull: 0.2 },
    sideways: { bear: 0.1, sideways: 0.8, bull: 0.1 },
    bull: { bear: 0.1, sideways: 0.2, bull: 0.7 },
  };

  const oneStep = forecastRegime(matrix, 'bull', 1);
  const twoStep = forecastRegime(matrix, 'bull', 2);

  assert.deepEqual(oneStep, { bear: 0.1, sideways: 0.2, bull: 0.7 });
  assert.ok(Math.abs(twoStep.bull - 0.53) < 1e-12);
  assert.ok(Math.abs(twoStep.bear - 0.15) < 1e-12);
  assert.ok(Math.abs(twoStep.sideways - 0.32) < 1e-12);
});

test('stationaryDistribution converges to the long-run regime mix', () => {
  const matrix = {
    bear: { bear: 0.6, sideways: 0.2, bull: 0.2 },
    sideways: { bear: 0.1, sideways: 0.8, bull: 0.1 },
    bull: { bear: 0.1, sideways: 0.2, bull: 0.7 },
  };

  const stationary = stationaryDistribution(matrix);

  assert.ok(Math.abs(stationary.bear - 0.2) < 1e-6);
  assert.ok(Math.abs(stationary.sideways - 0.5) < 1e-6);
  assert.ok(Math.abs(stationary.bull - 0.3) < 1e-6);
});

test('signalFromProbabilities subtracts bear probability from bull probability', () => {
  assert.equal(signalFromProbabilities({ bear: 0.2, sideways: 0.15, bull: 0.65 }), 0.45);
  assert.equal(signalFromProbabilities({ bear: 0.42, sideways: 0.29, bull: 0.29 }), -0.13);
});

test('markovSignal returns the current state, forecast and signed signal', () => {
  const closes = [
    100, 101, 102, 103, 104,
    110, 111, 112, 113, 114, 115,
  ];

  const result = markovSignal(closes, {
    lookback: 5,
    bullThreshold: 0.03,
    bearThreshold: -0.03,
    smoothing: 1,
  });

  assert.equal(result.currentState, 'bull');
  assert.ok(result.forecast.bull > result.forecast.bear);
  assert.ok(result.signal > 0);
});

test('walkForwardSignals does not change past signals when future prices change', () => {
  const prefix = [
    100, 100, 100, 100, 100,
    106, 107, 108, 109, 110, 111, 112,
  ];
  const original = prefix.concat([90, 88, 86, 84, 82]);
  const mutatedFuture = prefix.concat([140, 145, 150, 155, 160]);

  const opts = {
    lookback: 5,
    bullThreshold: 0.03,
    bearThreshold: -0.03,
    minTrainingBars: 8,
    smoothing: 1,
  };

  const originalSignals = walkForwardSignals(original, opts);
  const mutatedSignals = walkForwardSignals(mutatedFuture, opts);

  assert.deepEqual(originalSignals.slice(0, 4), mutatedSignals.slice(0, 4));
});
