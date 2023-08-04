import * as fs from "fs";
import { ZERO_ADDR } from "@/scripts/utils/constants";

export type Config = {
  validatorContractInfo: ValidatorContractInfo;
  stateContractInfo: StateContractInfo;
  poseidonFacade?: string;
};

export type ValidatorContractInfo = {
  validatorAddr?: string;
  isSigValidator: boolean | string;
};

export type StateContractInfo = {
  stateAddr?: string;
  stateInitParams?: StateInitParams;
};

export type StateInitParams = {
  signer: string;
  sourceStateContract: string;
  chainName: string;
};

export function parseConfig(configPath: string = "deploy/data/config.json"): Config {
  const config: Config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Config;

  if (config.stateContractInfo.stateAddr == undefined && config.stateContractInfo.stateInitParams == undefined) {
    throw new Error(`Invalid state contract address or state init params.`);
  }

  if (config.stateContractInfo.stateInitParams != undefined) {
    validateStateInitParams(config.stateContractInfo.stateInitParams);
  }

  config.validatorContractInfo.isSigValidator = config.validatorContractInfo.isSigValidator == "true";

  return config;
}

export function nonZeroAddr(filedDataRaw: string | undefined, filedName: string) {
  if (isZeroAddr(filedDataRaw)) {
    throw new Error(`Invalid ${filedName} filed.`);
  }
}

export function isZeroAddr(filedDataRaw: string | undefined) {
  return !filedDataRaw || filedDataRaw == "" || filedDataRaw === ZERO_ADDR;
}

function validateStateInitParams(stateInitParams: StateInitParams) {
  nonZeroAddr(stateInitParams.signer, "signer");
  nonZeroAddr(stateInitParams.sourceStateContract, "sourceStateContract");
  nonZeroAddr(stateInitParams.chainName, "chainName");
}
