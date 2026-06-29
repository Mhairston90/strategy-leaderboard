export function readJsonlText(text, options = {}) {
  const tolerateMalformed = options?.tolerateMalformed === true;
  const malformedType = options?.malformedType ?? 'malformed_jsonl';
  const rows = [];

  for (const [index, rawLine] of String(text ?? '').split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    try {
      rows.push(JSON.parse(line));
    } catch (error) {
      if (!tolerateMalformed) {
        throw error;
      }

      rows.push({
        type: malformedType,
        line_number: index + 1,
        raw_line: line,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return rows;
}

export async function readJsonlFile(filePath, options = {}) {
  const { readFile } = await import('node:fs/promises');

  try {
    const text = await readFile(filePath, 'utf8');
    return readJsonlText(text, options);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function appendJsonl(filePath, value) {
  const [{ appendFile, mkdir }, path] = await Promise.all([
    import('node:fs/promises'),
    import('node:path'),
  ]);

  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(value)}\n`, 'utf8');
}
