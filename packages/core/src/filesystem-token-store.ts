import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { DocklineError } from "./errors.js";
import type { TokenRecord, TokenStore } from "./provider.js";

export type FileSystemTokenStoreOptions = {
  directory: string;
};

const TOKEN_FILE_EXTENSION = ".json";

const cloneTokenRecord = (record: TokenRecord): TokenRecord => ({
  ...record,
  scopes: record.scopes ? [...record.scopes] : undefined,
  metadata: record.metadata ? { ...record.metadata } : undefined,
});

const fileNameForKey = (key: string): string => {
  const encoded = Buffer.from(key, "utf8").toString("base64url");
  return `${encoded || "empty"}${TOKEN_FILE_EXTENSION}`;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const parseTokenRecord = (raw: string): TokenRecord => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: "Stored token record is not valid JSON.",
      retryable: false,
      originalError: cause,
    });
  }

  if (!isPlainObject(parsed) || typeof parsed.accessToken !== "string") {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: "Stored token record is malformed.",
      retryable: false,
    });
  }

  if (parsed.refreshToken !== undefined && typeof parsed.refreshToken !== "string") {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: "Stored token record has a malformed refresh token.",
      retryable: false,
    });
  }

  if (parsed.expiresAt !== undefined && typeof parsed.expiresAt !== "number") {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: "Stored token record has a malformed expiration timestamp.",
      retryable: false,
    });
  }

  if (
    parsed.scopes !== undefined &&
    (!Array.isArray(parsed.scopes) || parsed.scopes.some((scope) => typeof scope !== "string"))
  ) {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: "Stored token record has malformed scopes.",
      retryable: false,
    });
  }

  if (parsed.metadata !== undefined && !isPlainObject(parsed.metadata)) {
    throw new DocklineError({
      code: "INVALID_REQUEST",
      message: "Stored token record has malformed metadata.",
      retryable: false,
    });
  }

  return {
    accessToken: parsed.accessToken,
    refreshToken: parsed.refreshToken,
    expiresAt: parsed.expiresAt,
    scopes: parsed.scopes ? [...parsed.scopes] : undefined,
    metadata: parsed.metadata ? { ...parsed.metadata } : undefined,
  };
};

const isNotFoundError = (error: unknown): boolean =>
  isPlainObject(error) && error.code === "ENOENT";

export class FileSystemTokenStore implements TokenStore {
  readonly #directory: string;

  constructor(options: FileSystemTokenStoreOptions) {
    if (!options || typeof options.directory !== "string" || options.directory.trim().length === 0) {
      throw new DocklineError({
        code: "INVALID_REQUEST",
        message: "FileSystemTokenStore requires a non-empty directory.",
        retryable: false,
      });
    }

    this.#directory = options.directory;
  }

  async get(key: string): Promise<TokenRecord | null> {
    try {
      const raw = await readFile(this.#pathForKey(key), "utf8");
      return parseTokenRecord(raw);
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw error;
    }
  }

  async set(key: string, value: TokenRecord): Promise<void> {
    await mkdir(this.#directory, { recursive: true });

    const targetPath = this.#pathForKey(key);
    const temporaryPath = join(this.#directory, `.${fileNameForKey(key)}.${process.pid}.${randomUUID()}.tmp`);
    const content = `${JSON.stringify(cloneTokenRecord(value), null, 2)}\n`;

    try {
      await writeFile(temporaryPath, content, { mode: 0o600 });
      await rename(temporaryPath, targetPath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.#pathForKey(key));
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
    }
  }

  #pathForKey(key: string): string {
    return join(this.#directory, fileNameForKey(key));
  }
}
