import { Deployer } from "@solarity/hardhat-migrate";
import { deployPoseidons } from "@/deploy/helpers/deploy_helper";
import { Config, parseConfig, isZeroAddr } from "@/deploy/helpers/config_parser";
import { PoseidonFacade__factory, SpongePoseidon__factory } from "@/generated-types/ethers";

export = async (deployer: Deployer) => {
  const config: Config = parseConfig();

  if (isZeroAddr(config.poseidonFacade)) {
    await deployPoseidons(deployer, [1, 2, 3, 4, 5, 6]);

    await deployer.deploy(SpongePoseidon__factory);

    await deployer.deploy(PoseidonFacade__factory);
  } else if (config.poseidonFacade) {
    await deployer.save(PoseidonFacade__factory, config.poseidonFacade);
  }
};
