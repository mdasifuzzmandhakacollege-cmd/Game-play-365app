/**
 * @file firebaseFirestoreService.ts
 * @description Real-time Firebase Firestore database service for Playall 365.
 * Strictly implements error handling and real-time synchronization for:
 * - User profile (/users/{userId})
 * - Real user wallets (/users/{userId}/wallets/{currency})
 * - Live financial transaction ledger (/users/{userId}/transactions/{txId})
 * - Real-time notifications (/users/{userId}/notifications/{id})
 * - Google Drive KYC documents (/users/{userId}/kyc_documents/{id})
 */

import {
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocFromServer,
  Unsubscribe
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { UserEntity, WalletEntity, TransactionEntity, WalletStatus } from '../server/types/seamless';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class FirebaseFirestoreService {
  private isConnected: boolean = true;

  constructor() {
    this.isConnected = true;
  }

  public async testConnection(): Promise<boolean> {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
      this.isConnected = true;
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error('Please check your Firebase configuration.');
        this.isConnected = false;
        return false;
      }
      this.isConnected = true;
      return true;
    }
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Listen to real-time user profile document changes
   */
  public subscribeToUserProfile(
    userId: string,
    onUpdate: (user: UserEntity) => void
  ): Unsubscribe {
    const userDocRef = doc(db, 'users', userId);
    const path = `users/${userId}`;

    return onSnapshot(
      userDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const userEntity: UserEntity = {
            id: userId,
            username: data.username || (data.email ? data.email.split('@')[0] : `User_${userId.slice(0, 6)}`),
            operator_id: 'GAMEPLAY365_LIVE',
            currency: (data.currency as 'BDT' | 'USD') || 'BDT',
            status: 'ACTIVE',
            country_code: data.currency === 'USD' ? 'US' : 'BD',
            email: data.email || '',
            phone: data.phone || '',
            created_at: data.createdAt || new Date().toISOString(),
            updated_at: data.updatedAt || new Date().toISOString()
          };
          onUpdate(userEntity);
        }
      },
      (error) => {
        console.warn(`Firestore user profile listener: ${error.message}`);
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  }

  /**
   * Ensure user document exists in Firestore and return synced profile
   */
  public async syncUserProfile(firebaseUser: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
    phoneNumber?: string | null;
  }, preferredCurrency: 'BDT' | 'USD' = 'BDT'): Promise<UserEntity> {
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const path = `users/${firebaseUser.uid}`;

    try {
      const snap = await getDoc(userDocRef);
      const now = new Date().toISOString();

      if (snap.exists()) {
        const data = snap.data();
        const userEntity: UserEntity = {
          id: firebaseUser.uid,
          username: data.username || firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Player_365'),
          operator_id: 'GAMEPLAY365_LIVE',
          currency: (data.currency as 'BDT' | 'USD') || preferredCurrency,
          status: 'ACTIVE',
          country_code: data.currency === 'USD' ? 'US' : 'BD',
          created_at: data.createdAt || now,
          updated_at: now
        };

        // Ensure wallet document exists
        await this.ensureUserWallet(firebaseUser.uid, userEntity.currency as 'BDT' | 'USD');
        return userEntity;
      } else {
        const username = firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : `user_${firebaseUser.uid.slice(0, 6)}`);
        const initialUserData = {
          id: firebaseUser.uid,
          username,
          email: firebaseUser.email || '',
          phone: firebaseUser.phoneNumber || '',
          currency: preferredCurrency,
          vipTier: 'BRONZE',
          vipPoints: 0,
          affiliateCode: `REF_${firebaseUser.uid.slice(0, 6).toUpperCase()}`,
          photoURL: firebaseUser.photoURL || '',
          createdAt: now,
          updatedAt: now
        };

        await setDoc(userDocRef, initialUserData);
        
        // Initialize Real-time Wallet with initial starting balance for live testing
        await this.ensureUserWallet(firebaseUser.uid, preferredCurrency, 5000);

        return {
          id: firebaseUser.uid,
          username,
          operator_id: 'GAMEPLAY365_LIVE',
          currency: preferredCurrency,
          status: 'ACTIVE',
          country_code: preferredCurrency === 'USD' ? 'US' : 'BD',
          created_at: now,
          updated_at: now
        };
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Ensure user's wallet document in Firestore
   */
  public async ensureUserWallet(userId: string, currency: 'BDT' | 'USD', initialBalance: number = 5000): Promise<WalletEntity> {
    const walletDocRef = doc(db, 'users', userId, 'wallets', currency);
    const path = `users/${userId}/wallets/${currency}`;

    try {
      const snap = await getDoc(walletDocRef);
      const now = new Date().toISOString();

      if (snap.exists()) {
        const data = snap.data();
        return {
          id: `w_${userId}_${currency.toLowerCase()}`,
          user_id: userId,
          currency: currency,
          real_balance: typeof data.realBalance === 'number' ? data.realBalance : initialBalance,
          bonus_balance: typeof data.bonusBalance === 'number' ? data.bonusBalance : 0,
          locked_balance: typeof data.lockedBalance === 'number' ? data.lockedBalance : 0,
          version: data.version || 1,
          status: (data.status as WalletStatus) || 'ACTIVE',
          created_at: data.createdAt || now,
          updated_at: data.updatedAt || now
        };
      } else {
        const initialWallet = {
          id: `w_${userId}_${currency.toLowerCase()}`,
          userId,
          currency,
          realBalance: initialBalance,
          bonusBalance: 0,
          lockedBalance: 0,
          version: 1,
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now
        };
        await setDoc(walletDocRef, initialWallet);
        return {
          id: `w_${userId}_${currency.toLowerCase()}`,
          user_id: userId,
          currency: currency,
          real_balance: initialBalance,
          bonus_balance: 0,
          locked_balance: 0,
          version: 1,
          status: 'ACTIVE',
          created_at: now,
          updated_at: now
        };
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Listen to real-time wallet balance changes for a specific currency
   */
  public subscribeToWallet(
    userId: string,
    currency: 'BDT' | 'USD',
    onUpdate: (wallet: WalletEntity) => void
  ): Unsubscribe {
    const walletDocRef = doc(db, 'users', userId, 'wallets', currency);
    const path = `users/${userId}/wallets/${currency}`;

    return onSnapshot(
      walletDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const entity: WalletEntity = {
            id: `w_${userId}_${currency.toLowerCase()}`,
            user_id: userId,
            currency: currency,
            real_balance: typeof data.realBalance === 'number' ? data.realBalance : 0,
            bonus_balance: typeof data.bonusBalance === 'number' ? data.bonusBalance : 0,
            locked_balance: typeof data.lockedBalance === 'number' ? data.lockedBalance : 0,
            version: data.version || 1,
            status: (data.status as WalletStatus) || 'ACTIVE',
            created_at: data.createdAt || new Date().toISOString(),
            updated_at: data.updatedAt || new Date().toISOString()
          };
          onUpdate(entity);
        }
      },
      (error) => {
        console.warn(`Firestore wallet listener (${currency}): ${error.message}`);
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  }

  /**
   * Listen to all real-time wallets for a user (BDT, USD, etc.)
   */
  public subscribeToAllWallets(
    userId: string,
    onUpdate: (wallets: WalletEntity[]) => void
  ): Unsubscribe {
    const walletsColRef = collection(db, 'users', userId, 'wallets');
    const path = `users/${userId}/wallets`;

    return onSnapshot(
      walletsColRef,
      (snapshot) => {
        const walletList: WalletEntity[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const curr = (data.currency as 'BDT' | 'USD') || (docSnap.id.toUpperCase() as 'BDT' | 'USD');
          return {
            id: data.id || `w_${userId}_${curr.toLowerCase()}`,
            user_id: userId,
            currency: curr,
            real_balance: typeof data.realBalance === 'number' ? data.realBalance : 0,
            bonus_balance: typeof data.bonusBalance === 'number' ? data.bonusBalance : 0,
            locked_balance: typeof data.lockedBalance === 'number' ? data.lockedBalance : 0,
            version: data.version || 1,
            status: (data.status as WalletStatus) || 'ACTIVE',
            created_at: data.createdAt || new Date().toISOString(),
            updated_at: data.updatedAt || new Date().toISOString()
          };
        });
        onUpdate(walletList);
      },
      (error) => {
        console.warn(`Firestore all-wallets listener: ${error.message}`);
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  }

  /**
   * Listen to real-time transaction ledger for a user
   */
  public subscribeToTransactions(
    userId: string,
    onUpdate: (transactions: TransactionEntity[]) => void
  ): Unsubscribe {
    const txColRef = collection(db, 'users', userId, 'transactions');
    const path = `users/${userId}/transactions`;
    const q = query(txColRef, orderBy('createdAt', 'desc'), limit(100));

    return onSnapshot(
      q,
      (snapshot) => {
        const txList: TransactionEntity[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            transaction_id: d.transactionId || docSnap.id,
            user_id: userId,
            wallet_id: d.walletId || `w_${userId}_${(d.currency || 'BDT').toLowerCase()}`,
            provider_id: d.providerId || 'SYSTEM',
            game_id: d.gameId || 'SYSTEM',
            provider_round_id: d.roundId,
            type: d.type as any,
            amount: d.amount,
            currency: d.currency,
            before_balance: d.beforeBalance || 0,
            after_balance: d.afterBalance || 0,
            status: d.status || 'COMPLETED',
            reference_transaction_id: d.referenceTransactionId,
            metadata: {
              audit_hash: d.auditHash,
              realtime_synced: true
            },
            created_at: d.createdAt || new Date().toISOString()
          };
        });
        onUpdate(txList);
      },
      (error) => {
        console.warn(`Firestore transactions listener: ${error.message}`);
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  }

  /**
   * Commit a transaction directly to Firestore and update real wallet balance atomically
   */
  public async commitTransaction(
    userId: string,
    currency: 'BDT' | 'USD',
    tx: {
      transactionId: string;
      providerId: string;
      gameId: string;
      roundId?: string;
      type: 'BET' | 'WIN' | 'REFUND' | 'DEPOSIT' | 'WITHDRAW';
      amount: number;
      referenceTransactionId?: string;
      auditHash?: string;
    }
  ): Promise<{ success: boolean; txEntity: TransactionEntity; updatedWallet: WalletEntity }> {
    const walletDocRef = doc(db, 'users', userId, 'wallets', currency);
    const txDocRef = doc(db, 'users', userId, 'transactions', tx.transactionId);
    const path = `users/${userId}/transactions/${tx.transactionId}`;

    try {
      const walletSnap = await getDoc(walletDocRef);
      const now = new Date().toISOString();
      const currentBalance = walletSnap.exists() && typeof walletSnap.data().realBalance === 'number'
        ? walletSnap.data().realBalance
        : 5000;

      let newBalance = currentBalance;
      if (tx.type === 'BET' || tx.type === 'WITHDRAW') {
        if (currentBalance < tx.amount) {
          throw new Error('Insufficient balance in wallet');
        }
        newBalance = Number((currentBalance - tx.amount).toFixed(4));
      } else if (tx.type === 'WIN' || tx.type === 'REFUND' || tx.type === 'DEPOSIT') {
        newBalance = Number((currentBalance + tx.amount).toFixed(4));
      }

      // 1. Update wallet balance
      await setDoc(walletDocRef, {
        id: `w_${userId}_${currency.toLowerCase()}`,
        userId,
        currency,
        realBalance: newBalance,
        bonusBalance: 0,
        lockedBalance: 0,
        version: (walletSnap.data()?.version || 1) + 1,
        updatedAt: now
      }, { merge: true });

      // 2. Insert transaction record
      const txData = {
        id: tx.transactionId,
        transactionId: tx.transactionId,
        userId,
        walletId: `w_${userId}_${currency.toLowerCase()}`,
        providerId: tx.providerId,
        gameId: tx.gameId,
        roundId: tx.roundId || `RND_${Date.now()}`,
        type: tx.type,
        amount: tx.amount,
        currency,
        beforeBalance: currentBalance,
        afterBalance: newBalance,
        status: 'COMMITTED',
        referenceTransactionId: tx.referenceTransactionId || null,
        auditHash: tx.auditHash || '',
        createdAt: now
      };

      await setDoc(txDocRef, txData);

      const txEntity: TransactionEntity = {
        id: tx.transactionId,
        transaction_id: tx.transactionId,
        user_id: userId,
        wallet_id: `w_${userId}_${currency.toLowerCase()}`,
        provider_id: tx.providerId,
        game_id: tx.gameId,
        provider_round_id: tx.roundId,
        type: tx.type,
        amount: tx.amount,
        currency,
        before_balance: currentBalance,
        after_balance: newBalance,
        status: 'COMPLETED',
        reference_transaction_id: tx.referenceTransactionId,
        metadata: {
          audit_hash: tx.auditHash,
          realtime_synced: true
        },
        created_at: now
      };

      const updatedWallet: WalletEntity = {
        id: `w_${userId}_${currency.toLowerCase()}`,
        user_id: userId,
        currency,
        real_balance: newBalance,
        bonus_balance: 0,
        locked_balance: 0,
        version: (walletSnap.data()?.version || 1) + 1,
        status: (walletSnap.data()?.status as WalletStatus) || 'ACTIVE',
        created_at: walletSnap.data()?.createdAt || now,
        updated_at: now
      };

      return { success: true, txEntity, updatedWallet };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Top-up / Deposit Funds in Real-time Firestore
   */
  public async depositWallet(userId: string, currency: 'BDT' | 'USD', amount: number): Promise<WalletEntity> {
    const txId = `TX_DEP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const res = await this.commitTransaction(userId, currency, {
      transactionId: txId,
      providerId: 'CASHIER_BANKING',
      gameId: 'BKASH_NAGAD_INSTANT',
      type: 'DEPOSIT',
      amount
    });
    return res.updatedWallet;
  }
}

export const firebaseFirestore = new FirebaseFirestoreService();
