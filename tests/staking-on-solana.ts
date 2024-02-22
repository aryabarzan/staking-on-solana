import {
  AnchorProvider,
  BN,
  Program,
  Wallet,
  getProvider,
  setProvider,
  web3,
  workspace,
} from "@coral-xyz/anchor";
import {
  Account,
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { assert } from "chai";

import { StakingOnSolana } from "../target/types/staking_on_solana";

describe("staking-on-solana", () => {
  let usdcMint: web3.PublicKey;
  let poolUsdcAccount: Account;
  let stakerUsdcAccount: Account;
  let poolAccount: web3.Keypair;
  let wallet: Wallet;

  // Configure the client to use the local cluster.
  const provider = AnchorProvider.env();
  setProvider(provider);

  const program = workspace.StakingOnSolana as Program<StakingOnSolana>;

  before(async () => {
    // @ts-ignore
    wallet = getProvider().wallet;

    // Create a new mint for mock USDC
    usdcMint = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      null,
      6, // Assuming 6 decimal places for USDC
      undefined,
      undefined,
      TOKEN_PROGRAM_ID
    );

    // Create a token account for the pool to receive USDC
    poolUsdcAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      usdcMint,
      program.programId
    );

    // Create a token account for the staker
    stakerUsdcAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      usdcMint,
      wallet.publicKey
    );

    // Mint some mock USDC to the staker's account
    let signature = await mintTo(
      provider.connection,
      wallet.payer,
      usdcMint,
      stakerUsdcAccount.address,
      wallet.publicKey,
      BigInt(20000000) // 20 tokens of mock USDC
    );
    console.log("mint tx:", signature);

    // Use the provider to create a Keypair for the pool account.
    poolAccount = web3.Keypair.generate();

    // Call the initialize_pool function.
    await program.methods
      .initializePool()
      .accounts({
        pool: poolAccount.publicKey,
        user: program.provider.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([poolAccount])
      .rpc();
  });

  it("Initializes the staking pool", async () => {
    // Fetch the pool account from the chain.
    const pool = await program.account.pool.fetch(poolAccount.publicKey);

    // Verify the pool's state.
    assert.equal(
      pool.totalStaked.toNumber(),
      0,
      "The pool was not initialized correctly"
    );
  });

  it("Stakes token into the pool and verifies balances", async () => {
    const stakeAmount = new BN(5000000); // 5 tokens of mock USDC

    await program.methods
      .stakeToken(stakeAmount)
      .accounts({
        staker: wallet.publicKey,
        stakerTokenAccount: stakerUsdcAccount.address,
        poolTokenAccount: poolUsdcAccount.address,
        pool: poolAccount.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    // Fetch the updated pool account
    const pool = await program.account.pool.fetch(poolAccount.publicKey);

    // Verify the pool's total staked amount has increased
    assert.equal(
      pool.totalStaked.toString(),
      stakeAmount.toString(),
      "The total staked amount in the pool should match the stake amount."
    );

    // Verify balances after staking
    const [stakerUsdcAccountInfo, poolUsdcAccountInfo] = await Promise.all([
      getAccount(provider.connection, stakerUsdcAccount.address),
      getAccount(provider.connection, poolUsdcAccount.address),
    ]);

    const { amount: stakerUsdcBalance } = stakerUsdcAccountInfo;
    const { amount: poolUsdcBalance } = poolUsdcAccountInfo;

    assert.equal(
      stakerUsdcBalance.toString(),
      "15000000",
      "The staker's USDC balance is incorrect"
    );

    assert.equal(
      poolUsdcBalance.toString(),
      "5000000",
      "The staker's USDC balance is incorrect"
    );
  });
});
