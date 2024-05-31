// @ts-ignore
import { network, ethers } from "hardhat";

function advanceTime() {
	return new Promise((resolve, reject) => {
		try {
			const result = network.provider.send("evm_increaseTime", [
				new Date().getTime(),
			]);
			return resolve(result);
		} catch (err) {
			return reject(err);
		}
	});
}

function advanceBlock() {
	return new Promise((resolve, reject) => {
		try {
			const result = network.provider.send("evm_mine", []);
			return resolve(result);
		} catch (err) {
			return reject(err);
		}
	});
}

export async function advanceTimeAndBlock() {
	await advanceTime();
	await advanceBlock();
}

export async function advanceTimeAndBlockNTimes(n: number) {
	for (let i = 0; i < n; i++) {
		const newBlock = await advanceTimeAndBlock();
	}
}

export async function advanceBlockNTimes(n: number) {
	for (let i = 0; i < n; i++) {
		const newBlock = await advanceBlock();
	}
}

export async function advanceToBlockN(n: number) {
	const currentBlock = await getCurrentBlockNumber();

	if (currentBlock > n) {
		throw new Error("N value too low");
	}
	for (let i = currentBlock; i < n; i++) {
		await advanceBlock();
	}
}

export async function advanceNSeconds(n: number) {
	return new Promise((resolve, reject) => {
		try {
			const result = network.provider.send("evm_increaseTime", [n]);

			return resolve(result);
		} catch (err) {
			return reject(err);
		}
	});
}

export async function advanceNSecondsAndBlock(n: number) {
	await advanceNSeconds(n);
	await advanceBlock();
}

export async function getCurrentBlockNumber() {
	return Number(await network.provider.send("eth_blockNumber", []));
}

export async function getCurrentBlockTimestamp(): Promise<number> {
	return getBlockTimestamp((await getCurrentBlockNumber()).toString(16));
}

export async function getBlockTimestamp(
	blockNumber: number | string
): Promise<number> {
	return parseInt(
		(
			await network.provider.send("eth_getBlockByNumber", [
				"0x" + blockNumber,
				true,
			])
		).timestamp,
		16
	);
}
