use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct VestingAccount {
    pub owner: Pubkey,
    pub mint: Pubkey, // Token to vest.
    pub treasury_token_account: Pubkey,
    #[max_len(64)]
    pub company_name: String,
    pub treasury_bump: u8,
    pub bump: u8,
}
