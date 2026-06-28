export function readJsonlText(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export async function readJsonlFile(filePath) {
  const { readFile } = await import('node:fs/promises');

  try {
    const text = await readFile(filePath, 'utf8');
    return readJsonlText(text);
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
