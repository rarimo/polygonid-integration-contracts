import { Deployer } from "@solarity/hardhat-migrate";
import { Config, parseConfig, isZeroAddr } from "@/deploy/helpers/config_parser";
import { ERC1967Proxy__factory, LightweightStateV2, LightweightStateV2__factory } from "@/generated-types/ethers";

export = async (deployer: Deployer) => {
  const config: Config = parseConfig();

  let lightweightStateV2: LightweightStateV2;

  if (isZeroAddr(config.stateContractInfo.stateAddr)) {
    const lightweightStateV2Impl = await deployer.deploy(LightweightStateV2__factory, {
      name: "LightweightStateV2Impl",
    });
    const lightweightStateV2Proxy = await deployer.deploy(
      ERC1967Proxy__factory,
      [lightweightStateV2Impl.address, "0x"],
      { name: "LightweightStateV2Proxy" }
    );

    lightweightStateV2 = await deployer.deployed(LightweightStateV2__factory, lightweightStateV2Proxy.address);

    if (config.stateContractInfo.stateInitParams) {
      await lightweightStateV2.__LightweightStateV2_init(
        config.stateContractInfo.stateInitParams.signer,
        config.stateContractInfo.stateInitParams.sourceStateContract,
        config.stateContractInfo.stateInitParams.chainName
      );
    } else {
      throw new Error("Invalid state init params");
    }
  } else {
    lightweightStateV2 = await deployer.deployed(LightweightStateV2__factory, config.stateContractInfo.stateAddr);
  }

  await deployer.save(LightweightStateV2__factory, lightweightStateV2.address);
};
