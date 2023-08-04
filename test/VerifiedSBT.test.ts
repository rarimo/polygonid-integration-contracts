import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { Reverter } from "@/test/helpers/reverter";
import { VerifiedSBTMock } from "@ethers-v5";

describe("VerifiedSBT", () => {
  const reverter = new Reverter();

  const NAME = "Test SBT";
  const SYMBOL = "TSBT";
  const TOKENS_URI = "Base tokens URI";

  let OWNER: SignerWithAddress;
  let FIRST: SignerWithAddress;
  let VERIFIER: SignerWithAddress;

  let verifiedSBT: VerifiedSBTMock;

  before(async () => {
    [OWNER, FIRST, VERIFIER] = await ethers.getSigners();

    const VerifiedSBTFactory = await ethers.getContractFactory("VerifiedSBTMock");
    const ERC1967ProxyFactory = await ethers.getContractFactory("ERC1967Proxy");

    const verifiedSBTImpl = await VerifiedSBTFactory.deploy();
    const verifiedSBTProxy = await ERC1967ProxyFactory.deploy(verifiedSBTImpl.address, []);

    verifiedSBT = VerifiedSBTFactory.attach(verifiedSBTProxy.address);

    await verifiedSBT.__VerifiedSBT_init(VERIFIER.address, NAME, SYMBOL, TOKENS_URI);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("creation", () => {
    it("should set correct data after creation", async () => {
      expect(await verifiedSBT.name()).to.be.eq(NAME);
      expect(await verifiedSBT.symbol()).to.be.eq(SYMBOL);
      expect(await verifiedSBT.owner()).to.be.eq(OWNER.address);
      expect(await verifiedSBT.verifier()).to.be.eq(VERIFIER.address);
    });

    it("should get exception if try to call init function twice", async () => {
      const reason = "Initializable: contract is already initialized";

      await expect(verifiedSBT.__VerifiedSBT_init(OWNER.address, NAME, SYMBOL, TOKENS_URI)).to.be.rejectedWith(reason);
    });
  });

  describe("upgradeability", () => {
    it("should correctly upgrade contract impl", async () => {
      const VerifiedSBTFactory = await ethers.getContractFactory("VerifiedSBT");
      const VerifiedSBTMockFactory = await ethers.getContractFactory("VerifiedSBTMock");
      const ERC1967ProxyFactory = await ethers.getContractFactory("ERC1967Proxy");

      const verifiedSBTImpl = await VerifiedSBTFactory.deploy();
      const verifiedSBTProxy = await ERC1967ProxyFactory.deploy(verifiedSBTImpl.address, []);

      const verifiedSBTToUpgrade: VerifiedSBTMock = VerifiedSBTMockFactory.attach(verifiedSBTProxy.address);

      await verifiedSBTToUpgrade.__VerifiedSBT_init(VERIFIER.address, NAME, SYMBOL, TOKENS_URI);
      await verifiedSBTToUpgrade.connect(VERIFIER).mint(OWNER.address);

      await expect(verifiedSBTToUpgrade.burn(0)).to.be.revertedWithoutReason();

      const newImpl = await VerifiedSBTMockFactory.deploy();

      await verifiedSBTToUpgrade.upgradeTo(newImpl.address);
      await verifiedSBTToUpgrade.burn(0);
    });

    it("should get exception if non owner try to call this function", async () => {
      const reason = "Ownable: caller is not the owner";

      await expect(verifiedSBT.connect(FIRST).upgradeTo(FIRST.address)).to.be.rejectedWith(reason);
    });
  });

  describe("setVerifier", () => {
    it("should correctly update verifier contract address", async () => {
      await verifiedSBT.setVerifier(OWNER.address);

      expect(await verifiedSBT.verifier()).to.be.eq(OWNER.address);
    });

    it("should get exception if non owner try to call this function", async () => {
      const reason = "Ownable: caller is not the owner";

      await expect(verifiedSBT.connect(FIRST).setVerifier(FIRST.address)).to.be.rejectedWith(reason);
    });
  });

  describe("setTokensURI", () => {
    const newTokenURI = "New Tokens URI";

    it("should correctly update verifier contract address", async () => {
      await verifiedSBT.setTokensURI(newTokenURI);

      expect(await verifiedSBT.tokensURI()).to.be.eq(newTokenURI);
    });

    it("should get exception if non owner try to call this function", async () => {
      const reason = "Ownable: caller is not the owner";

      await expect(verifiedSBT.connect(FIRST).setTokensURI(newTokenURI)).to.be.rejectedWith(reason);
    });
  });

  describe("mint", () => {
    it("should correctly mint new SBT token", async () => {
      expect(await verifiedSBT.balanceOf(FIRST.address)).to.be.eq(0);

      await verifiedSBT.connect(VERIFIER).mint(OWNER.address);
      await verifiedSBT.connect(VERIFIER).mint(FIRST.address);

      expect(await verifiedSBT.balanceOf(FIRST.address)).to.be.eq(1);

      expect(await verifiedSBT.ownerOf(0)).to.be.eq(OWNER.address);
      expect(await verifiedSBT.ownerOf(1)).to.be.eq(FIRST.address);
    });

    it("should get exception if non verifier try to call this function", async () => {
      const reason = "VerifiedSBT: only verifier can call this function";

      await expect(verifiedSBT.mint(FIRST.address)).to.be.rejectedWith(reason);
    });
  });

  describe("tokenURI", () => {
    it("should return correct token URI string", async () => {
      await verifiedSBT.connect(VERIFIER).mint(OWNER.address);
      await verifiedSBT.connect(VERIFIER).mint(FIRST.address);

      expect(await verifiedSBT.tokenURI(0)).to.be.eq(TOKENS_URI);
      expect(await verifiedSBT.tokenURI(1)).to.be.eq(TOKENS_URI);

      await verifiedSBT.setTokensURI("");

      expect(await verifiedSBT.tokenURI(0)).to.be.eq("");
      expect(await verifiedSBT.tokenURI(1)).to.be.eq("");
    });
  });

  describe("beforeTokenTransfer", () => {
    it("should allow burn logic", async () => {
      await verifiedSBT.connect(VERIFIER).mint(OWNER.address);

      expect(await verifiedSBT.balanceOf(OWNER.address)).to.be.eq(1);

      await verifiedSBT.burn(0);

      expect(await verifiedSBT.balanceOf(OWNER.address)).to.be.eq(0);
    });

    it("should get exception if try to transfer token", async () => {
      await verifiedSBT.connect(VERIFIER).mint(OWNER.address);

      const reason = "VerifiedSBT: token transfers are not allowed";

      await expect(
        verifiedSBT["safeTransferFrom(address,address,uint256)"](OWNER.address, FIRST.address, 0)
      ).to.be.rejectedWith(reason);
    });
  });
});
