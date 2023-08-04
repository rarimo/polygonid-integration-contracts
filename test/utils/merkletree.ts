import { MerkleTree } from "merkletreejs";
import { ethers } from "hardhat";
import type { BigNumberish } from "ethers";
import { SignHelper } from "@/test/utils/signature";
import { StateData, GistRootData } from "@/test/utils/types";

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

  public encodeLeaf(
    sourceStateContract: string,
    prevState: BigNumberish,
    prevGist: BigNumberish,
    stateData: StateData,
    gistRootData: GistRootData
  ) {
    const stateDataBytes: string = this.getStateDataBytes(stateData);
    const gistRootDataBytes: string = this.getGistRootDataBytes(gistRootData);

    return ethers.utils.solidityKeccak256(
      ["address", "bytes", "bytes", "uint256", "uint256"],
      [sourceStateContract, stateDataBytes, gistRootDataBytes, prevState, prevGist]
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
    const typesArr: string[] = ["uint256", "uint256", "uint256", "uint256", "uint256"];
    const values: any[] = [
      stateData.id,
      stateData.state,
      stateData.replacedByState,
      stateData.createdAtTimestamp,
      stateData.createdAtBlock,
    ];

    return ethers.utils.solidityPack(typesArr, values);
  }

  private getGistRootDataBytes(gistRootData: GistRootData): string {
    const typesArr: string[] = ["uint256", "uint256", "uint256", "uint256"];
    const values: any[] = [
      gistRootData.root,
      gistRootData.replacedByRoot,
      gistRootData.createdAtTimestamp,
      gistRootData.createdAtBlock,
    ];

    return ethers.utils.solidityPack(typesArr, values);
  }
}
