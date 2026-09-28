import { choice, noul } from "@typesafe-ai/sdk";

export function singleRequest(word: string, letter: string) {
  return { state: { word }, questions: { letter_count: choice(`How many times does the letter "${letter}" appear in \`word\`?`, { "0": "zero times", "1": "once", "2": "twice", "3": "three times", "4": "four times", "5": "five or more times" }) } };
}

export function batchRequest(word: string, letter: string) {
  return { state: { word }, questions: Object.fromEntries([...word].map((ch, i) => [`pos_${i + 1}`, noul(`The character at position ${i + 1} of \`word\` is "${ch}". Is that character the letter "${letter}"?`, { true: `It is the letter "${letter}".`, false: `It is not the letter "${letter}".` })])) };
}

export function fanoutRequest(word: string, letter: string, index: number) {
  return { state: { word, position: index + 1, character: word[index] }, questions: { is_target: noul(`Is \`character\` the letter "${letter}"?`) } };
}
