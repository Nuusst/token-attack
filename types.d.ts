// Type declarations for modules without type definitions

// Declaration for the token program IDL
declare module "./target/idl/token_attack_program.json" {
  const value: any;
  export default value;
}

// Declaration for the token program types
declare module "./target/types/token_attack_program" {
  export interface TokenAttackProgram {
    "version": string;
    "name": string;
    "instructions": any[];
    "accounts": any[];
  }
}
