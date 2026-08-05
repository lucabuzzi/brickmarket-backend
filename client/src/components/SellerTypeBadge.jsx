import { useTranslation } from 'react-i18next';

/**
 * Small pill badge showing whether a seller is a private individual or a
 * professional/business account (users.seller_type). Renders nothing for
 * buyer-only accounts (seller_type is null), matching how the other seller
 * badges (PRO/VERIFIED/LEGENDARY) already only appear when applicable.
 */
export default function SellerTypeBadge({ sellerType, className = '' }) {
  const { t } = useTranslation();

  if (sellerType === 'professional') {
    return (
      <span className={`bg-gold-500 text-white px-1.5 py-0.5 text-[9px] rounded-md font-black uppercase ${className}`}>
        {t('profile.seller_professional')}
      </span>
    );
  }

  if (sellerType === 'private') {
    return (
      <span className={`bg-stone-700 text-stone-300 px-1.5 py-0.5 text-[9px] rounded-md font-semibold uppercase ${className}`}>
        {t('profile.seller_private')}
      </span>
    );
  }

  return null;
}
