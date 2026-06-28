const ADJ = ['brave','silent','golden','swift','dark','lone','hidden','ancient',
  'rusty','frozen','burning','hollow','iron','misty','faded','steel',
  'sunken','wild','broken','empty','tangled','bitter','sharp','grave',
  'quiet','dusty','silver','cracked','lost','veiled'];
const NOUN = ['falcon','cipher','vault','echo','beacon','relic','signal','gate',
  'lantern','compass','anchor','specter','mirror','shard','ember','ridge',
  'hollow','trail','codex','flare','tower','basin','needle','forge',
  'wraith','canopy','sphere','coil','petal','dagger'];

export function generateSlug(): string {
  const adj  = ADJ[Math.floor(Math.random() * ADJ.length)];
  const noun = NOUN[Math.floor(Math.random() * NOUN.length)];
  const num  = Math.floor(Math.random() * 99) + 1;
  return `${adj}-${noun}-${num}`;
}
