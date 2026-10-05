const KEY_PREFIX = "arctic:stock-operation:";
const memoryKeys = new Map<string, string>();

function storageKey(scope: string, payload: unknown) {
  return `${KEY_PREFIX}${scope}:${JSON.stringify(payload)}`;
}

function createUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    bytes.forEach((_, index) => {
      bytes[index] = Math.floor(Math.random() * 256);
    });
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

/** Reuse a pending key for the same operation and payload until it succeeds. */
export function getIdempotencyKey(scope: string, payload: unknown) {
  const key = storageKey(scope, payload);
  const inMemory = memoryKeys.get(key);
  if (inMemory) return inMemory;

  try {
    const stored = sessionStorage.getItem(key);
    if (stored) {
      memoryKeys.set(key, stored);
      return stored;
    }
  } catch {
    // Private browsing or storage restrictions use the in-memory fallback.
  }

  const idempotencyKey = createUuid();
  memoryKeys.set(key, idempotencyKey);
  try {
    sessionStorage.setItem(key, idempotencyKey);
  } catch {
    // Retain the key in memory so an in-page retry remains safe.
  }
  return idempotencyKey;
}

export function clearIdempotencyKey(
  scope: string,
  payload: unknown,
  idempotencyKey: string,
) {
  const key = storageKey(scope, payload);
  if (memoryKeys.get(key) === idempotencyKey) memoryKeys.delete(key);
  try {
    if (sessionStorage.getItem(key) === idempotencyKey) {
      sessionStorage.removeItem(key);
    }
  } catch {
    // The in-memory fallback has already been cleared.
  }
}
