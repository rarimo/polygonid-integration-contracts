import { Deployer } from "@solarity/hardhat-migrate";
import { ethers } from "hardhat";

const { poseidonContract } = require("circomlibjs");

import {
  CredentialAtomicQueryMTPValidator__factory,
  CredentialAtomicQuerySigValidator__factory,
  ERC1967Proxy__factory,
  LightweightStateV2__factory,
  VerifierMTPWrapper__factory,
  VerifierSigWrapper__factory,
} from "@/generated-types/ethers";

import * as dotenv from "dotenv";
dotenv.config();

export async function getPoseidonContractFactory(parametersCount: number) {
  const abi = poseidonContract.generateABI(parametersCount);
  const code = poseidonContract.createCode(parametersCount);

  return new ethers.ContractFactory(abi, code);
}

export async function deployPoseidons(deployer: Deployer, poseidonSizeParams: number[]) {
  poseidonSizeParams.forEach((size) => {
    if (![1, 2, 3, 4, 5, 6].includes(size)) {
      throw new Error(`Poseidon should be integer in a range 1..6. Poseidon size provided: ${size}`);
    }
  });

  const deployPoseidon = async (params: number) => {
    const newPoseidonContract = await deployer.deploy(await getPoseidonContractFactory(params), {
      name: `@iden3/contracts/lib/Poseidon.sol:PoseidonUnit${params}L`,
    });

    return newPoseidonContract;
  };

  const result = [];

  for (const size of poseidonSizeParams) {
    result.push(await deployPoseidon(size));
  }

  return result;
}

export async function deployMTPValidatorOnChain(deployer: Deployer) {
  const queryMTPVerifierOnChain = await deployer.deploy(VerifierMTPWrapper__factory);
  const queryMTPValidatorOnChainImpl = await deployer.deploy(CredentialAtomicQueryMTPValidator__factory, {
    name: "QueryMTPValidatorOnChainImpl",
  });
  const queryMTPValidatorOnChainProxy = await deployer.deploy(
    ERC1967Proxy__factory,
    [queryMTPValidatorOnChainImpl.address, "0x"],
    { name: "QueryMTPValidatorOnChainProxy" }
  );

  const queryMTPValidator = await deployer.deployed(
    CredentialAtomicQueryMTPValidator__factory,
    queryMTPValidatorOnChainProxy.address
  );

  await queryMTPValidator.initialize(
    queryMTPVerifierOnChain.address,
    (
      await deployer.deployed(LightweightStateV2__factory)
    ).address
  );

  return queryMTPValidator.address;
}

export async function deploySigValidatorOnChain(deployer: Deployer) {
  const querySigVerifierOnChain = await deployer.deploy(VerifierSigWrapper__factory);
  const querySigValidatorOnChainImpl = await deployer.deploy(CredentialAtomicQuerySigValidator__factory, {
    name: "QuerySigValidatorOnChainImpl",
  });
  const querySigValidatorOnChainProxy = await deployer.deploy(
    ERC1967Proxy__factory,
    [querySigValidatorOnChainImpl.address, "0x"],
    { name: "QuerySigValidatorOnChainProxy" }
  );

  const querySigValidator = await deployer.deployed(
    CredentialAtomicQuerySigValidator__factory,
    querySigValidatorOnChainProxy.address
  );

  await querySigValidator.initialize(
    querySigVerifierOnChain.address,
    (
      await deployer.deployed(LightweightStateV2__factory)
    ).address
  );

  return querySigValidator.address;
}
