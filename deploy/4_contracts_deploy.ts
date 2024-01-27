import { Deployer, Logger } from "@solarity/hardhat-migrate";
import { artifacts } from "hardhat";

import { Config, parseConfig } from "@/deploy/helpers/config_parser";

const VerifiedSBT = artifacts.require("VerifiedSBT");
const QueryVerifier = artifacts.require("QueryVerifier");
const PoseidonFacade = artifacts.require("PoseidonFacade");
const LightweightStateV2 = artifacts.require("LightweightStateV2");
const ERC1967Proxy = artifacts.require("ERC1967Proxy");

const CredentialAtomicQuerySigValidator = artifacts.require("CredentialAtomicQuerySigValidator");
const CredentialAtomicQueryMTPValidator = artifacts.require("CredentialAtomicQueryMTPValidator");

export = async (deployer: Deployer, logger: Logger) => {
  const config: Config = parseConfig();

  const poseidonFacade = await PoseidonFacade.deployed();
  await deployer.link(poseidonFacade, QueryVerifier);

  const verifiedSBTImpl = await deployer.deploy(VerifiedSBT);
  const verifiedSBTProxy = await deployer.deploy(ERC1967Proxy, verifiedSBTImpl.address, []);

  const verifiedSBT = await VerifiedSBT.at(verifiedSBTProxy.address);
  await VerifiedSBT.setAsDeployed(verifiedSBT);

  const queryVerifier = await deployer.deploy(QueryVerifier);

  logger.logTransaction(
    await queryVerifier.setSBTContract(verifiedSBT.address),
    "Set VerifiedSBT contract address in the QueryVerifier contract"
  );

  logger.logTransaction(
    await verifiedSBT.__VerifiedSBT_init(queryVerifier.address, "Polygon ID × Rarimo", "PRA", ""),
    "Initialize VerifiedSBT contract"
  );

  let validatorsInfo;

  if (config.validatorContractInfo.isSigValidator) {
    validatorsInfo = ["QuerySigValidatorOnChain", (await CredentialAtomicQuerySigValidator.deployed()).address];
  } else {
    validatorsInfo = ["QueryMTPValidatorOnChain", (await CredentialAtomicQueryMTPValidator.deployed()).address];
  }

  logger.logContracts(
    ["LightweightStateV2", (await LightweightStateV2.deployed()).address],
    validatorsInfo,
    ["VerifiedSBT", verifiedSBT.address],
    ["QueryVerifier", queryVerifier.address],
    ["PoseidonFacade", poseidonFacade.address]
  );
};
