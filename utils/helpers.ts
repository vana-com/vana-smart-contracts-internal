// @ts-ignore
import {
  ContractTransactionReceipt,
  parseEther as parseEtherOriginal,
} from "ethers";

export function parseEther(value: number | string) {
  return parseEtherOriginal(value.toString());
}

export async function getReceipt(tx: any): Promise<ContractTransactionReceipt> {
  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("No receipt");
  }
  return receipt;
}
