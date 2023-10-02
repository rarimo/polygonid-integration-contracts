import { Deployer, Logger } from "@solarity/hardhat-migrate";
import { artifacts } from "hardhat";
import { Config, parseConfig, isZeroAddr } from "@/deploy/helpers/config_parser";
import { deployMTPValidatorOffChain, deploySigValidatorOffChain } from "@/deploy/helpers/deploy_helper";

const PoseidonFacade = artifacts.require("PoseidonFacade");
const LightweightStateV2 = artifacts.require("LightweightStateV2");

const QueryMTPValidatorOffChain = artifacts.require("QueryMTPValidatorOffChain");
const QuerySigValidatorOffChain = artifacts.require("QuerySigValidatorOffChain");

export = async (deployer: Deployer, logger: Logger) => {
  const config: Config = parseConfig();

  let queryValidatorAddr;

  if (isZeroAddr(config.validatorContractInfo.validatorAddr)) {
    const poseidonFacade = await PoseidonFacade.deployed();
    const stateAddr = (await LightweightStateV2.deployed()).address;

    if (config.validatorContractInfo.isSigValidator) {
      queryValidatorAddr = await deploySigValidatorOffChain(deployer, logger, poseidonFacade, stateAddr);
    } else {
      queryValidatorAddr = await deployMTPValidatorOffChain(deployer, logger, poseidonFacade, stateAddr);
    }
  } else {
    queryValidatorAddr = config.validatorContractInfo.validatorAddr;
  }

  if (config.validatorContractInfo.isSigValidator) {
    const querySigValidator = await QuerySigValidatorOffChain.at(queryValidatorAddr);

    await QuerySigValidatorOffChain.setAsDeployed(querySigValidator);
  } else {
    const queryMTPValidator = await QueryMTPValidatorOffChain.at(queryValidatorAddr);

    await QueryMTPValidatorOffChain.setAsDeployed(queryMTPValidator);
  }
};
