import { Deployer, Logger } from "@dlsl/hardhat-migrate";
import { ethers, artifacts } from "hardhat";

const { poseidonContract } = require("circomlibjs");

const ERC1967Proxy = artifacts.require("ERC1967Proxy");
const QueryMTPVerifierOffChain = artifacts.require("QueryMTPVerifierOffChain");
const QuerySigVerifierOffChain = artifacts.require("QuerySigVerifierOffChain");

const QueryMTPValidatorOffChain = artifacts.require("QueryMTPValidatorOffChain");
const QuerySigValidatorOffChain = artifacts.require("QuerySigValidatorOffChain");

import * as dotenv from "dotenv";
dotenv.config();

export async function deployPoseidons(deployer: any, poseidonSizeParams: number[], isLog: boolean = true) {
  poseidonSizeParams.forEach((size) => {
    if (![1, 2, 3, 4, 5, 6].includes(size)) {
      throw new Error(`Poseidon should be integer in a range 1..6. Poseidon size provided: ${size}`);
    }
  });

  const deployPoseidon = async (params: number, isLog: boolean) => {
    const abi = poseidonContract.generateABI(params);
    const code = poseidonContract.createCode(params);

    const PoseidonElements = new ethers.ContractFactory(abi, code, deployer);
    const poseidonElements = await PoseidonElements.deploy();

    await poseidonElements.deployed();

    if (isLog) {
      console.log(`Poseidon${params}Elements deployed to:`, poseidonElements.address);
    }

    return poseidonElements;
  };

  const result = [];

  for (const size of poseidonSizeParams) {
    result.push(await deployPoseidon(size, isLog));
  }

  return result;
}

export async function deployMTPValidatorOffChain(
  deployer: Deployer,
  logger: Logger,
  poseidonFacade: any,
  stateContractAddr: string
) {
  await deployer.link(poseidonFacade, QueryMTPValidatorOffChain);

  const queryMTPVerifierOffChain = await deployer.deploy(QueryMTPVerifierOffChain);
  const queryMTPValidatorOffChainImpl = await deployer.deploy(QueryMTPValidatorOffChain);
  const queryMTPValidatorOffChainProxy = await deployer.deploy(ERC1967Proxy, queryMTPValidatorOffChainImpl.address, []);

  const queryMTPValidator = await QueryMTPValidatorOffChain.at(queryMTPValidatorOffChainProxy.address);

  logger.logTransaction(
    await queryMTPValidator.__QueryValidatorOffChain_init(queryMTPVerifierOffChain.address, stateContractAddr),
    "Initialize QueryMTPValidatorOffChain contract"
  );

  return queryMTPValidator.address;
}

export async function deploySigValidatorOffChain(
  deployer: Deployer,
  logger: Logger,
  poseidonFacade: any,
  stateContractAddr: string
) {
  await deployer.link(poseidonFacade, QuerySigValidatorOffChain);

  const querySigVerifierOffChain = await deployer.deploy(QuerySigVerifierOffChain);
  const querySigValidatorOffChainImpl = await deployer.deploy(QuerySigValidatorOffChain);
  const querySigValidatorOffChainProxy = await deployer.deploy(ERC1967Proxy, querySigValidatorOffChainImpl.address, []);

  const querySigValidator = await QuerySigValidatorOffChain.at(querySigValidatorOffChainProxy.address);

  logger.logTransaction(
    await querySigValidator.__QueryValidatorOffChain_init(querySigVerifierOffChain.address, stateContractAddr),
    "Initialize QuerySigValidatorOffChain contract"
  );

  return querySigValidator.address;
}
