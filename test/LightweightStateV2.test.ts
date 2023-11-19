import { expect } from "chai";
import { ethers } from "hardhat";
import { Wallet } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Reverter } from "@/test/helpers/reverter";
import { CHAIN_NAME } from "@/test/helpers/constants";
import { SignHelper } from "@/test/utils/signature";
import { MerkleTreeHelper } from "@/test/utils/merkletree";
import { ILightweightStateV2, IState, LightweightStateV2Mock } from "@ethers-v5";
import { ZERO_ADDR } from "@/scripts/utils/constants";

describe("LightweightStateV2", () => {
  const reverter = new Reverter();

  let signHelper: SignHelper;
  let merkleHelper: MerkleTreeHelper;

  let OWNER: SignerWithAddress;
  let FIRST: SignerWithAddress;
  let SIGNER: Wallet;

  let lightweightStateV2: LightweightStateV2Mock;
  let sourceStateContractAddr: string;

  function compareStateInfo(stateInfo: IState.StateInfoStructOutput, expectedStateInfo: IState.StateInfoStruct) {
    expect(stateInfo.id).to.be.eq(expectedStateInfo.id);
    expect(stateInfo.state).to.be.eq(expectedStateInfo.state);
    expect(stateInfo.replacedByState).to.be.eq(expectedStateInfo.replacedByState);
    expect(stateInfo.createdAtTimestamp).to.be.eq(expectedStateInfo.createdAtTimestamp);
    expect(stateInfo.replacedAtTimestamp).to.be.eq(expectedStateInfo.replacedAtTimestamp);
    expect(stateInfo.createdAtBlock).to.be.eq(expectedStateInfo.createdAtBlock);
    expect(stateInfo.replacedAtBlock).to.be.eq(expectedStateInfo.replacedAtBlock);
  }

  function compareGistRootInfo(
    gistRootInfo: IState.GistRootInfoStructOutput,
    expectedGistRootInfo: IState.GistRootInfoStruct
  ) {
    expect(gistRootInfo.root).to.be.eq(expectedGistRootInfo.root);
    expect(gistRootInfo.replacedByRoot).to.be.eq(expectedGistRootInfo.replacedByRoot);
    expect(gistRootInfo.createdAtTimestamp).to.be.eq(expectedGistRootInfo.createdAtTimestamp);
    expect(gistRootInfo.replacedAtTimestamp).to.be.eq(expectedGistRootInfo.replacedAtTimestamp);
    expect(gistRootInfo.createdAtBlock).to.be.eq(expectedGistRootInfo.createdAtBlock);
    expect(gistRootInfo.replacedAtBlock).to.be.eq(expectedGistRootInfo.replacedAtBlock);
  }

  before(async () => {
    [OWNER, FIRST] = await ethers.getSigners();
    SIGNER = ethers.Wallet.createRandom();

    const LightweightStateV2Factory = await ethers.getContractFactory("LightweightStateV2Mock");
    const ERC1967ProxyFactory = await ethers.getContractFactory("ERC1967Proxy");

    const lightweightStateV2Impl = await LightweightStateV2Factory.deploy();
    const lightweightStateV2Proxy = await ERC1967ProxyFactory.deploy(lightweightStateV2Impl.address, []);

    lightweightStateV2 = LightweightStateV2Factory.attach(lightweightStateV2Proxy.address);

    signHelper = new SignHelper(SIGNER, CHAIN_NAME, lightweightStateV2.address);
    merkleHelper = new MerkleTreeHelper(signHelper, CHAIN_NAME, lightweightStateV2.address);

    sourceStateContractAddr = ethers.Wallet.createRandom().address;

    await lightweightStateV2.__LightweightStateV2_init(SIGNER.address, sourceStateContractAddr, CHAIN_NAME);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("creation", () => {
    it("should set correct data after creation", async () => {
      expect(await lightweightStateV2.callStatic.signer()).to.be.eq(SIGNER.address);
      expect(await lightweightStateV2.sourceStateContract()).to.be.eq(sourceStateContractAddr);
      expect(await lightweightStateV2.chainName()).to.be.eq(CHAIN_NAME);
    });

    it("should get exception if try to call init function twice", async () => {
      const reason = "Initializable: contract is already initialized";

      await expect(
        lightweightStateV2.__LightweightStateV2_init(SIGNER.address, sourceStateContractAddr, CHAIN_NAME)
      ).to.be.rejectedWith(reason);
    });
  });

  describe("upgradebility", () => {
    it("should correctly upgrade contract to the new implementation", async () => {
      const LightweightStateV2Factory = await ethers.getContractFactory("LightweightStateV2");

      const newImpl = await LightweightStateV2Factory.deploy();

      const signature = signHelper.signAuthorizeUpgrade(newImpl.address, 0);

      const randomAccount = ethers.Wallet.createRandom();
      const publicKey = "0x" + randomAccount.publicKey.slice(4);

      expect(await lightweightStateV2.convertPubKeyToAddress(publicKey)).to.be.eq(randomAccount.address);

      await lightweightStateV2.upgradeToWithSig(newImpl.address, signature);

      await expect(lightweightStateV2.convertPubKeyToAddress(publicKey)).to.be.revertedWithoutReason();
    });

    it("should get exception if pass zero address as a new implementation", async () => {
      const reason = "LightweightStateV2: zero address";
      const signature = signHelper.signAuthorizeUpgrade(lightweightStateV2.address, 0);

      await expect(lightweightStateV2.upgradeToWithSig(ZERO_ADDR, signature)).to.be.rejectedWith(reason);
    });

    it("should get exception if try to call upgradeTo function", async () => {
      const reason = "LightweightStateV2: this upgrade method is off";

      await expect(lightweightStateV2.upgradeTo(ZERO_ADDR)).to.be.rejectedWith(reason);
    });
  });

  describe("changeSigner", () => {
    const newSigner = ethers.Wallet.createRandom();
    const publicKey = "0x" + newSigner.publicKey.slice(4);

    it("should change signer if all conditions are met", async () => {
      expect(await lightweightStateV2.callStatic.signer()).to.eq(SIGNER.address);

      const signature = signHelper.signChangeSinger(publicKey);

      await lightweightStateV2.changeSigner(publicKey, signature);

      expect(await lightweightStateV2.callStatic.signer()).to.eq(newSigner.address);
    });

    it("should not change signer if invalid signature", async () => {
      const signature = signHelper.signChangeSinger(newSigner.privateKey);

      const tx = lightweightStateV2.changeSigner(publicKey, signature);

      await expect(tx).to.be.revertedWith("Signers: invalid signature");
    });

    it("should not change signer if wrong pubKey length", async () => {
      const signature = signHelper.signChangeSinger(newSigner.privateKey);

      const tx = lightweightStateV2.changeSigner(newSigner.privateKey, signature);

      await expect(tx).to.be.revertedWith("Signers: wrong pubKey length");
    });

    it("should not change signer if zero pubKey", async () => {
      const pBytes = "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F";
      const zeroBytes = "0000000000000000000000000000000000000000000000000000000000000000";
      const notNull = "0000000000000000000000000000000000000000000000000000000000000001";

      const zeroPubKeys = [
        "0x" + zeroBytes + notNull,
        "0x" + pBytes + notNull,
        "0x" + notNull + zeroBytes,
        "0x" + notNull + pBytes,
      ];

      for (const pubKey of zeroPubKeys) {
        const signature = signHelper.signChangeSinger(pubKey);

        const tx = lightweightStateV2.changeSigner(pubKey, signature);

        await expect(tx).to.be.revertedWith("Signers: zero pubKey");
      }
    });

    it("should not change signer if pubKey not on the curve", async () => {
      const wrongPubKey =
        "0x10101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010";

      const signature = signHelper.signChangeSinger(wrongPubKey);

      const tx = lightweightStateV2.changeSigner(wrongPubKey, signature);

      await expect(tx).to.be.revertedWith("Signers: pubKey not on the curve");
    });
  });

  describe("changeSourceStateContract", () => {
    it("should change source state contract address", async () => {
      expect(await lightweightStateV2.sourceStateContract()).to.eq(sourceStateContractAddr);

      const signature = signHelper.signChangeSourceStateContract(FIRST.address, 0);

      await lightweightStateV2.changeSourceStateContract(FIRST.address, signature);

      expect(await lightweightStateV2.sourceStateContract()).to.eq(FIRST.address);
    });

    it("should get exception if pass zero address", async () => {
      const signature = signHelper.signChangeSourceStateContract(ZERO_ADDR, 0);

      const tx = lightweightStateV2.changeSourceStateContract(ZERO_ADDR, signature);

      await expect(tx).to.be.revertedWith("LightweightStateV2: zero address");
    });

    it("should get exception if pass invalid signature", async () => {
      const signature = signHelper.signChangeSourceStateContract(FIRST.address, 1);

      const tx = lightweightStateV2.changeSourceStateContract(FIRST.address, signature);

      await expect(tx).to.be.revertedWith("Signers: invalid signature");
    });
  });

  describe("signedTransitGISTData", () => {
    it("should correctly transit last GIST data", async () => {
      const gistRootData: ILightweightStateV2.GistRootDataStruct = {
        root: 333,
        replacedByRoot: 0,
        createdAtTimestamp: 1000,
        createdAtBlock: 100,
      };

      const leaf = merkleHelper.encodeGISTLeaf(sourceStateContractAddr, 0, gistRootData);
      const proof = merkleHelper.getProof(leaf);

      const tx = await lightweightStateV2.signedTransitGISTData(0, gistRootData, proof);

      compareGistRootInfo(await lightweightStateV2.getCurrentGISTRootInfo(), {
        ...gistRootData,
        replacedAtTimestamp: 0,
        replacedAtBlock: 0,
      });

      expect(await lightweightStateV2.getGISTRoot()).to.be.eq(gistRootData.root);

      expect(tx).to.emit(lightweightStateV2, "SignGISTDataTransited").withArgs(gistRootData.root, 0);
    });

    it("should correctly transit GIST data several times one by one", async () => {
      const gistRootData1: ILightweightStateV2.GistRootDataStruct = {
        root: 111,
        replacedByRoot: 0,
        createdAtTimestamp: 1000,
        createdAtBlock: 100,
      };

      let leaf = merkleHelper.encodeGISTLeaf(sourceStateContractAddr, 0, gistRootData1);
      let proof = merkleHelper.getProof(leaf);

      // First GIST data transition
      await lightweightStateV2.signedTransitGISTData(0, gistRootData1, proof);

      compareGistRootInfo(await lightweightStateV2.getCurrentGISTRootInfo(), {
        ...gistRootData1,
        replacedAtTimestamp: 0,
        replacedAtBlock: 0,
      });

      expect(await lightweightStateV2.getGISTRoot()).to.be.eq(gistRootData1.root);

      const gistRootData2: ILightweightStateV2.GistRootDataStruct = {
        root: 222,
        replacedByRoot: 0,
        createdAtTimestamp: 1200,
        createdAtBlock: 120,
      };

      leaf = merkleHelper.encodeGISTLeaf(sourceStateContractAddr, gistRootData1.root, gistRootData2);
      proof = merkleHelper.getProof(leaf);

      // Second GIST data transition
      await lightweightStateV2.signedTransitGISTData(gistRootData1.root, gistRootData2, proof);

      compareGistRootInfo(await lightweightStateV2.getCurrentGISTRootInfo(), {
        ...gistRootData2,
        replacedAtTimestamp: 0,
        replacedAtBlock: 0,
      });

      expect(await lightweightStateV2.getGISTRoot()).to.be.eq(gistRootData2.root);

      compareGistRootInfo(await lightweightStateV2.getGISTRootInfo(gistRootData1.root), {
        ...gistRootData1,
        replacedByRoot: gistRootData2.root,
        replacedAtTimestamp: gistRootData2.createdAtTimestamp,
        replacedAtBlock: gistRootData2.createdAtBlock,
      });

      const gistRootData3: ILightweightStateV2.GistRootDataStruct = {
        root: 333,
        replacedByRoot: 0,
        createdAtTimestamp: 1300,
        createdAtBlock: 130,
      };

      leaf = merkleHelper.encodeGISTLeaf(sourceStateContractAddr, gistRootData2.root, gistRootData3);
      proof = merkleHelper.getProof(leaf);

      // Third GIST data transition
      await lightweightStateV2.signedTransitGISTData(gistRootData2.root, gistRootData3, proof);

      compareGistRootInfo(await lightweightStateV2.getCurrentGISTRootInfo(), {
        ...gistRootData3,
        replacedAtTimestamp: 0,
        replacedAtBlock: 0,
      });

      expect(await lightweightStateV2.getGISTRoot()).to.be.eq(gistRootData3.root);

      compareGistRootInfo(await lightweightStateV2.getGISTRootInfo(gistRootData2.root), {
        ...gistRootData2,
        replacedByRoot: gistRootData3.root,
        replacedAtTimestamp: gistRootData3.createdAtTimestamp,
        replacedAtBlock: gistRootData3.createdAtBlock,
      });
    });

    it("should correctly transit GIST data for not latest GIST", async () => {
      const gistRootData1: ILightweightStateV2.GistRootDataStruct = {
        root: 333,
        replacedByRoot: 0,
        createdAtTimestamp: 1300,
        createdAtBlock: 130,
      };
      const gistRootData2: ILightweightStateV2.GistRootDataStruct = {
        root: 222,
        replacedByRoot: 0,
        createdAtTimestamp: 1200,
        createdAtBlock: 120,
      };
      const gistRootData3: ILightweightStateV2.GistRootDataStruct = {
        root: 111,
        replacedByRoot: 0,
        createdAtTimestamp: 1000,
        createdAtBlock: 100,
      };

      let leaf = merkleHelper.encodeGISTLeaf(sourceStateContractAddr, gistRootData2.root, gistRootData1);
      let proof = merkleHelper.getProof(leaf);

      // First GIST data transition
      await lightweightStateV2.signedTransitGISTData(gistRootData2.root, gistRootData1, proof);

      leaf = merkleHelper.encodeGISTLeaf(sourceStateContractAddr, gistRootData2.root, gistRootData1);
      proof = merkleHelper.getProof(leaf);

      compareGistRootInfo(await lightweightStateV2.getCurrentGISTRootInfo(), {
        ...gistRootData1,
        replacedAtTimestamp: 0,
        replacedAtBlock: 0,
      });
      compareGistRootInfo(await lightweightStateV2.getGISTRootInfo(gistRootData2.root), {
        root: 0,
        replacedByRoot: 0,
        createdAtTimestamp: 0,
        createdAtBlock: 0,
        replacedAtTimestamp: 0,
        replacedAtBlock: 0,
      });

      expect(await lightweightStateV2.getGISTRoot()).to.be.eq(gistRootData1.root);
      expect((await lightweightStateV2.getGISTData(gistRootData2.root)).replacedByRoot).to.be.eq(gistRootData1.root);

      // Second GIST data transition
      leaf = merkleHelper.encodeGISTLeaf(sourceStateContractAddr, 0, gistRootData3);
      proof = merkleHelper.getProof(leaf);

      await lightweightStateV2.signedTransitGISTData(0, gistRootData3, proof);

      compareGistRootInfo(await lightweightStateV2.getGISTRootInfo(gistRootData3.root), {
        ...gistRootData3,
        replacedAtTimestamp: 0,
        replacedAtBlock: 0,
      });

      expect(await lightweightStateV2.getGISTRoot()).to.be.eq(gistRootData1.root);

      // Third GIST data transition
      leaf = merkleHelper.encodeGISTLeaf(sourceStateContractAddr, gistRootData3.root, gistRootData2);
      proof = merkleHelper.getProof(leaf);

      await lightweightStateV2.signedTransitGISTData(gistRootData3.root, gistRootData2, proof);

      compareGistRootInfo(await lightweightStateV2.getGISTRootInfo(gistRootData2.root), {
        ...gistRootData2,
        replacedByRoot: gistRootData1.root,
        replacedAtTimestamp: gistRootData1.createdAtTimestamp,
        replacedAtBlock: gistRootData1.createdAtBlock,
      });
      compareGistRootInfo(await lightweightStateV2.getGISTRootInfo(gistRootData3.root), {
        ...gistRootData3,
        replacedByRoot: gistRootData2.root,
        replacedAtTimestamp: gistRootData2.createdAtTimestamp,
        replacedAtBlock: gistRootData2.createdAtBlock,
      });

      expect(await lightweightStateV2.getGISTRoot()).to.be.eq(gistRootData1.root);
    });

    it("should get exception if try to update existing GIST data", async () => {
      const gistRootData: ILightweightStateV2.GistRootDataStruct = {
        root: 111,
        replacedByRoot: 0,
        createdAtTimestamp: 1000,
        createdAtBlock: 100,
      };

      const leaf = merkleHelper.encodeGISTLeaf(sourceStateContractAddr, 0, gistRootData);
      const proof = merkleHelper.getProof(leaf);

      await lightweightStateV2.signedTransitGISTData(0, gistRootData, proof);

      const reason = "LightweightStateV2: unable to update already stored gist data";

      await expect(lightweightStateV2.signedTransitGISTData(0, gistRootData, proof)).to.be.rejectedWith(reason);
    });
  });

  describe("signedTransitStateData", () => {
    it("should correctly transit state data", async () => {
      const stateData: ILightweightStateV2.StateDataStruct = {
        id: 1,
        state: 111,
        replacedByState: 0,
        createdAtTimestamp: 1000,
        createdAtBlock: 100,
      };

      const leaf = merkleHelper.encodeStateLeaf(sourceStateContractAddr, 0, stateData);
      const proof = merkleHelper.getProof(leaf);

      const tx = await lightweightStateV2.signedTransitStateData(0, stateData, proof);

      compareStateInfo(await lightweightStateV2.getStateInfoById(stateData.id), {
        ...stateData,
        replacedAtTimestamp: 0,
        replacedAtBlock: 0,
      });

      expect(await lightweightStateV2.getIdentityLastState(stateData.id)).to.be.eq(stateData.state);

      expect(tx).to.emit(lightweightStateV2, "SignStateDataTransited").withArgs(stateData.id, stateData.state, 0);
    });

    it("should correctly transit state data several times one by one", async () => {
      const userId = 1;

      const stateData1: ILightweightStateV2.StateDataStruct = {
        id: userId,
        state: 111,
        replacedByState: 0,
        createdAtTimestamp: 1000,
        createdAtBlock: 100,
      };

      let leaf = merkleHelper.encodeStateLeaf(sourceStateContractAddr, 0, stateData1);
      let proof = merkleHelper.getProof(leaf);

      // First state transition
      await lightweightStateV2.signedTransitStateData(0, stateData1, proof);

      const stateData2: ILightweightStateV2.StateDataStruct = {
        id: userId,
        state: 222,
        replacedByState: 0,
        createdAtTimestamp: 1200,
        createdAtBlock: 120,
      };

      leaf = merkleHelper.encodeStateLeaf(sourceStateContractAddr, stateData1.state, stateData2);
      proof = merkleHelper.getProof(leaf);

      // Second state transition
      await lightweightStateV2.signedTransitStateData(stateData1.state, stateData2, proof);

      compareStateInfo(await lightweightStateV2.getStateInfoById(userId), {
        ...stateData2,
        replacedAtTimestamp: 0,
        replacedAtBlock: 0,
      });

      compareStateInfo(await lightweightStateV2.getStateInfoByIdAndState(userId, stateData1.state), {
        ...stateData1,
        replacedByState: stateData2.state,
        replacedAtTimestamp: stateData2.createdAtTimestamp,
        replacedAtBlock: stateData2.createdAtBlock,
      });

      expect(await lightweightStateV2.getIdentityLastState(userId)).to.be.eq(stateData2.state);

      const stateData3: ILightweightStateV2.StateDataStruct = {
        id: userId,
        state: 333,
        replacedByState: 0,
        createdAtTimestamp: 1300,
        createdAtBlock: 130,
      };

      leaf = merkleHelper.encodeStateLeaf(sourceStateContractAddr, stateData2.state, stateData3);
      proof = merkleHelper.getProof(leaf);

      // Third state transition
      await lightweightStateV2.signedTransitStateData(stateData2.state, stateData3, proof);

      compareStateInfo(await lightweightStateV2.getStateInfoById(userId), {
        ...stateData3,
        replacedAtTimestamp: 0,
        replacedAtBlock: 0,
      });

      compareStateInfo(await lightweightStateV2.getStateInfoByIdAndState(userId, stateData2.state), {
        ...stateData2,
        replacedByState: stateData3.state,
        replacedAtTimestamp: stateData3.createdAtTimestamp,
        replacedAtBlock: stateData3.createdAtBlock,
      });

      expect(await lightweightStateV2.getIdentityLastState(userId)).to.be.eq(stateData3.state);
    });

    it("should correctly transit state data for not latest user state", async () => {
      const userId = 1;

      const stateData1: ILightweightStateV2.StateDataStruct = {
        id: userId,
        state: 111,
        replacedByState: 0,
        createdAtTimestamp: 1000,
        createdAtBlock: 100,
      };
      const stateData2: ILightweightStateV2.StateDataStruct = {
        id: userId,
        state: 222,
        replacedByState: 0,
        createdAtTimestamp: 1200,
        createdAtBlock: 120,
      };
      const stateData3: ILightweightStateV2.StateDataStruct = {
        id: userId,
        state: 333,
        replacedByState: 0,
        createdAtTimestamp: 1300,
        createdAtBlock: 130,
      };

      // Third state transition
      let leaf = merkleHelper.encodeStateLeaf(sourceStateContractAddr, stateData2.state, stateData3);
      let proof = merkleHelper.getProof(leaf);

      await lightweightStateV2.signedTransitStateData(stateData2.state, stateData3, proof);

      compareStateInfo(await lightweightStateV2.getStateInfoById(userId), {
        ...stateData3,
        replacedAtTimestamp: 0,
        replacedAtBlock: 0,
      });

      compareStateInfo(await lightweightStateV2.getStateInfoByIdAndState(userId, stateData2.state), {
        id: 0,
        state: 0,
        replacedByState: 0,
        createdAtTimestamp: 0,
        createdAtBlock: 0,
        replacedAtTimestamp: 0,
        replacedAtBlock: 0,
      });

      expect(await lightweightStateV2.getIdentityLastState(userId)).to.be.eq(stateData3.state);

      // First state transition
      leaf = merkleHelper.encodeStateLeaf(sourceStateContractAddr, 0, stateData1);
      proof = merkleHelper.getProof(leaf);

      await lightweightStateV2.signedTransitStateData(0, stateData1, proof);

      compareStateInfo(await lightweightStateV2.getStateInfoByIdAndState(userId, stateData1.state), {
        ...stateData1,
        replacedAtTimestamp: 0,
        replacedAtBlock: 0,
      });

      expect(await lightweightStateV2.getIdentityLastState(userId)).to.be.eq(stateData3.state);

      // Second state transition
      leaf = merkleHelper.encodeStateLeaf(sourceStateContractAddr, stateData1.state, stateData2);
      proof = merkleHelper.getProof(leaf);

      await lightweightStateV2.signedTransitStateData(stateData1.state, stateData2, proof);

      compareStateInfo(await lightweightStateV2.getStateInfoByIdAndState(userId, stateData2.state), {
        ...stateData2,
        replacedByState: stateData3.state,
        replacedAtTimestamp: stateData3.createdAtTimestamp,
        replacedAtBlock: stateData3.createdAtBlock,
      });

      compareStateInfo(await lightweightStateV2.getStateInfoByIdAndState(userId, stateData1.state), {
        ...stateData1,
        replacedByState: stateData2.state,
        replacedAtTimestamp: stateData2.createdAtTimestamp,
        replacedAtBlock: stateData2.createdAtBlock,
      });

      expect(await lightweightStateV2.getIdentityLastState(userId)).to.be.eq(stateData3.state);
    });

    it("should get exception if try to update existing state data", async () => {
      const stateData: ILightweightStateV2.StateDataStruct = {
        id: 1,
        state: 111,
        replacedByState: 0,
        createdAtTimestamp: 1000,
        createdAtBlock: 100,
      };

      const leaf = merkleHelper.encodeStateLeaf(sourceStateContractAddr, 0, stateData);
      const proof = merkleHelper.getProof(leaf);

      await lightweightStateV2.signedTransitStateData(0, stateData, proof);

      const reason = "LightweightStateV2: unable to update already stored states";

      await expect(lightweightStateV2.signedTransitStateData(0, stateData, proof)).to.be.revertedWith(reason);
    });
  });

  describe("getters", () => {
    it("getters should return correct data", async () => {
      const userId = 1;

      const stateData1: ILightweightStateV2.StateDataStruct = {
        id: userId,
        state: 111,
        replacedByState: 0,
        createdAtTimestamp: 1000,
        createdAtBlock: 100,
      };
      const stateData2: ILightweightStateV2.StateDataStruct = {
        id: userId,
        state: 222,
        replacedByState: 0,
        createdAtTimestamp: 1200,
        createdAtBlock: 120,
      };

      const gistRootData1: ILightweightStateV2.GistRootDataStruct = {
        root: 111,
        replacedByRoot: 0,
        createdAtTimestamp: 1000,
        createdAtBlock: 100,
      };
      const gistRootData2: ILightweightStateV2.GistRootDataStruct = {
        root: 222,
        replacedByRoot: 0,
        createdAtTimestamp: 1200,
        createdAtBlock: 120,
      };

      // State transitions
      let stateLeaf = merkleHelper.encodeStateLeaf(sourceStateContractAddr, 0, stateData1);
      let stateProof = merkleHelper.getProof(stateLeaf);

      await lightweightStateV2.signedTransitStateData(0, stateData1, stateProof);

      stateLeaf = merkleHelper.encodeStateLeaf(sourceStateContractAddr, stateData1.state, stateData2);
      stateProof = merkleHelper.getProof(stateLeaf);

      await lightweightStateV2.signedTransitStateData(stateData1.state, stateData2, stateProof);

      // GIST data transitions
      let gistLeaf = merkleHelper.encodeGISTLeaf(sourceStateContractAddr, 0, gistRootData1);
      let gistDataProof = merkleHelper.getProof(gistLeaf);

      await lightweightStateV2.signedTransitGISTData(0, gistRootData1, gistDataProof);

      gistLeaf = merkleHelper.encodeGISTLeaf(sourceStateContractAddr, gistRootData1.root, gistRootData2);
      gistDataProof = merkleHelper.getProof(gistLeaf);

      await lightweightStateV2.signedTransitGISTData(gistRootData1.root, gistRootData2, gistDataProof);

      // Getters calls
      compareStateInfo(await lightweightStateV2.getStateInfoById(userId), {
        ...stateData2,
        replacedAtTimestamp: 0,
        replacedAtBlock: 0,
      });
      compareStateInfo(await lightweightStateV2.getStateInfoByIdAndState(userId, stateData1.state), {
        ...stateData1,
        replacedByState: stateData2.state,
        replacedAtTimestamp: stateData2.createdAtTimestamp,
        replacedAtBlock: stateData2.createdAtBlock,
      });

      expect(await lightweightStateV2.getGISTRoot()).to.be.eq(gistRootData2.root);

      compareGistRootInfo(await lightweightStateV2.getCurrentGISTRootInfo(), {
        ...gistRootData2,
        replacedAtTimestamp: 0,
        replacedAtBlock: 0,
      });
      compareGistRootInfo(await lightweightStateV2.getGISTRootInfo(gistRootData1.root), {
        ...gistRootData1,
        replacedByRoot: gistRootData2.root,
        replacedAtTimestamp: gistRootData2.createdAtTimestamp,
        replacedAtBlock: gistRootData2.createdAtBlock,
      });

      expect(await lightweightStateV2.idExists(userId)).to.be.eq(true);
      expect(await lightweightStateV2.idExists(2)).to.be.eq(false);

      expect(await lightweightStateV2.stateExists(userId, stateData1.state)).to.be.eq(true);
      expect(await lightweightStateV2.stateExists(userId, 200)).to.be.eq(false);

      expect(await lightweightStateV2.getIdentityLastState(userId)).to.be.eq(stateData2.state);
      expect(await lightweightStateV2.getIdentityLastState(2)).to.be.eq(0);
    });
  });
});
