import { Deployer } from "@solarity/hardhat-migrate";
import { ethers } from "hardhat";
import { Config, parseConfig } from "@/deploy/helpers/config_parser";
import { AGE_VERIFY_REQUEST_ID } from "@/test/helpers/constants";
import {
  CredentialAtomicQueryMTPValidator,
  CredentialAtomicQueryMTPValidator__factory,
  CredentialAtomicQuerySigValidator,
  CredentialAtomicQuerySigValidator__factory,
  QueryVerifier__factory,
} from "@/generated-types/ethers";

const Operators = {
  NOOP: 0, // No operation, skip query verification in circuit
  EQ: 1, // equal
  LT: 2, // less than
  GT: 3, // greater than
  IN: 4, // in
  NIN: 5, // not in
  NE: 6, // not equal
};

export = async (deployer: Deployer) => {
  const config: Config = parseConfig();

  let validator: CredentialAtomicQueryMTPValidator | CredentialAtomicQuerySigValidator;

  if (config.validatorContractInfo.isSigValidator) {
    validator = await deployer.deployed(CredentialAtomicQuerySigValidator__factory);
  } else {
    validator = await deployer.deployed(CredentialAtomicQueryMTPValidator__factory);
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

  const queryVerifier = await deployer.deployed(QueryVerifier__factory);

  await queryVerifier.setZKPRequest(
    AGE_VERIFY_REQUEST_ID,
    validator.address,
    query.schema.toBigInt(),
    query.claimPathKey.toBigInt(),
    query.operator,
    query.value
  );
};
