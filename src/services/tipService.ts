import { JSONRpcProvider, OP_20_ABI, getContract, IOP20Contract, type TransactionParameters } from 'opnet';
import { networks } from '@btc-vision/bitcoin';
import { Address } from '@btc-vision/transaction';

const RPC_URL = 'https://testnet.opnet.org';

export class TipService {
  private provider: JSONRpcProvider;

  constructor() {
    this.provider = new JSONRpcProvider(RPC_URL, networks.testnet);
  }

  private async resolveOPAddress(input: string): Promise<Address> {
    const s = (input || '').trim();
    if (s.startsWith('0x') && s.length > 66) {
      const zero = '0x' + '0'.repeat(64);
      return Address.fromString(zero, s);
    }
    const lower = s.toLowerCase();
    if (lower.startsWith('opt1') || lower.startsWith('bc1')) {
      try {
        const info: any = await (this.provider as any).getPublicKeyInfo(s);
        const pub =
          info?.publicKeyHex ??
          info?.publicKey ??
          info?.legacyPublicKey ??
          info?.hex ??
          info?.properties?.publicKey ??
          '';
        if (typeof pub === 'string' && pub.startsWith('0x')) {
          const zero = '0x' + '0'.repeat(64);
          return Address.fromString(zero, pub);
        }
        if (typeof window !== 'undefined') {
          const manual = window.prompt('Enter destination public key hex (0x...)')?.trim() ?? '';
          if (manual && manual.startsWith('0x')) {
            const zero = '0x' + '0'.repeat(64);
            return Address.fromString(zero, manual);
          }
        }
        throw new Error('Public key not found for address');
      } catch {
        if (typeof window !== 'undefined') {
          const manual = window.prompt('Enter destination public key hex (0x...)')?.trim() ?? '';
          if (manual && manual.startsWith('0x')) {
            const zero = '0x' + '0'.repeat(64);
            return Address.fromString(zero, manual);
          }
        }
        throw new Error('Public key not found for address');
      }
    }
    return Address.fromString(s);
  }

  async sendTokenTip(
    tokenAddressHex: string,
    senderOptAddressStr: string,
    recipientOptAddressStr: string,
    amount: bigint,
    refundToBtcAddress: string
  ) {
    try {
      const tokenAddress = Address.fromString(tokenAddressHex);
      const senderAddress = await this.resolveOPAddress(senderOptAddressStr);
      const recipientAddress = await this.resolveOPAddress(recipientOptAddressStr);

      const contract = getContract<IOP20Contract>(
        tokenAddress,
        OP_20_ABI,
        this.provider,
        networks.testnet,
        senderAddress
      );

      const simulation = await contract.transfer(recipientAddress, amount);

      if (simulation.revert) {
        throw new Error(String(simulation.revert));
      }

      const txParams: TransactionParameters = {
        signer: null,
        mldsaSigner: null,
        refundTo: refundToBtcAddress,
        maximumAllowedSatToSpend: 100_000n,
        feeRate: 0,
        network: networks.testnet,
      };

      const receipt = await simulation.sendTransaction(txParams);

      // Normalize and return tx id
      // @ts-expect-error runtime shape depends on provider version
      return receipt?.transactionId ?? receipt?.hash ?? receipt;

    } catch (error) {
      console.error('Error sending OP20 tip:', error);
      throw error;
    }
  }
}

export const tipService = new TipService();
