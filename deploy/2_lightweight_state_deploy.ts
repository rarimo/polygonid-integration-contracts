import { Deployer, Logger } from "@solarity/hardhat-migrate";
import { artifacts } from "hardhat";
import { Config, parseConfig, isZeroAddr } from "@/deploy/helpers/config_parser";

const ERC1967Proxy = artifacts.require("ERC1967Proxy");
const LightweightStateV2 = artifacts.require("LightweightStateV2");

export = async (deployer: Deployer, logger: Logger) => {
  const config: Config = parseConfig();

  let lightweightStateV2;

  if (isZeroAddr(config.stateContractInfo.stateAddr)) {
    const lightweightStateV2Impl = await deployer.deploy(LightweightStateV2);
    const lightweightStateV2Proxy = await deployer.deploy(ERC1967Proxy, lightweightStateV2Impl.address, []);

    lightweightStateV2 = await LightweightStateV2.at(lightweightStateV2Proxy.address);

    if (config.stateContractInfo.stateInitParams) {
      logger.logTransaction(
        await lightweightStateV2.__LightweightStateV2_init(
          config.stateContractInfo.stateInitParams.signer,
          config.stateContractInfo.stateInitParams.sourceStateContract,
          config.stateContractInfo.stateInitParams.chainName
        ),
        "Initialize LightweightStateV2 contract"
      );
    } else {
      throw new Error("Invalid state init params");
    }
  } else {
    lightweightStateV2 = await LightweightStateV2.at(config.stateContractInfo.stateAddr);
  }

  await LightweightStateV2.setAsDeployed(lightweightStateV2);
};
