const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function formatTime(ms: number): string {
  return dateTime.format(new Date(ms));
}

export function shortHash(hash: string, size = 10): string {
  return hash.length > size * 2 ? `${hash.slice(0, size)}…${hash.slice(-size)}` : hash;
}

export function percent(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}
