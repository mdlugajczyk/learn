import { enumeratePartitions } from '../public/numberblocks/engine.js';
import { MISSION_FACTS } from '../public/numberblocks/missions.js';

const numberNames = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const blockNoun = number => number === 1 ? 'block' : 'blocks';

function sentenceName(number) {
  const name = numberNames[number] || String(number);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function listWords(parts) {
  const words = parts.map(number => numberNames[number]);
  if (words.length === 1) return words[0];
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words.slice(0, -1).join(', ')}, and ${words.at(-1)}`;
}

export const NUMBER_MAGIC_AUDIO_ENTRIES = [
  { filename: 'welcome.mp3', text: "Hello, number maker! I'm Ten. Ready for some number magic?" }
];

for (let target = 2; target <= 10; target += 1) {
  NUMBER_MAGIC_AUDIO_ENTRIES.push(
    {
      filename: `play-${target}.mp3`,
      text: `Pull some of ${numberNames[target]}'s blocks away. Bump the number friends together, or flick them up!`
    },
    {
      filename: `together-${target}.mp3`,
      text: `All together again. ${sentenceName(target)} is still ${numberNames[target]}!`
    },
    {
      filename: `new-way-${target}.mp3`,
      text: `Can you make ${numberNames[target]} a different way?`
    }
  );

  for (const parts of enumeratePartitions(target, { includeWhole: false })) {
    NUMBER_MAGIC_AUDIO_ENTRIES.push({
      filename: `composition-${target}-${parts.join('-')}.mp3`,
      text: `${sentenceName(target)} is made of ${listWords(parts)}!`
    });
  }
}

export const NUMBER_MAGIC_MISSION_AUDIO_ENTRIES = [
  { filename: 'mission-try-again.mp3', text: 'Nearly! Count the blocks, then try another number friend.' },
  { filename: 'mission-split-retry.mp3', text: 'Almost! Let the blocks bounce back, count carefully, and pull again.' },
  { filename: 'mission-pull-next.mp3', text: 'Great! Pull one more block.' },
  { filename: 'mission-session-complete.mp3', text: 'Three missions complete! Ten is very proud of you!' }
];

const missionNumbers = [...new Set(MISSION_FACTS.flatMap(fact => [fact.a, fact.b]))].sort((left, right) => left - right);
for (let number = 6; number <= 10; number += 1) {
  NUMBER_MAGIC_MISSION_AUDIO_ENTRIES.push({
    filename: `mission-unlock-${number}.mp3`,
    text: `Amazing! Number ${numberNames[number]} is ready to play!`
  });
}
for (const number of missionNumbers) {
  NUMBER_MAGIC_MISSION_AUDIO_ENTRIES.push(
    {
      filename: `mission-build-first-${number}.mp3`,
      text: `First, build ${numberNames[number]}! Drag ${numberNames[number]} ${blockNoun(number)} into the glowing spot.`
    },
    {
      filename: `mission-build-next-${number}.mp3`,
      text: `Brilliant! Now build ${numberNames[number]} in the next glowing spot.`
    }
  );
}
for (const fact of MISSION_FACTS) {
  const pair = `${fact.a}-${fact.b}`;
  NUMBER_MAGIC_MISSION_AUDIO_ENTRIES.push(
    {
      filename: `mission-predict-${pair}.mp3`,
      text: `What do ${numberNames[fact.a]} and ${numberNames[fact.b]} make? Choose a number friend!`
    },
    {
      filename: `mission-combine-${pair}.mp3`,
      text: `Yes! Now push ${numberNames[fact.a]} and ${numberNames[fact.b]} together!`
    },
    {
      filename: `mission-split-${pair}.mp3`,
      text: `Here is ${numberNames[fact.sum]}. Pull one block at a time to make ${numberNames[fact.a]} and ${numberNames[fact.b]}!`
    },
    {
      filename: `mission-split-made-${pair}.mp3`,
      text: `You made ${numberNames[fact.a]} and ${numberNames[fact.b]}! Look at the two number friends.`
    },
    {
      filename: `mission-success-${pair}.mp3`,
      text: `${sentenceName(fact.a)} and ${numberNames[fact.b]} make ${numberNames[fact.sum]}!`
    }
  );
}

NUMBER_MAGIC_AUDIO_ENTRIES.push(...NUMBER_MAGIC_MISSION_AUDIO_ENTRIES);

export const NUMBER_MAGIC_AUDIO_BY_FILENAME = new Map(NUMBER_MAGIC_AUDIO_ENTRIES.map(entry => [entry.filename, entry]));
