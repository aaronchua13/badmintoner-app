const groups = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%*-_+"];
export function generateInitialPassword() {
  const random = (max: number) => {
    const range = 256 - (256 % max);
    let n: number;
    do { n = crypto.getRandomValues(new Uint8Array(1))[0]; } while (n >= range);
    return n % max;
  };
  const alphabet = groups.join("");
  const chars = groups.map((g) => g[random(g.length)]);
  while (chars.length < 20) chars.push(alphabet[random(alphabet.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = random(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join("");
}
