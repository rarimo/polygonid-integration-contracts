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

  describe("signedTransitState", () => {
    let stateData: ILightweightStateV2.StateDataStruct;
    let gistRootData: ILightweightStateV2.GistRootDataStruct;

    beforeEach("setup", async () => {
      stateData = {
        id: 1,
        state: 123,
        replacedByState: 0,
        createdAtTimestamp: 1000,
        createdAtBlock: 100,
      };

      gistRootData = {
        root: 333,
        replacedByRoot: 0,
        createdAtTimestamp: 1000,
        createdAtBlock: 100,
      };
    });

    it("should correctly transit signed state", async () => {
      const leaf = merkleHelper.encodeLeaf(sourceStateContractAddr, 0, 0, stateData, gistRootData);
      const proof = merkleHelper.getProof(leaf);

      const tx = await lightweightStateV2.signedTransitState(0, 0, stateData, gistRootData, proof);

      compareStateInfo(await lightweightStateV2.getStateInfoById(1), {
        ...stateData,
        replacedAtTimestamp: 0,
        replacedAtBlock: 0,
      });
      compareGistRootInfo(await lightweightStateV2.getCurrentGISTRootInfo(), {
        ...gistRootData,
        replacedAtTimestamp: 0,
        replacedAtBlock: 0,
      });

      expect(tx)
        .to.emit(lightweightStateV2, "SignedStateTransited")
        .withArgs(gistRootData.root, stateData.id, stateData.state, 0, 0);
    });

    it("should correctly update last identity state", async () => {
      let leaf = merkleHelper.encodeLeaf(sourceStateContractAddr, 0, 0, stateData, gistRootData);
      let proof = merkleHelper.getProof(leaf);

      await lightweightStateV2.signedTransitState(0, 0, stateData, gistRootData, proof);

      expect(await lightweightStateV2.getIdentityLastState(stateData.id)).to.be.eq(stateData.state);
      expect(await lightweightStateV2.getGISTRoot()).to.be.eq(gistRootData.root);

      const stateData1 = { ...stateData, state: 125, createdAtTimestamp: 1200, createdAtBlock: 120 };
      const gistRootData1 = { ...gistRootData, root: 335, createdAtTimestamp: 1200, createdAtBlock: 120 };

      leaf = merkleHelper.encodeLeaf(sourceStateContractAddr, 124, 334, stateData1, gistRootData1);
      proof = merkleHelper.getProof(leaf);

      await lightweightStateV2.signedTransitState(124, 334, stateData1, gistRootData1, proof);

      expect(await lightweightStateV2.getIdentityLastState(stateData.id)).to.be.eq(stateData1.state);
      expect(await lightweightStateV2.getGISTRoot()).to.be.eq(gistRootData1.root);

      const stateData2 = {
        ...stateData,
        state: 124,
        replacedByState: 125,
        createdAtTimestamp: 1100,
        createdAtBlock: 110,
      };
      const gistRootData2 = { ...gistRootData, root: 334, createdAtTimestamp: 1100, createdAtBlock: 110 };

      leaf = merkleHelper.encodeLeaf(sourceStateContractAddr, 123, 333, stateData2, gistRootData2);
      proof = merkleHelper.getProof(leaf);

      await lightweightStateV2.signedTransitState(123, 333, stateData2, gistRootData2, proof);

      expect(await lightweightStateV2.getIdentityLastState(stateData.id)).to.be.eq(stateData1.state);
      expect(await lightweightStateV2.getGISTRoot()).to.be.eq(gistRootData1.root);
    });

    it("should correctly transit signed state with the same gist root info", async () => {
      let leaf = merkleHelper.encodeLeaf(sourceStateContractAddr, 0, 0, stateData, gistRootData);
      let proof = merkleHelper.getProof(leaf);

      await lightweightStateV2.signedTransitState(0, 0, stateData, gistRootData, proof);

      const stateData1 = { ...stateData, id: 2, state: 223, createdAtTimestamp: 800, createdAtBlock: 80 };

      leaf = merkleHelper.encodeLeaf(sourceStateContractAddr, 0, 0, stateData1, gistRootData);
      proof = merkleHelper.getProof(leaf);

      await lightweightStateV2.signedTransitState(0, 0, stateData1, gistRootData, proof);

      expect(await lightweightStateV2.getIdentityLastState(stateData.id)).to.be.eq(stateData.state);
      expect(await lightweightStateV2.getIdentityLastState(stateData1.id)).to.be.eq(stateData1.state);
      expect(await lightweightStateV2.getGISTRoot()).to.be.eq(gistRootData.root);
    });

    it("should get exception if try to update already stored states", async () => {
      const leaf = merkleHelper.encodeLeaf(sourceStateContractAddr, 0, 0, stateData, gistRootData);
      const proof = merkleHelper.getProof(leaf);

      await lightweightStateV2.signedTransitState(0, 0, stateData, gistRootData, proof);

      const reason = "LightweightStateV2: unable to update already stored states";

      await expect(lightweightStateV2.signedTransitState(0, 0, stateData, gistRootData, proof)).to.be.rejectedWith(
        reason
      );
    });

    it("should get exception if try to update already stored gist root", async () => {
      let leaf = merkleHelper.encodeLeaf(sourceStateContractAddr, 0, 0, stateData, gistRootData);
      let proof = merkleHelper.getProof(leaf);

      await lightweightStateV2.signedTransitState(0, 0, stateData, gistRootData, proof);

      const stateData1 = { ...stateData, id: 2, state: 124 };
      const gistRootData1 = { ...gistRootData, root: 444, createdAtTimestamp: 1050, createdAtBlock: 105 };

      const leaf1 = merkleHelper.encodeLeaf(
        sourceStateContractAddr,
        0,
        await gistRootData.root,
        stateData1,
        gistRootData1
      );
      const proof1 = merkleHelper.getProof(leaf1);

      await lightweightStateV2.signedTransitState(0, gistRootData.root, stateData1, gistRootData1, proof1);

      const reason = "LightweightStateV2: unable to update already stored gist data";

      const stateData2 = { ...stateData, id: 1, state: 200 };

      leaf = merkleHelper.encodeLeaf(sourceStateContractAddr, await stateData.state, 0, stateData2, gistRootData);
      proof = merkleHelper.getProof(leaf);

      await expect(
        lightweightStateV2.signedTransitState(stateData.state, 0, stateData2, gistRootData, proof)
      ).to.be.rejectedWith(reason);
    });
  });

  describe("getters", () => {
    let stateData: ILightweightStateV2.StateDataStruct;
    let gistRootData: ILightweightStateV2.GistRootDataStruct;

    beforeEach("setup", async () => {
      stateData = {
        id: 1,
        state: 123,
        replacedByState: 0,
        createdAtTimestamp: 1000,
        createdAtBlock: 100,
      };

      gistRootData = {
        root: 333,
        replacedByRoot: 0,
        createdAtTimestamp: 1000,
        createdAtBlock: 100,
      };
    });

    it("getters should return correct data", async () => {
      let leaf = merkleHelper.encodeLeaf(sourceStateContractAddr, 0, 0, stateData, gistRootData);
      let proof = merkleHelper.getProof(leaf);

      await lightweightStateV2.signedTransitState(0, 0, stateData, gistRootData, proof);

      const stateData1 = { ...stateData, state: 124, createdAtTimestamp: 1200, createdAtBlock: 120 };
      const gistRootData1 = { ...gistRootData, root: 334, createdAtTimestamp: 1200, createdAtBlock: 120 };

      leaf = merkleHelper.encodeLeaf(
        sourceStateContractAddr,
        await stateData.state,
        await gistRootData.root,
        stateData1,
        gistRootData1
      );
      proof = merkleHelper.getProof(leaf);

      await lightweightStateV2.signedTransitState(stateData.state, gistRootData.root, stateData1, gistRootData1, proof);

      const expectedStateInfo: IState.StateInfoStruct = {
        ...stateData,
        replacedByState: stateData1.state,
        replacedAtTimestamp: stateData1.createdAtTimestamp,
        replacedAtBlock: stateData1.createdAtBlock,
      };
      const expectedGistRootInfo: IState.GistRootInfoStruct = {
        ...gistRootData,
        replacedByRoot: gistRootData1.root,
        replacedAtTimestamp: gistRootData1.createdAtTimestamp,
        replacedAtBlock: gistRootData1.createdAtBlock,
      };

      compareStateInfo(await lightweightStateV2.getStateInfoById(stateData.id), {
        ...stateData1,
        replacedAtTimestamp: 0,
        replacedAtBlock: 0,
      });
      compareStateInfo(
        await lightweightStateV2.getStateInfoByIdAndState(stateData.id, stateData.state),
        expectedStateInfo
      );

      expect(await lightweightStateV2.getGISTRoot()).to.be.eq(gistRootData1.root);

      compareGistRootInfo(await lightweightStateV2.getCurrentGISTRootInfo(), {
        ...gistRootData1,
        replacedAtTimestamp: 0,
        replacedAtBlock: 0,
      });
      compareGistRootInfo(await lightweightStateV2.getGISTRootInfo(gistRootData.root), expectedGistRootInfo);

      expect(await lightweightStateV2.idExists(stateData.id)).to.be.eq(true);
      expect(await lightweightStateV2.idExists(2)).to.be.eq(false);

      expect(await lightweightStateV2.stateExists(stateData.id, stateData.state)).to.be.eq(true);
      expect(await lightweightStateV2.stateExists(stateData.id, 200)).to.be.eq(false);

      expect(await lightweightStateV2.getIdentityLastState(stateData.id)).to.be.eq(stateData1.state);
      expect(await lightweightStateV2.getIdentityLastState(2)).to.be.eq(0);
    });
  });
});
