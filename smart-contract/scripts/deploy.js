const hre = require("hardhat");
const path = require("path");
const fs = require("fs");

async function main() {
  const networkName = hre.network.name;
  console.log(`Deploying CertificateNFT to ${networkName}...`);
  console.log(`Deployer: ${(await hre.ethers.getSigners())[0].address}`);

  const CertificateNFT = await hre.ethers.getContractFactory("CertificateNFT");
  const contract = await CertificateNFT.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  const txHash = contract.deploymentTransaction()?.hash || "";

  console.log(`CertificateNFT deployed to: ${contractAddress}`);
  console.log(`Transaction hash: ${txHash}`);

  // ── Save deployment artifacts ──
  const artifactsDir = path.join(__dirname, "..", "deployment");
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const deployment = {
    network: networkName,
    chainId: 80002,
    contractAddress,
    deployer: (await hre.ethers.getSigners())[0].address,
    transactionHash: txHash,
    timestamp: new Date().toISOString(),
    contractName: "CertificateNFT",
  };

  const deployPath = path.join(artifactsDir, `deployment-${networkName}.json`);
  fs.writeFileSync(deployPath, JSON.stringify(deployment, null, 2));
  console.log(`Deployment artifact saved to: ${deployPath}`);

  // ── Update backend contract address file ──
  const backendConfigPath = path.join(__dirname, "..", "..", "backend", "blockchain", "contractAddress.js");
  if (fs.existsSync(backendConfigPath)) {
    let configContent = fs.readFileSync(backendConfigPath, "utf8");
    configContent = configContent.replace(
      /process\.env\.CONTRACT_ADDRESS \|\| ""/,
      `process.env.CONTRACT_ADDRESS || "${contractAddress}"`
    );
    fs.writeFileSync(backendConfigPath, configContent);
    console.log(`Updated backend contract address to: ${contractAddress}`);
  }

  console.log("\n✅ Deployment complete!");
  console.log(`Add this to your backend .env:`);
  console.log(`CONTRACT_ADDRESS=${contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
