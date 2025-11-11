import { randomUUID } from "crypto"

export const generateAccountId = (first_name: string) => {
  return `FH_${first_name.toLocaleLowerCase()}_${randomUUID()}`
}

export const normalizeName = (name: string) => {
  return name
    .trim()                   // remove leading/trailing spaces
    .replace(/\s+/g, ' ')     // replace multiple spaces with one
    .toLowerCase();
}