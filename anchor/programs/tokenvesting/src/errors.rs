use anchor_lang::prelude::*;

#[error_code]
pub enum CustomErrorCodes {
    #[msg("Claim not available yet")]
    ClaimNotAvailableYet,
    #[msg("Invalid vesting period")]
    InvalidVestingTime,
    #[msg("Calculations overflow")]
    CalculationOverflow,
    #[msg("No tokens to claim")]
    NoTokensToClaim,
}
