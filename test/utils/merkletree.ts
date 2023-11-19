import { MerkleTree } from "merkletreejs";
import { ethers } from "hardhat";
import type { BigNumberish } from "ethers";
import { SignHelper } from "@/test/utils/signature";
import { StateData, GistRootData } from "@/test/utils/types";
import { PromiseOrValue } from "@/generated-types/ethers/common";

export class MerkleTreeHelper {
  public tree: MerkleTree;

  constructor(public signHelper: SignHelper, public chainName: string, public lightweightStateV2: string) {
    const leaves = Array.from({ length: 10 }, () => ethers.utils.randomBytes(32));

    this.tree = new MerkleTree(
      leaves,
      (e: Buffer) => {
        const hash = ethers.utils.solidityKeccak256(["bytes"], [e]);

        return Buffer.from(hash.slice(2), "hex");
      },
      { sortPairs: true }
    );
  }

  public encodeGISTLeaf(
    sourceStateContract: string,
    prevGist: PromiseOrValue<BigNumberish>,
    gistRootData: GistRootData
  ) {
    const gistRootDataBytes: string = this.getGistRootDataBytes(gistRootData);

    return ethers.utils.solidityKeccak256(
      ["address", "bytes", "uint256"],
      [sourceStateContract, gistRootDataBytes, prevGist]
    );
  }

  public encodeStateLeaf(sourceStateContract: string, prevState: PromiseOrValue<BigNumberish>, stateData: StateData) {
    const stateDataBytes: string = this.getStateDataBytes(stateData);

    return ethers.utils.solidityKeccak256(
      ["address", "bytes", "uint256"],
      [sourceStateContract, stateDataBytes, prevState]
    );
  }

  public addLeaf(leaf: string) {
    this.tree.addLeaf(Buffer.from(leaf.slice(2), "hex"));
  }

  public getPath(leaf: string): Array<string> {
    return this.tree.getProof(leaf).map((el) => "0x" + el.data.toString("hex"));
  }

  public getProof(leaf: string, addLeaf: boolean = true): string {
    if (addLeaf) {
      this.addLeaf(leaf);
    }

    const root = this.getRoot();
    const path = this.getPath(leaf);

    const signature = this.signHelper.sign(root);

    return ethers.utils.defaultAbiCoder.encode(["bytes32[]", "bytes"], [path, signature]);
  }

  public getRoot(): string {
    return "0x" + this.tree.getRoot().toString("hex");
  }

  private getStateDataBytes(stateData: StateData): string {
    const typesArr: string[] = ["uint256", "uint256", "uint256", "uint256"];
    const values: any[] = [stateData.id, stateData.state, stateData.createdAtTimestamp, stateData.createdAtBlock];

    return ethers.utils.solidityPack(typesArr, values);
  }

  private getGistRootDataBytes(gistRootData: GistRootData): string {
    const typesArr: string[] = ["uint256", "uint256", "uint256"];
    const values: any[] = [gistRootData.root, gistRootData.createdAtTimestamp, gistRootData.createdAtBlock];

    return ethers.utils.solidityPack(typesArr, values);
  }
}
