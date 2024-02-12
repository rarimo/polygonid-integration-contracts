import { Deployer, Reporter } from "@solarity/hardhat-migrate";
import { Config, parseConfig } from "@/deploy/helpers/config_parser";
import {
  CredentialAtomicQueryMTPValidator__factory,
  CredentialAtomicQuerySigValidator__factory,
  ERC1967Proxy__factory,
  LightweightStateV2__factory,
  PoseidonFacade__factory,
  QueryVerifier__factory,
  VerifiedSBT__factory,
} from "@/generated-types/ethers";

export = async (deployer: Deployer) => {
  const config: Config = parseConfig();

  const verifiedSBTImpl = await deployer.deploy(VerifiedSBT__factory, { name: "VerifiedSBTImpl" });
  const verifiedSBTProxy = await deployer.deploy(ERC1967Proxy__factory, [verifiedSBTImpl.address, "0x"], {
    name: "VerifiedSBTProxy",
  });

  const verifiedSBT = await deployer.deployed(VerifiedSBT__factory, verifiedSBTProxy.address);

  await deployer.save(VerifiedSBT__factory, verifiedSBTProxy.address);

  const queryVerifier = await deployer.deploy(QueryVerifier__factory);

  await queryVerifier.setSBTContract(verifiedSBT.address);
  await verifiedSBT.__VerifiedSBT_init(
    queryVerifier.address,
    config.verifiedSBTInfo.name,
    config.verifiedSBTInfo.symbol,
    config.verifiedSBTInfo.tokenURI
  );

  console.log(`Initialize VerifiedSBT contract with next params:
    NAME: ${config.verifiedSBTInfo.name}
    SYMBOL: ${config.verifiedSBTInfo.symbol}
    TOKEN_URI: ${config.verifiedSBTInfo.tokenURI}
  `);

  let validatorsInfo: [string, string];

  if (config.validatorContractInfo.isSigValidator) {
    validatorsInfo = [
      "QuerySigValidatorOnChain",
      (await deployer.deployed(CredentialAtomicQuerySigValidator__factory)).address,
    ];
  } else {
    validatorsInfo = [
      "QueryMTPValidatorOnChain",
      (await deployer.deployed(CredentialAtomicQueryMTPValidator__factory)).address,
    ];
  }

  Reporter.reportContracts(
    ["LightweightStateV2", (await deployer.deployed(LightweightStateV2__factory)).address],
    validatorsInfo,
    ["VerifiedSBT", verifiedSBT.address],
    ["QueryVerifier", queryVerifier.address],
    ["PoseidonFacade", (await deployer.deployed(PoseidonFacade__factory)).address]
  );
};
