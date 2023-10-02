import { Deployer, Logger } from "@solarity/hardhat-migrate";
import { artifacts, ethers } from "hardhat";
import { Config, parseConfig } from "@/deploy/helpers/config_parser";
import { AGE_VERIFY_REQUEST_ID } from "@/test/helpers/constants";

const QueryVerifier = artifacts.require("QueryVerifier");
const QueryMTPValidatorOffChain = artifacts.require("QueryMTPValidatorOffChain");
const QuerySigValidatorOffChain = artifacts.require("QuerySigValidatorOffChain");

const Operators = {
  NOOP: 0, // No operation, skip query verification in circuit
  EQ: 1, // equal
  LT: 2, // less than
  GT: 3, // greater than
  IN: 4, // in
  NIN: 5, // not in
  NE: 6, // not equal
};

export = async (deployer: Deployer, logger: Logger) => {
  const config: Config = parseConfig();

  let validator;

  if (config.validatorContractInfo.isSigValidator) {
    validator = await QuerySigValidatorOffChain.deployed();
  } else {
    validator = await QueryMTPValidatorOffChain.deployed();
  }

  const circuitId = await validator.getCircuitId();

  const query = {
    schema: ethers.BigNumber.from("74977327600848231385663280181476307657"),
    claimPathKey: ethers.BigNumber.from(
      "20376033832371109177683048456014525905119173674985843915445634726167450989630"
    ),
    operator: Operators.LT, // operator
    value: [20020101, ...new Array(63).fill(0).map((i) => 0)],
    circuitId,
  };

  const queryVerifier = await QueryVerifier.deployed();

  logger.logTransaction(
    await queryVerifier.setZKPRequest(
      AGE_VERIFY_REQUEST_ID,
      validator.address,
      query.schema,
      query.claimPathKey,
      query.operator,
      query.value
    ),
    "ZKP Request for KYC Age Credential is set"
  );
};
