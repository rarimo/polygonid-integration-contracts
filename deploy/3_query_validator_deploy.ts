import { Deployer, Logger } from "@solarity/hardhat-migrate";
import { artifacts } from "hardhat";
import { Config, parseConfig, isZeroAddr } from "@/deploy/helpers/config_parser";
import { deployMTPValidatorOnChain, deploySigValidatorOnChain } from "@/deploy/helpers/deploy_helper";

const PoseidonFacade = artifacts.require("PoseidonFacade");
const LightweightStateV2 = artifacts.require("LightweightStateV2");

const CredentialAtomicQuerySigValidator = artifacts.require("CredentialAtomicQuerySigValidator");
const CredentialAtomicQueryMTPValidator = artifacts.require("CredentialAtomicQueryMTPValidator");

export = async (deployer: Deployer, logger: Logger) => {
  const config: Config = parseConfig();

  let queryValidatorAddr;

  if (isZeroAddr(config.validatorContractInfo.validatorAddr)) {
    const poseidonFacade = await PoseidonFacade.deployed();
    const stateAddr = (await LightweightStateV2.deployed()).address;

    if (config.validatorContractInfo.isSigValidator) {
      queryValidatorAddr = await deploySigValidatorOnChain(deployer, logger, stateAddr);
    } else {
      queryValidatorAddr = await deployMTPValidatorOnChain(deployer, logger, stateAddr);
    }
  } else {
    queryValidatorAddr = config.validatorContractInfo.validatorAddr;
  }

  if (config.validatorContractInfo.isSigValidator) {
    const querySigValidator = await CredentialAtomicQuerySigValidator.at(queryValidatorAddr);

    await CredentialAtomicQuerySigValidator.setAsDeployed(querySigValidator);
  } else {
    const queryMTPValidator = await CredentialAtomicQueryMTPValidator.at(queryValidatorAddr);

    await CredentialAtomicQueryMTPValidator.setAsDeployed(queryMTPValidator);
  }
};
