// @ts-ignore
import { parseEther as parseEtherOriginal } from "ethers";

export function parseEther(value: number | string) {
  return parseEtherOriginal(value.toString());
}
