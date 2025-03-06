use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct EmployeeAccount {
    pub beneficiary: Pubkey, // pubkey of the employee
    pub start_time: i64,
    pub end_time: i64,
    pub cliff_time: i64,         // time when the first tokens can be withdrawn
    pub vesting_account: Pubkey, // corresponding token account
    pub total_amount: u64,
    pub total_withdrawn: u64,
    pub bump: u8,
}
