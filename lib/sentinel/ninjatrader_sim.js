import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_CONSUMPTION_TIMEOUT_MS = 60_000;
const DEFAULT_FEEDBACK_TIMEOUT_MS = 60_000;
const DEFAULT_POLL_INTERVAL_MS = 250;

function normalizeText(value) {
  return String(value ?? '').trim();
}

function requireText(value, label) {
  const text = normalizeText(value);
  if (!text) {
    throw new Error(`${label} is required`);
  }
  return text;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMissingFile(error) {
  return error?.code === 'ENOENT';
}

function numeric(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be numeric`);
  }
  return parsed;
}

function oifAction(side) {
  const normalized = normalizeText(side).toLowerCase();
  if (normalized === 'buy') {
    return 'BUY';
  }
  if (normalized === 'sell') {
    return 'SELL';
  }
  throw new Error('NinjaTrader OIF side must be buy or sell');
}

function oifOrderType(orderType) {
  const normalized = normalizeText(orderType).toLowerCase();
  if (normalized === 'market' || normalized === 'mkt') {
    return 'MARKET';
  }
  if (normalized === 'limit' || normalized === 'lmt') {
    return 'LIMIT';
  }
  if (normalized === 'stopmarket' || normalized === 'stop_market') {
    return 'STOPMARKET';
  }
  if (normalized === 'stoplimit' || normalized === 'stop_limit') {
    return 'STOPLIMIT';
  }
  throw new Error('NinjaTrader OIF order_type must be market, limit, stopmarket, or stoplimit');
}

function oifTimeInForce(value) {
  const normalized = normalizeText(value || 'day').toLowerCase();
  if (normalized === 'day') {
    return 'DAY';
  }
  if (normalized === 'gtc') {
    return 'GTC';
  }
  throw new Error('NinjaTrader OIF time_in_force must be day or gtc');
}

function oifQuantity(quantity) {
  const parsed = numeric(quantity, 'NinjaTrader OIF quantity');
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('NinjaTrader OIF quantity must be a positive integer');
  }
  return String(parsed);
}

function sanitizeOrderId(value) {
  const sanitized = normalizeText(value).replace(/[^A-Za-z0-9_-]+/g, '');
  if (!sanitized) {
    throw new Error('NinjaTrader OIF client_order_id is required');
  }
  return sanitized.slice(0, 80);
}

function assertSimulationAccount(account) {
  const value = requireText(account, 'NinjaTrader sim account');
  if (!/^(sim|demo)/i.test(value)) {
    throw new Error('NinjaTrader sim account must start with Sim or DEMO');
  }
  return value;
}

function defaultOifId() {
  return `${Date.now()}${Math.floor(Math.random() * 1_000_000)}`;
}

export function defaultNinjaTraderDocumentsRoot(env = process.env) {
  const explicit = normalizeText(env?.NINJATRADER_USER_DATA_DIR);
  if (explicit) {
    return explicit;
  }

  return path.join(os.homedir(), 'OneDrive', 'Documents', 'NinjaTrader 8');
}

export function buildNinjaTraderOifFileName({ id = defaultOifId() } = {}) {
  const raw = normalizeText(id);
  const digits = raw.replace(/\D+/g, '');
  const suffix = digits === raw ? digits : `${Date.now()}${digits}`;
  const safeSuffix = suffix || defaultOifId();
  return `oif${safeSuffix}.txt`;
}

export function buildPlaceOifLine(order = {}) {
  const account = assertSimulationAccount(order.account);
  const instrument = requireText(order.instrument ?? order.symbol, 'NinjaTrader OIF instrument');
  const action = oifAction(order.side);
  const quantity = oifQuantity(order.quantity ?? order.qty);
  const orderType = oifOrderType(order.order_type ?? order.type ?? 'market');
  const timeInForce = oifTimeInForce(order.time_in_force ?? order.tif ?? 'day');
  const orderId = sanitizeOrderId(order.client_order_id ?? order.order_id);

  return [
    'PLACE',
    account,
    instrument,
    action,
    quantity,
    orderType,
    '',
    '',
    timeInForce,
    '',
    orderId,
    '',
    '',
  ].join(';');
}

export function buildClosePositionOifLine(command = {}) {
  const account = assertSimulationAccount(command.account);
  const instrument = requireText(command.instrument ?? command.symbol, 'NinjaTrader OIF instrument');
  return ['CLOSEPOSITION', account, instrument, '', '', '', '', '', '', '', '', '', ''].join(';');
}

export function parseNinjaTraderOrderFeedback(text) {
  const raw = normalizeText(text);
  const [status, filledQty, fillPrice] = raw.split(';');
  return {
    status: normalizeText(status).toLowerCase(),
    filled_qty: numeric(filledQty || 0, 'NinjaTrader filled quantity'),
    fill_price: numeric(fillPrice || 0, 'NinjaTrader fill price'),
    raw,
  };
}

export function parseNinjaTraderPositionFeedback(text) {
  const raw = normalizeText(text);
  const [marketPosition, quantity, avgPrice] = raw.split(';');
  return {
    market_position: normalizeText(marketPosition).toLowerCase(),
    qty: numeric(quantity || 0, 'NinjaTrader position quantity'),
    avg_price: numeric(avgPrice || 0, 'NinjaTrader average price'),
    raw,
  };
}

async function waitUntil(predicate, { timeoutMs, intervalMs, timeoutMessage }) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    const value = await predicate();
    if (value) {
      return value;
    }
    await sleep(intervalMs);
  }
  throw new Error(timeoutMessage);
}

async function waitForFileToDisappear(filePath, { timeoutMs, intervalMs }) {
  return waitUntil(
    async () => {
      try {
        await stat(filePath);
        return false;
      } catch (error) {
        if (isMissingFile(error)) {
          return true;
        }
        throw error;
      }
    },
    {
      timeoutMs,
      intervalMs,
      timeoutMessage: `NinjaTrader did not consume OIF file: ${filePath}`,
    },
  );
}

async function writeOifCommand({ incomingDir, fileName, line }) {
  await mkdir(incomingDir, { recursive: true });
  const filePath = path.join(incomingDir, fileName);
  await writeFile(filePath, `${line}\r\n`, { encoding: 'ascii', flag: 'wx' });
  return filePath;
}

async function readIfExists(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (isMissingFile(error)) {
      return null;
    }
    throw error;
  }
}

function parsePositionFilename(filename, account) {
  const suffix = `_${account}_position.txt`;
  if (!filename.endsWith(suffix)) {
    return null;
  }
  const prefix = filename.slice(0, -suffix.length);
  const match = /^(.*)\s+([A-Za-z0-9]+)$/.exec(prefix);
  if (!match) {
    return { instrument: prefix, exchange: null };
  }
  return { instrument: match[1], exchange: match[2] };
}

function orderFeedbackPath(outgoingDir, account, orderId) {
  return path.join(outgoingDir, `${account}_${orderId}.txt`);
}

export function createNinjaTraderSimClient({
  env = process.env,
  documentsRoot = defaultNinjaTraderDocumentsRoot(env),
  account = env?.NINJATRADER_ACCOUNT || 'Sim101',
  connectionName = env?.NINJATRADER_CONNECTION || 'Simulation',
  nextOifId = defaultOifId,
  waitForFeedback = false,
  consumptionTimeoutMs = DEFAULT_CONSUMPTION_TIMEOUT_MS,
  feedbackTimeoutMs = DEFAULT_FEEDBACK_TIMEOUT_MS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
} = {}) {
  const safeAccount = assertSimulationAccount(account);
  const safeConnectionName = requireText(connectionName, 'NinjaTrader connection name');
  const root = requireText(documentsRoot, 'NinjaTrader documents root');
  const incomingDir = path.join(root, 'incoming');
  const outgoingDir = path.join(root, 'outgoing');

  async function writeCommand(line) {
    const fileName = buildNinjaTraderOifFileName({ id: nextOifId() });
    return writeOifCommand({ incomingDir, fileName, line });
  }

  async function waitForOrderFeedback(orderId) {
    const filePath = orderFeedbackPath(outgoingDir, safeAccount, orderId);
    return waitUntil(
      async () => {
        const text = await readIfExists(filePath);
        return text === null ? false : parseNinjaTraderOrderFeedback(text);
      },
      {
        timeoutMs: feedbackTimeoutMs,
        intervalMs: pollIntervalMs,
        timeoutMessage: `NinjaTrader order feedback not observed: ${filePath}`,
      },
    );
  }

  async function positions() {
    let entries;
    try {
      entries = await readdir(outgoingDir, { withFileTypes: true });
    } catch (error) {
      if (isMissingFile(error)) {
        return [];
      }
      throw error;
    }

    const rows = [];
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      const parsedName = parsePositionFilename(entry.name, safeAccount);
      if (!parsedName) {
        continue;
      }
      const text = await readFile(path.join(outgoingDir, entry.name), 'utf8');
      rows.push({
        account: safeAccount,
        instrument: parsedName.instrument,
        exchange: parsedName.exchange,
        ...parseNinjaTraderPositionFeedback(text),
      });
    }
    rows.sort((left, right) => left.instrument.localeCompare(right.instrument));
    return rows;
  }

  async function waitForFlatPosition(instrument) {
    return waitUntil(
      async () => {
        const currentPositions = await positions();
        return currentPositions.find(
          (position) =>
            position.instrument === instrument &&
            position.market_position === 'flat' &&
            position.qty === 0,
        );
      },
      {
        timeoutMs: feedbackTimeoutMs,
        intervalMs: pollIntervalMs,
        timeoutMessage: `NinjaTrader flat position feedback not observed for ${instrument}`,
      },
    );
  }

  return {
    async submitOrder(order = {}) {
      const orderId = sanitizeOrderId(order.client_order_id ?? order.order_id ?? `NT${nextOifId()}`);
      const line = buildPlaceOifLine({ ...order, account: safeAccount, client_order_id: orderId });
      const oifFile = await writeCommand(line);
      const result = {
        ok: true,
        order: {
          id: orderId,
          account: safeAccount,
          instrument: requireText(order.instrument ?? order.symbol, 'NinjaTrader OIF instrument'),
          oif_file: oifFile,
          status: 'submitted',
        },
      };

      if (order.waitForFeedback ?? waitForFeedback) {
        await waitForFileToDisappear(oifFile, {
          timeoutMs: consumptionTimeoutMs,
          intervalMs: pollIntervalMs,
        });
        result.order.feedback = await waitForOrderFeedback(orderId);
        result.order.status = result.order.feedback.status;
      }

      return result;
    },

    async closePosition(command = {}) {
      const instrument = requireText(command.instrument ?? command.symbol, 'NinjaTrader OIF instrument');
      const line = buildClosePositionOifLine({ ...command, account: safeAccount, instrument });
      const oifFile = await writeCommand(line);
      const result = {
        ok: true,
        close: {
          account: safeAccount,
          instrument,
          oif_file: oifFile,
          status: 'submitted',
        },
      };

      if (command.waitForFlat ?? waitForFeedback) {
        await waitForFileToDisappear(oifFile, {
          timeoutMs: consumptionTimeoutMs,
          intervalMs: pollIntervalMs,
        });
        result.close.feedback = await waitForFlatPosition(instrument);
        result.close.status = result.close.feedback.market_position;
      }

      return result;
    },

    async getAccount() {
      const text = await readIfExists(path.join(outgoingDir, `${safeConnectionName}.txt`));
      return {
        ok: true,
        account: {
          account: safeAccount,
          connection: text === null ? 'unknown' : normalizeText(text).toLowerCase(),
          connection_name: safeConnectionName,
        },
      };
    },

    async getPositions() {
      return {
        ok: true,
        positions: await positions(),
      };
    },

    async getOrders() {
      let entries;
      try {
        entries = await readdir(outgoingDir, { withFileTypes: true });
      } catch (error) {
        if (isMissingFile(error)) {
          return { ok: true, orders: [] };
        }
        throw error;
      }

      const prefix = `${safeAccount}_`;
      const orders = [];
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.startsWith(prefix) || entry.name.endsWith('_position.txt')) {
          continue;
        }
        const orderId = entry.name.slice(prefix.length, -'.txt'.length);
        const feedback = parseNinjaTraderOrderFeedback(await readFile(path.join(outgoingDir, entry.name), 'utf8'));
        orders.push({ id: orderId, account: safeAccount, ...feedback });
      }
      orders.sort((left, right) => left.id.localeCompare(right.id));
      return { ok: true, orders };
    },
  };
}
