/**
 * Migration: Make the ClutchVault shop purchase (wallet.js /buy-product) atomic
 * and race-condition-safe, matching the standard already used for contest slot
 * purchases (buy_contest_slot).
 *
 * Problem fixed: the previous /buy-product handler did SELECT balance, check,
 * then separate UPDATE wallet / INSERT transaction / UPDATE stock calls with no
 * row locking. Two near-simultaneous requests (double-click, retried request,
 * two browser tabs) could both read the same starting balance/stock, both pass
 * the check, and both deduct — overspending the wallet or overselling stock.
 *
 * Fix: a single PL/pgSQL function that locks the wallet row and the product row
 * with FOR UPDATE before validating and writing, so a second concurrent call
 * blocks until the first fully commits and then re-validates against the
 * already-updated balance/stock.
 *
 * Idempotent: safe to run more than once.
 * Run with: node src/db/migrate_shop_purchase_atomic.js
 */
require('dotenv').config();
const { query } = require('./index');

async function migrate() {
  console.log('Running shop purchase atomicity migration...');

  await query(`
    CREATE OR REPLACE FUNCTION public.buy_product(
        target_user_id UUID,
        target_product_id UUID
    )
    RETURNS JSON AS $$
    DECLARE
        current_wallet_credits NUMERIC;
        product_price NUMERIC;
        product_stock INTEGER;
        product_title VARCHAR;
    BEGIN
        -- Lock the wallet row first, then the product row, in a fixed order
        -- (wallet -> product) so two concurrent purchases of different products
        -- by the same user can never deadlock against each other.
        SELECT balance_credits INTO current_wallet_credits
        FROM public.user_wallets
        WHERE user_id = target_user_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN json_build_object('success', false, 'message', 'Wallet not found for user.');
        END IF;

        SELECT market_value, stock, title INTO product_price, product_stock, product_title
        FROM public.products
        WHERE id = target_product_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN json_build_object('success', false, 'message', 'Product not found.');
        END IF;

        IF product_stock <= 0 THEN
            RETURN json_build_object('success', false, 'message', 'Product is out of stock.');
        END IF;

        IF current_wallet_credits < product_price THEN
            RETURN json_build_object(
                'success', false,
                'message', 'Insufficient funds.',
                'requiredCredits', product_price,
                'availableCredits', current_wallet_credits
            );
        END IF;

        UPDATE public.user_wallets
        SET balance_credits = balance_credits - product_price,
            updated_at = now()
        WHERE user_id = target_user_id;

        INSERT INTO public.credit_transactions (user_id, amount, type, reference_id)
        VALUES (target_user_id, -product_price, 'shop_purchase', target_product_id::varchar);

        UPDATE public.products
        SET stock = stock - 1
        WHERE id = target_product_id;

        RETURN json_build_object(
            'success', true,
            'message', 'Purchase successful.',
            'productTitle', product_title,
            'price', product_price,
            'newBalance', current_wallet_credits - product_price
        );
    EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', SQLERRM);
    END;
    $$ LANGUAGE plpgsql;
  `);

  console.log('✅  public.buy_product() is live — shop purchases are now row-locked and race-condition-safe.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
