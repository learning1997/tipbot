import { useState, useCallback, useEffect } from 'react';
import { Bitcoin, Send, Droplets, Coins, ExternalLink, ShieldCheck, Zap, History, ArrowUpRight } from 'lucide-react';
import { useWallet } from './hooks/useWallet';
import { tipService } from './services/tipService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { balanceService } from './services/balanceService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TOKENS = [
  { symbol: 'TBTC', name: 'Test Bitcoin (OP20)', address: '', decimals: 8 },
  { symbol: 'MOTO', name: 'Moto Token', address: '0xfd4473840751d58d9f8b73bdd57d6c5260453d5518bd7cd02d0a4cf3df9bf4dd', decimals: 8 },
  { symbol: 'PILL', name: 'Pill Token', address: '0xb09fc29c112af8293539477e23d8df1d3126639642767d707277131352040cbb', decimals: 8 },
  { symbol: 'Custom', name: 'Custom Token', address: '', decimals: 18 },
];

export default function App() {
  const { isConnected, address, opAddress, connect, disconnect } = useWallet();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState(TOKENS[0]!);
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [recentTips, setRecentTips] = useState<any[]>([]);
  const [tbtcBalance, setTbtcBalance] = useState<string>('—');
  const [motoBalance, setMotoBalance] = useState<string>('—');
  const [pillBalance, setPillBalance] = useState<string>('—');

  const formatUnits = (value: bigint, decimals: number) => {
    const factor = 10n ** BigInt(decimals);
    const whole = value / factor;
    const frac = value % factor;
    return `${whole}.${frac.toString().padStart(decimals, '0')}`;
  };

  const loadBalances = useCallback(async () => {
    if (!isConnected || !opAddress) return;
    try {
      const tbtcAddr =
        // Prefer build-time env if provided
        ((import.meta as any).env?.VITE_TBTC_ADDRESS as string | undefined) ??
        // Fallback to previously saved local value for backward compatibility
        localStorage.getItem('token_tbtc') ??
        // Finally fallback to the token config
        TOKENS[0]!.address;
      if (tbtcAddr && tbtcAddr.startsWith('0x') && tbtcAddr.length > 10) {
        const bal = await balanceService.getTokenBalance(tbtcAddr, opAddress);
        setTbtcBalance(formatUnits(bal, TOKENS[0]!.decimals));
      } else {
        setTbtcBalance('—');
      }

      const motoAddr = TOKENS[1]!.address;
      if (motoAddr && motoAddr.startsWith('0x') && motoAddr.length > 10) {
        const bal = await balanceService.getTokenBalance(motoAddr, opAddress);
        setMotoBalance(formatUnits(bal, TOKENS[1]!.decimals));
      } else {
        setMotoBalance('—');
      }

      const pillAddr = TOKENS[2]!.address;
      if (pillAddr && pillAddr.startsWith('0x') && pillAddr.length > 10) {
        const bal = await balanceService.getTokenBalance(pillAddr, opAddress);
        setPillBalance(formatUnits(bal, TOKENS[2]!.decimals));
      } else {
        setPillBalance('—');
      }
    } catch (e) {
      console.warn('Balance fetch failed', e);
    }
  }, [isConnected, opAddress]);

  // Auto-load balances after wallet connect
  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  const handleSendTip = useCallback(async () => {
    if (!isConnected) {
      alert('Please connect your wallet first!');
      return;
    }

    if (!recipient || !amount) {
      alert('Please fill in all fields!');
      return;
    }

    let tokenAddress =
      selectedToken.symbol === 'TBTC'
        ? (
            (((import.meta as any).env?.VITE_TBTC_ADDRESS as string | undefined) ??
              localStorage.getItem('token_tbtc') ??
              TOKENS[0]!.address) || ''
          ).trim()
        : selectedToken.symbol === 'MOTO'
        ? (TOKENS[1]!.address || '').trim()
        : selectedToken.symbol === 'PILL'
        ? (TOKENS[2]!.address || '').trim()
        : (customTokenAddress || '').trim();
    if ((!tokenAddress || !tokenAddress.startsWith('0x')) && selectedToken.symbol === 'TBTC') {
      const input = window.prompt('Enter TBTC OP20 token address (0x...)')?.trim() ?? '';
      if (input && input.startsWith('0x')) {
        localStorage.setItem('token_tbtc', input);
        tokenAddress = input;
      }
    }
    if (!tokenAddress || !tokenAddress.startsWith('0x')) {
      alert('Set a valid OP20 token address (0x...) for selected token.');
      return;
    }
    const rec = recipient.trim();
    const isBech32 = rec.toLowerCase().startsWith('opt1');
    const isPubHex = rec.startsWith('0x') && rec.length > 66;
    if (!isBech32 && !isPubHex) {
      alert('Please enter a valid OPNet address (opt1...) or public key (0x...).');
      return;
    }
    if (!opAddress || !address) {
      alert('Wallet address info missing. Reconnect your wallet.');
      return;
    }

    setIsSending(true);
    try {
      const decimals =
        selectedToken.symbol === 'TBTC' ? 8 :
        selectedToken.symbol === 'MOTO' ? 8 :
        selectedToken.symbol === 'PILL' ? 8 :
        selectedToken.decimals;
      const amountBigInt = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)));
      let txId = '';

      const tx = await tipService.sendTokenTip(
        tokenAddress,
        opAddress,
        recipient.trim(),
        amountBigInt,
        address
      );
      txId = (tx as any) || '';
      await loadBalances();
      
      const newTip = {
        id: txId,
        recipient,
        amount,
        token: selectedToken.symbol,
        time: new Date().toLocaleTimeString(),
      };

      setRecentTips(prev => [newTip, ...prev].slice(0, 5));
      alert(`Tip sent successfully! TX: ${txId}`);
      setAmount('');
      setRecipient('');
    } catch (error) {
      console.error('Failed to send tip:', error);
      alert('Failed to send tip. Check console for details.');
    } finally {
      setIsSending(false);
    }
  }, [isConnected, recipient, amount, selectedToken, customTokenAddress, loadBalances, opAddress, address]);

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white font-sans">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0b0e11]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-bitcoin-orange p-2 rounded-xl shadow-lg shadow-bitcoin-orange/20">
              <Bitcoin className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-1">
                BITCOIN <span className="text-bitcoin-orange">TIPBOT</span>
              </h1>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Powered by OPNet</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isConnected && (
              <div className="hidden md:flex items-center gap-4 mr-2">
                <div className="text-xs text-gray-400 font-bold">
                  TBTC: <span className="text-white">{tbtcBalance}</span>
                </div>
                <div className="text-xs text-gray-400 font-bold">
                  MOTO: <span className="text-white">{motoBalance}</span>
                </div>
                <div className="text-xs text-gray-400 font-bold">
                  PILL: <span className="text-white">{pillBalance}</span>
                </div>
                <button
                  onClick={loadBalances}
                  className="px-3 py-1.5 rounded-full border border-gray-700 text-xs hover:border-bitcoin-orange hover:text-bitcoin-orange transition"
                >
                  Refresh
                </button>
              </div>
            )}
            <a 
              href="https://faucet.opnet.org/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full border border-gray-700 hover:border-bitcoin-orange hover:text-bitcoin-orange transition-all font-semibold text-sm"
            >
              <Droplets className="w-4 h-4" />
              Faucet
            </a>
            
            {isConnected ? (
              <div className="flex items-center gap-3">
                <div className="hidden lg:flex flex-col items-end">
                  <span className="text-xs font-bold text-gray-400">OP_NET Connected</span>
                  <span className="text-sm font-mono text-bitcoin-orange">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                </div>
                <button 
                  onClick={disconnect}
                  className="bg-gray-800 hover:bg-red-500/20 hover:text-red-500 px-6 py-2.5 rounded-full font-bold transition-all text-sm border border-transparent hover:border-red-500/30"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button 
                onClick={connect}
                className="bg-bitcoin-orange hover:bg-bitcoin-hover text-white px-8 py-2.5 rounded-full font-black transition-all shadow-lg shadow-bitcoin-orange/30 active:scale-95 text-sm"
              >
                Connect OP_NET Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          
          {/* Hero Section */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-bitcoin-orange/10 border border-bitcoin-orange/20 text-bitcoin-orange text-xs font-bold uppercase tracking-wider">
                <Zap className="w-3 h-3 fill-bitcoin-orange" />
                Lightning Fast Tips
              </div>
              <h2 className="text-5xl lg:text-6xl font-black leading-tight">
                Send tBTC Tips <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-bitcoin-orange to-orange-400">Instantly.</span>
              </h2>
              <p className="text-gray-400 text-lg max-w-md leading-relaxed">
                Support your favorite creators with tBTC or any OP20 test token on OPNet.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#1e2329] p-6 rounded-2xl border border-gray-800 hover:border-bitcoin-orange/30 transition-colors group">
                <ShieldCheck className="w-8 h-8 text-bitcoin-orange mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="font-bold mb-1">Secure</h3>
                <p className="text-xs text-gray-500">Non-custodial, direct peer-to-peer transfers.</p>
              </div>
              <div className="bg-[#1e2329] p-6 rounded-2xl border border-gray-800 hover:border-bitcoin-orange/30 transition-colors group">
                <Coins className="w-8 h-8 text-bitcoin-orange mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="font-bold mb-1">Multi-Token</h3>
                <p className="text-xs text-gray-500">Send any OP20 token with a contract address.</p>
              </div>
            </div>
          </div>

          {/* Send Tip Card */}
          <div className="bg-[#1e2329] p-8 rounded-3xl border border-gray-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-bitcoin-orange/5 blur-3xl rounded-full -mr-16 -mt-16" />
            
            <h3 className="text-2xl font-black mb-8 flex items-center gap-3">
              <Send className="w-6 h-6 text-bitcoin-orange" />
              Send a Tip
            </h3>

            <div className="space-y-6">
              {/* Token Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Select Token</label>
                <div className="grid grid-cols-4 gap-2">
                  {TOKENS.map((token) => (
                    <button
                      key={token.symbol}
                      onClick={() => setSelectedToken(token)}
                      className={cn(
                        "py-3 rounded-xl font-bold text-sm transition-all border",
                        selectedToken.symbol === token.symbol 
                          ? "bg-bitcoin-orange border-bitcoin-orange text-white shadow-lg shadow-bitcoin-orange/20" 
                          : "bg-bitcoin-black border-gray-800 text-gray-400 hover:border-gray-600"
                      )}
                    >
                      {token.symbol}
                    </button>
                  ))}
                </div>
              </div>

              {/* Only show contract input for Custom token */}

              {/* Custom Token Address Field */}
              {selectedToken.symbol === 'Custom' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Contract Address</label>
                  <input 
                    type="text" 
                    placeholder="0x..." 
                    value={customTokenAddress}
                    onChange={(e) => setCustomTokenAddress(e.target.value)}
                    className="w-full bg-bitcoin-black border border-gray-800 rounded-xl px-4 py-4 focus:outline-none focus:border-bitcoin-orange transition-colors font-mono text-sm"
                  />
                </div>
              )}

              {/* Recipient Field */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Recipient Address</label>
                <input 
                  type="text" 
                  placeholder="Enter OPNet address (opt1...)" 
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full bg-bitcoin-black border border-gray-800 rounded-xl px-4 py-4 focus:outline-none focus:border-bitcoin-orange transition-colors font-mono text-sm"
                />
              </div>

              {/* Amount Field */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Amount ({selectedToken.symbol})</label>
                <div className="relative">
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-bitcoin-black border border-gray-800 rounded-xl px-4 py-4 focus:outline-none focus:border-bitcoin-orange transition-colors font-bold text-lg pr-16"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">
                    {selectedToken.symbol}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button 
                disabled={!isConnected || isSending}
                onClick={handleSendTip}
                className={cn(
                  "w-full py-5 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 shadow-xl",
                  isConnected 
                    ? "bg-bitcoin-orange hover:bg-bitcoin-hover text-white shadow-bitcoin-orange/20 active:scale-[0.98]" 
                    : "bg-gray-800 text-gray-500 cursor-not-allowed",
                  isSending && "opacity-70 animate-pulse"
                )}
              >
                {isSending ? (
                  "Sending Tip..."
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Tip Now
                  </>
                )}
              </button>

              {!isConnected && (
                <p className="text-center text-xs text-gray-500 font-bold">
                  Please connect OP_NET Wallet to start tipping
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Tips Section */}
        {recentTips.length > 0 && (
          <div className="mt-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h3 className="text-xl font-black mb-6 flex items-center gap-3">
              <History className="w-5 h-5 text-bitcoin-orange" />
              Recent Tips
            </h3>
            <div className="grid gap-3">
              {recentTips.map((tip) => (
                <div key={tip.id} className="bg-[#1e2329] p-4 rounded-2xl border border-gray-800 flex items-center justify-between group hover:border-bitcoin-orange/30 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="bg-bitcoin-orange/10 p-2 rounded-lg text-bitcoin-orange">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-sm">Sent {tip.amount} {tip.token}</div>
                      <div className="text-[10px] text-gray-500 font-mono uppercase tracking-tighter">To: {tip.recipient.slice(0, 10)}...{tip.recipient.slice(-10)}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-gray-400">{tip.time}</div>
                    <a 
                      href={`https://testnet.opnet.org/tx/${tip.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-bitcoin-orange hover:underline font-bold uppercase tracking-widest flex items-center gap-1 justify-end"
                    >
                      View <ExternalLink className="w-2 h-2" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-24 border-t border-gray-900 pt-12 text-center space-y-4">
          <div className="flex items-center justify-center gap-8 opacity-40">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest">OPNet Testnet Active</span>
            </div>
            <a 
              href="https://opnet.org" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest hover:text-bitcoin-orange transition-colors"
            >
              OPNet.org <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <p className="text-gray-600 text-[10px] font-bold uppercase tracking-[0.2em]">
            &copy; 2026 Bitcoin TipBot. No rights reserved. Built for the community.
          </p>
        </div>
      </main>
    </div>
  );
}
