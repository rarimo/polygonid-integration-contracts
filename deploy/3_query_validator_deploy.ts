import { Deployer } from "@solarity/hardhat-migrate";
import { Config, parseConfig, isZeroAddr } from "@/deploy/helpers/config_parser";
import { deployMTPValidatorOnChain, deploySigValidatorOnChain } from "@/deploy/helpers/deploy_helper";
import {
  CredentialAtomicQueryMTPValidator__factory,
  CredentialAtomicQuerySigValidator__factory,
} from "@/generated-types/ethers";

export = async (deployer: Deployer) => {
  const config: Config = parseConfig();

  let queryValidatorAddr: string;

  if (isZeroAddr(config.validatorContractInfo.validatorAddr)) {
    if (config.validatorContractInfo.isSigValidator) {
      queryValidatorAddr = await deploySigValidatorOnChain(deployer);
    } else {
      queryValidatorAddr = await deployMTPValidatorOnChain(deployer);
    }
  } else {
    if (!config.validatorContractInfo.validatorAddr) {
      throw new Error(`Invalid validator address - ${config.validatorContractInfo.validatorAddr}`);
    }

    queryValidatorAddr = config.validatorContractInfo.validatorAddr;
  }

  if (config.validatorContractInfo.isSigValidator) {
    await deployer.save(CredentialAtomicQuerySigValidator__factory, queryValidatorAddr);
  } else {
    await deployer.save(CredentialAtomicQueryMTPValidator__factory, queryValidatorAddr);
  }
};
