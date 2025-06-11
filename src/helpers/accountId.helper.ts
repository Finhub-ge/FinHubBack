import { randomUUID } from "crypto"

export const generateAccountId = (first_name: string) => {
  return `FH_${first_name.toLocaleLowerCase()}_${randomUUID()}`
}