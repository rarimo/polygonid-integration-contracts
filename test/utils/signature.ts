import { ethers } from "hardhat";
import { BigNumberish, BytesLike, Wallet } from "ethers";
import { MethodId } from "@/test/helpers/constants";

export class SignHelper {
  constructor(public signer: Wallet, public chainName: string, public lightweightStateV2: string) {}

  public signAuthorizeUpgrade(newAddress: string, nonce: BigNumberish): string {
    const hash = ethers.utils.solidityKeccak256(
      ["uint8", "address", "string", "uint256", "address"],
      [MethodId.AuthorizeUpgrade, newAddress, this.chainName, nonce, this.lightweightStateV2]
    );

    return this.sign(hash);
  }

  public signChangeSourceStateContract(newAddress: string, nonce: BigNumberish): string {
    const hash = ethers.utils.solidityKeccak256(
      ["uint8", "address", "string", "uint256", "address"],
      [MethodId.ChangeSourceStateContract, newAddress, this.chainName, nonce, this.lightweightStateV2]
    );

    return this.sign(hash);
  }

  public signChangeSinger(newPubKey: string): string {
    const hash = ethers.utils.solidityKeccak256(["bytes"], [newPubKey]);

    return this.sign(hash);
  }

  public sign(hash: BytesLike) {
    return ethers.utils.joinSignature(this.signer._signingKey().signDigest(hash));
  }
}
