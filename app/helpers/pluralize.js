export default function pluralize(number, s, p) {
  const single = s || '';
  const plural = p || single + 's';
  return number == 1 ? single : plural;
}
