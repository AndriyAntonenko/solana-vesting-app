import * as anchor from "@coral-xyz/anchor";
import { BankrunProvider } from "anchor-bankrun";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Program, BN } from "@coral-xyz/anchor";

import {
  startAnchor,
  BanksClient,
  ProgramTestContext,
  Clock,
} from "solana-bankrun";

import { createMint, mintTo, getAccount } from "spl-token-bankrun";
import { PublicKey, Keypair } from "@solana/web3.js";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import IDL from "../target/idl/tokenvesting.json";
import { Tokenvesting } from "../target/types/tokenvesting";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";

const COMPANY_NAME = "Beliefs";
const TREASURY_AMOUNT = 10_000 * 10 ** 9;

describe("Vesting smart-contract tests", () => {
  let beneficiary: Keypair;
  let employer: Keypair;
  let context: ProgramTestContext;

  let provider: BankrunProvider;
  let beneficiaryProvider: BankrunProvider;

  let program: Program<Tokenvesting>;
  let beneficiaryProgram: Program<Tokenvesting>;

  let banksClient: BanksClient;
  let mint: PublicKey;

  let vestingAccountKey: PublicKey;
  let treasuryTokenAccountKey: PublicKey;
  let employeeAccountKey: PublicKey;

  beforeAll(async () => {
    beneficiary = new anchor.web3.Keypair();

    context = await startAnchor(
      "", // empty string since we are using fixtures folder for .so file
      [
        {
          name: "tokenvesting",
          programId: new PublicKey(IDL.address),
        },
      ],
      [
        {
          address: beneficiary.publicKey,
          info: {
            lamports: 1_000_000_000,
            data: Buffer.alloc(0),
            owner: SYSTEM_PROGRAM_ID,
            executable: false,
          },
        },
      ]
    ); // start bankrun

    provider = new BankrunProvider(context);
    anchor.setProvider(provider);

    program = new Program<Tokenvesting>(IDL as Tokenvesting, provider);
    banksClient = context.banksClient;
    employer = provider.wallet.payer;

    mint = await createMint(
      // @ts-expect-error - invalid library typing
      banksClient,
      employer,
      employer.publicKey,
      null,
      2
    );

    beneficiaryProvider = new BankrunProvider(
      context,
      new NodeWallet(beneficiary)
    );

    beneficiaryProgram = new Program<Tokenvesting>(
      IDL as Tokenvesting,
      beneficiaryProvider
    );

    // deriving pdas
    [vestingAccountKey] = PublicKey.findProgramAddressSync(
      [Buffer.from(COMPANY_NAME, "utf-8")],
      program.programId
    );

    [treasuryTokenAccountKey] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vesting_treasury", "utf-8"),
        Buffer.from(COMPANY_NAME, "utf-8"),
      ],
      program.programId
    );

    [employeeAccountKey] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("employee_vesting", "utf-8"),
        beneficiary.publicKey.toBuffer(),
        vestingAccountKey.toBuffer(),
      ],
      program.programId
    );
  });

  it("should create a vesting account for employer", async () => {
    const tx = await program.methods
      .createVestingAccount(COMPANY_NAME)
      .accounts({
        signer: employer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        mint,
      })
      .rpc({ commitment: "confirmed" });

    console.log("Create vesting account tx", tx);

    const vestingAccountData = await program.account.vestingAccount.fetch(
      vestingAccountKey
    );

    console.info("Vesting account data", vestingAccountData);

    expect(vestingAccountData.companyName).toEqual(COMPANY_NAME);
    expect(vestingAccountData.owner.toBase58()).toEqual(
      employer.publicKey.toBase58()
    );
    expect(vestingAccountData.mint.toBase58()).toEqual(mint.toBase58());
    expect(vestingAccountData.treasuryTokenAccount.toBase58()).toEqual(
      treasuryTokenAccountKey.toBase58()
    );
    expect(typeof vestingAccountData.bump === "number").toBeTruthy();
    expect(typeof vestingAccountData.treasuryBump === "number").toBeTruthy();
  });

  it("should fund the treasury token account", async () => {
    const mintTx = await mintTo(
      // @ts-expect-error - invalid library typing
      banksClient,
      employer,
      mint,
      treasuryTokenAccountKey,
      employer,
      TREASURY_AMOUNT
    );

    console.log("Mint to treasury tx", mintTx);
  });

  it("should create a vesting account for employee", async () => {
    const tx = await program.methods
      .createEmployeeAccount(new BN(0), new BN(100), new BN(100), new BN(0))
      .accounts({
        beneficiary: beneficiary.publicKey,
        vestingAccount: vestingAccountKey,
      })
      .rpc({ commitment: "confirmed" });

    console.log("Create employee account tx", tx);

    const employeeAccountData = await program.account.employeeAccount.fetch(
      employeeAccountKey
    );

    console.info("Employee account data", employeeAccountData);

    expect(employeeAccountData.beneficiary.toBase58()).toEqual(
      beneficiary.publicKey.toBase58()
    );
    expect(employeeAccountData.vestingAccount.toBase58()).toEqual(
      vestingAccountKey.toBase58()
    );
    expect(employeeAccountData.totalAmount.toNumber()).toEqual(100);
  });

  it("should claim vested tokens", async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const currentClock = await banksClient.getClock();
    context.setClock(
      new Clock(
        currentClock.slot,
        currentClock.epochStartTimestamp,
        currentClock.epoch,
        currentClock.leaderScheduleEpoch,
        BigInt(1000)
      )
    );

    const tx = await beneficiaryProgram.methods
      .claimTokens(COMPANY_NAME)
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({ commitment: "confirmed" });

    console.log("Claim tokens tx", tx);

    const employeeAccountData = await program.account.employeeAccount.fetch(
      employeeAccountKey
    );

    console.info("Employee account data", employeeAccountData);

    expect(employeeAccountData.totalAmount.toNumber()).toEqual(100);
    expect(employeeAccountData.totalWithdrawn.toNumber()).toEqual(100);

    const beneficiaryTokenAccount = await getAccount(
      // @ts-expect-error - invalid library typing
      banksClient,
      getAssociatedTokenAddressSync(
        mint,
        beneficiary.publicKey,
        false,
        TOKEN_PROGRAM_ID
      ),
      "confirmed"
    );

    console.info("Beneficiary token account", beneficiaryTokenAccount);

    expect(beneficiaryTokenAccount.amount).toEqual(BigInt(100));
  });
});
