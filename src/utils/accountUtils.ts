import { ChartOfAccount, AccountingTransaction, SalesInvoice, PaymentMethodConfig, AccountBalances, Supplier, PurchaseOrder, ProductItem, JournalEntry, Project } from '../types';

/**
 * Normalizes account or channel string for fuzzy matching
 */
export const normalizeChannelKey = (name: string): string => {
    return (name || '').toLowerCase().replace(/[\s\-_()]/g, '');
};

/**
 * Matches a payment method name, channel name, or ID to a specific Chart of Account head
 */
export const matchChannelToAccount = (
    channelNameOrId: string,
    chartOfAccounts: ChartOfAccount[],
    paymentMethods?: PaymentMethodConfig[]
): ChartOfAccount | undefined => {
    if (!channelNameOrId || !chartOfAccounts || chartOfAccounts.length === 0) return undefined;
    const raw = channelNameOrId.trim();
    const lower = raw.toLowerCase();

    // 1. Try matching by exact ID or Code in COA
    let found = chartOfAccounts.find(a => a.id === raw || a.code === raw);
    if (found) return found;

    // 2. Check if channelNameOrId corresponds to a PaymentMethodConfig
    const pm = paymentMethods?.find(p => p.id === raw || p.name.toLowerCase() === lower);
    if (pm?.linkedAccountId) {
        const byLink = chartOfAccounts.find(a => 
            a.id === pm.linkedAccountId || 
            a.code === pm.linkedAccountId || 
            `${a.code} - ${a.name}`.toLowerCase() === pm.linkedAccountId!.toLowerCase() ||
            pm.linkedAccountId!.toLowerCase().includes(a.code)
        );
        if (byLink) return byLink;
    }

    // 3. Match by exact account name or Bengali name
    found = chartOfAccounts.find(a => a.name.toLowerCase() === lower || (a.nameBn && a.nameBn.toLowerCase() === lower));
    if (found) return found;

    // 4. Specific MFS matching (strictly distinguish bKash vs Nagad vs Rocket vs Upay)
    if (lower.includes('bkash') || lower.includes('বিকাশ')) {
        const bkashAcc = chartOfAccounts.find(a => 
            (a.name.toLowerCase().includes('bkash') || a.nameBn?.includes('বিকাশ')) && 
            !a.name.toLowerCase().includes('nagad') && 
            !a.nameBn?.includes('নগদ')
        );
        if (bkashAcc) return bkashAcc;
    }
    if (lower.includes('nagad') || lower.includes('নগদ')) {
        const nagadAcc = chartOfAccounts.find(a => 
            (a.name.toLowerCase().includes('nagad') || a.nameBn?.includes('নগদ')) && 
            !a.name.toLowerCase().includes('bkash') && 
            !a.nameBn?.includes('বিকাশ')
        );
        if (nagadAcc) return nagadAcc;
    }
    if (lower.includes('rocket') || lower.includes('রকেট')) {
        const rocketAcc = chartOfAccounts.find(a => a.name.toLowerCase().includes('rocket') || a.nameBn?.includes('রকেট'));
        if (rocketAcc) return rocketAcc;
    }
    if (lower.includes('upay') || lower.includes('উপায়')) {
        const upayAcc = chartOfAccounts.find(a => a.name.toLowerCase().includes('upay') || a.nameBn?.includes('উপায়'));
        if (upayAcc) return upayAcc;
    }

    // 5. Specific Bank matching
    if (lower.includes('city') || (pm?.bankName && pm.bankName.toLowerCase().includes('city'))) {
        const cityAcc = chartOfAccounts.find(a => a.name.toLowerCase().includes('city'));
        if (cityAcc) return cityAcc;
    }
    if (lower.includes('southeast') || (pm?.bankName && pm.bankName.toLowerCase().includes('southeast'))) {
        const seAcc = chartOfAccounts.find(a => a.name.toLowerCase().includes('southeast'));
        if (seAcc) return seAcc;
    }
    if (lower.includes('brac') || (pm?.bankName && pm.bankName.toLowerCase().includes('brac'))) {
        const bracAcc = chartOfAccounts.find(a => a.name.toLowerCase().includes('brac'));
        if (bracAcc) return bracAcc;
    }
    if (pm?.bankName) {
        const byBank = chartOfAccounts.find(a => a.name.toLowerCase().includes(pm.bankName!.toLowerCase()));
        if (byBank) return byBank;
    }

    // 6. Cash matching
    if (lower.includes('cash') || lower.includes('ক্যাশ')) {
        const cashAcc = chartOfAccounts.find(a => 
            (a.name.toLowerCase().includes('cash') || a.nameBn?.includes('নগদ') || a.code === '1001' || a.code === '1010') &&
            !a.name.toLowerCase().includes('bkash') &&
            !a.name.toLowerCase().includes('nagad')
        );
        if (cashAcc) return cashAcc;
    }

    // 7. General partial name match within Asset classification
    found = chartOfAccounts.find(a => 
        a.classification === 'Asset' && (
            a.name.toLowerCase().includes(lower) || 
            lower.includes(a.name.toLowerCase())
        )
    );
    if (found) return found;

    return undefined;
};

/**
 * Checks whether an AccountingTransaction matches a specific ChartOfAccount head
 */
export const doesTransactionMatchAccount = (
    tx: AccountingTransaction,
    acc: ChartOfAccount
): boolean => {
    const accNameLower = (acc.name || '').toLowerCase().trim();
    const accCode = (acc.code || '').trim();
    const payAcc = (tx.paymentAccount || tx.account || tx.accountHead || tx.paymentMethod || '').toLowerCase().trim();
    const head = (tx.accountHead || tx.account || tx.paymentAccount || '').toLowerCase().trim();
    const desc = (tx.description || '').toLowerCase();

    // 1. Exact match by account ID, code, or name
    if (tx.account === acc.id || tx.paymentAccount === acc.id || tx.accountHead === acc.id) return true;
    if (payAcc === accNameLower || head === accNameLower) return true;
    if (accCode && (payAcc === accCode || head === accCode || payAcc.startsWith(accCode + ' ') || head.startsWith(accCode + ' ') || payAcc.endsWith(' ' + accCode))) return true;

    const isBkash = accNameLower.includes('bkash') || (acc.nameBn && acc.nameBn.includes('বিকাশ'));
    const isNagad = accNameLower.includes('nagad') || (acc.nameBn && acc.nameBn.includes('নগদ'));
    const isCity = accNameLower.includes('city');
    const isSoutheast = accNameLower.includes('southeast');
    const isBrac = accNameLower.includes('brac');
    const isCash = (accNameLower.includes('cash') || accCode === '1001' || accCode === '1010' || (acc.nameBn && acc.nameBn.includes('ক্যাশ'))) && !isBkash && !isNagad;

    // Determine if the transaction explicitly declares a payment channel or account
    const txHasExplicitChannel = Boolean(payAcc || head);

    // 2. Strict MFS separation
    if (isBkash) {
        if (payAcc.includes('nagad') || head.includes('nagad') || payAcc.includes('city') || payAcc.includes('southeast') || payAcc.includes('brac') || payAcc.includes('cash')) return false;
        if (payAcc.includes('bkash') || head.includes('bkash')) return true;
        if (!txHasExplicitChannel && desc.includes('bkash')) return true;
        return false;
    }

    if (isNagad) {
        if (payAcc.includes('bkash') || head.includes('bkash') || payAcc.includes('city') || payAcc.includes('southeast') || payAcc.includes('brac') || payAcc.includes('cash')) return false;
        if (payAcc.includes('nagad') || head.includes('nagad')) return true;
        if (!txHasExplicitChannel && desc.includes('nagad')) return true;
        return false;
    }

    // 3. Strict Bank separation
    if (isCity) {
        if (payAcc.includes('southeast') || head.includes('southeast') || payAcc.includes('brac') || head.includes('brac') || payAcc.includes('cash') || payAcc.includes('bkash') || payAcc.includes('nagad')) {
            return false;
        }
        if (payAcc.includes('city') || head.includes('city')) return true;
        if (!txHasExplicitChannel && desc.includes('city')) return true;
        return false;
    }

    if (isSoutheast) {
        if (payAcc.includes('city') || head.includes('city') || payAcc.includes('brac') || head.includes('brac') || payAcc.includes('cash') || payAcc.includes('bkash') || payAcc.includes('nagad')) {
            return false;
        }
        if (payAcc.includes('southeast') || head.includes('southeast')) return true;
        if (!txHasExplicitChannel && desc.includes('southeast')) return true;
        return false;
    }

    if (isBrac) {
        if (payAcc.includes('city') || head.includes('city') || payAcc.includes('southeast') || head.includes('southeast') || payAcc.includes('cash') || payAcc.includes('bkash') || payAcc.includes('nagad')) {
            return false;
        }
        if (payAcc.includes('brac') || head.includes('brac')) return true;
        if (!txHasExplicitChannel && desc.includes('brac')) return true;
        return false;
    }

    // 4. Cash separation
    if (isCash) {
        const isOtherChannel = payAcc.includes('bank') || payAcc.includes('bkash') || payAcc.includes('nagad') || payAcc.includes('city') || payAcc.includes('southeast') || payAcc.includes('brac') || payAcc.includes('card') || payAcc.includes('rocket') || payAcc.includes('upay');
        if (!isOtherChannel) {
            return payAcc.includes('cash') || payAcc === 'office cash' || payAcc === 'factory cash' || head.includes('cash') || (payAcc === '' && head === '');
        }
        return false;
    }

    // 5. General partial match only for other unspecialized Asset accounts
    if (acc.classification === 'Asset') {
        const isTargetSpecialized = isCity || isSoutheast || isBrac || isBkash || isNagad || isCash;
        if (!isTargetSpecialized) {
            if (payAcc && (accNameLower.includes(payAcc) || payAcc.includes(accNameLower))) return true;
            if (head && (accNameLower.includes(head) || head.includes(accNameLower))) return true;
        }
    }

    return false;
};

/**
 * Calculates the exact dynamic live balance for any asset account in Chart of Accounts
 */
export const calculateSingleAccountBalance = (
    acc: ChartOfAccount,
    transactions: AccountingTransaction[],
    invoices: SalesInvoice[] = [],
    projects: any[] = []
): number => {
    let balance = Number(acc.openingBalance) || 0;

    const accNameLower = (acc.name || '').toLowerCase().trim();
    const accCode = (acc.code || '').trim();
    const isBkash = accNameLower.includes('bkash') || (acc.nameBn && acc.nameBn.includes('বিকাশ'));
    const isNagad = accNameLower.includes('nagad') || (acc.nameBn && acc.nameBn.includes('নগদ'));
    const isCity = accNameLower.includes('city');
    const isSoutheast = accNameLower.includes('southeast');
    const isBrac = accNameLower.includes('brac');
    const isCash = (accNameLower.includes('cash') || accCode === '1001' || accCode === '1010' || (acc.nameBn && acc.nameBn.includes('ক্যাশ'))) && !isBkash && !isNagad;

    // 1. Sum up all matched ledger transactions
    (transactions || []).forEach((tx) => {
        if (doesTransactionMatchAccount(tx, acc)) {
            if (tx.type === 'INCOME') {
                balance += tx.amount;
            } else if (tx.type === 'EXPENSE') {
                balance -= tx.amount;
            }
        }
    });

    // 2. Reconcile sales invoices with splitPayments or paymentMethod that might not have a ledger tx record
    const recordedInvoiceRefs = new Set(
        (transactions || [])
            .filter((t) => t.type === 'INCOME' && t.refNo)
            .map((t) => (t.refNo || '').toLowerCase().trim())
    );

    // Build set of invoice numbers / IDs linked to projects to prevent double-counting
    const projectLinkedInvoiceNos = new Set<string>();
    if (projects && Array.isArray(projects)) {
        projects.forEach((p: any) => {
            if (p.invoiceNo) projectLinkedInvoiceNos.add(p.invoiceNo.toLowerCase().trim());
            (p.salesItems || []).forEach((s: any) => {
                if (s.invoiceNo) projectLinkedInvoiceNos.add(s.invoiceNo.toLowerCase().trim());
            });
        });
    }

    (invoices || []).forEach((inv) => {
        const invRef = (inv.invoiceNo || '').toLowerCase().trim();

        // Skip invoices that belong to projects - project collections/sales are recorded via project vouchers/transactions
        if (inv.projectId || inv.projectCode || (invRef && projectLinkedInvoiceNos.has(invRef))) {
            return;
        }

        if (invRef && recordedInvoiceRefs.has(invRef)) {
            return; // Already accounted for in transactions
        }

        if (inv.splitPayments) {
            Object.entries(inv.splitPayments).forEach(([key, val]) => {
                const kLower = key.toLowerCase();
                const amt = Number(val) || 0;
                if (amt <= 0 || kLower === 'due') return;

                let matchesKey = false;
                if (kLower === accNameLower || (accCode && kLower.includes(accCode))) {
                    matchesKey = true;
                } else if (isBkash && (kLower.includes('bkash') || kLower === 'pm-bkash')) {
                    matchesKey = true;
                } else if (isNagad && (kLower.includes('nagad') || kLower === 'pm-nagad')) {
                    matchesKey = true;
                } else if (isCity && kLower.includes('city')) {
                    matchesKey = true;
                } else if (isSoutheast && kLower.includes('southeast')) {
                    matchesKey = true;
                } else if (isCash && (kLower.includes('cash') || kLower === 'pm-cash')) {
                    matchesKey = true;
                }

                if (matchesKey) {
                    balance += amt;
                }
            });
        } else if ((inv.paidAmount || 0) > 0) {
            const pmLower = (inv.paymentMethod || '').toLowerCase();
            let matchesPm = false;
            if (pmLower === accNameLower || (accCode && pmLower.includes(accCode))) {
                matchesPm = true;
            } else if (isBkash && pmLower.includes('bkash')) {
                matchesPm = true;
            } else if (isNagad && pmLower.includes('nagad')) {
                matchesPm = true;
            } else if (isCity && pmLower.includes('city')) {
                matchesPm = true;
            } else if (isSoutheast && pmLower.includes('southeast')) {
                matchesPm = true;
            } else if (isCash && (pmLower.includes('cash') || pmLower === '')) {
                matchesPm = true;
            }

            if (matchesPm) {
                balance += Number(inv.paidAmount) || 0;
            }
        }
    });

    return Math.max(0, balance);
};

/**
 * Calculates live balance for a PaymentMethodConfig item dynamically
 */
export const getPaymentMethodLiveBalance = (
    pm: PaymentMethodConfig,
    chartOfAccounts: ChartOfAccount[] = [],
    transactions: AccountingTransaction[] = [],
    invoices: SalesInvoice[] = [],
    accountBalances?: AccountBalances,
    projects: any[] = []
): number => {
    if (!pm) return 0;
    const pmName = (pm.name || '').toLowerCase().trim();
    const pmId = (pm.id || '').toLowerCase().trim();
    const pmBank = (pm.bankName || '').toLowerCase().trim();
    const pmAccountNo = (pm.accountNumber || '').trim();

    // 1. If it's a specific cash method, calculate cash
    if (pm.type === 'cash') {
        if (pmName.includes('factory')) {
            return accountBalances?.factoryCash || 0;
        }
        let cashAmt = 0;
        let hasDirectTx = false;
        (transactions || []).forEach((tx) => {
            const pAcc = (tx.paymentAccount || tx.account || tx.accountHead || tx.paymentMethod || '').toLowerCase().trim();
            if (pAcc === 'cash' || pAcc === pmName || pAcc.includes('cash counter') || pAcc.includes('in hand')) {
                hasDirectTx = true;
                if (tx.type === 'INCOME') cashAmt += tx.amount;
                else if (tx.type === 'EXPENSE') cashAmt -= tx.amount;
            }
        });
        if (hasDirectTx) return Math.max(0, cashAmt);
        return Math.max(0, (accountBalances?.cash || 0) + (accountBalances?.factoryCash || 0));
    }

    // 2. Dedicated Chart of Accounts matching (ONLY if the COA account specifically matches this payment method, NOT generic shared 1030/1040/1010)
    const matchingAcc = (chartOfAccounts || []).find((acc) => {
        if (acc.classification !== 'Asset') return false;
        const accName = acc.name.toLowerCase().trim();
        const accId = acc.id.toLowerCase().trim();
        const accCode = (acc.code || '').trim();

        // Exact ID match (if user explicitly linked a distinct custom COA account, not generic shared 1030/1040)
        if (pm.linkedAccountId && (accId === pm.linkedAccountId || acc.id === pm.linkedAccountId) && accCode !== '1030' && accCode !== '1040' && accCode !== '1010') {
            return true;
        }

        // Distinct name match
        if (accName === pmName || (acc.nameBn && pm.nameBn && acc.nameBn === pm.nameBn)) {
            return true;
        }

        // Bank-specific name match (e.g. "City Bank PLC" matches "City Bank PLC" in COA)
        if (pm.type === 'bank') {
            if (pmName.includes('city') && accName.includes('city')) return true;
            if (pmName.includes('southeast') && accName.includes('southeast')) return true;
            if (pmName.includes('brac') && accName.includes('brac')) return true;
            if (pmBank && accName.includes(pmBank)) return true;
            if (pmName.includes('ucb') && accName.includes('ucb')) return true;
            if (pmName.includes('aibl') && accName.includes('aibl')) return true;
            if (pmName.includes('islami') && accName.includes('islami')) return true;
            if (pmName.includes('dutch') && accName.includes('dutch')) return true;
            if (pmName.includes('eastern') && accName.includes('eastern')) return true;
        }

        // MFS-specific name match
        if (pm.type === 'mfs') {
            if (pmName.includes('bkash') && accName.includes('bkash') && !accName.includes('nagad')) return true;
            if (pmName.includes('nagad') && accName.includes('nagad') && !accName.includes('bkash')) return true;
            if (pmName.includes('rocket') && accName.includes('rocket')) return true;
            if (pmName.includes('upay') && accName.includes('upay')) return true;
        }

        return false;
    });

    if (matchingAcc) {
        return calculateSingleAccountBalance(matchingAcc, transactions, invoices, projects);
    }

    // 3. Compute directly from transactions specifically matching this payment method
    let liveAmt = 0;
    let hasTxMatch = false;

    // Helper to test if a string matches this PM
    const matchesPmString = (str: string) => {
        if (!str) return false;
        const s = str.toLowerCase().trim();
        if (s === pmName || s === pmId) return true;
        if (pmBank && (s === pmBank || s.includes(pmBank))) return true;
        if (pmAccountNo && s.includes(pmAccountNo)) return true;

        // Specific channel keyword matching
        if (pmName.includes('ucb') && s.includes('ucb')) return true;
        if (pmName.includes('aibl') && s.includes('aibl')) return true;
        if (pmName.includes('city') && s.includes('city')) return true;
        if (pmName.includes('southeast') && s.includes('southeast')) return true;
        if (pmName.includes('brac') && s.includes('brac')) return true;
        if (pmName.includes('bkash') && s.includes('bkash')) return true;
        if (pmName.includes('nagad') && s.includes('nagad')) return true;
        if (pmName.includes('rocket') && s.includes('rocket')) return true;
        if (pmName.includes('upay') && s.includes('upay')) return true;

        return false;
    };

    (transactions || []).forEach((tx) => {
        const pAcc = (tx.paymentAccount || tx.account || tx.accountHead || tx.paymentMethod || '').toLowerCase().trim();
        const head = (tx.accountHead || '').toLowerCase().trim();
        const desc = (tx.description || '').toLowerCase();

        if (matchesPmString(pAcc) || matchesPmString(head) || (pAcc === '' && matchesPmString(desc))) {
            hasTxMatch = true;
            if (tx.type === 'INCOME') liveAmt += tx.amount;
            else if (tx.type === 'EXPENSE') liveAmt -= tx.amount;
        }
    });

    // 4. Reconcile invoices with splitPayments or direct paymentMethod for this PM
    const recordedInvoiceRefs = new Set(
        (transactions || [])
            .filter((t) => t.type === 'INCOME' && t.refNo)
            .map((t) => (t.refNo || '').toLowerCase().trim())
    );

    (invoices || []).forEach((inv) => {
        const invRef = (inv.invoiceNo || '').toLowerCase().trim();
        if (invRef && recordedInvoiceRefs.has(invRef)) return;

        if (inv.splitPayments) {
            Object.entries(inv.splitPayments).forEach(([key, val]) => {
                const amt = Number(val) || 0;
                if (amt <= 0) return;
                if (key === pm.id || matchesPmString(key)) {
                    hasTxMatch = true;
                    liveAmt += amt;
                }
            });
        } else if ((inv.paidAmount || 0) > 0) {
            const m = (inv.paymentMethod || '').toLowerCase().trim();
            if (matchesPmString(m)) {
                hasTxMatch = true;
                liveAmt += Number(inv.paidAmount) || 0;
            }
        }
    });

    // If transactions or invoices matched this method, return the calculated live balance
    if (hasTxMatch) {
        return Math.max(0, liveAmt);
    }

    // 5. Special fallback ONLY for standard predefined bKash and Nagad if they were seeded in accountBalances
    if (accountBalances) {
        if (pmName.includes('bkash') && accountBalances.bkash !== undefined) {
            return accountBalances.bkash || 0;
        }
        if (pmName.includes('nagad') && accountBalances.nagad !== undefined) {
            return accountBalances.nagad || 0;
        }
    }

    // For any newly created or custom bank/MFS/gateway with 0 transactions, its balance is 0!
    // NEVER fall back to the total bank balance (accountBalances.bank) or total mobile balance!
    return Math.max(0, liveAmt);
};

/**
 * Extracts bank accounts with their individual balances
 */
export const getBankAccountsBreakdown = (
    chartOfAccounts: ChartOfAccount[] = [],
    transactions: AccountingTransaction[] = [],
    invoices: SalesInvoice[] = [],
    projects: any[] = []
): Array<{ id: string; code: string; name: string; balance: number }> => {
    const isMobile = (name: string) => {
        const n = name.toLowerCase();
        return n.includes('bkash') || n.includes('nagad') || n.includes('rocket') || n.includes('wallet') || n.includes('mobile') || n.includes('mfs') || n.includes('বিকাশ') || n.includes('নগদ');
    };

    const isBank = (acc: ChartOfAccount) => {
        if (acc.classification !== 'Asset') return false;
        if (isMobile(acc.name)) return false;
        const n = acc.name.toLowerCase();
        return n.includes('bank') || n.includes('plc') || n.includes('city') || n.includes('southeast') || n.includes('brac') || n.includes('eastern') || n.includes('ব্যাংক') || acc.code === '1004' || acc.code === '1005' || acc.code === '1020' || acc.code === '1030';
    };

    const bankAccs = chartOfAccounts.filter(isBank);
    return bankAccs.map((acc) => ({
        id: acc.id,
        code: acc.code,
        name: acc.name,
        balance: calculateSingleAccountBalance(acc, transactions, invoices, projects),
    }));
};

/**
 * Extracts MFS accounts with their individual balances
 */
export const getMfsAccountsBreakdown = (
    chartOfAccounts: ChartOfAccount[] = [],
    transactions: AccountingTransaction[] = [],
    invoices: SalesInvoice[] = [],
    projects: any[] = []
): {
    bkash: number;
    nagad: number;
    total: number;
    accounts: Array<{ id: string; code: string; name: string; balance: number }>;
} => {
    const isMfs = (acc: ChartOfAccount) => {
        if (acc.classification !== 'Asset') return false;
        const n = acc.name.toLowerCase();
        return n.includes('bkash') || n.includes('nagad') || n.includes('rocket') || n.includes('wallet') || n.includes('mobile') || n.includes('mfs') || n.includes('বিকাশ') || n.includes('নগদ') || acc.code === '1006' || acc.code === '1007' || acc.code === '1040';
    };

    const mfsAccs = chartOfAccounts.filter(isMfs);
    let bkash = 0;
    let nagad = 0;
    const accounts = mfsAccs.map((acc) => {
        const bal = calculateSingleAccountBalance(acc, transactions, invoices, projects);
        const n = acc.name.toLowerCase();
        if (n.includes('bkash') || (acc.nameBn && acc.nameBn.includes('বিকাশ'))) {
            bkash += bal;
        } else if (n.includes('nagad') || (acc.nameBn && acc.nameBn.includes('নগদ'))) {
            nagad += bal;
        }
        return {
            id: acc.id,
            code: acc.code,
            name: acc.name,
            balance: bal,
        };
    });

    return {
        bkash,
        nagad,
        total: bkash + nagad,
        accounts,
    };
};

/**
 * Extracts Cash accounts with their individual balances
 */
export const getCashAccountsBreakdown = (
    chartOfAccounts: ChartOfAccount[] = [],
    transactions: AccountingTransaction[] = [],
    invoices: SalesInvoice[] = [],
    projects: any[] = []
): {
    total: number;
    officeCash: number;
    factoryCash: number;
    accounts: Array<{ id: string; code: string; name: string; balance: number }>;
} => {
    const isCash = (acc: ChartOfAccount) => {
        if (acc.classification !== 'Asset') return false;
        const n = acc.name.toLowerCase();
        if (n.includes('bkash') || n.includes('nagad') || n.includes('rocket') || n.includes('bank') || n.includes('plc')) return false;
        return (
            n.includes('cash') ||
            (acc.nameBn && acc.nameBn.includes('ক্যাশ')) ||
            n.includes('counter') ||
            n.includes('drawer') ||
            acc.code === '1001' ||
            acc.code === '1010' ||
            acc.code === '1020'
        );
    };

    const cashAccs = chartOfAccounts.filter(isCash);
    let officeCash = 0;
    let factoryCash = 0;
    let total = 0;
    const accounts = cashAccs.map((acc) => {
        const bal = calculateSingleAccountBalance(acc, transactions, invoices, projects);
        total += bal;
        const n = acc.name.toLowerCase();
        if (n.includes('factory') || acc.code === '1020') {
            factoryCash += bal;
        } else {
            officeCash += bal;
        }
        return {
            id: acc.id,
            code: acc.code,
            name: acc.name,
            balance: bal,
        };
    });

    return {
        total,
        officeCash,
        factoryCash,
        accounts,
    };
};

/**
 * Checks whether an accounting transaction is linked to an existing sales invoice or receivable collection
 * (e.g. POS invoice payments, automated invoice payment sync, client due collection).
 * These transactions represent collections of accounts receivable, rather than new sales revenue.
 */
export const isInvoiceTransaction = (tx: Partial<AccountingTransaction>): boolean => {
    if (!tx) return false;
    // Strictly exclude any project transactions, project due collections, and project vouchers
    if (isProjectTransaction(tx) || isProjectDueCollectionTransaction(tx)) return false;
    const cat = (tx.category || '').toLowerCase();
    if (cat.includes('project')) return false;

    const ref = (tx.refNo || '').toUpperCase();
    const desc = (tx.description || '').toLowerCase();
    const id = (tx.id || '').toLowerCase();

    if (id.startsWith('tx-prj-')) return false;
    if (ref.startsWith('COL-') || ref.startsWith('PRJ-')) return false;
    if (desc.includes('project due') || desc.includes('project sales') || desc.includes('project expense')) return false;

    if (id.startsWith('tx-auto-inv')) return true;
    if (ref.startsWith('DCC-INV-') || ref.startsWith('INV-')) return true;
    if (cat === 'sales revenue') return true;
    if (cat.includes('due collection') || cat.includes('pos payment') || cat.includes('invoice payment')) return true;
    if (desc.includes('sales invoice payment') || desc.includes('due collection against invoice') || desc.includes('pos payment') || desc.includes('invoice payment')) return true;
    return false;
};

/**
 * Checks whether an accounting transaction is linked to a project sales billing, collection or expense
 */
export const isProjectTransaction = (tx: Partial<AccountingTransaction>): boolean => {
    if (!tx) return false;
    const ref = (tx.refNo || '').toUpperCase();
    const desc = (tx.description || '').toLowerCase();
    const cat = (tx.category || '').toLowerCase();
    const id = (tx.id || '').toLowerCase();

    if (id.startsWith('tx-prj-')) return true;
    if (ref.startsWith('PRJ-') || ref.startsWith('COL-')) return true;
    if (cat.includes('project')) return true;
    if (desc.includes('project income') || desc.includes('project sales') || desc.includes('project expense') || desc.includes('project due')) return true;
    return false;
};

/**
 * Checks whether an accounting transaction is a customer advance adjustment
 * (an internal non-cash offset of an invoice against previously collected customer advance liability).
 * This is an internal settlement, NOT a new cash inflow or duplicate sales revenue.
 */
export const isAdvanceAdjustmentTransaction = (tx: Partial<AccountingTransaction>): boolean => {
    if (!tx) return false;
    const cat = (tx.category || '').toLowerCase();
    const desc = (tx.description || '').toLowerCase();
    const acc = (tx.paymentAccount || tx.account || tx.accountHead || '').toLowerCase();
    return (
        cat.includes('advance adjust') ||
        cat.includes('অগ্রিম সমন্বয়') ||
        cat.includes('customer advance adjustment') ||
        desc.includes('advance adjust') ||
        desc.includes('adjusted from advance') ||
        desc.includes('adjusted tk') ||
        acc === 'customer advance' ||
        acc.includes('customer advance') ||
        acc.includes('কাস্টমার অগ্রিম')
    );
};

/**
 * Checks whether an accounting transaction is an advance deposit receipt from a customer
 * (liability deposit, NOT direct sales revenue).
 */
export const isAdvanceDepositTransaction = (tx: Partial<AccountingTransaction>): boolean => {
    if (!tx) return false;
    if (isAdvanceAdjustmentTransaction(tx)) return false;
    const cat = (tx.category || '').toLowerCase();
    const desc = (tx.description || '').toLowerCase();
    return (
        cat.includes('customer advance') ||
        cat.includes('কাস্টমার অগ্রিম') ||
        (cat.includes('advance') && !cat.includes('adjust')) ||
        (cat.includes('অগ্রিম') && !cat.includes('সমন্বয়')) ||
        desc.includes('advance received') ||
        desc.includes('অগ্রিম গ্রহণ')
    );
};

/**
 * Checks whether an accounting transaction is a project due collection
 * (cash/bank receipt settling an existing project receivable, NOT new project sales revenue).
 */
export const isProjectDueCollectionTransaction = (tx: Partial<AccountingTransaction>): boolean => {
    if (!tx) return false;
    const cat = (tx.category || '').toLowerCase();
    const desc = (tx.description || '').toLowerCase();
    const ref = (tx.refNo || '').toUpperCase();
    const id = (tx.id || '').toLowerCase();
    return (
        id.startsWith('tx-prj-col') ||
        ref.startsWith('COL-') ||
        cat.includes('project due collection') ||
        cat.includes('project due') ||
        desc.includes('project due collected') ||
        desc.includes('project due collection')
    );
};

/**
 * Checks whether an accounting transaction is an unpaid credit / due receivable booking.
 * These transactions represent unpaid credit billings, NOT cash inflows in the financial ledger.
 */
export const isDueReceivableTransaction = (tx: Partial<AccountingTransaction>): boolean => {
    if (!tx) return false;
    const cat = (tx.category || '').toLowerCase();
    const desc = (tx.description || '').toLowerCase();
    const acc = (tx.paymentAccount || tx.account || tx.accountHead || '').toLowerCase();
    const method = (tx.paymentMethod || '').toLowerCase();
    return (
        method === 'due' ||
        method.includes('receivable') ||
        acc === 'accounts receivable' ||
        acc.includes('accounts receivable') ||
        acc.includes('প্রাপ্য হিসাব') ||
        desc.endsWith('(due)') ||
        desc.includes('(due)') ||
        desc.includes(' (due)')
    );
};


/**
 * Checks whether an invoice belongs to a specific customer record (matches by id, phone, or name/company)
 */
export const isInvoiceMatchingCustomer = (inv: Partial<SalesInvoice>, c: any): boolean => {
    if (!inv || !c) return false;
    if (inv.customerId && c.id) {
        return inv.customerId === c.id;
    }

    const cPhone = (c.phone || '').replace(/[^0-9]/g, '');
    const invPhone = (inv.customerPhone || '').replace(/[^0-9]/g, '');
    if (cPhone.length >= 8 && invPhone.length >= 8 && (cPhone === invPhone || cPhone.endsWith(invPhone) || invPhone.endsWith(cPhone))) {
        return true;
    }

    const cName = (c.name || '').toLowerCase().trim();
    const cCompany = (c.company || '').toLowerCase().trim();
    const invName = (inv.customerName || '').toLowerCase().trim();
    const invCompany = (inv.customerCompany || '').toLowerCase().trim();

    if (invCompany && cCompany && (invCompany === cCompany || invCompany.includes(cCompany) || cCompany.includes(invCompany))) return true;
    if (cCompany && invName && (invName.includes(cCompany) || cCompany.includes(invName))) return true;
    if (cName && invName && (invName === cName || invName.includes(cName) || cName.includes(invName))) return true;

    return false;
};

/**
 * Calculates live financial summary for a customer based on all matching sales invoices
 */
export const getCustomerInvoiceSummary = (c: any, allInvoices: SalesInvoice[]) => {
    const clientInvoices = (allInvoices || []).filter(inv => isInvoiceMatchingCustomer(inv, c));

    const totalPurchased = clientInvoices.length > 0
        ? clientInvoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0)
        : (Number(c.totalPurchased) || 0);

    const totalPaid = clientInvoices.length > 0
        ? clientInvoices.reduce((sum, inv) => sum + (Number(inv.paidAmount) || 0), 0)
        : Math.max(0, (Number(c.totalPurchased) || 0) - (Number(c.dueAmount) || 0));

    const dueAmount = clientInvoices.length > 0
        ? clientInvoices.reduce((sum, inv) => sum + (Number(inv.dueAmount) || 0), 0)
        : (Number(c.dueAmount) || 0);

    const advanceBalance = Number(c.advanceBalance) || 0;

    return {
        clientInvoices,
        totalPurchased,
        totalPaid,
        dueAmount,
        advanceBalance,
    };
};

export interface InvoicePaymentItem {
    id: string;
    date: string;
    channel: string;
    amount: number;
    description: string;
    category?: string;
}

/**
 * Extracts all itemized payment records for a given invoice from accounting transactions and splitPayments
 */
export const getInvoicePayments = (
    inv: SalesInvoice,
    allTransactions: AccountingTransaction[],
    paymentMethods?: PaymentMethodConfig[]
): InvoicePaymentItem[] => {
    if (!inv) return [];
    const invNo = (inv.invoiceNo || '').toLowerCase().trim();

    // 1. Check matching income ledger transactions
    const txMatches = (allTransactions || []).filter(t =>
        t.type === 'INCOME' &&
        t.refNo &&
        t.refNo.toLowerCase().trim() === invNo &&
        Number(t.amount) > 0
    );

    if (txMatches.length > 0) {
        return txMatches.map(t => ({
            id: t.id,
            date: t.date,
            channel: t.paymentAccount || t.accountHead || 'Cash',
            amount: Number(t.amount) || 0,
            description: t.description || t.category || 'Payment',
            category: t.category,
        }));
    }

    // 2. Check splitPayments on invoice
    if (inv.splitPayments && Object.keys(inv.splitPayments).length > 0) {
        const list: InvoicePaymentItem[] = [];
        const seen = new Set<string>();

        const keys = Object.keys(inv.splitPayments).filter(k => {
            const lk = k.toLowerCase();
            return lk !== 'due' && (Number(inv.splitPayments?.[k]) || 0) > 0;
        });

        // Pass 1: Named accounts
        keys.forEach(k => {
            const amt = Number(inv.splitPayments?.[k]) || 0;
            const lk = k.toLowerCase();
            if (['cash', 'card', 'bkash', 'nagad'].includes(lk)) return;
            const pm = paymentMethods?.find(p => p.id === k);
            const channelName = pm ? pm.name : k;
            if (!seen.has(channelName.toLowerCase())) {
                seen.add(channelName.toLowerCase());
                list.push({
                    id: `split-${channelName}`,
                    date: inv.date,
                    channel: channelName,
                    amount: amt,
                    description: `POS Payment via ${channelName}`,
                });
            }
        });

        // Pass 2: Aliases if list is empty
        if (list.length === 0) {
            keys.forEach(k => {
                const amt = Number(inv.splitPayments?.[k]) || 0;
                const channelName = k.charAt(0).toUpperCase() + k.slice(1);
                if (!seen.has(channelName.toLowerCase())) {
                    seen.add(channelName.toLowerCase());
                    list.push({
                        id: `split-${channelName}`,
                        date: inv.date,
                        channel: channelName,
                        amount: amt,
                        description: `POS Payment via ${channelName}`,
                    });
                }
            });
        }

        if (list.length > 0) return list;
    }

    // 3. Fallback to single paymentMethod if paidAmount > 0
    if ((inv.paidAmount || 0) > 0) {
        return [{
            id: `pm-${inv.id}`,
            date: inv.date,
            channel: inv.paymentMethod || 'Cash',
            amount: inv.paidAmount,
            description: `Payment via ${inv.paymentMethod || 'Cash'}`,
        }];
    }

    return [];
};

/**
 * Calculates dynamic real-time Accounts Receivable (Customer Dues) from Sales Invoices, Projects and unlinked Customer records
 */
export const calculateTotalCustomerReceivables = (
    invoices: SalesInvoice[] = [],
    customers: any[] = [],
    projects: any[] = []
): number => {
    // Build set of invoice numbers / IDs linked to projects to prevent double-counting
    const projectLinkedInvoiceNos = new Set<string>();
    const projectLinkedInvoiceIds = new Set<string>();
    if (projects && Array.isArray(projects)) {
        projects.forEach((p: any) => {
            if (p.id) projectLinkedInvoiceIds.add(p.id);
            if (p.invoiceId) projectLinkedInvoiceIds.add(p.invoiceId);
            if (p.invoiceNo) projectLinkedInvoiceNos.add(p.invoiceNo.toLowerCase().trim());
            (p.salesItems || []).forEach((s: any) => {
                if (s.invoiceNo) projectLinkedInvoiceNos.add(s.invoiceNo.toLowerCase().trim());
            });
        });
    }

    // 1. Authoritative customer receivables are strictly the outstanding due amounts on active sales invoices (excluding project-linked invoices)
    const totalInvoiceDue = (invoices || []).filter(inv => {
        const invNo = (inv.invoiceNo || '').toLowerCase().trim();
        const isLinkedToProject = Boolean(
            inv.projectId ||
            inv.projectCode ||
            projectLinkedInvoiceIds.has(inv.id) ||
            (invNo && projectLinkedInvoiceNos.has(invNo))
        );
        return !isLinkedToProject;
    }).reduce((sum, inv) => sum + (Number(inv.dueAmount) || 0), 0);

    // 2. Authoritative customer receivables from Project Sales items
    const totalProjectDue = (projects || []).reduce((sum, p: any) => {
        let pDue = 0;
        if (p.totalDue !== undefined && typeof p.totalDue === 'number' && p.totalDue > 0) {
            pDue = Number(p.totalDue);
        } else if (p.salesItems && p.salesItems.length > 0) {
            p.salesItems.forEach((s: any) => {
                if (s.dueAmount !== undefined) {
                    pDue += Number(s.dueAmount) || 0;
                } else {
                    const breakdowns = s.paymentBreakdown || [];
                    const dueRow = breakdowns.find((b: any) => {
                        const m = (b.method || '').toLowerCase();
                        return m.includes('due') || m.includes('receivable');
                    });
                    const dueInitial = dueRow ? Number(dueRow.amount) || 0 : 0;
                    const pastCollections = (s.collections || []).reduce((csum: number, c: any) => csum + (Number(c.amount) || 0), 0);
                    pDue += Math.max(0, dueInitial - pastCollections);
                }
            });
        }
        return sum + pDue;
    }, 0);

    // 3. Add unlinked customer opening dues (only for customers who have NO invoices and NO projects in the system)
    const seenCustomerKeys = new Set<string>();
    const unlinkedCustomerDue = (customers || []).reduce((sum, c) => {
        // Check if customer has any matching invoices in the system
        const hasMatchingInvoices = (invoices || []).some(inv => isInvoiceMatchingCustomer(inv, c));
        if (hasMatchingInvoices) {
            // Their due is already counted in totalInvoiceDue, so do NOT count again!
            return sum;
        }

        // Check if customer has matching projects in the system
        const hasMatchingProjects = (projects || []).some((p: any) => {
            const cName = (c.name || '').toLowerCase().trim();
            const cPhone = (c.phone || '').trim();
            const pClient = (p.clientName || '').toLowerCase().trim();
            const pPhone = (p.clientPhone || '').trim();
            return (cName && pClient && (cName === pClient || pClient.includes(cName) || cName.includes(pClient))) ||
                   (cPhone && pPhone && cPhone === pPhone);
        });
        if (hasMatchingProjects) {
            return sum;
        }

        // Deduplicate unlinked customers by normalized phone or name to avoid duplicate counting
        const key = (c.phone || c.name || c.company || c.id || '').toLowerCase().trim();
        if (key && seenCustomerKeys.has(key)) return sum;
        if (key) seenCustomerKeys.add(key);

        return sum + (Number(c.dueAmount) || 0);
    }, 0);

    return totalInvoiceDue + totalProjectDue + unlinkedCustomerDue;
};

/**
 * Calculates dynamic real-time Accounts Payable (Suppliers) due from Suppliers and Purchase Orders
 */
export const calculateTotalSupplierPayables = (
    suppliers: Supplier[] = [],
    purchaseOrders: PurchaseOrder[] = []
): number => {
    // If purchase orders exist in system, active supplier payables are strictly the dues from Received POs
    if (purchaseOrders && purchaseOrders.length > 0) {
        return purchaseOrders
            .filter((p) => p.status === 'Received')
            .reduce((sum, p) => {
                const due = p.dueAmount !== undefined
                    ? Number(p.dueAmount)
                    : Math.max(0, (Number(p.grandTotal ?? p.totalAmount ?? 0)) - (Number(p.paidAmount || 0)));
                return sum + due;
            }, 0);
    }

    // Fallback if no purchase orders exist in the system yet
    return (suppliers || []).reduce((sum, s) => sum + (Number(s.dueAmount) || Number(s.balancePayable) || 0), 0);
};

/**
 * Calculates dynamic real-time Raw Materials & Inventory Asset balance from Products, Purchase Orders, Opening Balance & Journal Entries
 */
export const calculateInventoryValuation = (
    products: ProductItem[] = [],
    purchaseOrders: PurchaseOrder[] = [],
    account?: ChartOfAccount,
    journalEntries: JournalEntry[] = []
): number => {
    const totalStockValuation = (products || []).reduce(
        (acc, p) => acc + ((Number(p.stockFactory) || 0) + (Number(p.stockOffice) || 0)) * (Number(p.costPrice) || 0),
        0
    );
    const rawStockValuation = (products || [])
        .filter((p) => p.isRawMaterial)
        .reduce(
            (acc, p) => acc + ((Number(p.stockFactory) || 0) + (Number(p.stockOffice) || 0)) * (Number(p.costPrice) || 0),
            0
        );
    const finishedStockValuation = (products || [])
        .filter((p) => !p.isRawMaterial)
        .reduce(
            (acc, p) => acc + ((Number(p.stockFactory) || 0) + (Number(p.stockOffice) || 0)) * (Number(p.costPrice) || 0),
            0
        );

    // Total purchase value of received POs
    const totalReceivedPurchases = (purchaseOrders || [])
        .filter((p) => p.status === 'Received')
        .reduce((acc, po) => acc + Number(po.grandTotal ?? po.totalAmount ?? 0), 0);

    const nameLower = (account?.name || '').toLowerCase();
    const nameBn = (account?.nameBn || '').toLowerCase();
    const isFinishedOnly = (account?.code === '1070' || nameLower.includes('finished goods') || nameBn.includes('প্রস্তুতকৃত পণ্য')) && !nameLower.includes('raw');

    // Calculate net adjustment from posted Journal Entries
    // For Raw Materials & Inventory asset:
    // - Debit to Raw Materials & Inventory adds to asset (+amt)
    // - Credit to Raw Materials & Inventory subtracts from asset (-amt)
    // - Debit to Cost of Goods Sold (COGS) consumes/expenses raw materials (-amt)
    let journalDelta = 0;
    const accId = account?.id;
    const accCode = account?.code;
    const accNameLower = (account?.name || '').toLowerCase().trim();

    (journalEntries || []).forEach((j) => {
        // Exclude project revenue/expense journals
        if (j.source === 'PROJECT_SALES' || j.source === 'PROJECT_EXPENSE') return;

        const dName = (j.debitAccountName || '').toLowerCase().trim();
        const cName = (j.creditAccountName || '').toLowerCase().trim();

        const isCogsDebit = Boolean(
            dName.includes('cost of goods') ||
            dName.includes('cogs') ||
            (dName.includes('raw material') && (dName.includes('cost') || dName.includes('expense') || dName.includes('sold'))) ||
            dName.includes('বিক্রিত পণ্যের ব্যয়')
        );

        const isAssetDebit = !isCogsDebit && Boolean(
            (accId && j.debitAccountId === accId) ||
            (accCode && (j.debitAccountId === accCode || (j as any).debitAccountCode === accCode)) ||
            (dName && (
                dName === accNameLower ||
                (!dName.includes('cost') && !dName.includes('sold') && !dName.includes('expense') && (
                    (accNameLower.includes('raw material') && dName.includes('raw material')) ||
                    (accNameLower.includes('inventory') && dName.includes('inventory'))
                ))
            ))
        );

        const isAssetCredit = Boolean(
            (accId && j.creditAccountId === accId) ||
            (accCode && (j.creditAccountId === accCode || (j as any).creditAccountCode === accCode)) ||
            (cName && (
                cName === accNameLower ||
                (!cName.includes('cost') && !cName.includes('sold') && !cName.includes('expense') && (
                    (accNameLower.includes('raw material') && cName.includes('raw material')) ||
                    (accNameLower.includes('inventory') && cName.includes('inventory'))
                ))
            ))
        );

        const amt = Number(j.amount) || 0;
        if (isAssetDebit && !isAssetCredit) {
            journalDelta += amt;
        } else if (isAssetCredit && !isAssetDebit) {
            journalDelta -= amt;
        } else if (isCogsDebit && !isAssetDebit) {
            // Materials expensed into Cost of Goods Sold reduce remaining raw materials inventory valuation
            journalDelta -= amt;
        }
    });

    if (isFinishedOnly) {
        return Math.max(0, finishedStockValuation + (account?.openingBalance || 0) + journalDelta);
    }

    // For Raw Materials or unified Raw Materials & Inventory account (like 1002 / 1060):
    const effectiveStockVal = rawStockValuation > 0 ? rawStockValuation : totalStockValuation;
    const baseVal = Math.max(
        effectiveStockVal,
        totalReceivedPurchases,
        totalStockValuation,
        account?.openingBalance || 0
    );

    return Math.max(0, baseVal + journalDelta);
};
