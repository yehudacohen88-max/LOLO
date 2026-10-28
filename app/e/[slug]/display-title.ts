/** Display-only. Keeps a dash attached to the word before it so a line does not start with «–». */
export function displayTitle(title: string) {
  return title.replace(/ ([–—])/g, "\u00A0$1");
}
