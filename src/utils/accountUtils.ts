import { ChartOfAccount, AccountingTransaction, SalesInvoice, PaymentMethodConfig, AccountBalances, Supplier, PurchaseOrder, ProductItem, JournalEntry, Project, ExpenseHead } from '../types';

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

    // 2. Match by exact account name or Bengali name
    found = chartOfAccounts.find(a => a.name.toLowerCase() === lower || (a.nameBn && a.nameBn.toLowerCase() === lower));
    if (found) return found;

    // 3. Check if channelNameOrId corresponds to a PaymentMethodConfig
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
    projects: any[] = [],
    journalEntries: JournalEntry[] = []
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

    // 1. Sum up all matched ledger transactions with safeguard against duplicate invoice payments
    const seenInvoiceChannelSums = new Map<string, number>();
    const invRecordedForThisAcc = new Map<string, number>();

    (transactions || []).forEach((tx) => {
        if (doesTransactionMatchAccount(tx, acc)) {
            if (tx.type === 'INCOME') {
                const ref = (tx.refNo || '').toLowerCase().trim();
                const amt = Number(tx.amount) || 0;
                if (ref) {
                    const invoiceKey = `${ref}_${acc.id || acc.code || acc.name}`;
                    const linkedInv = (invoices || []).find(i => (i.invoiceNo || '').toLowerCase().trim() === ref);
                    if (linkedInv) {
                        const currentSum = seenInvoiceChannelSums.get(invoiceKey) || 0;
                        const maxAllowed = Number(linkedInv.paidAmount) || 0;
                        if (currentSum + amt > maxAllowed && currentSum > 0) {
                            return; // skip duplicate transaction contribution!
                        }
                        seenInvoiceChannelSums.set(invoiceKey, currentSum + amt);
                    }
                    invRecordedForThisAcc.set(ref, (invRecordedForThisAcc.get(ref) || 0) + amt);
                    const numPart = ref.replace(/\D/g, '');
                    if (numPart && numPart.length >= 4) {
                        invRecordedForThisAcc.set(numPart, (invRecordedForThisAcc.get(numPart) || 0) + amt);
                    }
                }
                balance += tx.amount;
            } else if (tx.type === 'EXPENSE') {
                balance -= tx.amount;
            }
        }
    });

    // 2. Reconcile sales invoices with splitPayments or paymentMethod that might not have a ledger tx record
    const getRecordedAmtForThisAcc = (invNo: string): number => {
        if (!invNo) return 0;
        const r = invNo.toLowerCase().trim();
        if (invRecordedForThisAcc.has(r)) return invRecordedForThisAcc.get(r)!;
        const num = r.replace(/\D/g, '');
        if (num && num.length >= 4) {
            if (invRecordedForThisAcc.has(num)) return invRecordedForThisAcc.get(num)!;
            for (const [k, v] of invRecordedForThisAcc.entries()) {
                if (k.length >= 4 && (num.endsWith(k) || k.endsWith(num))) {
                    return v;
                }
            }
        }
        return 0;
    };

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

        const alreadyRecorded = getRecordedAmtForThisAcc(invRef);

        if (inv.splitPayments && Object.keys(inv.splitPayments).length > 0) {
            // Deduplicate split payment channels so alias keys (e.g. 'bKash' and 'bkash') are NEVER summed together
            const channelSplitMap = new Map();
            Object.entries(inv.splitPayments).forEach(([k, v]) => {
                const lk = k.toLowerCase().trim();
                const amt = Number(v) || 0;
                if (lk === 'due' || lk.startsWith('pm-') || amt <= 0) return;

                // Canonical channel key
                const normChannel = (lk === 'cash' || lk === 'cash in hand' || lk === 'cashinhand') ? 'cash'
                    : (lk === 'card' || lk === 'bank' || lk.includes('bank')) ? 'bank'
                    : lk === 'bkash' ? 'bkash'
                    : lk === 'nagad' ? 'nagad'
                    : lk === 'rocket' ? 'rocket'
                    : lk;

                // Take maximum if duplicate alias keys exist for the same channel
                channelSplitMap.set(normChannel, Math.max(channelSplitMap.get(normChannel) || 0, amt));
            });

            let targetAccSplitAmt = 0;
            let isMatched = false;

            channelSplitMap.forEach((amt, normChannel) => {
                let matchesKey = false;
                if (normChannel === accNameLower || (accCode && normChannel.includes(accCode))) {
                    matchesKey = true;
                } else if (isBkash && normChannel === 'bkash') {
                    matchesKey = true;
                } else if (isNagad && normChannel === 'nagad') {
                    matchesKey = true;
                } else if (isCity && normChannel.includes('city')) {
                    matchesKey = true;
                } else if (isSoutheast && normChannel.includes('southeast')) {
                    matchesKey = true;
                } else if (isCash && normChannel === 'cash') {
                    matchesKey = true;
                }

                if (matchesKey) {
                    targetAccSplitAmt += amt;
                    isMatched = true;
                }
            });

            if (isMatched) {
                const unrecordedAmt = Math.max(0, targetAccSplitAmt - alreadyRecorded);
                balance += unrecordedAmt;
            }
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
                const unrecordedAmt = Math.max(0, Number(inv.paidAmount) - alreadyRecorded);
                balance += unrecordedAmt;
            }
        }
    });

    // 3. Reconcile manual journal entries (source === 'MANUAL' or non-synced journal vouchers)
    const recordedInvoiceRefs = new Set(
        (transactions || [])
            .filter((t) => t.type === 'INCOME' && t.refNo)
            .map((t) => (t.refNo || '').toLowerCase().trim())
    );
    const recordedTxRefs = new Set(
        (transactions || [])
            .filter((t) => t.refNo)
            .map((t) => (t.refNo || '').toLowerCase().trim())
    );

    (journalEntries || []).forEach((j) => {
        // Exclude system auto-generated journals that mirror existing transactions to avoid double-counting
        if (
            j.source === 'LEDGER_SYNC' || 
            j.source === 'PROJECT_SALES' || 
            j.source === 'PROJECT_EXPENSE' || 
            j.source === 'EXPENSE' || 
            j.source === 'SALES' || 
            j.source === 'PURCHASE'
        ) return;
        const jRef = (j.refNo || '').toLowerCase().trim();
        if (jRef && (recordedInvoiceRefs.has(jRef) || recordedTxRefs.has(jRef))) return;

        const isDebit = (
            j.debitAccountId === acc.id ||
            j.debitAccountId === acc.code ||
            (j.debitAccountName && j.debitAccountName.toLowerCase().trim() === accNameLower)
        );
        const isCredit = (
            j.creditAccountId === acc.id ||
            j.creditAccountId === acc.code ||
            (j.creditAccountName && j.creditAccountName.toLowerCase().trim() === accNameLower)
        );

        const amt = Number(j.amount) || 0;
        if (isDebit && !isCredit) {
            balance += amt;
        } else if (isCredit && !isDebit) {
            balance -= amt;
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
    projects: any[] = [],
    journalEntries: JournalEntry[] = []
): number => {
    if (!pm) return 0;
    const pmName = (pm.name || '').toLowerCase().trim();
    const pmId = (pm.id || '').toLowerCase().trim();
    const pmBank = (pm.bankName || '').toLowerCase().trim();
    const pmAccountNo = (pm.accountNumber || '').trim();

    // 1. If it's a specific cash method, calculate cash
    if (pm.type === 'cash') {
        if (pmName.includes('factory')) {
            const factoryAcc = (chartOfAccounts || []).find(a => a.classification === 'Asset' && (a.code === '1020' || a.name.toLowerCase().includes('factory')));
            if (factoryAcc) {
                const fBal = calculateSingleAccountBalance(factoryAcc, transactions, invoices, projects, journalEntries);
                if (fBal > 0) return fBal;
                if (factoryAcc.currentBalance !== undefined && factoryAcc.currentBalance !== null && Number(factoryAcc.currentBalance) > 0) {
                    return Number(factoryAcc.currentBalance);
                }
            }
            return accountBalances?.factoryCash || 0;
        }
        const cashAcc = (chartOfAccounts || []).find(a => 
            a.classification === 'Asset' && 
            (a.code === '1001' || a.code === '1010' || a.name.toLowerCase().includes('cash in hand') || a.name.toLowerCase() === 'cash' || (a.nameBn && a.nameBn.includes('ক্যাশ')))
        );
        if (cashAcc) {
            const liveCash = calculateSingleAccountBalance(cashAcc, transactions, invoices, projects, journalEntries);
            if (liveCash > 0) {
                return liveCash;
            }
            if (cashAcc.currentBalance !== undefined && cashAcc.currentBalance !== null && Number(cashAcc.currentBalance) > 0) {
                return Number(cashAcc.currentBalance);
            }
        }
        if (accountBalances?.cash && Number(accountBalances.cash) > 0) {
            return accountBalances.cash;
        }
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
        const bal = calculateSingleAccountBalance(matchingAcc, transactions, invoices, projects, journalEntries);
        if (bal > 0) return bal;
        if (matchingAcc.currentBalance !== undefined && matchingAcc.currentBalance !== null && Number(matchingAcc.currentBalance) > 0) {
            return Number(matchingAcc.currentBalance);
        }
        return bal;
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
    projects: any[] = [],
    journalEntries: JournalEntry[] = []
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
        balance: calculateSingleAccountBalance(acc, transactions, invoices, projects, journalEntries),
    }));
};

/**
 * Extracts MFS accounts with their individual balances
 */
export const getMfsAccountsBreakdown = (
    chartOfAccounts: ChartOfAccount[] = [],
    transactions: AccountingTransaction[] = [],
    invoices: SalesInvoice[] = [],
    projects: any[] = [],
    journalEntries: JournalEntry[] = []
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
        const bal = calculateSingleAccountBalance(acc, transactions, invoices, projects, journalEntries);
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
    projects: any[] = [],
    journalEntries: JournalEntry[] = []
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
        const bal = calculateSingleAccountBalance(acc, transactions, invoices, projects, journalEntries);
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

    // Direct Operating Incomes recorded via INC- voucher are NEVER invoice transactions!
    if (ref.startsWith('INC-') || id.startsWith('tx-inc-')) return false;

    if (id.startsWith('tx-prj-')) return false;
    if (ref.startsWith('COL-') || ref.startsWith('PRJ-')) return false;
    if (desc.includes('project due') || desc.includes('project sales') || desc.includes('project expense')) return false;

    if (id.startsWith('tx-auto-inv')) return true;
    if (ref.startsWith('DCC-INV-') || ref.startsWith('INV-')) return true;
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
    if (desc.includes('project income') || desc.includes('project sales') || desc.includes('project expense') || desc.includes('project due') || desc.includes('project cost')) return true;
    if (Boolean(tx.projectId) || Boolean(tx.projectCode)) return true;
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

    const normChannel = (raw?: string): string => {
        const l = (raw || '').toLowerCase().trim();
        if (l === 'cash' || l === 'cash in hand' || l === 'counter cash' || l === 'pm-cash' || l.includes('cash in hand') || (l.includes('cash') && !l.includes('bkash') && !l.includes('nagad'))) {
            return 'Cash in Hand';
        }
        if (l.includes('bkash')) return 'bKash';
        if (l.includes('nagad')) return 'Nagad';
        if (l.includes('rocket')) return 'Rocket';
        if (l.includes('city')) return 'City Bank PLC';
        if (l.includes('southeast')) return 'Southeast Bank';
        if (l.includes('brac')) return 'BRAC Bank';
        if (l.includes('bank') || l.includes('card')) return 'Bank Account';
        return raw || 'Cash in Hand';
    };

    const resultList: InvoicePaymentItem[] = [];
    const seenChannels = new Set<string>();
    let accumulatedPaid = 0;
    const maxPaid = Number(inv.paidAmount) || 0;

    // 1. Check matching income ledger transactions
    const txMatches = (allTransactions || []).filter(t =>
        t.type === 'INCOME' &&
        t.refNo &&
        t.refNo.toLowerCase().trim() === invNo &&
        Number(t.amount) > 0
    );

    if (txMatches.length > 0) {
        txMatches.forEach(t => {
            const ch = normChannel(t.paymentAccount || t.accountHead);
            const amt = Number(t.amount) || 0;
            const normKey = ch.toLowerCase();
            if (seenChannels.has(normKey)) return; // duplicate channel
            if (maxPaid > 0 && accumulatedPaid + amt > maxPaid && accumulatedPaid > 0) return;
            seenChannels.add(normKey);
            accumulatedPaid += amt;
            resultList.push({
                id: t.id,
                date: t.date,
                channel: ch,
                amount: amt,
                description: t.description || t.category || 'Payment',
                category: t.category,
            });
        });
    }

    // 2. Check splitPayments on invoice for any channels not already covered by transactions
    if (inv.splitPayments && Object.keys(inv.splitPayments).length > 0) {
        const splitKeys = Object.keys(inv.splitPayments).filter(k => {
            const lk = k.toLowerCase();
            return lk !== 'due' && (Number(inv.splitPayments?.[k]) || 0) > 0;
        });

        // Pass 1: Named accounts (skip alias keys like 'cash', 'card', 'bkash', 'nagad' if specific names exist)
        const hasNamedAccounts = splitKeys.some(k => !['cash', 'card', 'bkash', 'nagad'].includes(k.toLowerCase()));
        const effectiveKeys = hasNamedAccounts
            ? splitKeys.filter(k => !['cash', 'card', 'bkash', 'nagad'].includes(k.toLowerCase()))
            : splitKeys;

        effectiveKeys.forEach(k => {
            const amt = Number(inv.splitPayments?.[k]) || 0;
            if (amt <= 0) return;

            const pm = paymentMethods?.find(p => p.id === k);
            const rawChannel = pm ? pm.name : (k.charAt(0).toUpperCase() + k.slice(1));
            const ch = normChannel(rawChannel);
            const normKey = ch.toLowerCase();

            if (!seenChannels.has(normKey)) {
                if (maxPaid > 0 && accumulatedPaid + amt > maxPaid && accumulatedPaid > 0) return;
                seenChannels.add(normKey);
                accumulatedPaid += amt;
                resultList.push({
                    id: `split-${k}`,
                    date: inv.date,
                    channel: ch,
                    amount: amt,
                    description: `POS Payment via ${ch}`,
                });
            }
        });
    }

    // 3. Fallback to single paymentMethod if resultList is still empty and paidAmount > 0
    if (resultList.length === 0 && (inv.paidAmount || 0) > 0) {
        const ch = normChannel(inv.paymentMethod || 'Cash');
        return [{
            id: `pm-${inv.id}`,
            date: inv.date,
            channel: ch,
            amount: inv.paidAmount,
            description: `Payment via ${ch}`,
        }];
    }

    return resultList;
};

export interface PurchaseOrderPaymentItem {
    id: string;
    date: string;
    channel: string;
    amount: number;
    description: string;
    category?: string;
    refNo?: string;
}

/**
 * Extracts all itemized payment records for a given purchase order from accounting transactions,
 * journal entries, and purchase order payment method configuration.
 */
export const getPurchaseOrderPayments = (
    po: PurchaseOrder,
    allTransactions: AccountingTransaction[] = [],
    journalEntries: JournalEntry[] = [],
    paymentMethods?: PaymentMethodConfig[]
): PurchaseOrderPaymentItem[] => {
    if (!po) return [];
    const poNo = (po.poNo || po.poNumber || '').toLowerCase().trim();
    const poId = (po.id || '').toLowerCase().trim();
    if (!poNo && !poId) return [];

    const normChannel = (raw?: string): string => {
        const l = (raw || '').toLowerCase().trim();
        if (l === 'cash' || l === 'cash in hand' || l === 'counter cash' || l === 'pm-cash' || l.includes('cash in hand') || (l.includes('cash') && !l.includes('bkash') && !l.includes('nagad'))) {
            return 'Cash in Hand';
        }
        if (l.includes('bkash')) return 'bKash';
        if (l.includes('nagad')) return 'Nagad';
        if (l.includes('rocket')) return 'Rocket';
        if (l.includes('city')) return 'City Bank PLC';
        if (l.includes('southeast')) return 'Southeast Bank';
        if (l.includes('brac')) return 'BRAC Bank';
        if (l.includes('bank') || l.includes('card')) return 'Bank Account';
        return raw || 'Cash in Hand';
    };

    const resultList: PurchaseOrderPaymentItem[] = [];
    const seenTxIds = new Set<string>();
    let accumulatedPaid = 0;
    const maxPaid = Number(po.paidAmount) || 0;

    // 1. Check matching expense transactions
    const txMatches = (allTransactions || []).filter(t => {
        if (t.type !== 'EXPENSE' || !(Number(t.amount) > 0)) return false;
        const ref = (t.refNo || '').toLowerCase().trim();
        const desc = (t.description || '').toLowerCase().trim();
        const matchesRef = Boolean((poNo && (ref === poNo || ref.includes(poNo) || poNo.includes(ref))) ||
                                   (poId && ref === poId));
        const matchesDesc = Boolean((poNo && desc.includes(poNo)) || (poId && desc.includes(poId)));
        return matchesRef || matchesDesc;
    });

    if (txMatches.length > 0) {
        txMatches.forEach(t => {
            if (seenTxIds.has(t.id)) return;
            const ch = normChannel(t.paymentAccount || t.accountHead);
            const amt = Number(t.amount) || 0;
            if (maxPaid > 0 && accumulatedPaid + amt > maxPaid && accumulatedPaid > 0) return;
            seenTxIds.add(t.id);
            accumulatedPaid += amt;
            resultList.push({
                id: t.id,
                date: t.date,
                channel: ch,
                amount: amt,
                description: t.description || t.category || 'Purchase Payment',
                category: t.category,
                refNo: t.refNo,
            });
        });
    }

    // 2. Check journal entries if transactions didn't cover the full paidAmount or no transactions found
    if (resultList.length === 0 || (maxPaid > 0 && accumulatedPaid < maxPaid)) {
        const jnlMatches = (journalEntries || []).filter(j => {
            if (Number(j.amount) <= 0) return false;
            const ref = (j.refNo || '').toLowerCase().trim();
            const narr = (j.narration || '').toLowerCase().trim();
            const matchesRef = Boolean((poNo && (ref === poNo || ref.includes(poNo) || poNo.includes(ref))) ||
                                       (poId && ref === poId));
            const matchesNarr = Boolean((poNo && narr.includes(poNo)) || (poId && narr.includes(poId)));
            return matchesRef || matchesNarr;
        });

        jnlMatches.forEach(j => {
            const amt = Number(j.amount) || 0;
            const alreadyInResult = resultList.some(r => Math.abs(r.amount - amt) < 0.01 && r.date === j.date);
            if (alreadyInResult) return;
            if (maxPaid > 0 && accumulatedPaid + amt > maxPaid && accumulatedPaid > 0) return;
            const ch = normChannel(j.creditAccountName);
            accumulatedPaid += amt;
            resultList.push({
                id: j.id,
                date: j.date,
                channel: ch,
                amount: amt,
                description: j.narration || 'Journal Payment',
                refNo: j.refNo,
            });
        });
    }

    // 3. Fallback to single paymentMethod if resultList is still empty and paidAmount > 0
    if (resultList.length === 0 && (po.paidAmount || 0) > 0) {
        const ch = normChannel(po.paymentMethod || 'Cash in Hand');
        return [{
            id: `po-pm-${po.id || po.poNo}`,
            date: po.date || new Date().toISOString().slice(0, 10),
            channel: ch,
            amount: Number(po.paidAmount) || 0,
            description: `Payment via ${ch}`,
        }];
    }

    return resultList;
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
 * Checks if a transaction represents a debt repayment/payment to a supplier against a Purchase Order or supplier due
 */
export const isSupplierPaymentTransaction = (t: AccountingTransaction): boolean => {
    if (!t) return false;
    const cat = (t.category || '').toLowerCase();
    const desc = (t.description || '').toLowerCase();
    const ref = (t.refNo || '').toLowerCase();
    return (
        cat.includes('supplier due') ||
        cat.includes('po payment') ||
        cat.includes('procurement') ||
        desc.includes('payment for purchase order') ||
        desc.includes('payment for po') ||
        desc.includes('payment to supplier') ||
        desc.includes('supplier due payment') ||
        desc.includes('po payment') ||
        ref.startsWith('sup-pay-') ||
        ((ref.includes('po-') || desc.includes('po-')) && (ref.includes('pay') || desc.includes('pay') || cat.includes('procurement')))
    );
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
            .filter((p) => 
                p.status === 'Received' || 
                (p as any).status === 'Received (Partial)' || 
                (p as any).challanStatus === 'Received' || 
                (p as any).challanStatus === 'Received (Partial)'
            )
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
    // Helper to resolve effective unit cost: if product has costPrice <= 1 but was received via a PO with unitCost > 0, use PO unitCost
    const getEffectiveCostPrice = (p: ProductItem): number => {
        const cp = Number(p.costPrice) || 0;
        if (cp > 1) return cp;
        for (const po of purchaseOrders || []) {
            if (po.status === 'Received' || (po as any).challanStatus === 'Received') {
                const match = (po.items || []).find((it: any) => it.productId === p.id || (it.name && it.name.trim() === (p.name || '').trim()));
                const uCost = Number(match?.unitCost ?? (match as any)?.unitPrice ?? (match as any)?.rate) || 0;
                if (uCost > 0) return uCost;
            }
        }
        return cp;
    };

    const totalStockValuation = (products || []).reduce(
        (acc, p) => acc + ((Number(p.stockFactory) || 0) + (Number(p.stockOffice) || 0)) * getEffectiveCostPrice(p),
        0
    );
    const rawStockValuation = (products || [])
        .filter((p) => p.isRawMaterial)
        .reduce(
            (acc, p) => acc + ((Number(p.stockFactory) || 0) + (Number(p.stockOffice) || 0)) * getEffectiveCostPrice(p),
            0
        );
    const finishedStockValuation = (products || [])
        .filter((p) => !p.isRawMaterial)
        .reduce(
            (acc, p) => acc + ((Number(p.stockFactory) || 0) + (Number(p.stockOffice) || 0)) * getEffectiveCostPrice(p),
            0
        );

    // Total purchase value of received POs
    const totalReceivedPurchases = (purchaseOrders || [])
        .filter((p) => 
            p.status === 'Received' || 
            (p as any).status === 'Received (Partial)' || 
            (p as any).challanStatus === 'Received' || 
            (p as any).challanStatus === 'Received (Partial)'
        )
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

        // Purchase order goods receipt / procurement journals do NOT deduct warehouse inventory stock!
        const refUpper = `${j.refNo || ''} ${(j as any).reference || ''} ${j.narration || ''}`.toUpperCase();
        if (refUpper.includes('PO-') || refUpper.includes('DCC-PO-') || j.source === 'PURCHASE') {
            return;
        }

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

    // For Raw Materials (1060 / raw material) or unified Inventory account:
    // Account 1002 is the unified inventory asset account (covering both Raw Materials and Finished Inventory)
    const isUnifiedInventory = account?.code === '1002' || (
        account?.code !== '1060' && 
        account?.code !== '1070' && 
        nameLower.includes('inventory') && 
        (nameLower.includes('raw') || nameLower.includes('&'))
    );
    const isRawOnly = account?.code === '1060' || (
        !isUnifiedInventory && 
        (nameLower.includes('raw material') || nameBn.includes('কাঁচামাল'))
    );

    // When products exist with tracked physical stock, valuation derives strictly from physical stock.
    // If physical product stock is not yet populated, fallback to total received purchases.
    const baseStockVal = isRawOnly ? rawStockValuation : totalStockValuation;
    const baseVal = baseStockVal > 0 ? baseStockVal : totalReceivedPurchases;
    const closingVal = baseVal + (account?.openingBalance || 0);

    return Math.max(0, closingVal + journalDelta);
};

/**
 * Resolves the appropriate Expense account from Chart of Accounts
 * based on an Expense Head, category name, or description/note.
 */
export const resolveExpenseAccount = (
    categoryOrHeadName: string,
    noteOrTitle: string = '',
    chartOfAccounts: ChartOfAccount[] = [],
    expenseHeads: ExpenseHead[] = [],
    allowFallback: boolean = false
): ChartOfAccount | undefined => {
    if (!chartOfAccounts || chartOfAccounts.length === 0) return undefined;

    const catRaw = (categoryOrHeadName || '').trim();
    const catLower = catRaw.toLowerCase();
    const noteLower = (noteOrTitle || '').toLowerCase().trim();
    const combined = `${catLower} ${noteLower}`.trim();

    // 1. If category matches an active Expense Head with a linkedAccountId
    const matchedHead = (expenseHeads || []).find(h => 
        h.isActive && (
            h.id === catRaw ||
            h.code.toLowerCase() === catLower ||
            h.name.toLowerCase().trim() === catLower ||
            (h.nameBn && h.nameBn.trim() === catRaw)
        )
    );

    if (matchedHead && matchedHead.linkedAccountId) {
        const link = matchedHead.linkedAccountId.toLowerCase().trim();
        const linkedCoa = chartOfAccounts.find(a => 
            a.id.toLowerCase() === link || 
            a.code.toLowerCase() === link ||
            a.id.toLowerCase() === `coa-${link}` ||
            a.code.toLowerCase() === link.replace('coa-', '')
        );
        if (linkedCoa) return linkedCoa;
    }

    // 2. Direct exact ID or Name match in Chart of Accounts (classification === 'Expense')
    const exactCoa = chartOfAccounts.find(a => 
        a.classification === 'Expense' && (
            a.id === catRaw ||
            a.name.toLowerCase().trim() === catLower ||
            (a.nameBn && a.nameBn.trim() === catRaw)
        )
    );
    if (exactCoa) return exactCoa;

    // 3. Keyword / Semantic matching across standard business expense categories
    // 3a. Tea, Refreshment, Food, Snacks, Hospitality
    if (combined.includes('tea') || combined.includes('refreshment') || combined.includes('snack') || combined.includes('food') || combined.includes('lunch') || combined.includes('hospitality') || combined.includes('entertainment') || combined.includes('নাস্তা') || combined.includes('আপ্যায়ন')) {
        const acc = chartOfAccounts.find(a => a.classification === 'Expense' && (
            a.name.toLowerCase().includes('hospitality') || 
            a.name.toLowerCase().includes('tea') || 
            a.name.toLowerCase().includes('refreshment') || 
            a.name.toLowerCase().includes('snack') ||
            (a.nameBn && (a.nameBn.includes('আপ্যায়ন') || a.nameBn.includes('চা'))) ||
            a.code === '5090' || 
            a.code === '5204'
        ));
        if (acc) return acc;
    }

    // 3b. Rent & Facility Lease
    if (combined.includes('rent') || combined.includes('lease') || combined.includes('facility') || combined.includes('ভাড়া')) {
        const acc = chartOfAccounts.find(a => a.classification === 'Expense' && (
            a.name.toLowerCase().includes('rent') || 
            a.name.toLowerCase().includes('lease') ||
            (a.nameBn && a.nameBn.includes('ভাড়া')) ||
            a.code === '5200' || 
            a.code === '5050'
        ));
        if (acc) return acc;
    }

    // 3c. Electricity, Generator, Fuel, Power & Utilities
    if (combined.includes('electric') || combined.includes('power') || combined.includes('generator') || combined.includes('diesel') || combined.includes('বিদ্যুৎ')) {
        const acc = chartOfAccounts.find(a => a.classification === 'Expense' && (
            a.name.toLowerCase().includes('electric') || 
            a.name.toLowerCase().includes('power') || 
            a.name.toLowerCase().includes('generator') ||
            (a.nameBn && a.nameBn.includes('বিদ্যুৎ')) ||
            a.code === '5203' || 
            a.code === '5040'
        ));
        if (acc) return acc;
    }

    // 3d. Salaries, Wages, Overtime, Labor, Payroll
    if (combined.includes('salary') || combined.includes('salaries') || combined.includes('wage') || combined.includes('payroll') || combined.includes('overtime') || combined.includes('worker') || combined.includes('labor') || combined.includes('labour') || combined.includes('বেতন') || combined.includes('মজুরি')) {
        const acc = chartOfAccounts.find(a => a.classification === 'Expense' && (
            a.name.toLowerCase().includes('salar') || 
            a.name.toLowerCase().includes('wage') || 
            a.name.toLowerCase().includes('payroll') ||
            (a.nameBn && (a.nameBn.includes('বেতন') || a.nameBn.includes('মজুরি'))) ||
            a.code === '5201' || 
            a.code === '5070'
        ));
        if (acc) return acc;
    }

    // 3e. Internet, Telecom, Software, Mobile, IT
    if (combined.includes('internet') || combined.includes('telecom') || combined.includes('software') || combined.includes('hosting') || combined.includes('mobile') || combined.includes('broadband') || combined.includes('ইন্টারনেট')) {
        const acc = chartOfAccounts.find(a => a.classification === 'Expense' && (
            a.name.toLowerCase().includes('internet') || 
            a.name.toLowerCase().includes('telecom') || 
            a.name.toLowerCase().includes('software') ||
            (a.nameBn && a.nameBn.includes('ইন্টারনেট')) ||
            (a.code === '5202' && !a.name.toLowerCase().includes('hospitality')) || 
            a.code === '5110'
        ));
        if (acc) return acc;
    }

    // 3f. Conveyance, Transport, Fuel, Courier, Delivery Logistics
    if (combined.includes('conveyance') || combined.includes('courier') || combined.includes('delivery') || combined.includes('transport') || combined.includes('logistics') || combined.includes('fare') || combined.includes('যাতায়াত') || combined.includes('গাড়ি ভাড়া')) {
        const acc = chartOfAccounts.find(a => a.classification === 'Expense' && (
            a.name.toLowerCase().includes('conveyance') || 
            a.name.toLowerCase().includes('delivery') || 
            a.name.toLowerCase().includes('courier') || 
            a.name.toLowerCase().includes('transport') ||
            (a.nameBn && a.nameBn.includes('যাতায়াত')) ||
            a.code === '5100' || 
            a.code === '5080'
        ));
        if (acc) return acc;
    }

    // 3g. Machine Maintenance, Servicing, Spare Parts
    if (combined.includes('machine') || combined.includes('maintenance') || combined.includes('servicing') || combined.includes('spare') || combined.includes('repair') || combined.includes('মেরামত')) {
        const acc = chartOfAccounts.find(a => a.classification === 'Expense' && (
            a.name.toLowerCase().includes('maint') || 
            a.name.toLowerCase().includes('servicing') || 
            a.name.toLowerCase().includes('repair') ||
            (a.nameBn && a.nameBn.includes('মেরামত')) ||
            a.code === '5030'
        ));
        if (acc) return acc;
    }

    // 3h. Marketing, Ads & Promotions
    if (combined.includes('market') || combined.includes('ad') || combined.includes('promotion') || combined.includes('campaign') || combined.includes('বিজ্ঞাপন')) {
        const acc = chartOfAccounts.find(a => a.classification === 'Expense' && (
            a.name.toLowerCase().includes('market') || 
            a.name.toLowerCase().includes('promotion') || 
            a.name.toLowerCase().includes('ad') ||
            (a.nameBn && a.nameBn.includes('বিজ্ঞাপন')) ||
            a.code === '5070' ||
            a.code === '5300'
        ));
        if (acc) return acc;
    }

    // 3i. Municipal Tax, Trade License & Legal Fees
    if (combined.includes('tax') || combined.includes('license') || combined.includes('municipal') || combined.includes('vat') || combined.includes('ট্যাক্স') || combined.includes('লাইসেন্স')) {
        const acc = chartOfAccounts.find(a => a.classification === 'Expense' && (
            a.name.toLowerCase().includes('tax') || 
            a.name.toLowerCase().includes('license') ||
            (a.nameBn && (a.nameBn.includes('ট্যাক্স') || a.nameBn.includes('লাইসেন্স'))) ||
            a.code === '5120'
        ));
        if (acc) return acc;
    }

    // 3j. Raw Materials, Factory Consumables, COGS
    if (combined.includes('raw') || combined.includes('cogs') || combined.includes('cost of good') || combined.includes('material') || combined.includes('solvent') || combined.includes('packaging') || combined.includes('বক্স') || combined.includes('কাঁচামাল')) {
        const acc = chartOfAccounts.find(a => a.classification === 'Expense' && (
            a.name.toLowerCase().includes('cost of goods') || 
            a.name.toLowerCase().includes('raw') || 
            a.name.toLowerCase().includes('cogs') ||
            (a.nameBn && a.nameBn.includes('কাঁচামাল')) ||
            a.code === '5001' || 
            a.code === '5010'
        ));
        if (acc) return acc;
    }

    // 3k. Project Expenses (ONLY if category or note specifically indicates Project)
    const isExplicitProject = catLower.includes('project') || noteLower.includes('project') || combined.includes('প্রজেক্ট');
    if (isExplicitProject) {
        const acc = chartOfAccounts.find(a => a.classification === 'Expense' && (
            a.code === '5206' || 
            a.id === 'coa-5206' || 
            a.name.toLowerCase().includes('project') ||
            (a.nameBn && a.nameBn.includes('প্রজেক্ট'))
        ));
        if (acc) return acc;
    }

    // 3l. Miscellaneous & Petty Expenses
    if (combined.includes('misc') || combined.includes('petty') || combined.includes('other') || combined.includes('অন্যান্য')) {
        const acc = chartOfAccounts.find(a => a.classification === 'Expense' && (
            a.name.toLowerCase().includes('misc') || 
            a.name.toLowerCase().includes('petty') ||
            (a.nameBn && a.nameBn.includes('অন্যান্য')) ||
            a.code === '5130'
        ));
        if (acc) return acc;
    }

    // 4. Fallback (only if allowFallback is enabled, e.g. when recording a new expense)
    if (allowFallback) {
        const fallbackGeneral = chartOfAccounts.find(a => 
            a.classification === 'Expense' && 
            !a.name.toLowerCase().includes('project') && 
            a.code !== '5206' &&
            a.id !== 'coa-5206'
        );
        if (fallbackGeneral) return fallbackGeneral;
        return chartOfAccounts.find(a => a.classification === 'Expense') || chartOfAccounts[0];
    }

    return undefined;
};

/**
 * Checks if an accounting transaction belongs to a specific Chart of Accounts expense account
 */
export const doesTransactionMatchExpenseAccount = (
    t: AccountingTransaction,
    acc: ChartOfAccount,
    expenseHeads: ExpenseHead[] = [],
    chartOfAccounts: ChartOfAccount[] = [],
    journalEntries: JournalEntry[] = []
): boolean => {
    if (!t || t.type !== 'EXPENSE' || !acc) return false;

    const accNameLower = (acc.name || '').toLowerCase().trim();
    const accCode = (acc.code || '').trim();
    const accId = (acc.id || '').trim();
    const isProjectExpAcc = accCode === '5206' || accId === 'coa-5206' || accNameLower.includes('project');

    // Project Transactions must only match Project Expense account (5206)
    const isPrj = isProjectTransaction(t) || Boolean(t.projectId || t.projectCode || (t.refNo && t.refNo.startsWith('PRJ-')));
    if (isPrj) {
        return isProjectExpAcc;
    }
    if (isProjectExpAcc && !isPrj) {
        // Non-project operating expense must NEVER match Project Expense
        return false;
    }

    // 1. Transaction accountHead direct match (by exact name or ID)
    if (t.accountHead) {
        const hLower = t.accountHead.toLowerCase().trim();
        if (hLower === accNameLower || hLower === accId.toLowerCase()) {
            return true;
        }
    }

    // 2. Check if a Journal Voucher exists for this transaction and debits this account specifically (by ID or exact Name)
    if (t.refNo && journalEntries && journalEntries.length > 0) {
        const matchedJournal = journalEntries.find(j => 
            j.refNo && j.refNo.toLowerCase().trim() === t.refNo.toLowerCase().trim()
        );
        if (matchedJournal) {
            const jDebitName = (matchedJournal.debitAccountName || '').toLowerCase().trim();
            if (
                matchedJournal.debitAccountId === accId ||
                (jDebitName && jDebitName === accNameLower)
            ) {
                return true;
            }
        }
    }

    // 3. Check if t.category matches an ExpenseHead linked to this COA account
    const categoryLower = (t.category || '').toLowerCase().trim();
    if (categoryLower) {
        const matchingHead = (expenseHeads || []).find(h => 
            h.name.toLowerCase().trim() === categoryLower || 
            (h.nameBn && h.nameBn.trim() === categoryLower) ||
            h.code.toLowerCase() === categoryLower
        );
        if (matchingHead && matchingHead.linkedAccountId) {
            const link = matchingHead.linkedAccountId.toLowerCase().trim();
            if (
                link === accId.toLowerCase() ||
                accId.toLowerCase() === `coa-${link}`
            ) {
                return true;
            }
        }
    }

    // 4. Direct exact match with category
    if (categoryLower && categoryLower === accNameLower) {
        return true;
    }

    // 5. Semantic resolver match (by unique ID or exact name)
    const resolved = resolveExpenseAccount(t.category || '', t.description || '', chartOfAccounts, expenseHeads, false);
    if (resolved && (resolved.id === accId || resolved.name.toLowerCase().trim() === accNameLower)) {
        return true;
    }

    return false;
};
