import { JSONRpcProvider, OP_20_ABI, getContract, IOP20Contract } from 'opnet';
import { networks } from '@btc-vision/bitcoin';
import { Address } from '@btc-vision/transaction';

const NETWORK = networks.testnet;
const RPC_URL = 'https://testnet.opnet.org';

class BalanceService {
  private provider: JSONRpcProvider;

  constructor() {
    this.provider = new JSONRpcProvider(RPC_URL, NETWORK);
  }

  async getBtcBalance(address: string): Promise<bigint> {
    return this.provider.getBalance(address, true);
  }

  async getTokenBalance(tokenAddressHex: string, publicKey: string): Promise<bigint> {
    const tokenAddress = Address.fromString(tokenAddressHex);
    const token = getContract<IOP20Contract>(tokenAddress, OP_20_ABI, this.provider, NETWORK);

    // Create address from (dummyMLDSA, legacyPubKey)
    const owner = Address.fromString('0x0000000000000000000000000000000000000000000000000000000000000000', publicKey);
    const result = await token.balanceOf(owner);
    // Some ABI implementations return an object with properties, some return bigint.
    // Normalize to bigint.
    // @ts-expect-error runtime shape from ABI
    const value: bigint = result?.properties?.balance ?? result?.balance ?? result ?? 0n;
    return value;
  }
}

export const balanceService = new BalanceService();

