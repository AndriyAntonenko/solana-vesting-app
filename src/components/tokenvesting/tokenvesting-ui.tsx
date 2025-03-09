"use client";

import { PublicKey } from "@solana/web3.js";
import { useMemo, useState } from "react";
import {
  useTokenvestingProgram,
  useVestingProgramAccount,
} from "./tokenvesting-data-access";
import { useWallet } from "@solana/wallet-adapter-react";

export function TokenvestingCreate() {
  const { createVestingAccount } = useTokenvestingProgram();
  const [companyName, setCompanyName] = useState("");
  const [mint, setMint] = useState("");
  const { publicKey } = useWallet();

  const isFormValid = useMemo(() => {
    return !!companyName && !!mint;
  }, [companyName, mint]);

  const handleSumit = () => {
    if (publicKey && isFormValid) {
      createVestingAccount.mutateAsync({
        mint,
        companyName,
      });
    }
  };

  if (!publicKey) {
    return (
      <div className="alert alert-warning">
        <span>Please connect your wallet to create a vesting account.</span>
      </div>
    );
  }

  return (
    <div>
      <h2>Create Vesting Account</h2>
      <input
        type="text"
        className="input input-bordered width-full max-w-xs"
        placeholder="Company Name"
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
      />

      <input
        type="text"
        className="input input-bordered width-full max-w-xs"
        placeholder="Mint"
        value={mint}
        onChange={(e) => setMint(e.target.value)}
      />

      <button
        className="btn btn-xs lg:btn-md btn-primary"
        onClick={() => handleSumit()}
        disabled={createVestingAccount.isPending || !isFormValid}
      >
        Create new vesting account {createVestingAccount.isPending && "..."}
      </button>
    </div>
  );
}

export function TokenvestingList() {
  const { accounts, getProgramAccount } = useTokenvestingProgram();

  if (getProgramAccount.isLoading) {
    return <span className="loading loading-spinner loading-lg"></span>;
  }
  if (!getProgramAccount.data?.value) {
    return (
      <div className="alert alert-info flex justify-center">
        <span>
          Program account not found. Make sure you have deployed the program and
          are on the correct cluster.
        </span>
      </div>
    );
  }
  return (
    <div className={"space-y-6"}>
      {accounts.isLoading ? (
        <span className="loading loading-spinner loading-lg"></span>
      ) : accounts.data?.length ? (
        <div className="grid md:grid-cols-2 gap-4">
          {accounts.data?.map((account) => (
            <TokenvestingCard
              key={account.publicKey.toString()}
              account={account.publicKey}
            />
          ))}
        </div>
      ) : (
        <div className="text-center">
          <h2 className={"text-2xl"}>No accounts</h2>
          No accounts found. Create one above to get started.
        </div>
      )}
    </div>
  );
}

function TokenvestingCard({ account }: { account: PublicKey }) {
  const { accountQuery, createVestingAccount } = useVestingProgramAccount({
    account,
  });

  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [cliffTime, setCliffTime] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [beneficiary, setBeneficiary] = useState("");

  const companyName = useMemo(() => {
    return accountQuery.data?.companyName;
  }, [accountQuery.data?.companyName]);

  return accountQuery.isLoading ? (
    <span className="loading loading-spinner loading-lg"></span>
  ) : (
    <div className="card card-bordered border-base-300 border-4 text-neutral-content">
      <div className="card-body items-center text-center">
        <div className="space-y-6">
          <h2
            className="card-title justify-center text-3xl cursor-pointer"
            onClick={() => accountQuery.refetch()}
          >
            {companyName}
          </h2>
          <div className="card-actions justify-around">
            <input
              type="number"
              className="input input-bordered width-full max-w-xs"
              placeholder="Start Time"
              value={startTime}
              onChange={(e) => setStartTime(parseInt(e.target.value))}
            />

            <input
              type="number"
              className="input input-bordered width-full max-w-xs"
              placeholder="End Time"
              value={endTime}
              onChange={(e) => setEndTime(parseInt(e.target.value))}
            />

            <input
              type="number"
              className="input input-bordered width-full max-w-xs"
              placeholder="Cliff Time"
              value={cliffTime}
              onChange={(e) => setCliffTime(parseInt(e.target.value))}
            />

            <input
              type="number"
              className="input input-bordered width-full max-w-xs"
              placeholder="Total Amount"
              value={totalAmount}
              onChange={(e) => setTotalAmount(parseInt(e.target.value))}
            />

            <input
              type="text"
              className="input input-bordered width-full max-w-xs"
              placeholder="Beneficiary"
              value={beneficiary}
              onChange={(e) => setBeneficiary(e.target.value)}
            />

            <button
              className="btn btn-xs lg:btn-md btn-outline"
              onClick={() =>
                createVestingAccount.mutateAsync({
                  startTime,
                  endTime,
                  cliffTime,
                  totalAmount,
                  beneficiary,
                })
              }
              disabled={createVestingAccount.isPending}
            >
              Create Employee Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
